'use strict';
(() => {
  const $=id=>document.getElementById(id);
  let promotions=[], products=[], rows=[], listVersion=0, pending=false;
  const valueFilters={category:null,sale:null,enabled:null,promotion:null}, snapshots=new Map(), dirty=new Set();
  const filterLabels={category:'상품 종류',sale:'이번 달 판매',enabled:'적용/미적용',promotion:'프로모션'};
  let activeFilter=null, filterTrigger=null;
  const normalize=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('ko').replace(/\s/g,'');
  const rowValue=row=>JSON.stringify([...row.querySelectorAll('input,select')].map(el=>el.value));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const collator=new Intl.Collator('ko',{numeric:true});
  function message(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
  function login(){listVersion++;products=[];rows=[];promotions=[];snapshots.clear();dirty.clear();$('products').replaceChildren();resetFilters();$('product-count').textContent='회사를 선택해 주세요.';$('manage-panel').hidden=true;$('login-panel').hidden=false;$('login-form').reset();}
  async function api(path,method='GET',body){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);try{const res=await fetch('/api/rental/manage/'+path,{method,credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:method==='GET'?{}:{'Content-Type':'application/json','X-Rental-Manage':'1'},...(body!==undefined?{body:JSON.stringify(body)}:{})});const data=await res.json();if(res.status===401&&path!=='login'){login();throw new Error('다시 로그인해 주세요.');}if(!res.ok)throw new Error(data.error||'처리하지 못했습니다. 다시 시도해 주세요.');return data;}finally{clearTimeout(timer);}}
  async function run(fn){if(pending)return;pending=true;$('manage-panel').setAttribute('aria-busy','true');const controls=[...document.querySelectorAll('nav button,.filters button,.filters input,.filters select,#login-form button,#password-form button')].map(el=>[el,el.disabled]);controls.forEach(([el])=>el.disabled=true);try{await fn();}catch(e){message(e.name==='AbortError'?'연결이 늦어지고 있어요. 다시 시도해 주세요.':e.message,true);}finally{pending=false;$('manage-panel').removeAttribute('aria-busy');controls.forEach(([el,disabled])=>{if(el.isConnected)el.disabled=disabled;});}}
  function tab(password){$('promo-panel').hidden=password;$('password-panel').hidden=!password;$('promo-tab').setAttribute('aria-pressed',String(!password));$('password-tab').setAttribute('aria-pressed',String(password));}
  function promoFor(id){return promotions.find(p=>String(p.product_id)===String(id));}
  function rowMarkup(p){const promo=promoFor(p.id),label=esc(p.name||p.model_code),id=esc(p.id),image=typeof p.image_file==='string'&&/^[a-zA-Z0-9_.-]+$/.test(p.image_file);
    return `<tr data-product="${id}" data-name="${esc(normalize(p.name||p.model_code))}" data-model="${esc(normalize(p.model_code))}" data-category="${esc(p.category||'종류 없음')}" data-sale="${p.on_sale?'판매 중':'판매 없음'}" data-promotion="${promo?'있음':'없음'}"><td class="photo-cell">${image?`<img src="../assets/products/${esc(p.image_file)}" alt="" loading="lazy" width="44" height="52">`:'<span class="no-photo">사진 없음</span>'}</td><th scope="row" class="name-cell">${label}<small class="registration">${promo?'프로모션 있음':'프로모션 없음'}</small></th><td>${esc(p.category)}</td><td class="model">${esc(p.model_code)}</td><td>${p.on_sale?'판매 중':'판매 없음'}</td><td class="promotion-cell">${promo?'있음':'없음'}</td><td><input name="copy" maxlength="40" value="${esc(promo?.copy||'')}" aria-label="${label} 프로모션 문구" aria-describedby="row-status-${id}"></td><td><input name="starts_on" type="date" value="${esc(promo?.starts_on||'')}" aria-label="${label} 시작일"></td><td><input name="ends_on" type="date" value="${esc(promo?.ends_on||'')}" aria-label="${label} 종료일"></td><td><select name="enabled" aria-label="${label} 적용 여부"><option value="false"${promo?.enabled?'':' selected'}>미적용</option><option value="true"${promo?.enabled?' selected':''}>적용</option></select></td><td><div class="row-actions"><button type="button" data-save>저장</button><button type="button" data-delete${promo?'':' hidden'}>삭제</button></div><p id="row-status-${id}" class="row-status" role="status" aria-live="polite"></p></td></tr>`;
  }
  function closeFilter(){if($('filter-dialog').open)$('filter-dialog').close();}
  function resetFilters(){closeFilter();for(const key of Object.keys(valueFilters))valueFilters[key]=null;$('filter-name').value='';$('filter-model').value='';updateFilterTitles();}
  function updateFilterTitles(){document.querySelectorAll('[data-filter]').forEach(button=>{const on=valueFilters[button.dataset.filter]!==null;button.classList.toggle('is-filtered',on);button.querySelector('.filter-state').textContent=on?' (필터 적용 중)':'';});for(const id of ['filter-name','filter-model'])$(id).closest('th').classList.toggle('is-filtered',!!normalize($(id).value));}
  function valueOf(row,key){return key==='enabled'?(row.querySelector('[name=enabled]').value==='true'?'적용':'미적용'):row.dataset[key];}
  function trackDirty(row){if(rowValue(row)===snapshots.get(row.dataset.product))dirty.delete(row.dataset.product);else dirty.add(row.dataset.product);}
  function markSaved(row){snapshots.set(row.dataset.product,rowValue(row));dirty.delete(row.dataset.product);filterProducts();}
  function filterProducts(){const name=normalize($('filter-name').value),model=normalize($('filter-model').value);let count=0;for(const row of rows){row.hidden=!row.dataset.name.includes(name)||!row.dataset.model.includes(model)||Object.entries(valueFilters).some(([key,values])=>values!==null&&!values.has(valueOf(row,key)));if(!row.hidden)count++;}updateFilterTitles();$('product-count').textContent=$('brand').value?`${products.length}개 중 ${count}개`+(dirty.size?` · 저장 안 한 행 ${dirty.size}개`:'')+(products.length===1000?' · API 조회 상한 1,000개':'')+(products.length&&!count?' · 필터 결과가 없어요.':''): '회사를 선택해 주세요.';}
  function renderFilterOptions(){const counts=new Map();for(const row of rows){const value=valueOf(row,activeFilter);counts.set(value,(counts.get(value)||0)+1);}const selected=valueFilters[activeFilter];$('filter-options').innerHTML=[...counts].sort(([a],[b])=>collator.compare(a,b)).map(([value,count])=>`<label class="filter-option"><input type="checkbox" value="${esc(value)}"${selected===null||selected.has(value)?' checked':''}><span>${esc(value)}</span><small>${count}개</small></label>`).join('');$('filter-empty').hidden=counts.size>0;}
  function openFilter(button){if(pending)return;activeFilter=button.dataset.filter;filterTrigger=button;$('filter-heading').textContent=filterLabels[activeFilter]+' 필터';renderFilterOptions();button.setAttribute('aria-expanded','true');$('filter-dialog').showModal();$('close-filter').focus();}
  async function listProducts(){const ticket=++listVersion,brand=$('brand').value;products=[];rows=[];snapshots.clear();dirty.clear();$('products').replaceChildren();resetFilters();if(!brand){$('product-count').textContent='회사를 선택해 주세요.';return;}$('product-count').textContent='제품 전체를 불러오는 중이에요.';try{const [data,promos]=await Promise.all([api('products?brand='+encodeURIComponent(brand)),api('promotions')]);if(ticket!==listVersion)return;promotions=promos.items;products=data.items.sort((a,b)=>collator.compare(a.category||'',b.category||'')||collator.compare(a.name||'',b.name||'')||collator.compare(String(a.id),String(b.id)));$('products').innerHTML=products.map(rowMarkup).join('');rows=[...$('products').rows];rows.forEach(row=>snapshots.set(row.dataset.product,rowValue(row)));filterProducts();$('product-scroll').scrollTop=0;$('product-scroll').scrollLeft=0;}catch(e){if(ticket===listVersion)$('product-count').textContent='목록을 불러오지 못했어요. 회사를 다시 선택해 주세요.';throw e;}}
  function rowStatus(row,text,error=false){const el=row.querySelector('.row-status');el.textContent=text;el.classList.toggle('error',error);row.querySelectorAll('input,select').forEach(el=>el.removeAttribute('aria-invalid'));}
  async function rowRequest(row,...args){
    // A late save/delete response must not overwrite edits made while it was pending.
    const controls=[...row.querySelectorAll('input,select,button')].map(el=>[el,el.disabled]);
    row.setAttribute('aria-busy','true');
    controls.forEach(([el])=>el.disabled=true);
    try{return await api(...args);}
    finally{
      row.removeAttribute('aria-busy');
      controls.forEach(([el,disabled])=>{if(el.isConnected)el.disabled=disabled;});
    }
  }
  async function saveRow(row){const p=products.find(p=>String(p.id)===row.dataset.product),old=promoFor(p.id),get=name=>row.querySelector(`[name="${name}"]`).value;
    const b={product_id:String(p.id),title:old?.title||String(p.name||p.model_code).slice(0,80),copy:get('copy').trim(),starts_on:get('starts_on'),ends_on:get('ends_on'),enabled:get('enabled')==='true'};
    rowStatus(row,'');
    if(!old&&!b.enabled&&!b.copy&&!b.starts_on&&!b.ends_on){rowStatus(row,'미적용 상태예요.');return;}
    if(!b.enabled&&old){b.copy=old.copy;b.starts_on=old.starts_on;b.ends_on=old.ends_on;}
    const invalid=['copy','starts_on','ends_on'].filter(key=>!b[key]);if(b.starts_on>b.ends_on)invalid.push('ends_on');
    if(invalid.length){rowStatus(row,'문구·시작일·종료일을 확인해 주세요. 종료일은 시작일 이후여야 해요.',true);invalid.forEach(key=>row.querySelector(`[name="${key}"]`).setAttribute('aria-invalid','true'));row.querySelector(`[name="${invalid[0]}"]`).focus();return;}
    try{const result=await rowRequest(row,'promotions'+(old?'/'+encodeURIComponent(old.id):''),old?'PUT':'POST',b);promotions=promotions.filter(p=>String(p.product_id)!==b.product_id);promotions.push({...b,id:result.id||old?.id});row.querySelector('[name=copy]').value=b.copy;row.querySelector('[name=starts_on]').value=b.starts_on;row.querySelector('[name=ends_on]').value=b.ends_on;row.querySelector('.registration').textContent='프로모션 있음';row.dataset.promotion='있음';row.querySelector('.promotion-cell').textContent='있음';row.querySelector('[data-delete]').hidden=false;rowStatus(row,b.enabled?'적용으로 저장했어요.':'미적용으로 저장했어요. 문구와 기간은 보존했어요.');markSaved(row);message('저장했어요.');}catch(e){if(row.isConnected)rowStatus(row,e.name==='AbortError'?'연결이 늦어요. 다시 저장해 주세요.':e.message,true);throw e;}}
  async function deleteRow(row){const old=promoFor(row.dataset.product);if(!old||!confirm('이 프로모션을 삭제할까요?'))return;try{await rowRequest(row,'promotions/'+encodeURIComponent(old.id),'DELETE',{});promotions=promotions.filter(p=>String(p.id)!==String(old.id));row.querySelectorAll('input').forEach(el=>el.value='');row.querySelector('[name=enabled]').value='false';row.querySelector('[data-delete]').hidden=true;row.querySelector('.registration').textContent='프로모션 없음';row.dataset.promotion='없음';row.querySelector('.promotion-cell').textContent='없음';rowStatus(row,'삭제했어요. 미적용 상태예요.');markSaved(row);message('삭제했어요.');}catch(e){if(row.isConnected)rowStatus(row,e.message,true);throw e;}}
  async function manage(){$('login-panel').hidden=true;$('manage-panel').hidden=false;tab(false);const brands=(await api('brands')).items;$('brand').innerHTML='<option value="">회사를 선택해 주세요</option>'+brands.map(b=>`<option value="${esc(b.brand_code)}">${esc(b.brand)}</option>`).join('');message('회사를 선택해 프로모션을 설정해 주세요.');}
  $('login-form').onsubmit=e=>{e.preventDefault();const f=e.currentTarget;run(async()=>{await api('login','POST',{username:f.elements.username.value,password:f.elements.password.value});f.reset();await manage();});};
  $('brand').onchange=()=>run(listProducts);
  for(const id of ['filter-name','filter-model'])$(id).oninput=filterProducts;
  $('clear-filters').onclick=()=>{resetFilters();filterProducts();};
  document.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>openFilter(button));
  $('close-filter').onclick=closeFilter;
  $('filter-dialog').addEventListener('close',()=>{if(filterTrigger){filterTrigger.setAttribute('aria-expanded','false');if(filterTrigger.isConnected&&filterTrigger.getClientRects().length)filterTrigger.focus();}activeFilter=null;});
  $('filter-options').onchange=()=>{valueFilters[activeFilter]=new Set([...$('filter-options').querySelectorAll('input:checked')].map(el=>el.value));filterProducts();};
  $('select-all').onclick=()=>{valueFilters[activeFilter]=null;renderFilterOptions();filterProducts();};
  $('select-none').onclick=()=>{valueFilters[activeFilter]=new Set();renderFilterOptions();filterProducts();};
  $('products').addEventListener('input',e=>{const row=e.target.closest('tr');if(row){trackDirty(row);filterProducts();}});
  $('products').addEventListener('change',e=>{const row=e.target.closest('tr');if(row){trackDirty(row);filterProducts();}});
  $('products').onclick=e=>{const button=e.target.closest('button');if(!button||pending)return;const row=button.closest('tr');if(button.hasAttribute('data-save'))run(()=>saveRow(row));else if(button.hasAttribute('data-delete'))run(()=>deleteRow(row));};
  $('promo-tab').onclick=()=>tab(false);$('password-tab').onclick=()=>tab(true);
  $('logout').onclick=()=>run(async()=>{await api('logout','POST',{});login();message('로그아웃했어요.');});
  $('password-form').onsubmit=e=>{e.preventDefault();const f=e.currentTarget;run(async()=>{if(f.elements.newPassword.value!==f.elements.confirmPassword.value)throw new Error('새 비밀번호가 일치하지 않아요.');await api('password','POST',{currentPassword:f.elements.currentPassword.value,newPassword:f.elements.newPassword.value});f.reset();login();message('비밀번호를 변경했어요. 다시 로그인해 주세요.');});};
  login();
})();

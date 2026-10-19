(() => {
'use strict';
const section=document.getElementById('how');if(!section)return;
const $=id=>document.getElementById('promotion-'+id);
const filters={category:'all',brand:'all',budget:'all',care:'all'};
const careNames={visit:'방문 관리',self:'직접 관리',none:'관리 없음'};
let expanded=false,facets=null,cursor=null,items=[],sequence=0,active=null,busy=false,started=false,yearMonth=null;
function node(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
function status(text){$('status').textContent=text;}
function button(text,action){const b=node('button',text);b.type='button';b.onclick=action;return b;}
function controls(){
 const focused=document.activeElement?.dataset?.category;
 $('categories').replaceChildren();
 const values=[{value:'all',label:'전체'},...(facets?.categories||[]).map(x=>({...x,label:x.value}))];
 values.forEach((c,i)=>{const b=button(c.label,()=>{filters.category=c.value;load();});b.dataset.category=c.value;b.setAttribute('aria-pressed',String(filters.category===c.value));b.hidden=!expanded&&i>4;$('categories').append(b);});
 $('expand').hidden=values.length<=5;$('expand').setAttribute('aria-expanded',String(expanded));$('expand').textContent=expanded?'종류 접기':'더 많은 종류';
 if(focused)$('categories').querySelectorAll('button').forEach(b=>{if(b.dataset.category===focused&&!b.hidden)b.focus({preventScroll:true});});
 for(const [key,facet,label] of [['brand','brands','브랜드 전체'],['budget','budgets','예산 전체'],['care','careModes','관리 전체']]){
  const select=$(key);select.replaceChildren(new Option(label,'all'));
  (facets?.[facet]||[]).forEach(x=>select.add(new Option(x.label+' ('+x.count+')',String(x.value))));if(filters[key]!=='all'&&![...select.options].some(o=>o.value===filters[key]))select.add(new Option(key==='budget'?(filters[key]==='0'?'월 1만 원 미만':'월 '+Number(filters[key])/10000+'만 원대까지'):(careNames[filters[key]]||filters[key]),filters[key]));select.value=filters[key];
 }
}
function renderCard(c){
 const a=node('a',undefined,'promotion-card');a.dataset.id=c.id;
 a.href='/find/?'+new URLSearchParams({category:c.category,source:'promotion'});
 const copy=node('p',undefined,'promotion-copy');
 const current=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
 if(c.promotion.source==='admin')copy.append(node('span',yearMonth===current?'이달 추천':'추천 혜택','promotion-badge'));
 copy.append(document.createTextNode(c.promotion.copy));a.append(copy);
 const product=node('div',undefined,'promotion-product'),photo=node('div',undefined,'promotion-photo');
 const image=typeof c.imageUrl==='string'&&/^\/sites\/rentalfit-v2\/assets\/products\/[A-Za-z0-9][A-Za-z0-9_-]*\.(webp|png|jpe?g)$/.test(c.imageUrl)?c.imageUrl:null;
 if(image){const img=node('img');img.alt='';img.loading='lazy';img.decoding='async';img.width=120;img.height=150;img.onerror=()=>photo.replaceChildren(node('span','사진 준비 중'));img.src=image;photo.append(img);}else photo.textContent='사진 준비 중';
 const detail=node('div');detail.append(node('p',c.brand,'promotion-brand'),node('h3',c.title));
 const fee=node('p',c.feeLabel,'promotion-fee');fee.append(node('span',c.feeBandLabel,'promotion-price'));detail.append(fee);product.append(photo,detail);a.append(product);
 const term=c.contractMonths.min===c.contractMonths.max?c.contractMonths.min:c.contractMonths.min+'~'+c.contractMonths.max;
 a.append(node('p','약정 '+term+'개월 · '+c.careModes.map(x=>careNames[x]).join(' / '),'promotion-terms'),node('p','조건별 혜택이 달라요. 상담에서 확인해 주세요.','promotion-explain'),node('span','우리 집 조건으로 찾기 →','promotion-cta'));
 return a;
}
function renderCards(append){
 const previous=new Set([...$('cards').children].map(x=>x.dataset.id));
 if(!append)$('cards').replaceChildren();
 let first=null;items.forEach(c=>{if(append&&previous.has(c.id))return;const a=renderCard(c);$('cards').append(a);first ||= a;});
 if(append&&first)first.focus();
}
function message(text,action,label){$('message').replaceChildren(node('p',text));if(action)$('message').append(button(label,action));}
function reset(){Object.keys(filters).forEach(k=>filters[k]='all');load();}
async function load(append=false,recovery=0,notice=''){
 if(append&&busy)return;
 if(!append){cursor=null;items=[];$('cards').replaceChildren();$('more').hidden=true;}
 active?.abort();const controller=new AbortController();active=controller;const ticket=++sequence;busy=true;
 $('results').setAttribute('aria-busy','true');$('more').disabled=true;$('message').replaceChildren();status(append?'추가 제품을 불러오고 있어요.':'혜택을 불러오고 있어요.');
 const q=new URLSearchParams();Object.entries(filters).forEach(([k,v])=>{if(v!=='all')q.set(k,v);});if(append&&cursor)q.set('cursor',cursor);
 const timeout=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetch('/api/rental/promotions?'+q,{signal:controller.signal,credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
  if(ticket!==sequence)return;
  if(response.status===429)throw Object.assign(new Error('rate-limit'),{status:429});
  if(response.status===409&&recovery<1){await load(false,recovery+1,'혜택이 바뀌어 처음부터 다시 불러왔어요. ');return;}
  let data=response.ok?await response.json():null;if(ticket!==sequence)return;
  if(data&&(!Array.isArray(data.items)||!data.facets||!Number.isSafeInteger(data.total)))throw new Error('invalid');
  const facetKeys=[['category','categories'],['brand','brands'],['budget','budgets'],['care','careModes']];
  const selectedMissing=data&&facetKeys.some(([key,facet])=>filters[key]!=='all'&&!data.facets[facet].some(x=>String(x.value)===filters[key]));
  // Disambiguate a zero-match combination from a value removed by a catalog update.
  // Only a removed value is reset; other selections survive.
  if(recovery<4&&(response.status===400||selectedMissing)){
   const baseline=await fetch('/api/rental/promotions',{signal:controller.signal,cache:'no-store',credentials:'same-origin',headers:{Accept:'application/json'}});
   if(baseline.status===429)throw Object.assign(new Error('rate-limit'),{status:429});
   if(!baseline.ok)throw new Error('unavailable');const full=await baseline.json();if(ticket!==sequence)return;
   let changed=false;
   for(const [key,facet] of facetKeys){if(filters[key]!=='all'&&!full.facets[facet].some(x=>String(x.value)===filters[key])){filters[key]='all';changed=true;}}
   if(changed){facets=full.facets;controls();await load(false,recovery+1,'선택 조건이 바뀌어 사라진 항목을 초기화했어요. ');return;}
  }
  if(!response.ok)throw new Error('unavailable');
  facets=data.facets;yearMonth=data.yearMonth;
  cursor=data.nextCursor;items=append?[...new Map([...items,...data.items].map(c=>[c.id,c])).values()]:data.items;
  controls();renderCards(append);$('more').hidden=!cursor;
  const current=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
  document.getElementById('how-title').textContent=yearMonth&&yearMonth!==current?'최근 등록 혜택':'이달의 프로모션 제품';
  document.querySelectorAll('a[href="#how"]').forEach(a=>a.textContent=yearMonth&&yearMonth!==current?'최근 등록 혜택':'이달의 프로모션');
  $('month').textContent=yearMonth?yearMonth.replace('-', '년 ')+'월 기준':'등록된 혜택을 준비하고 있어요';
  status(notice+'조건에 맞는 제품 '+data.total+'개 · 관리자 추천 우선');
  if(!data.total){if(!facets.categories.length){message('등록된 프로모션을 준비하고 있어요.');const link=node('a','맞춤 찾기');link.href='/find/';$('message').append(link);}else message('고른 조건의 프로모션이 없어요. 조건을 바꿔보세요.',reset,'필터 초기화');}
 }catch(e){if(ticket!==sequence)return;const text=e.status===429?'요청이 많아요. 잠시 후 다시 시도해 주세요.':'혜택을 불러오지 못했어요.';status(text);message(text,()=>load(append),e.status===429?'잠시 후 다시 시도':'재시도');if(append){$('more').disabled=false;$('more').focus();}}
 finally{clearTimeout(timeout);if(ticket===sequence){busy=false;$('results').setAttribute('aria-busy','false');$('more').disabled=false;}}
}
$('expand').onclick=()=>{expanded=!expanded;controls();};
for(const key of ['brand','budget','care'])$(key).onchange=()=>{filters[key]=$(key).value;load();};
$('more').onclick=()=>load(true);
controls();
const observer=new IntersectionObserver(entries=>{if(!started&&entries.some(e=>e.isIntersecting)){started=true;observer.disconnect();load();}},{rootMargin:'300px'});observer.observe(section);
})();

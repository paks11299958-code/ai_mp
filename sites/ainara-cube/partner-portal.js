const API = '/api/partner-auth';
const STATUS = { PENDING: '접수 완료', CONTACTED: '담당자 연락 완료', APPROVED: '파트너 승인', REJECTED: '검토 종료' };

export function initPartnerPortal(root = document) {
  const modal = root.querySelector('[data-partner-modal]');
  if (!modal) return;
  const dialog = modal.querySelector('[data-partner-dialog]');
  const views = [...modal.querySelectorAll('[data-partner-view]')];
  let returnFocus = null;
  const refKey = 'aiworldPartnerRef';
  const incomingRef = new URLSearchParams(location.search).get('ref')?.trim();
  if (incomingRef && /^[a-zA-Z0-9._-]{4,40}$/.test(incomingRef)) localStorage.setItem(refKey, incomingRef);
  const storedRef = localStorage.getItem(refKey) || '';
  const refInput = modal.querySelector('[name="referrer"]');
  if (storedRef && refInput) { refInput.value = storedRef; refInput.readOnly = true; modal.querySelector('[data-partner-ref-note]').hidden = false; }

  const showView = name => views.forEach(view => { view.hidden = view.dataset.partnerView !== name; });
  const open = (name, trigger) => {
    returnFocus = trigger || root.activeElement;
    showView(name);
    modal.hidden = false;
    root.body?.setAttribute('data-partner-open', 'true');
    requestAnimationFrame(() => modal.querySelector(`[data-partner-view="${name}"] input`)?.focus());
  };
  const close = () => {
    modal.hidden = true;
    root.body?.removeAttribute('data-partner-open');
    returnFocus?.focus?.();
  };
  const request = async (path, options = {}) => {
    const response = await fetch(API + path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '요청을 처리하지 못했습니다.');
    return data;
  };
  const showAccount = data => {
    modal.querySelector('[data-partner-name]').textContent = data.partner.name;
    modal.querySelector('[data-partner-status]').textContent = STATUS[data.application?.status] || '신청 확인 중';
    showView('account');
  };

  root.querySelectorAll('[data-partner-apply]').forEach(button => button.addEventListener('click', () => open('register', button)));
  root.querySelectorAll('[data-partner-login]').forEach(button => button.addEventListener('click', async () => {
    open('login', button);
    try { showAccount(await request('/me')); } catch { /* signed-out state */ }
  }));
  modal.querySelector('[data-partner-close]').addEventListener('click', close);
  modal.querySelector('[data-partner-show-login]').addEventListener('click', () => showView('login'));
  modal.querySelector('[data-partner-show-register]').addEventListener('click', () => showView('register'));
  modal.addEventListener('click', event => { if (event.target === modal) close(); });
  root.addEventListener('keydown', event => { if (event.key === 'Escape' && !modal.hidden) close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll('button:not([hidden]),input:not([hidden])')].filter(el => !el.disabled && el.offsetParent !== null);
    if (!items.length) return;
    if (event.shiftKey && root.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
    else if (!event.shiftKey && root.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
  });

  modal.querySelector('[data-partner-register]').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const error = modal.querySelector('[data-partner-register-error]');
    const submit = form.querySelector('[type="submit"]');
    error.textContent = '';
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    if (values.password !== values.passwordConfirm) { error.textContent = '암호 확인이 일치하지 않습니다.'; return; }
    submit.disabled = true;
    try {
      await request('/register', { method: 'POST', body: JSON.stringify({ ...values, privacyAgreed: values.privacyAgreed === 'on' }) });
      localStorage.removeItem(refKey);
      form.reset();
      showView('success');
      modal.querySelector('[data-partner-close]').focus();
    } catch (e) { error.textContent = e.message; }
    finally { submit.disabled = false; }
  });

  modal.querySelector('[data-partner-login-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const error = modal.querySelector('[data-partner-login-error]');
    const submit = form.querySelector('[type="submit"]');
    error.textContent = '';
    if (!form.reportValidity()) return;
    submit.disabled = true;
    try { showAccount(await request('/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) })); form.reset(); }
    catch (e) { error.textContent = e.message; }
    finally { submit.disabled = false; }
  });

  modal.querySelector('[data-partner-logout]').addEventListener('click', async () => {
    try { await request('/logout', { method: 'POST', body: '{}' }); } finally { close(); }
  });
  modal.querySelector('[data-partner-open-dashboard]').addEventListener('click', async () => {
    const error = modal.querySelector('[data-partner-dashboard-error]'); error.textContent = '';
    try {
      const data = await request('/dashboard');
      modal.querySelector('[data-partner-my-link]').value = data.referralLink;
      const list = modal.querySelector('[data-partner-referrals]'); list.textContent = '';
      if (!data.referrals.length) { const empty=document.createElement('p');empty.className='partner-intro';empty.textContent='아직 소개 링크로 가입한 회원이 없습니다.';list.append(empty); }
      data.referrals.forEach(item => {
        const row=document.createElement('div');row.className='partner-row';
        const text=document.createElement('span');const name=document.createElement('b');name.textContent=item.name;const meta=document.createElement('small');meta.textContent=`${item.loginId} · ${STATUS[item.status]||item.status}`;text.append(name,meta);row.append(text);
        if (data.partner.approvalRole==='APPROVER' && ['PENDING','CONTACTED'].includes(item.status)) { const button=document.createElement('button');button.className='partner-mini';button.type='button';button.textContent='승인';button.addEventListener('click',async()=>{button.disabled=true;try{await request(`/referrals/${item.id}/approve`,{method:'PATCH',body:'{}'});button.textContent='승인 완료';meta.textContent=`${item.loginId} · 파트너 승인`;}catch(e){error.textContent=e.message;button.disabled=false;}});row.append(button); }
        list.append(row);
      });
      const approvalSection = modal.querySelector('[data-partner-approval-section]');
      approvalSection.hidden = data.partner.approvalRole !== 'APPROVER';
      if (!approvalSection.hidden) {
        const queue = modal.querySelector('[data-partner-approval-queue]'); queue.textContent = '';
        if (!data.approvalQueue.length) { const empty=document.createElement('p');empty.className='partner-intro';empty.textContent='승인을 기다리는 신청이 없습니다.';queue.append(empty); }
        data.approvalQueue.forEach(item => {
          const row=document.createElement('div');row.className='partner-row';const text=document.createElement('span');const name=document.createElement('b');name.textContent=item.name;const meta=document.createElement('small');meta.textContent=`${item.loginId} · 추천인 ${item.referrerLoginId||'없음'} · ${STATUS[item.status]||item.status}`;text.append(name,meta);const button=document.createElement('button');button.className='partner-mini';button.type='button';button.textContent='승인';button.addEventListener('click',async()=>{button.disabled=true;try{await request(`/referrals/${item.id}/approve`,{method:'PATCH',body:'{}'});button.textContent='승인 완료';row.dataset.done='true';}catch(e){error.textContent=e.message;button.disabled=false;}});row.append(text,button);queue.append(row);
        });
      }
      showView('dashboard');
    } catch(e) { error.textContent=e.message; }
  });
  modal.querySelector('[data-partner-copy-link]').addEventListener('click', async () => { await navigator.clipboard.writeText(modal.querySelector('[data-partner-my-link]').value); modal.querySelector('[data-partner-copy-link]').textContent='복사되었습니다'; });
  modal.querySelector('[data-partner-back-account]').addEventListener('click', () => showView('account'));
}

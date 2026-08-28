const API = '/api/partner-auth';
const STATUS = { PENDING: '접수 완료', CONTACTED: '담당자 연락 완료', APPROVED: '파트너 승인', REJECTED: '검토 종료' };

export function initPartnerPortal(root = document) {
  const modal = root.querySelector('[data-partner-modal]');
  if (!modal) return;
  const dialog = modal.querySelector('[data-partner-dialog]');
  const views = [...modal.querySelectorAll('[data-partner-view]')];
  let returnFocus = null;

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
}

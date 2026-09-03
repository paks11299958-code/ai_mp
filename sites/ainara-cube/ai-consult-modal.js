export function initAiConsultModal(document) {
  const modal = document.querySelector('[data-ai-consult-modal]');
  const closeButton = document.querySelector('[data-ai-consult-close]');
  const openButtons = Array.from(document.querySelectorAll('[data-ai-consult-open]'));

  if (!modal || !closeButton) return;

  let returnFocus = null;

  const openModal = (event) => {
    event?.preventDefault();
    returnFocus = event?.currentTarget || null;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    // ★상담창을 열면 서아가 한 번 인사한다. 인사 영상은 대사가 있어 1회만 재생되고,
    //   끝나면 avatar.html 이 스스로 IDLE 로 돌아간다(여기서 되돌릴 필요 없다).
    setAvatarState(document, 'GREETING');
    closeButton.focus?.();
  };

  const closeModal = () => {
    modal.hidden = true;
    document.body.style.overflow = '';
    setAvatarState(document, 'IDLE');
    returnFocus?.focus?.();
  };

  openButtons.forEach((button) => button.addEventListener('click', openModal));
  closeButton.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) closeModal();
  });

  initAiConsultAssistant(document);
}

const AVATAR_STATES = new Set(['GREETING', 'IDLE', 'THINKING', 'SPEAKING', 'FALLBACK']);

export function setAvatarState(document, state) {
  if (!AVATAR_STATES.has(state)) return false;
  const frame = document.querySelector('[data-ai-consult-avatar]');
  const origin = document.defaultView?.location?.origin;
  if (!frame?.contentWindow || !origin) return false;
  frame.contentWindow.postMessage({ type: 'SEOA_AVATAR_STATE', state }, origin);
  return true;
}

const GEMINI_WEBHOOK = 'https://n8n.dbzone.kr/webhook/b67f63e8-2302-44d5-b129-78e0f2068821';
const INQUIRY_WEBHOOK = 'https://n8n.dbzone.kr/webhook/eb26940e-1e5f-49dd-bef6-3c92cb9abbb4';

function appendMessage(document, log, role, text) {
  const message = document.createElement('p');
  message.className = `ai-chat-message ${role}`;
  message.textContent = text;
  log.appendChild(message);
  log.scrollTop = log.scrollHeight;
}

async function postJson(url, body, timeoutMs = 45_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    return contentType.includes('application/json') ? response.json() : {};
  } finally {
    clearTimeout(timeout);
  }
}

export function initAiConsultAssistant(document) {
  const tabs = Array.from(document.querySelectorAll('[data-ai-consult-tab]'));
  const views = Array.from(document.querySelectorAll('[data-ai-consult-view]'));
  const chatForm = document.querySelector('[data-ai-chat-form]');
  const chatLog = document.querySelector('[data-ai-chat-log]');
  const inquiryForm = document.querySelector('[data-ai-inquiry-form]');
  const inquiryStatus = document.querySelector('[data-ai-inquiry-status]');
  let avatarIdleTimer = null;

  const showAvatarState = (state, idleDelay = 0) => {
    if (avatarIdleTimer) clearTimeout(avatarIdleTimer);
    setAvatarState(document, state);
    if (idleDelay > 0) avatarIdleTimer = setTimeout(() => setAvatarState(document, 'IDLE'), idleDelay);
  };

  tabs.forEach((tab) => tab.addEventListener('click', () => {
    const selected = tab.dataset.aiConsultTab;
    tabs.forEach((item) => item.setAttribute('aria-selected', String(item === tab)));
    views.forEach((view) => { view.hidden = view.dataset.aiConsultView !== selected; });
  }));

  chatForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = chatForm.elements.question;
    const button = chatForm.querySelector('button[type="submit"]');
    const question = input.value.trim();
    if (!question || !chatLog) return;

    appendMessage(document, chatLog, 'user', question);
    input.value = '';
    input.disabled = true;
    button.disabled = true;
    button.textContent = '답변 중';
    showAvatarState('THINKING');
    try {
      const result = await postJson(GEMINI_WEBHOOK, { question });
      const answer = typeof result.answer === 'string' && result.answer.trim()
        ? result.answer.trim()
        : '답변을 받지 못했습니다. 잠시 후 다시 시도해 주세요.';
      appendMessage(document, chatLog, 'assistant', answer);
      showAvatarState('SPEAKING', 4_900);
    } catch {
      appendMessage(document, chatLog, 'assistant', '지금은 AI 상담 연결이 원활하지 않습니다. 잠시 후 다시 시도하거나 담당자 상담을 접수해 주세요.');
      showAvatarState('FALLBACK', 4_000);
    } finally {
      input.disabled = false;
      button.disabled = false;
      button.textContent = '전송';
      input.focus();
    }
  });

  inquiryForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(inquiryForm);
    const button = inquiryForm.querySelector('button[type="submit"]');
    const payload = {
      이름: String(formData.get('name') || '').trim(),
      연락처: String(formData.get('phone') || '').trim(),
      문의유형: String(formData.get('inquiryType') || '').trim(),
      문의내용: String(formData.get('content') || '').trim(),
      담당자연락처: '010-7450-8867',
    };
    if (Object.values(payload).some((value) => !value)) return;

    button.disabled = true;
    button.textContent = '접수 중';
    inquiryStatus.textContent = '';
    inquiryStatus.dataset.state = '';
    try {
      await postJson(INQUIRY_WEBHOOK, payload, 20_000);
      inquiryForm.reset();
      inquiryStatus.textContent = '신청이 완료되었습니다. 담당자가 확인 후 연락드립니다.';
      inquiryStatus.dataset.state = 'success';
    } catch {
      inquiryStatus.textContent = '접수하지 못했습니다. 잠시 후 다시 시도해 주세요.';
      inquiryStatus.dataset.state = 'error';
    } finally {
      button.disabled = false;
      button.textContent = '상담 접수하기';
    }
  });
}

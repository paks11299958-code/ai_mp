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
    closeButton.focus?.();
  };

  const closeModal = () => {
    modal.hidden = true;
    document.body.style.overflow = '';
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
}

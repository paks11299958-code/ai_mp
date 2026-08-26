export function initAiConsultModal(document) {
  const modal = document.querySelector('[data-ai-consult-modal]');
  const closeButton = document.querySelector('[data-ai-consult-close]');

  if (!modal || !closeButton) return;

  const closeModal = () => {
    modal.hidden = true;
    document.body.style.overflow = '';
  };

  document.body.style.overflow = 'hidden';
  closeButton.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });
}

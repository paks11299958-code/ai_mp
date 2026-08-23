(()=>{'use strict';
const header=document.querySelector('[data-header]');
const modal=document.querySelector('[data-consult-modal]');
const dialog=modal?.querySelector('.consult-dialog');
const chat=modal?.querySelector('[data-chat-src]');
const openers=[...document.querySelectorAll('[data-consult-open]')];
const closers=[...document.querySelectorAll('[data-consult-close]')];
let returnFocus=null;

const updateHeader=()=>header?.classList.toggle('is-scrolled',scrollY>18);
const openModal=event=>{
  if(!modal)return;
  returnFocus=event?.currentTarget||document.activeElement;
  if(chat&&!chat.src)chat.src=chat.dataset.chatSrc;
  modal.hidden=false;
  document.body.style.overflow='hidden';
  dialog?.focus();
};
const closeModal=()=>{
  if(!modal||modal.hidden)return;
  modal.hidden=true;
  document.body.style.overflow='';
  returnFocus?.focus?.();
};
openers.forEach(button=>button.addEventListener('click',openModal));
closers.forEach(button=>button.addEventListener('click',closeModal));
document.addEventListener('keydown',event=>{
  if(event.key==='Escape')closeModal();
  if(event.key==='Tab'&&modal&&!modal.hidden&&dialog){
    const focusable=[...dialog.querySelectorAll('button,[href],iframe,[tabindex]:not([tabindex="-1"])')];
    if(!focusable.length)return;
    const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  }
});
addEventListener('scroll',updateHeader,{passive:true});
updateHeader();
})();

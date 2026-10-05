import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArinPromoEntry } from './ArinPromoEntry';
import { EntryChatModal } from './EntryChatModal';
import { ARIN_ID, ENTRY_CHAT_THEMES, entryStartDestination } from '../../lib/entryChatThemes';
import { ARIN_GROUPS, collapseGreetingRuns, rememberReturn } from './arinMenu';
const keys=ARIN_GROUPS.flatMap(g=>g.items.map(i=>i.key));
const base=()=>({theme:ENTRY_CHAT_THEMES[ARIN_ID],messages:[] as any[],isTyping:false,balance:120,draftOwner:'test',onSend:vi.fn(async()=> 'sent' as const),onClose:vi.fn(),onNeedCharge:vi.fn(),onOpenFullChat:vi.fn(),onFeature:vi.fn()});
beforeEach(()=>{localStorage.clear();sessionStorage.clear();Element.prototype.scrollTo=vi.fn();});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
describe('Arin studio entry and shared contracts',()=>{
 it('renders six unique thumbnails and labels, with no obsolete animation',()=>{const p={guide:{title:'이아린',desc:''},onClose:vi.fn(),onStart:vi.fn(),onFeature:vi.fn(),onInvite:vi.fn()};const {container}=render(<ArinPromoEntry {...p}/>);expect(container.querySelectorAll('[data-feature]')).toHaveLength(6);expect(new Set(keys).size).toBe(6);for(const g of ARIN_GROUPS)for(const i of g.items){expect(screen.getByRole('button',{name:i.label})).toBeTruthy();expect(container.querySelector(`img[src="/arin/menu/${i.key}.webp"]`)).toBeTruthy();}expect(container.querySelector('.ap-summon')).toBeNull();fireEvent.click(screen.getByRole('button',{name:/대화하기/}));expect(p.onStart).toHaveBeenCalledWith();fireEvent.click(screen.getByRole('button',{name:/친구 초대/}));expect(p.onInvite).toHaveBeenCalledOnce();});
 it.each(keys)('%s routes exact key, reverse saves return before callback',key=>{const onFeature=vi.fn(k=>{expect(k).toBe(key);if(key==='reverse-prompt')expect(sessionStorage.getItem('rp:backTo')).toBe('/?p='+ARIN_ID);});const {container}=render(<ArinPromoEntry guide={{title:'이아린',desc:'',personaId:ARIN_ID}} onFeature={onFeature} onStart={vi.fn()} onClose={vi.fn()} onInvite={vi.fn()}/>);fireEvent.click(container.querySelector(`[data-feature="${key}"]`)!);expect(onFeature).toHaveBeenCalledOnce();});
 it('CTA resolves studio modal; feature link keeps prior destination',()=>{expect(entryStartDestination(ARIN_ID)).toBe('modal');expect(ENTRY_CHAT_THEMES[ARIN_ID].visualPreset).toBe('studio');expect(entryStartDestination(ARIN_ID,'marketing')).toBe('chat');});
 it('first visit opens, toggle persists through remount, past conversation defaults closed',()=>{const p=base();let v=render(<EntryChatModal {...p}/>);expect(screen.getByRole('button',{name:'메뉴 접기 ⌃'}).getAttribute('aria-expanded')).toBe('true');fireEvent.click(screen.getByRole('button',{name:'메뉴 접기 ⌃'}));expect(screen.getByRole('button',{name:'메뉴 펼치기 ⌄'})).toBeTruthy();v.unmount();v=render(<EntryChatModal {...p}/>);expect(screen.getByRole('button',{name:'메뉴 펼치기 ⌄'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'메뉴 펼치기 ⌄'}));v.unmount();render(<EntryChatModal {...p}/>);expect(screen.getByRole('button',{name:'메뉴 접기 ⌃'})).toBeTruthy();cleanup();localStorage.clear();render(<EntryChatModal {...p} messages={[{id:'1',role:'user',text:'이전 대화'}]}/>);expect(screen.getByRole('button',{name:'메뉴 펼치기 ⌄'})).toBeTruthy();});
 it('late-loaded history closes untouched initial menu',()=>{const p=base();const v=render(<EntryChatModal {...p}/>);expect(screen.getByRole('button',{name:'메뉴 접기 ⌃'})).toBeTruthy();v.rerender(<EntryChatModal {...p} messages={[{id:'late',role:'user',text:'과거 대화'}]}/>);expect(screen.getByRole('button',{name:'메뉴 펼치기 ⌄'})).toBeTruthy();});
 it('storage failure permits toggling, return saving and sending',async()=>{vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('denied');});vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('denied');});expect(()=>rememberReturn()).not.toThrow();const p=base();render(<EntryChatModal {...p}/>);fireEvent.click(screen.getByRole('button',{name:'메뉴 접기 ⌃'}));fireEvent.click(screen.getByRole('button',{name:'메뉴 펼치기 ⌄'}));fireEvent.change(screen.getByRole('textbox'),{target:{value:'내용'}});await act(async()=>fireEvent.click(screen.getByRole('button',{name:'메시지 보내기'})));expect(p.onSend).toHaveBeenCalledWith('내용');});
 it.each(keys)('chat %s closes panel and routes callback; App closes modal',key=>{const p=base();p.onFeature.mockImplementation(()=>p.onClose());const {container}=render(<EntryChatModal {...p}/>);fireEvent.click(container.querySelector(`[data-feature="${key}"]`)!);expect(p.onFeature).toHaveBeenCalledWith(key);expect(p.onClose).toHaveBeenCalledOnce();expect(container.querySelector('#arin-chat-menu')).toBeNull();});
 it('insufficient points preserve draft across charge-induced unmount',async()=>{const p=base();p.onSend.mockResolvedValueOnce('insufficient' as any);let v=render(<EntryChatModal {...p}/>);fireEvent.change(screen.getByRole('textbox'),{target:{value:'저장할 초안'}});await act(async()=>fireEvent.click(screen.getByRole('button',{name:'메시지 보내기'})));expect(p.onNeedCharge).toHaveBeenCalledOnce();expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('저장할 초안');v.unmount();render(<EntryChatModal {...p}/>);expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('저장할 초안');});
 it('blocked and rejected send retain draft; duplicate sends suppressed',async()=>{const p=base();let resolve!:(r:any)=>void;p.onSend.mockImplementationOnce(()=>new Promise(r=>resolve=r));render(<EntryChatModal {...p}/>);fireEvent.change(screen.getByRole('textbox'),{target:{value:'남길 초안'}});fireEvent.click(screen.getByRole('button',{name:'메시지 보내기'}));fireEvent.click(screen.getByRole('button',{name:'메시지 보내기'}));expect(p.onSend).toHaveBeenCalledOnce();await act(async()=>resolve('blocked'));expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('남길 초안');p.onSend.mockRejectedValueOnce(new Error('network'));await act(async()=>fireEvent.click(screen.getByRole('button',{name:'메시지 보내기'})));expect(screen.getByRole('alert')).toBeTruthy();expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('남길 초안');});
 it.each(['sent','insufficient'])('completion %s after unmount never erases a new draft',async(result)=>{const p=base();let done!:(r:any)=>void;p.onSend.mockImplementationOnce(()=>new Promise(r=>done=r));const v=render(<EntryChatModal {...p}/>);fireEvent.change(screen.getByRole('textbox'),{target:{value:'첫 메시지'}});fireEvent.click(screen.getByRole('button',{name:'메시지 보내기'}));v.unmount();render(<EntryChatModal {...p}/>);fireEvent.change(screen.getByRole('textbox'),{target:{value:'다음 초안'}});await act(async()=>done(result));expect(sessionStorage.getItem('arin-draft:test:'+ARIN_ID)).toBe('다음 초안');});
 it('admin cost hidden, full chat callback retained, all old assistant messages preserved',()=>{const p=base();render(<EntryChatModal {...p} hideCost messages={[{id:'1',role:'model',text:'옛 인사'},{id:'2',role:'model',text:'선물 감사'},{id:'3',role:'model',text:'재방문 인사'}]}/>);expect(screen.queryByText(/대화 10P/)).toBeNull();for(const text of ['옛 인사','선물 감사','재방문 인사'])expect(screen.getByText(text)).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:/전체 채팅/}));expect(p.onOpenFullChat).toHaveBeenCalledOnce();});
 it('Escape closes menu then dialog and never loses draft',()=>{const p=base();render(<EntryChatModal {...p}/>);fireEvent.keyDown(window,{key:'Escape'});expect(screen.getByRole('button',{name:'메뉴 펼치기 ⌄'})).toBeTruthy();fireEvent.keyDown(window,{key:'Escape'});expect(p.onClose).toHaveBeenCalledOnce();});
});

// ★아린 답변의 마크다운이 원문 기호로 보이지 않는지(2026-10-05 총괄 검수 — 운영 답변 11건 중 9건이 **굵게** 사용)
it('아린 답변의 **굵게**·목록을 기호 없이 그린다', () => {
    render(<EntryChatModal {...base()} messages={[{ id: 'u1', role: 'user', text: '홍보 문구', timestamp: 0 }, { id: 'a1', role: 'model', text: '**핵심** 포인트\n\n- 하나\n- 둘', timestamp: 0 }]} />);
    expect(screen.getByText('핵심').tagName).toBe('STRONG');
    expect(document.body.textContent).not.toContain('**');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
});

// ★과거 누적 인사는 연속 구간마다 마지막 하나만 보인다(2026-10-05 사장 승인 — 데이터는 그대로)
it('연속된 인사는 마지막 하나만, 대화 사이 인사·답변은 그대로 보인다', () => {
    const msgs = [
        { id: 'g1', role: 'assistant', text: '다시 뵙게 되어 반갑네요.', timestamp: 0 },
        { id: 'g2', role: 'assistant', text: '다시 찾아주셔서 반가워요.', timestamp: 0 },
        { id: 'u1', role: 'user', text: '홍보 문구', timestamp: 0 },
        { id: 'a1', role: 'model', text: '좋아요', timestamp: 0 },
        { id: 'g3', role: 'assistant', text: '돌아오셨네요.', timestamp: 0 },
        { id: 'g4', role: 'assistant', text: '오랜만이에요.', timestamp: 0 },
    ] as any[];
    expect(collapseGreetingRuns(msgs).map(m => m.id)).toEqual(['g2', 'u1', 'a1', 'g4']);
    render(<EntryChatModal {...base()} messages={msgs} />);
    expect(screen.queryByText('다시 뵙게 되어 반갑네요.')).toBeNull();
    expect(screen.queryByText('돌아오셨네요.')).toBeNull();
    expect(screen.getByText('다시 찾아주셔서 반가워요.')).toBeTruthy();
    expect(screen.getByText('오랜만이에요.')).toBeTruthy();
});

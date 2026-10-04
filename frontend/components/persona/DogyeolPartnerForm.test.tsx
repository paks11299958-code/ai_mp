import React from 'react';
import { act, fireEvent, render, screen, cleanup, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SajuEntry } from './SajuEntry';
import { DogyeolEntryChatModal } from './DogyeolEntryChatModal';
import { ENTRY_CHAT_THEMES, DOGYEOL_ID } from '../../lib/entryChatThemes';
import { withBirth, withPartner, withTwoPartners } from './useSajuRunner';
const m=vi.hoisted(()=>({get:vi.fn(),save:vi.fn(),generate:vi.fn(),gate:vi.fn()}));
const menus=[{label:'❤️ 인연',resultCard:true,subMenu:{items:[{label:'인연 궁합',prompt:'인연 원본 프롬프트.',partnerModal:true}]}},{label:'🤝 우정',resultCard:true,subMenu:{items:[{label:'나와 친구 궁합',prompt:'우정 원본 프롬프트.',partnerModal:true},{label:'친구 둘 궁합',prompt:'두 친구 원본 프롬프트.',twoPartnerModal:true}]}}];
const me={name:'본인',year:'1990',month:'1',day:'2',time:'모름',lunar:false};
const partner={name:'김하늘',year:'1990',month:'2',day:'12',time:'자시(子時)',lunar:true};

vi.mock('../../services/apiService',()=>({quickMenuApi:{generate:m.generate},personaApi:{getAll:async()=>[{id:DOGYEOL_ID,name:'도결 선생',quickMenuJson:JSON.stringify({useBirthInfo:true,menus})}]},userProfileApi:{getBirthInfo:m.get,saveBirthInfo:m.save}}));
vi.mock('../../contexts/PointsContext',()=>({usePoints:()=>({priceOf:()=>100,showPointModal:false,setPaidPoints:vi.fn(),setBonusPoints:vi.fn()})}));
vi.mock('../MainPageNew',()=>({MpnFeatureIcon:()=>null}));
vi.mock('./sajuHero',()=>({SAJU_TONE:{},SAJU_HERO_ASPECT:'1216 / 832',SAJU_HERO_IMAGES:{tiger:'/saju/tiger.png'},mountSajuHero:()=>({destroy:()=>{}}),mountSajuLoadingSmoke:()=>({destroy:()=>{}}),prefersReducedMotion:()=>true}));
vi.mock('../FaceReadingModal',()=>({FaceReadingModal:()=> <p>관상 입력</p>}));vi.mock('../PalmReadingModal',()=>({PalmReadingModal:()=> <p>손금 입력</p>}));vi.mock('../FaceReadingResultCard',()=>({FaceReadingResultCard:()=>null}));vi.mock('../PalmReadingResultCard',()=>({PalmReadingResultCard:()=>null}));
const features=[['siwoon','시운의 흐름'],['wealth','성취와 재물'],['yeonn','인연의 결'],['friendship','우정 궁합'],['dream','꿈해몽'],['rebirth','전생 이야기'],['gwansang','관상학'],['palm','손금 보기']].map(([key,name])=>({key,name,icon:'fortune' as any}));
function show(chat:boolean,guest=false){return render(chat?<DogyeolEntryChatModal theme={ENTRY_CHAT_THEMES[DOGYEOL_ID]} messages={[]} isTyping={false} balance={1000} onSend={vi.fn()} onClose={vi.fn()} onNeedCharge={vi.fn()} onOpenFullChat={vi.fn()}/>:<SajuEntry guide={{title:'도결 선생',personaName:'도결 선생',desc:'인생 멘토',features}} onClose={vi.fn()} onStart={vi.fn()} onFeature={vi.fn()} onGuestGate={guest?m.gate:undefined}/>);}

async function open(chat:boolean,kind='인연 궁합') {
    show(chat); await act(async()=>{});
    const friendship=kind!=='인연 궁합';
    fireEvent.click(screen.getByRole('button',{name:chat?(friendship?'우정':'인연'):(friendship?'우정 궁합':'인연의 결'),exact:true}));
    fireEvent.click(screen.getByRole('button',{name:chat?`${kind} · ${kind==='친구 둘 궁합'?'두 사람 정보':'상대 정보'}`:new RegExp(kind)}));
}
function fill(name='김하늘',day='12') {
    for(const [label,value] of [['이름',name],['태어난 해','1990'],['태어난 달','2'],['태어난 날',day]]) fireEvent.change(screen.getByLabelText(label),{target:{value}});
}
async function submit(label='정보 확인 후 풀이 시작') { await act(async()=>fireEvent.click(screen.getByRole('button',{name:label}))); }
beforeEach(()=>{vi.clearAllMocks();m.get.mockResolvedValue({birthInfoJson:me});m.generate.mockResolvedValue({result:'풀이 완성'});Element.prototype.scrollTo=vi.fn();Object.defineProperty(window,'matchMedia',{configurable:true,value:()=>({matches:false})});});
afterEach(cleanup);
describe.each([false,true])('상대 한지 폼 chat=%s',chat=>{
    it('인연 입력 후 generate1회·전체 프롬프트 동일·저장0',async()=>{
        await open(chat); expect(screen.getByRole('heading',{name:'상대의 명부'})).toBeTruthy();
        expect(document.body.textContent).not.toContain('💑'); expect(document.querySelectorAll('form')).toHaveLength(1);
        fill(); fireEvent.click(screen.getByLabelText('음력')); fireEvent.change(screen.getByLabelText('태어난 시'),{target:{value:'자시(子時)'}});
        await submit(); expect(m.generate).toHaveBeenCalledTimes(1);
        expect(m.generate.mock.calls[0][1]).toBe(withBirth(withPartner('인연 원본 프롬프트.',partner),me)); expect(m.save).not.toHaveBeenCalled();
    });
    it.each(['취소하고 돌아가기','Escape'])('취소 %s 실행0·차감 콜백0·저장0',async how=>{
        await open(chat); if(how==='Escape') fireEvent.keyDown(screen.getByLabelText('이름'),{key:'Escape'}); else fireEvent.click(screen.getByRole('button',{name:how}));
        expect(screen.queryByRole('heading',{name:'상대의 명부'})).toBeNull(); expect(m.generate).not.toHaveBeenCalled(); expect(m.save).not.toHaveBeenCalled();
    });
    it.each(['','30'])('이름/날짜 오류 %s는 요청0·오류 안내',async day=>{
        await open(chat); if(day) fill('김하늘',day); await submit();
        expect(screen.getByRole('alert').textContent).toBe('이름과 생년월일을 다시 확인해 주세요.'); expect(m.generate).not.toHaveBeenCalled(); expect(m.save).not.toHaveBeenCalled();
    });
    it('나와 친구 문구와 동일 프롬프트',async()=>{
        await open(chat,'나와 친구 궁합'); expect(screen.getByText('우정 궁합 · 친구 정보')).toBeTruthy(); expect(screen.getByRole('heading',{name:'친구의 명부'})).toBeTruthy(); fill(); await submit();
        expect(m.generate.mock.calls[0][1]).toBe(withBirth(withPartner('우정 원본 프롬프트.',{...partner,lunar:false,time:'모름'}),me));
    });
    it('친구 둘 1/2→2/2 새 입력·단일 폼·프롬프트 전체 동일·1회',async()=>{
        await open(chat,'친구 둘 궁합'); expect(screen.getByText('친구 둘 궁합 · 1/2')).toBeTruthy(); fill('친구1'); const firstId=screen.getByLabelText('이름').id;
        await submit('다음 친구 적기'); expect(m.generate).not.toHaveBeenCalled(); expect(screen.getByText('친구 둘 궁합 · 2/2')).toBeTruthy(); expect((screen.getByLabelText('이름') as HTMLInputElement).value).toBe(''); expect(screen.getByLabelText('이름').id).not.toBe(firstId); expect(document.querySelectorAll('form')).toHaveLength(1);
        fill('친구2'); await submit(); expect(m.generate).toHaveBeenCalledTimes(1); expect(m.generate.mock.calls[0][1]).toBe(withBirth(withTwoPartners('두 친구 원본 프롬프트.',{...partner,name:'친구1',time:'모름',lunar:false},{...partner,name:'친구2',time:'모름',lunar:false}),me)); expect(m.save).not.toHaveBeenCalled();
    });
    it('친구2 취소 후 다시 열면 친구1부터·요청0',async()=>{
        await open(chat,'친구 둘 궁합'); fill('친구1'); await submit('다음 친구 적기'); fireEvent.click(screen.getByRole('button',{name:'취소하고 돌아가기'})); expect(m.generate).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button',{name:chat?'친구 둘 궁합 · 두 사람 정보':new RegExp('친구 둘 궁합')})); expect(screen.getByText('친구 둘 궁합 · 1/2')).toBeTruthy(); expect((screen.getByLabelText('이름') as HTMLInputElement).value).toBe('');
    });
});

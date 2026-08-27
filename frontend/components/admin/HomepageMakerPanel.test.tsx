import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { api }=vi.hoisted(()=>({api:{
    listDevProjects:vi.fn().mockResolvedValue({projects:[],concurrency:{running:0,max:1,canStart:true}}),
    createDevProject:vi.fn().mockResolvedValue({project:{id:'p1'}}),
    updateDevProject:vi.fn(), startDevProject:vi.fn().mockResolvedValue({started:true,id:'p1',message:'시작됨'}),
}}));
vi.mock('../../services/apiService',()=>({adminApi:api}));
import { HomepageMakerPanel } from './HomepageMakerPanel';

describe('HomepageMakerPanel 실행 경계',()=>{
    beforeEach(()=>vi.clearAllMocks());
    it('입력이나 렌더만으로 API를 호출하지 않고 저장 후에만 시작할 수 있다',async()=>{
        render(<HomepageMakerPanel/>);
        await waitFor(()=>expect(api.listDevProjects).toHaveBeenCalledTimes(1));
        expect(api.createDevProject).not.toHaveBeenCalled();
        expect(api.startDevProject).not.toHaveBeenCalled();
        const values=['cube','프리미엄','서비스 구조','큐브','펼쳐져 메뉴가 된다'];
        ['프로젝트 이름','원하는 홈페이지 느낌','히어로 화면 한 줄 설명','히어로의 핵심 오브젝트','움직임과 콘텐츠 연결'].forEach((name,i)=>fireEvent.change(screen.getByLabelText(new RegExp(name)),{target:{value:values[i]}}));
        fireEvent.click(screen.getByRole('button',{name:'1. 명세 저장'}));
        await waitFor(()=>expect(api.createDevProject).toHaveBeenCalledTimes(1));
        expect(api.startDevProject).not.toHaveBeenCalled();
    });
});

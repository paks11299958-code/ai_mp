import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { api }=vi.hoisted(()=>({api:{
    listDevProjects:vi.fn().mockResolvedValue({projects:[{id:'p1',title:'큐브',status:'done',herdrProjectId:'cube',workdir:'/repo',latestVersion:1,counts:{versions:1,files:0,events:1},createdAt:'2026-08-27',updatedAt:'2026-08-27'}],concurrency:{running:0,max:1,canStart:true}}),
    getDevProject:vi.fn().mockResolvedValue({project:{id:'p1',title:'큐브',status:'done',herdrProjectId:'cube',workdir:'/repo',useReview:true,createdAt:'2026-08-27',updatedAt:'2026-08-27',versions:[],events:[{id:1,actor:'reviewer',phase:'review',message:'통과',meta:null,at:'2026-08-27'}],result:{deployUrl:'https://aichat.dbzone.kr/sites/cube/',summary:null,commits:'[]',designSourceUrl:null}}}),
    getDevProjectArtifacts:vi.fn().mockResolvedValue({artifacts:{siteSlug:'cube',sourceAvailable:true,images:[{name:'hero.png',url:'/sites/cube/hero.png',size:3}],imagesTruncated:false,spec:{text:'# 사양',truncated:false},reviews:[{fileName:'review.done',date:'2026-08-27',text:'PASS',truncated:false}]}}),
    downloadSite:vi.fn(),
}}));
vi.mock('../../services/apiService',()=>({adminApi:api}));
import { HerdrResultsPanel } from './HerdrResultsPanel';

describe('HerdrResultsPanel',()=>{
    it('프로젝트 선택 시 이벤트·이미지·사양서·리뷰를 함께 보여준다',async()=>{
        render(<HerdrResultsPanel/>);
        await waitFor(()=>expect(screen.getByRole('button',{name:/큐브/})).toBeTruthy());
        fireEvent.click(screen.getByRole('button',{name:/큐브/}));
        await waitFor(()=>expect(screen.getByText('# 사양')).toBeTruthy());
        expect(screen.getByAltText('hero.png')).toBeTruthy();
        expect(screen.getByText('통과')).toBeTruthy();
        expect(screen.getByRole('button',{name:/review.done/})).toBeTruthy();
    });
});

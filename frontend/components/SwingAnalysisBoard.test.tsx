import React from 'react';
import {render,screen,cleanup} from '@testing-library/react';
import {it,expect,afterEach} from 'vitest';
import {SeolaLessonCard} from './SwingAnalysisBoard';
afterEach(cleanup);
it('hides absent fields and never manufactures scores',()=>{render(<SeolaLessonCard record={{id:1,createdAt:'2026-01-01',analysis:{} as any}}/>);for(const text of ['오늘의 원포인트','스윙 요약','오늘의 드릴 하나','내 스윙의 흐름','종합 점수'])expect(screen.queryByText(text)).toBeNull();});
it('orders existing priorities, first sentence, first drill, raw scores then detail',()=>{const {container}=render(<SeolaLessonCard record={{id:1,title:'내 제목',createdAt:'2026-01-01',analysis:{topPriorities:['몸통 회전'],overallComment:'천천히 움직여요. 다음 문장입니다.',recommendedDrills:['수건 드릴'],overallScore:53,sections:[{name:'백스윙',score:45,comment:'상세',good:[],improve:[]}]}}}/>);expect(screen.getByRole('heading',{name:'내 제목'})).toBeTruthy();expect([...container.querySelectorAll('section h3')].map(e=>e.textContent)).toEqual(['오늘의 원포인트','스윙 요약','오늘의 드릴 하나','내 스윙의 흐름']);expect(screen.getByText('천천히 움직여요.')).toBeTruthy();expect(screen.getByLabelText('백스윙 45점').getAttribute('value')).toBe('45');});

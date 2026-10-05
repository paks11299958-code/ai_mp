import React from 'react';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
import {SwingInputModal} from './SwingInputModal';
import {swingAnalysisApi} from '../services/apiService';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it.each([['',null],['   ',null],['  내 연습  ','내 연습']])('submits %s as %s retaining file and golfer defaults',(title,expected)=>{const submit=vi.fn();const {container}=render(<SwingInputModal onSubmit={submit} onClose={vi.fn()}/>);const file=new File(['mock'],'swing.mp4',{type:'video/mp4'});fireEvent.change(container.querySelector('input[type=file]')!,{target:{files:[file]}});fireEvent.change(screen.getByPlaceholderText('비워두면 설아가 지어줘요'),{target:{value:title}});fireEvent.click(screen.getByRole('button',{name:'내 스윙 보여주기'}));expect(submit).toHaveBeenCalledWith({title:expected,gender:'남성',skillLevel:'중급',file});});
it('serializes null through the existing analysis request',async()=>{const fetch=vi.fn(async()=>new Response(JSON.stringify({id:1,analysis:{},createdAt:'2026-01-01'}),{status:200}));vi.stubGlobal('fetch',fetch);await swingAnalysisApi.analyze('mock://video','persona','video/mp4','swing.mp4',null,'남성','중급');expect(JSON.parse(fetch.mock.calls[0][1].body).title).toBeNull();});

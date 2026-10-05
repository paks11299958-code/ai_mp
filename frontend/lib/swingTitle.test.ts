import {describe,it,expect} from 'vitest';
import {swingTitle} from './swingTitle';
const analysis:any={overallScore:53,sections:[{name:'어드레스',score:65},{name:'백스윙',score:45},{name:'다운스윙',score:48},{name:'임팩트',score:55},{name:'팔로우스루',score:50}]};
const fixture={title:null,analysis};
describe('swingTitle — Round0 cases adapted to Round1 title policy',()=>{
 it.each([
 ['null',fixture,'백스윙 점검 · 53점'],
 ['explicit',{...fixture,title:'  나의 첫 연습  '},'나의 첫 연습'],
 ['literal explicit Untitled',{...fixture,title:'Untitled'},'Untitled'],
 ['empty sections',{analysis:{overallScore:53,sections:[]}},'스윙 점검 · 53점'],
 ['empty record',{},'스윙 점검 기록'],
 ['zero',{analysis:{overallScore:0,sections:[{name:'백스윙',score:0}]}},'백스윙 점검 · 0점'],
 ['null score',{analysis:{overallScore:null,sections:[{name:'임팩트',score:null}]}},'스윙 점검 기록'],
 ['invalid',{analysis:{overallScore:101,sections:[{name:'임팩트',score:-1}]}},'스윙 점검 기록'],
 ['tie',{analysis:{overallScore:50,sections:[{name:'임팩트',score:45},{name:'백스윙',score:45}]}},'백스윙 점검 · 50점'],
 ['old date',{...fixture,title:'스윙 분석 2026. 10. 5.'},'백스윙 점검 · 53점'],
 ['no club inference',{...fixture,fileName:'driver.mp4'},'백스윙 점검 · 53점'],
 ['priority',{analysis:{overallScore:53,topPriorities:['몸통을 먼저 돌려보세요.']}},'몸통을 먼저 돌려보세요. · 53점'],
 ['blank',{...fixture,title:'  '},'백스윙 점검 · 53점'],
 ['date without final dot',{...fixture,title:'스윙 분석 2026. 1. 2'},'백스윙 점검 · 53점'],
 ['similar user title',{...fixture,title:'스윙 분석 2026. 1. 2. 연습'},'스윙 분석 2026. 1. 2. 연습'],
 ['100',{analysis:{overallScore:100}},'스윙 점검 · 100점'],
 ['NaN',{analysis:{overallScore:NaN}},'스윙 점검 기록'],
 ['Infinity',{analysis:{overallScore:Infinity}},'스윙 점검 기록'],
 ] as [string,any,string][])('%s',(_,record,expected)=>expect(swingTitle(record)).toBe(expected));
 it('does not mutate input',()=>{const before=JSON.stringify(fixture);swingTitle(fixture);expect(JSON.stringify(fixture)).toBe(before);});
 it('caps priority at 36 unicode characters',()=>expect(swingTitle({analysis:{topPriorities:['가'.repeat(40)]}})).toBe('가'.repeat(36)));
});

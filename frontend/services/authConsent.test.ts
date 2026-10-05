import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../lib/deviceFingerprint',()=>({getDeviceFp:()=>null,initDeviceFp:async()=>null}));
vi.mock('./referral',()=>({getStoredRef:()=> 'test-ref'}));
import { authApi } from './apiService';
const yes={terms:true,privacy:true,age14:true};
beforeEach(()=>{localStorage.setItem('token','mock-token');vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,status:200,text:async()=>JSON.stringify({user:{id:1},token:'mock-token',recorded:true})}));});afterEach(()=>{vi.unstubAllGlobals();localStorage.clear()});
describe('consent transport without changing auth contracts',()=>{
 it('register retains referral and appends affirmative consent',async()=>{await authApi.verifyRegister('PHONE','01012345678','123456','abcdef','tester',yes);const [url,options]=(fetch as any).mock.calls[0];expect(url).toBe('/api/auth/verify-register');expect(JSON.parse(options.body)).toEqual({type:'PHONE',identifier:'01012345678',code:'123456',password:'abcdef',username:'tester',ref:'test-ref',consent:yes});});
 it('upgrade appends consent to authenticated existing-account request',async()=>{await authApi.upgradeGuest('EMAIL','person@example.test','123456','abcdef','tester',yes);const [url,options]=(fetch as any).mock.calls[0];expect(url).toBe('/api/auth/upgrade-guest');expect(options.headers.Authorization).toBe('Bearer mock-token');expect(JSON.parse(options.body).consent).toEqual(yes);});
 it('Kakao sheet only submits fields, not user id/channel/version',async()=>{await authApi.consent(yes);const [url,options]=(fetch as any).mock.calls[0];expect(url).toBe('/api/auth/consent');expect(JSON.parse(options.body)).toEqual({consent:yes});});
});

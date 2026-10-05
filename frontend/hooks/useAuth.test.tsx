import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const f=vi.hoisted(()=>({me:vi.fn()}));vi.mock('../services/apiService',()=>({authApi:{me:f.me}}));
import { useAuth } from './useAuth';
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();window.history.replaceState({},'','/');});afterEach(()=>vi.unstubAllGlobals());
describe('auth entry intent and server-owned needsConsent',()=>{
 it('opens register explicitly and resets incidental authPage navigation to login',()=>{const {result}=renderHook(useAuth);act(()=>result.current.openAuthPage('register'));expect(result.current.screen).toBe('authPage');expect(result.current.authPageMode).toBe('register');act(()=>result.current.goTo('authPage'));expect(result.current.authPageMode).toBe('login');});
 it.each([true,false,undefined])('refresh keeps server consent status %s',async(needsConsent)=>{localStorage.setItem('token','mock-token');f.me.mockResolvedValue({user:{id:1,provider:'kakao',needsConsent}});const {result}=renderHook(useAuth);await waitFor(()=>expect(result.current.isAuthChecking).toBe(false));expect(result.current.user?.needsConsent).toBe(needsConsent);});
 it('Kakao exchange retrieves consent state from /me instead of isNewUser guessing',async()=>{window.history.replaceState({},'','/?kakao_login=1&kakao_code=local-test');vi.stubGlobal('fetch',vi.fn().mockResolvedValue({json:async()=>({token:'mock-token',isNewUser:true})}));f.me.mockResolvedValue({user:{id:1,provider:'kakao',needsConsent:true}});const {result}=renderHook(useAuth);await waitFor(()=>expect(result.current.user?.needsConsent).toBe(true));expect(result.current.screen).toBe('main');});
});

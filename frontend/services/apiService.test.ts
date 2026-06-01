// apiService 메서드 헬퍼 회귀 테스트 (vitest)
//
// #2 apiService 리팩토링 안전망: post/put/del/get 헬퍼가 기존
// request<T>(path, {method, body: JSON.stringify(...)}) 직접 호출과
// "동일한 fetch 요청"을 만드는지 검증. fetch를 mock해 URL·method·
// headers·body를 직접 확인한다.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get, post, put, del } from './apiService';

const BASE = '/api';

function mockFetchOK(payload: unknown = { ok: true }) {
  const fn = vi.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(payload),
  }));
  // @ts-expect-error 테스트용 global fetch 주입
  global.fetch = fn;
  return fn;
}

describe('apiService 메서드 헬퍼', () => {
  beforeEach(() => {
    // localStorage stub (authHeaders가 token 읽음)
    const store: Record<string, string> = { token: 'TESTTOKEN' };
    // @ts-expect-error 테스트용
    global.localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => {},
      key: () => null,
      length: 0,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('get: GET + 인증헤더, body 없음', async () => {
    const fn = mockFetchOK();
    await get('/auth/me');
    const [url, init] = fn.mock.calls[0];
    expect(url).toBe(`${BASE}/auth/me`);
    expect(init.method).toBeUndefined(); // GET은 method 미지정(fetch 기본)
    expect(init.body).toBeUndefined();
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer TESTTOKEN',
    });
  });

  it('post: POST + body는 JSON.stringify', async () => {
    const fn = mockFetchOK();
    await post('/auth/login', { identifier: 'a', password: 'b' });
    const [url, init] = fn.mock.calls[0];
    expect(url).toBe(`${BASE}/auth/login`);
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ identifier: 'a', password: 'b' }));
    expect(init.headers).toMatchObject({ Authorization: 'Bearer TESTTOKEN' });
  });

  it('post: body 생략 시 body 미포함 (logout 패턴)', async () => {
    const fn = mockFetchOK();
    await post('/auth/logout');
    const [, init] = fn.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
  });

  it('put: PUT + body JSON', async () => {
    const fn = mockFetchOK();
    await put('/personas/1', { name: 'x' });
    const [url, init] = fn.mock.calls[0];
    expect(url).toBe(`${BASE}/personas/1`);
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(JSON.stringify({ name: 'x' }));
  });

  it('del: DELETE, body 없음', async () => {
    const fn = mockFetchOK();
    await del('/personas/1');
    const [url, init] = fn.mock.calls[0];
    expect(url).toBe(`${BASE}/personas/1`);
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
  });

  it('del: body 있으면 JSON 포함', async () => {
    const fn = mockFetchOK();
    await del('/x', { ids: [1, 2] });
    const [, init] = fn.mock.calls[0];
    expect(init.method).toBe('DELETE');
    expect(init.body).toBe(JSON.stringify({ ids: [1, 2] }));
  });

  it('에러 응답(!ok)은 data.error 메시지로 throw', async () => {
    // @ts-expect-error 테스트용
    global.fetch = vi.fn(async () => ({
      ok: false, status: 400,
      text: async () => JSON.stringify({ error: '잘못된 요청' }),
    }));
    await expect(post('/x', {})).rejects.toThrow('잘못된 요청');
  });
});

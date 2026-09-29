import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// 09-29 검수: handleSendMessage(overrideText?) 로 바뀐 뒤 메인 채팅 보내기 버튼이 onClick={handleSendMessage} 로 남아
// 클릭 이벤트가 "보낼 글"로 들어가 전송이 죽을 뻔했다(strict:false 라 tsc 가 못 잡음). 소스에서 직접 막는다.
describe('App 보내기 버튼 배선', () => {
    const src = readFileSync(resolve(__dirname, 'App.tsx'), 'utf-8');
    it('onClick 에 handleSendMessage 를 직접 넘기지 않는다', () => {
        expect(src).not.toMatch(/onClick=\{handleSendMessage\}/);
    });
    it('onSend(모달)에는 넘겨도 된다 — 문자열 인자로 부른다', () => {
        expect(src).toMatch(/onSend=\{handleSendMessage\}/);
    });
});

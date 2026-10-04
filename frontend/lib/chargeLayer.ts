// 충전 창 층 — 사장 지시(2026-10-04): "충전 창은 무조건 가장 위에".
//
// ★충전 창은 전역 402 이벤트로 **다른 창이 열린 채로** 뜬다(진입화면·채팅·헤어 등 보드).
//   z 숫자만 올려서는 두 가지 함정이 남는다:
//   ① 같은 층이면 DOM 에서 나중에 그려진 보드가 위로 온다(App.tsx 에서 PointModal 이 HairStyleBoard 보다 앞).
//   ② 부모가 쌓임 맥락(transform·z-index·filter)을 만들면 그 안에 갇힌다.
//   → body 로 portal 하고, 앱 화면 전부(≤ 200)보다 높은 9000 에 둔다.
// ★9999 층(약관·리워드 알림·포인트 넛지·카카오 닉네임)은 의도적 최상단이라 그 아래.
//   토스 결제창(SDK)은 이보다 위에 떠야 결제가 된다 — 올리지 말 것.
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const CHARGE_LAYER_Z = 9000;

export const toChargeLayer = (node: ReactNode) =>
    typeof document === 'undefined' ? node : createPortal(node, document.body);

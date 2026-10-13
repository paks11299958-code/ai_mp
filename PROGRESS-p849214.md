# 진행 상황 — 충전 모달 문구 A/B 테스트(charge_copy_v1: control / 추천 배지 / 포인트 증정 문구)를 미완성분(p691205 묶음 B

> 프로젝트 ID `p849214` · 진행 1/4 · 헤르메스가 묶음 단위로 자동 갱신합니다.

## 완료
- [x] A. 이벤트 테이블 + 변형 배정·이벤트 기록 API — `shared-a`
      ChargeAbEvent 테이블 생성(운영 DB, 추가 전용) + shared-api /api/aimp/ab(charge-copy 변형 조회·charge-event 기록) + /api/aimp/admin/ab/cha

## 다음 할 일
- [ ] B. 충전 모달 A/B 표시 + 노출·클릭 이벤트
- [ ] C. 어드민 실험 관리·결과 탭
- [ ] D. 운영 반영 확인 + 실험 활성화 + 기록

## 결정 사항
- 묶음 B 는 변형을 화면에서 계산하지 말고 GET /api/ab/charge-copy 로 받아 쓴다(active=false 면 지금 화면 그대로). 이벤트는 POST /api/ab/charge-event {event, packageId?, orderId?} 를 기다리지 않고 부른다. 어드민 결과표는 GET /api/admin/ab/charge-copy/stats, 설정 저장은 기존 PUT /api/settings(키 ab.charge_copy).
- ⏸ 2026-10-13 사장 결정: 보류. 묶음 B(충전 모달 문구 변경)·C(어드민 탭)·D(실험 켜기)는 진행하지 않는다. 묶음 A 산출물(빈 ChargeAbEvent 표, /api/ab, 어드민 결과표 API)은 꺼진 채 남겨 둔다 — 실험 설정(AppConfig ab.charge_copy)이 없어 전원 control·무기록. 다시 하려면 사장 지시 후 `/hermes 이어서 p849214`.

---

이어서 진행하려면 텔레그램으로: `/hermes 이어서 p849214`

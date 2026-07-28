import React, { useState } from 'react';

// 💸 환불 처리 절차 문서 (2026-07-29 신설)
// 사장 요청: "환불 해달라고 하면 어떻게 처리해야 될까? 문서를 만들어놔."
// ★현재 환불은 **수동 처리**다(결제 총 2건·환불 0건 규모라 자동화는 과잉).
//   막상 요청이 오면 "토스 어디로 들어가지?"부터 헤매게 되므로 순서를 박제해둔다.
// ★자동화(어드민 환불 버튼)는 건수가 늘면 검토 — 토스 취소 API + 포인트 회수 +
//   거래기록을 한 번에 처리해야 정합성이 깨지지 않는다.

const CARD = 'bg-gray-800/60 border border-gray-700 rounded-xl p-4';

export const RefundGuidePanel: React.FC = () => {
    const [amount, setAmount] = useState(5000);
    const [used, setUsed] = useState(0);
    const [days, setDays] = useState(3);
    const [fee, setFee] = useState(false);

    // 환불액 계산 — 약관 제5조 기준
    const pkg: Record<number, number> = { 5000: 5000, 10000: 11000, 50000: 60000 };
    const givenPoints = pkg[amount] ?? amount;
    const remain = Math.max(0, givenPoints - used);
    const ratio = givenPoints > 0 ? remain / givenPoints : 0;
    const base = Math.floor(amount * ratio);          // 잔여 비율만큼 환산
    const feeAmt = fee ? Math.floor(base * 0.1) : 0;  // 약관 ③ 수수료 10%(재량)
    const refund = Math.max(0, base - feeAmt);
    const fullRefund = used === 0 && days <= 7;

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
            <div>
                <p className="text-sm font-semibold text-white">💸 환불 처리 절차</p>
                <p className="text-xs text-gray-500">
                    현재 <b className="text-gray-300">수동 처리</b>입니다. 아래 순서대로 진행하세요.
                    (자동화는 건수가 늘면 검토 — 잘못 누르면 되돌릴 수 없는 작업이라 신중히)
                </p>
            </div>

            {/* 1단계 */}
            <div className={CARD}>
                <p className="text-sm font-semibold text-purple-300 mb-2">1️⃣ 요청 확인 — 무엇을 물어볼까</p>
                <ul className="text-xs text-gray-300 space-y-1 list-disc pl-4">
                    <li><b>닉네임 또는 가입한 전화번호/이메일</b> (계정 특정)</li>
                    <li><b>결제 일시와 금액</b> (영수증 문자·카드 내역으로 확인 가능)</li>
                    <li><b>환불 사유</b> (단순 변심 / 오결제 / 서비스 불만 — 응대 톤이 달라집니다)</li>
                </ul>
                <p className="text-[11px] text-gray-500 mt-2">
                    어드민 → <b>회원 관리</b>에서 닉네임으로 검색하면 포인트 잔액·거래내역을 볼 수 있습니다.
                </p>
            </div>

            {/* 2단계 */}
            <div className={CARD}>
                <p className="text-sm font-semibold text-purple-300 mb-2">2️⃣ 환불 가능 여부 판단 (약관 제5조)</p>
                <table className="w-full text-xs">
                    <tbody className="text-gray-300">
                        <tr className="border-b border-gray-700/60">
                            <td className="py-1.5 pr-3 text-gray-400 whitespace-nowrap">7일 이내 + 미사용</td>
                            <td className="py-1.5 text-emerald-300">전액 환불</td>
                        </tr>
                        <tr className="border-b border-gray-700/60">
                            <td className="py-1.5 pr-3 text-gray-400 whitespace-nowrap">일부 사용</td>
                            <td className="py-1.5">잔여 포인트분만 환불 · 수수료 10% <span className="text-gray-500">부과 <b>가능</b>(재량)</span></td>
                        </tr>
                        <tr className="border-b border-gray-700/60">
                            <td className="py-1.5 pr-3 text-gray-400 whitespace-nowrap">1년 경과</td>
                            <td className="py-1.5 text-red-300">환불 불가</td>
                        </tr>
                        <tr>
                            <td className="py-1.5 pr-3 text-gray-400 whitespace-nowrap">보너스 포인트</td>
                            <td className="py-1.5 text-red-300">환불 대상 아님 (가입·레벨업 등 무료 지급분)</td>
                        </tr>
                    </tbody>
                </table>
                <p className="text-[11px] text-amber-300/80 mt-2">
                    ※ 약관은 "수수료가 <b>부과될 수 있습니다</b>"라 재량입니다. 소액(5,000원)에서 500원을
                    떼면 정서적 반발이 크니 <b>초기 사례는 안 떼는 쪽</b>을 권합니다.
                </p>
            </div>

            {/* 계산기 */}
            <div className={CARD}>
                <p className="text-sm font-semibold text-purple-300 mb-3">🧮 환불액 계산기</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <label className="text-xs text-gray-400">
                        결제금액
                        <select value={amount} onChange={e => setAmount(Number(e.target.value))}
                            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white">
                            <option value={5000}>5,000원 (5,000P)</option>
                            <option value={10000}>10,000원 (11,000P)</option>
                            <option value={50000}>50,000원 (60,000P)</option>
                        </select>
                    </label>
                    <label className="text-xs text-gray-400">
                        사용한 포인트
                        <input type="number" min={0} value={used}
                            onChange={e => setUsed(Math.max(0, Number(e.target.value) || 0))}
                            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white" />
                    </label>
                    <label className="text-xs text-gray-400">
                        결제 후 경과일
                        <input type="number" min={0} value={days}
                            onChange={e => setDays(Math.max(0, Number(e.target.value) || 0))}
                            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white" />
                    </label>
                    <label className="text-xs text-gray-400 flex flex-col justify-end">
                        <span className="mb-1">수수료 10%</span>
                        <button onClick={() => setFee(!fee)}
                            className={`w-full py-1.5 rounded-lg text-sm border ${fee
                                ? 'bg-amber-600/30 border-amber-500 text-amber-200'
                                : 'bg-gray-900 border-gray-700 text-gray-400'}`}>
                            {fee ? '부과함' : '면제(권장)'}
                        </button>
                    </label>
                </div>
                <div className="bg-gray-900/70 rounded-lg p-3 text-xs space-y-1">
                    <div className="text-gray-400">지급된 포인트 <b className="text-gray-200">{givenPoints.toLocaleString()}P</b> · 잔여 <b className="text-gray-200">{remain.toLocaleString()}P</b> ({Math.round(ratio * 100)}%)</div>
                    {feeAmt > 0 && <div className="text-gray-400">수수료 −{feeAmt.toLocaleString()}원</div>}
                    <div className="text-base font-bold text-emerald-300">환불액 {refund.toLocaleString()}원</div>
                    {days > 365
                        ? <div className="text-red-300">⚠️ 1년 경과 — 약관상 환불 불가</div>
                        : fullRefund
                            ? <div className="text-emerald-300">✅ 7일 이내 미사용 — 전액 환불 대상</div>
                            : <div className="text-gray-500">부분 사용 건 — 잔여분 기준 계산</div>}
                </div>
            </div>

            {/* 3단계 */}
            <div className={CARD}>
                <p className="text-sm font-semibold text-purple-300 mb-2">3️⃣ 토스에서 결제 취소</p>
                <ol className="text-xs text-gray-300 space-y-1 list-decimal pl-4">
                    <li><a href="https://app.tosspayments.com" target="_blank" rel="noreferrer"
                        className="text-blue-300 underline">app.tosspayments.com</a> 로그인</li>
                    <li><b>결제내역</b>에서 해당 건 검색 (닉네임 아님 — <b>결제일시·금액</b>으로 찾기)</li>
                    <li><b>결제 취소</b> 클릭 → 전액 또는 부분금액 입력 → 확인</li>
                    <li>취소 완료 문자가 회원에게 자동 발송됨 (카드사 환급은 영업일 3~5일)</li>
                </ol>
                <p className="text-[11px] text-amber-300/80 mt-2">
                    ※ 계약완료 상점(MID)에서 처리해야 합니다. 상점이 여러 개면 결제된 상점을 확인하세요.
                </p>
            </div>

            {/* 4단계 */}
            <div className={CARD}>
                <p className="text-sm font-semibold text-purple-300 mb-2">4️⃣ 포인트 회수 요청</p>
                <p className="text-xs text-gray-300 mb-2">
                    ★<b className="text-amber-300">토스에서만 취소하고 포인트를 안 빼면 돈은 돌려주고 포인트는 남습니다.</b>
                    반드시 함께 처리하세요.
                </p>
                <p className="text-xs text-gray-400">
                    현재 어드민에 회수 버튼이 없으므로 <b className="text-gray-200">클로드에게 아래 형식으로 요청</b>하세요:
                </p>
                <pre className="mt-2 bg-gray-900 rounded-lg p-3 text-[11px] text-emerald-200 whitespace-pre-wrap">
{`환불 처리해줘
- 닉네임: 홍길동
- 결제 orderId: 56_basic_1783857018783
- 회수할 포인트: 5000
- 토스 취소: 완료함`}
                </pre>
                <p className="text-[11px] text-gray-500 mt-2">
                    회수는 <b>잔액가드 원자 UPDATE + PointTransaction 거래기록</b>을 동반해 처리됩니다
                    (기록 없이 숫자만 바꾸면 정산이 안 맞습니다).
                </p>
            </div>

            {/* 5단계 */}
            <div className={CARD}>
                <p className="text-sm font-semibold text-purple-300 mb-2">5️⃣ 회원 안내 문구 (복사용)</p>
                <pre className="bg-gray-900 rounded-lg p-3 text-[11px] text-gray-200 whitespace-pre-wrap">
{`안녕하세요, AI놀이터입니다.

요청하신 결제 건 환불 처리가 완료되었습니다.
· 환불 금액: 5,000원
· 처리 일자: 2026-00-00

카드사 사정에 따라 실제 환급까지 영업일 기준
3~5일이 소요될 수 있습니다.

이용에 불편을 드려 죄송합니다.
감사합니다.`}
                </pre>
            </div>

            {/* 주의사항 */}
            <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-4">
                <p className="text-sm font-semibold text-red-300 mb-2">⚠️ 반드시 지킬 것</p>
                <ul className="text-xs text-gray-300 space-y-1 list-disc pl-4">
                    <li><b>토스 취소와 포인트 회수는 한 세트</b> — 하나만 하면 정산이 어긋납니다.</li>
                    <li><b>환불은 되돌릴 수 없습니다</b> — 금액·계정을 두 번 확인하고 진행하세요.</li>
                    <li><b>보너스 포인트는 건드리지 않습니다</b> — 유료 충전분(paidPoints)만 회수.</li>
                    <li>처리 후 <b>회원에게 안내</b>까지 해야 문의가 반복되지 않습니다.</li>
                </ul>
            </div>

            <p className="text-[11px] text-gray-600">
                고객센터 0502-468-0502 · 약관 제5조(포인트 충전 및 환불 정책) 기준 · 최종 정리 2026-07-29
            </p>
        </div>
    );
};

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { attention, dateKey, Destination, fmt, loadDashboard, number, Snapshot, SourceKey, summarize } from './opsDashboard';
import './opsDashboard.css';

const COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500'];
type Series = { label: string; values: number[]; line?: boolean };
function Chart({ labels, series, unit = '' }: { labels: string[]; series: Series[]; unit?: string }) {
    const [tip, setTip] = useState<string | null>(null);
    const max = Math.max(1, ...labels.map((_, i) => series.filter(s => !s.line).reduce((sum, s) => sum + (s.values[i] || 0), 0)), ...series.flatMap(s => s.values));
    if (!labels.length) return <p className="ops-muted">미연결 · 집계 자료 없음</p>;
    const step = 520 / labels.length;
    return <div className="ops-chart">
        <div className="ops-legend">{series.map((s, j) => <span key={s.label}><i style={{ background: COLORS[j % 4] }} />{s.label}</span>)}</div>
        <p className="ops-muted">공통 축 0–{fmt(max, unit)}</p>
        <svg viewBox="0 0 550 200" role="img" aria-label={series.map(s => s.label).join(' · ')}>
            <line x1="15" y1="180" x2="540" y2="180" stroke="#4b5563" />
            {labels.map((label, i) => {
                let bottom = 180;
                const detail = `${label} · ${series.map(s => `${s.label} ${fmt(s.values[i], unit)}`).join(' / ')}`;
                return <g key={label} tabIndex={0} role="img" aria-label={detail} onMouseEnter={() => setTip(detail)} onMouseLeave={() => setTip(null)} onFocus={() => setTip(detail)} onBlur={() => setTip(null)}>
                    <title>{detail}</title>
                    <rect x={15 + i * step} y="5" width={step} height="180" fill="transparent" />
                    {series.filter(s => !s.line).map(s => {
                        const j = series.indexOf(s); const h = (s.values[i] || 0) / max * 155; bottom -= h;
                        return <rect key={s.label} x={17 + i * step} y={bottom} width={Math.max(1, step - 4)} height={h} fill={COLORS[j % 4]} pointerEvents="none" />;
                    })}
                </g>;
            })}
            {series.map((s, j) => s.line && <polyline key={s.label} points={s.values.map((v, i) => `${15 + (i + .5) * step},${180 - v / max * 155}`).join(' ')} stroke={COLORS[j % 4]} strokeWidth="3" fill="none" pointerEvents="none" />)}
        </svg>
        <div className="ops-chart-dates"><span>{labels[0]}</span><span>{labels.at(-1)}</span></div>
        <div className="ops-muted" role="tooltip">{tip || '막대에 마우스를 올리거나 키보드로 선택하세요.'}</div>
        <p>끝값 {labels.at(-1)} · {series.map(s => `${s.label} ${fmt(s.values.at(-1), unit)}`).join(' / ')}</p>
    </div>;
}
function Bars({ rows, unit = '' }: { rows: [string, number][]; unit?: string }) {
    const max = Math.max(1, ...rows.map(r => r[1]));
    return rows.length ? <div className="ops-bars">{rows.map(([label, value], i) => <div key={label}>
        <div className="ops-split"><span>{label}</span><strong>{fmt(value, unit)}</strong></div>
        <svg width="100%" height="8" aria-label={`${label} ${fmt(value, unit)}`}><rect width="100%" height="8" fill="#374151" rx="4" /><rect width={`${value / max * 100}%`} height="8" fill={COLORS[i % 4]} rx="4" /></svg>
    </div>)}</div> : <p className="ops-muted">미연결 · 집계 자료 없음</p>;
}
function Gauge({ label, value }: { label: string; value: unknown }) {
    const n = number(value);
    const color = n === undefined ? '#4b5563' : n >= 85 ? '#d03b3b' : n >= 60 ? '#fab219' : '#0ca30c';
    return <div><div className="ops-split"><span>{label}</span><strong>{fmt(n, '%')}</strong></div><svg width="100%" height="8" aria-label={`${label} ${fmt(n, '%')}`}><rect width="100%" height="8" fill="#374151" /><rect width={`${Math.min(100, Math.max(0, n || 0))}%`} height="8" fill={color} /></svg></div>;
}
export const OpsDashboardPanel: React.FC<{ onNavigate: (key: Destination) => void }> = ({ onNavigate }) => {
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
    const [busy, setBusy] = useState(false);
    const mounted = useRef(false);
    const inFlight = useRef(false);
    const refresh = useCallback(async () => {
        if (inFlight.current) return;
        inFlight.current = true; setBusy(true);
        try { const next = await loadDashboard(); if (mounted.current) setSnapshot(next); }
        finally { inFlight.current = false; if (mounted.current) setBusy(false); }
    }, []);
    useEffect(() => {
        mounted.current = true; void refresh();
        const timer = window.setInterval(() => { void refresh(); }, 60000);
        return () => { mounted.current = false; window.clearInterval(timer); };
    }, [refresh]);
    const data = snapshot?.data || {};
    const s = summarize(data);
    const items = attention(data);
    const failed = snapshot?.failed || [];
    const issueSources: SourceKey[] = ['errors', 'balances', 'batches', 'approvals', 'cron'];
    const issuesComplete = snapshot && issueSources.every(k => data[k] !== undefined) && data.balances?.solapi != null && data.balances?.googleTts != null && !data.balances.solapi.error && !data.balances.googleTts.error && number(data.balances.solapi.balance) !== undefined && number(data.balances.solapi.lowBalanceThreshold) !== undefined && number(data.balances.googleTts.usedPercent) !== undefined;
    const reports = [...(data.reports?.reports || [])].sort((a, b) => a.reportDate.localeCompare(b.reportDate));
    const marketing = [...(data.marketing?.rows || [])].sort((a, b) => a.day.localeCompare(b.day));
    const points = [...(data.points?.daily || [])].sort((a, b) => a.date.localeCompare(b.date));
    const aiDates = [...new Set(data.ai?.daily?.map(r => r.date.slice(0, 10)))].sort();
    const services = [...new Set(data.ai?.daily?.map(r => r.service))];
    function status(keys: SourceKey[]) {
        return keys.filter(k => failed.includes(k)).map(key => <button className="ops-error" key={key} onClick={refresh} disabled={busy}>{key}: 조회 실패 · 다시 시도</button>);
    }
    const kpis = [
        ['오늘 매출 / 충전', fmt(s.todayRevenue, '원'), `${dateKey(new Date())} KST · 당일 집계 없으면 미연결`],
        ['이번 달 매출', fmt(s.monthRevenue, '원'), '월초부터 오늘까지 집계 완료 시 표시'],
        ['회원 수', fmt(s.members, '명'), `오늘 가입 +${fmt(s.joined, '명')} · 체험 제외`],
        ['포인트 충전 · 30일', fmt(data.points?.summary.chargePt, 'pt'), `사용 ${fmt(data.points?.summary.spent, 'pt')}`],
        ['AI 비용 · 30일', fmt(data.ai?.total?.cost, ' USD'), 'TTS 정가 환산 포함 · 실제 청구와 다름'],
        ['확인할 항목', issuesComplete ? fmt(items.reduce((n, item) => n + item.count, 0), '건') : '미연결', '오류·잔액·배치·승인 합계'],
    ];
    return <div className="ops-dashboard" aria-busy={busy}>
        <header className="ops-top"><div><p className="ops-eyebrow">OPERATIONS / LIVE DATA</p><h1>운영 대시보드 · AI Chat</h1><p className="ops-muted" role="status">마지막 조회 {snapshot ? snapshot.queriedAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' KST' : '불러오는 중…'} · 60초 자동 갱신</p></div><button onClick={refresh} disabled={busy}>{busy ? '조회 중…' : '새로고침'}</button></header>
        <div className="ops-kpis">{kpis.map(([label, value, sub]) => <article key={label}><p className="ops-muted">{label}</p><strong>{value}</strong><p className="ops-muted">{sub}</p></article>)}</div>
        <div className="ops-grid">
            <section><h2><small>CH.1</small> 매출·충전 30일</h2>{status(['reports', 'directives'])}<Chart labels={reports.map(r => r.reportDate.slice(0, 10))} series={[{ label: '매출·충전', values: reports.map(r => r.revenueKrw) }]} unit="원" /><h3>경영 지시 · 최근 3개</h3>{data.directives?.directives.length ? [...data.directives.directives].sort((a, b) => b.createdDate.localeCompare(a.createdDate)).slice(0, 3).map(d => <div className="ops-row" key={d.id}><strong>{d.title}</strong><p className="ops-muted">{d.createdDate.slice(0, 10)} · {d.status} · {d.assignee || '담당 미지정'}</p></div>) : <p className="ops-muted">미연결 · 지시 자료 없음</p>}</section>
            <section><h2><small>CH.2</small> 회원·유입</h2>{status(['users', 'marketing', 'referral'])}<Chart labels={marketing.map(r => r.day.slice(0, 10))} series={[{ label: '가입(체험 포함)', values: marketing.map(r => r.signups) }, { label: '방문', values: marketing.map(r => r.visits), line: true }]} unit="명/회" /><h3>레퍼럴 퍼널 · 전체 기간</h3><Bars rows={data.referral ? [['링크 방문', data.referral.funnel.visits], ['추천 가입', data.referral.funnel.signups], ['보상 지급', data.referral.funnel.rewarded]] : []} /></section>
            <section><h2><small>CH.3</small> 포인트</h2>{status(['points', 'marketing'])}<Chart labels={points.map(r => r.date.slice(0, 10))} series={[{ label: '충전', values: points.map(r => r.chargeAmount) }, { label: '사용·소진', values: points.map(r => r.spent), line: true }]} unit="pt" /><p className="ops-muted">잔액 {data.points ? fmt(data.points.summary.outstandingPaid + data.points.summary.outstandingBonus, 'pt') : '미연결'}</p><h3>기능별 사용 TOP 8 · 30일 · 횟수</h3><Bars rows={s.features} unit="회" /></section>
            <section><h2><small>CH.4</small> AI 비용 30일</h2>{status(['ai'])}<p className="ops-total">총 {fmt(data.ai?.total?.cost, ' USD')}</p><Chart labels={aiDates} series={services.map(service => ({ label: service, values: aiDates.map(date => (data.ai?.daily || []).filter(r => r.date.slice(0, 10) === date && r.service === service).reduce((sum, r) => sum + Number(r.cost), 0)) }))} unit=" USD" /><p className="ops-muted">서비스별 일 누적 · TTS는 정가 환산액이며 무료한도 내 실제 청구는 0원입니다.</p></section>
            <section><h2><small>CH.5</small> 서버·배치·잔액</h2>{status(['server1', 'server2', 'cron', 'balances', 'batches'])}<div className="ops-servers">{(['server1', 'server2'] as const).map((key, i) => <article key={key}><h3>서버{i + 1}</h3>{data[key]?.error && <p className="ops-error">조회 실패 · 다시 시도 <button onClick={refresh}>재조회</button></p>}<Gauge label="메모리" value={data[key]?.memory?.usedPercent} /><Gauge label="디스크" value={data[key]?.disk?.usedPercent} /></article>)}</div><h3>크론 작업 상태</h3><p className="ops-muted">실행 결과 미연결 · 등록 일정만 제공{data.cron ? ` · 서버1 조회 ${data.cron.server1Ok ? '성공' : '실패'}` : ''}</p><table><thead><tr><th>작업 / 서버</th><th>일정</th></tr></thead><tbody>{data.cron?.jobs.map(job => <tr key={`${job.server}-${job.id}`}><td>{job.name}<p className="ops-muted">{job.server}</p></td><td>{job.cycle} · {job.when}</td></tr>)}</tbody></table>{!data.cron?.jobs.length && <p className="ops-muted">미연결 · 작업 자료 없음</p>}<h3>서비스 잔액·사용량</h3><div className="ops-row"><Gauge label="TTS 무료한도 소진" value={data.balances?.googleTts?.error ? undefined : data.balances?.googleTts?.usedPercent} /><p className={items.some(i => i.label === '솔라피 잔액 부족') ? 'ops-balance-warning' : undefined}>솔라피 잔액 {data.balances?.solapi?.error ? '조회 실패 · 다시 시도' : fmt(data.balances?.solapi?.balance, '원')}</p><p>OpenAI 월 누적 {data.balances?.openai?.error ? '조회 실패 · 다시 시도' : fmt(data.balances?.openai?.monthToDateUsd, ' USD')}</p><p className="ops-muted">OpenAI 선불 잔액 미연결 · TTS 잔액 미연결</p>{Object.values(data.balances || {}).some(v => v?.error) && <button onClick={refresh}>다시 시도</button>}</div></section>
            <section><h2><small>CH.6</small> 확인할 항목</h2>{status(issueSources)}{!issuesComplete && <p className="ops-muted">미연결 항목이 있어 전체 건수를 확정할 수 없습니다.</p>}{items.length ? items.map(item => <div className="ops-attention" key={item.label}><div><strong>{item.label}</strong><p>{fmt(item.count, '건')}</p></div><button onClick={() => onNavigate(item.tab)}>해당 탭으로 →</button></div>) : <p className="ops-muted">{issuesComplete ? '확인할 항목이 없습니다.' : '연결된 자료에서 확인할 항목 없음'}</p>}{data.errors?.recent.map((line, i) => <p className="ops-log" key={i}>{line}</p>)}</section>
        </div>
    </div>;
};

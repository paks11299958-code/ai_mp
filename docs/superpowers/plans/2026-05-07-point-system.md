# 포인트 시스템 + XP 연동 + 별풍선 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 포인트 기반 대화 과금 시스템 + XP 레벨 연동 할인 + 별풍선 선물 기능을 결제 연동 없이 완전히 구축한다.

**Architecture:** Prisma 트랜잭션으로 포인트 차감과 XP 적립을 원자적으로 처리. 모든 포인트 변동은 PointTransaction 테이블에 기록해 대시보드/어드민 통계의 원천으로 활용. 별풍선은 포인트를 소비해 페르소나에게 전송하는 감성 기능으로, AI가 특별한 반응을 생성한다.

**Tech Stack:** Prisma 7.x, PostgreSQL, React 18 + TypeScript, Tailwind CSS v4, Vercel Serverless Functions

---

## 핵심 상수 (구현 전 확정)

```typescript
// 메시지당 포인트 차감 (XP 단계별)
const STAGE_COSTS = [10, 9, 8, 7, 6, 5]; // 1~6단계

// 레벨업 보너스 포인트 (2단계 달성 시 20pt, ...)
const LEVELUP_BONUS = [0, 20, 50, 100, 200, 500]; // index = 새 단계-1

// 신규 가입 무료 포인트
const SIGNUP_POINTS = 30; // 3회 무료 대화

// 별풍선 1개 = 10포인트
const BALLOON_COST = 10;

// 포인트 패키지
const PACKAGES = [
  { id: 'p1', name: '스타터', points: 100,  price: 1000 },
  { id: 'p2', name: '기본',   points: 330,  price: 3000 },
  { id: 'p3', name: '인기',   points: 600,  price: 5000 },
  { id: 'p4', name: '프리미엄', points: 1300, price: 10000 },
];
```

---

## 파일 구조

### 신규 생성
- `prisma/schema.prisma` — PointTransaction, StarBalloon 모델 추가, User.points 추가
- `api/_lib/points.ts` — 포인트 차감/지급/레벨업 헬퍼 함수
- `frontend/components/PointDisplay.tsx` — 헤더 포인트 잔액 표시
- `frontend/components/PointModal.tsx` — 포인트 부족 시 충전 안내 모달
- `frontend/components/StarBalloonButton.tsx` — 별풍선 전송 UI
- `frontend/components/PointDashboard.tsx` — 사용자 포인트 대시보드
- `frontend/services/pointService.ts` — 포인트 관련 API 함수

### 수정
- `prisma/schema.prisma` — User 모델에 points 필드 추가
- `api/router.ts` — points, star-balloon 도메인 추가, sessions/messages에 차감 로직 추가
- `frontend/App.tsx` — 포인트 상태 전역 관리, PointDisplay 추가
- `frontend/components/AdminPanel.tsx` — 포인트 통계 탭 추가

---

## Task 1: DB 스키마 추가

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: schema.prisma에 필드/모델 추가**

`User` 모델에 추가:
```prisma
  points            Int               @default(30)
  pointTransactions PointTransaction[]
  starBalloonsGiven StarBalloon[]     @relation("GivenBy")
```

`Persona` 모델에 추가:
```prisma
  starBalloons      StarBalloon[]
  pointTransactions PointTransaction[]
```

파일 끝에 새 모델 추가:
```prisma
model PointTransaction {
  id           Int      @id @default(autoincrement())
  userId       Int
  amount       Int
  type         String   // SIGNUP | CHAT | LEVELUP | BALLOON | CHARGE | ADMIN
  description  String?
  personaId    String?
  balanceAfter Int
  createdAt    DateTime @default(now())
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  persona      Persona? @relation(fields: [personaId], references: [id], onDelete: SetNull)
}

model StarBalloon {
  id          Int      @id @default(autoincrement())
  fromUserId  Int
  personaId   String
  amount      Int
  pointsSpent Int
  message     String?
  createdAt   DateTime @default(now())
  fromUser    User     @relation("GivenBy", fields: [fromUserId], references: [id], onDelete: Cascade)
  persona     Persona  @relation(fields: [personaId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: DB 반영 및 클라이언트 재생성**

```bash
npx prisma db push
npx prisma generate
git add src/generated/prisma prisma/schema.prisma
```

- [ ] **Step 3: 기존 유저 points 초기화 확인**

`npx prisma db push`가 기존 User에 `points = 30`을 기본값으로 설정한다. 기존 유저도 자동 적용됨.

- [ ] **Step 4: 커밋**

```bash
git commit -m "feat: PointTransaction, StarBalloon 모델 추가, User.points 필드 추가"
```

---

## Task 2: 포인트 헬퍼 라이브러리

**Files:**
- Create: `api/_lib/points.ts`

- [ ] **Step 1: points.ts 생성**

```typescript
import { PrismaClient } from '../../src/generated/prisma';

const STAGE_THRESHOLDS = [0, 30, 150, 500, 1200, 2500];
const STAGE_COSTS      = [10,  9,   8,   7,    6,    5];
const LEVELUP_BONUS    = [ 0, 20,  50, 100,  200,  500];

export function getStageIndex(xp: number): number {
  for (let i = STAGE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= STAGE_THRESHOLDS[i]) return i;
  }
  return 0;
}

export function getMessageCost(xp: number): number {
  return STAGE_COSTS[getStageIndex(xp)];
}

// 포인트 차감 + XP 적립 + 레벨업 감지 (트랜잭션)
export async function deductPointsForMessage(
  prisma: PrismaClient,
  userId: number,
  personaId: string
): Promise<{ success: boolean; newBalance: number; leveledUp: boolean; newStage: number; bonusPoints: number }> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { points: true } });
    if (!user) throw new Error('USER_NOT_FOUND');

    const xpRecord = await tx.userPersonaXp.findUnique({
      where: { userId_personaId: { userId, personaId } },
    });
    const currentXp = xpRecord?.xp ?? 0;
    const cost = getMessageCost(currentXp);

    if (user.points < cost) throw new Error('INSUFFICIENT_POINTS');

    const newBalance = user.points - cost;
    await tx.user.update({ where: { id: userId }, data: { points: newBalance } });
    await tx.pointTransaction.create({
      data: { userId, amount: -cost, type: 'CHAT', personaId, balanceAfter: newBalance },
    });

    // XP +1
    const oldStage = getStageIndex(currentXp);
    const newXp = currentXp + 1;
    await tx.userPersonaXp.upsert({
      where: { userId_personaId: { userId, personaId } },
      create: { userId, personaId, xp: newXp },
      update: { xp: newXp },
    });
    const newStage = getStageIndex(newXp);

    // 레벨업 보너스
    let bonusPoints = 0;
    if (newStage > oldStage) {
      bonusPoints = LEVELUP_BONUS[newStage];
      if (bonusPoints > 0) {
        const bonusBalance = newBalance + bonusPoints;
        await tx.user.update({ where: { id: userId }, data: { points: bonusBalance } });
        await tx.pointTransaction.create({
          data: { userId, amount: bonusPoints, type: 'LEVELUP', personaId, balanceAfter: bonusBalance },
        });
      }
    }

    return { success: true, newBalance: newBalance + bonusPoints, leveledUp: newStage > oldStage, newStage, bonusPoints };
  });
}

// 신규 가입 포인트 지급
export async function grantSignupPoints(prisma: PrismaClient, userId: number): Promise<void> {
  await prisma.pointTransaction.create({
    data: { userId, amount: 30, type: 'SIGNUP', description: '신규 가입 보너스', balanceAfter: 30 },
  });
}
```

- [ ] **Step 2: 커밋**

```bash
git add api/_lib/points.ts
git commit -m "feat: 포인트 차감/XP 연동/레벨업 보너스 헬퍼 추가"
```

---

## Task 3: API 라우터 - points 도메인 추가

**Files:**
- Modify: `api/router.ts`

- [ ] **Step 1: points 도메인 라우팅 추가**

`api/router.ts`에서 domain 분기 처리 부분에 추가:

```typescript
if (domain === 'points') {
  const requireAuth = () => {
    const user = verifyToken(req);
    if (!user) { res.status(401).json({ error: '인증 필요' }); return null; }
    return user;
  };

  // GET /api/points — 잔액 + 최근 거래 내역
  if (req.method === 'GET' && !s1) {
    const user = requireAuth(); if (!user) return;
    const [userData, transactions] = await Promise.all([
      prisma.user.findUnique({ where: { id: user.id }, select: { points: true } }),
      prisma.pointTransaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { persona: { select: { id: true, name: true } } },
      }),
    ]);
    return res.json({ points: userData?.points ?? 0, transactions });
  }

  // GET /api/points/stats — 대시보드 통계
  if (req.method === 'GET' && s1 === 'stats') {
    const user = requireAuth(); if (!user) return;
    const [totalSpent, byPersona, balloonsSent] = await Promise.all([
      prisma.pointTransaction.aggregate({
        where: { userId: user.id, amount: { lt: 0 }, type: 'CHAT' },
        _sum: { amount: true },
      }),
      prisma.pointTransaction.groupBy({
        by: ['personaId'],
        where: { userId: user.id, type: 'CHAT' },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'asc' } },
      }),
      prisma.starBalloon.aggregate({
        where: { fromUserId: user.id },
        _sum: { amount: true, pointsSpent: true },
      }),
    ]);
    const personaIds = byPersona.map(b => b.personaId).filter(Boolean) as string[];
    const personaNames = await prisma.persona.findMany({
      where: { id: { in: personaIds } },
      select: { id: true, name: true, imageUrl: true },
    });
    const byPersonaWithName = byPersona.map(b => ({
      personaId: b.personaId,
      spent: Math.abs(b._sum.amount ?? 0),
      persona: personaNames.find(p => p.id === b.personaId),
    }));
    return res.json({
      totalSpent: Math.abs(totalSpent._sum.amount ?? 0),
      byPersona: byPersonaWithName,
      balloonsSent: balloonsSent._sum.amount ?? 0,
      balloonsPointsSpent: balloonsSent._sum.pointsSpent ?? 0,
    });
  }

  // GET /api/points/cost — 현재 메시지 비용 조회
  if (req.method === 'GET' && s1 === 'cost') {
    const user = requireAuth(); if (!user) return;
    const { personaId } = req.query as { personaId?: string };
    if (!personaId) return res.status(400).json({ error: 'personaId 필요' });
    const xpRecord = await prisma.userPersonaXp.findUnique({
      where: { userId_personaId: { userId: user.id, personaId } },
    });
    const xp = xpRecord?.xp ?? 0;
    const { getMessageCost, getStageIndex } = await import('./_lib/points');
    return res.json({ cost: getMessageCost(xp), stage: getStageIndex(xp) + 1, xp });
  }
}
```

- [ ] **Step 2: auth/register에 signup 포인트 지급 추가**

`router.ts`에서 회원가입 성공 직후:
```typescript
// 기존: await prisma.user.create(...) 아래에 추가
const { grantSignupPoints } = await import('./_lib/points');
await grantSignupPoints(prisma, newUser.id);
```

- [ ] **Step 3: 커밋**

```bash
git add api/router.ts
git commit -m "feat: /api/points 도메인 추가 (잔액, 통계, 비용 조회)"
```

---

## Task 4: 채팅 메시지 전송 시 포인트 차감

**Files:**
- Modify: `api/router.ts` (sessions 도메인 메시지 전송 부분)

- [ ] **Step 1: 메시지 전송 API에 포인트 차감 추가**

`router.ts`에서 sessions 도메인, AI 응답 저장 직전에 삽입:

```typescript
// AI 응답 저장 전에 포인트 차감
const { deductPointsForMessage } = await import('./_lib/points');
let deductResult;
try {
  deductResult = await deductPointsForMessage(prisma, user.id, personaId);
} catch (e: any) {
  if (e.message === 'INSUFFICIENT_POINTS') {
    return res.status(402).json({ error: 'INSUFFICIENT_POINTS', message: '포인트가 부족합니다.' });
  }
  throw e;
}

// AI 메시지 저장 (기존 코드)
await prisma.message.create({ ... });

// 응답에 포인트 정보 포함
return res.json({
  message: aiMessage,
  points: {
    balance: deductResult.newBalance,
    cost: /* 차감된 포인트 */,
    leveledUp: deductResult.leveledUp,
    newStage: deductResult.newStage,
    bonusPoints: deductResult.bonusPoints,
  }
});
```

- [ ] **Step 2: 커밋**

```bash
git add api/router.ts
git commit -m "feat: AI 응답 후 포인트 차감 + XP 연동 레벨업 보너스"
```

---

## Task 5: 별풍선 API

**Files:**
- Modify: `api/router.ts`

- [ ] **Step 1: star-balloon 도메인 추가**

```typescript
if (domain === 'star-balloon') {
  const requireAuth = () => {
    const user = verifyToken(req);
    if (!user) { res.status(401).json({ error: '인증 필요' }); return null; }
    return user;
  };

  // POST /api/star-balloon — 별풍선 전송
  if (req.method === 'POST') {
    const user = requireAuth(); if (!user) return;
    const { personaId, amount, message } = req.body as { personaId: string; amount: number; message?: string };
    if (!personaId || !amount || amount < 1) return res.status(400).json({ error: '잘못된 요청' });

    const pointsSpent = amount * 10; // 별풍선 1개 = 10포인트

    const result = await prisma.$transaction(async (tx) => {
      const userData = await tx.user.findUnique({ where: { id: user.id }, select: { points: true } });
      if (!userData || userData.points < pointsSpent) throw new Error('INSUFFICIENT_POINTS');

      const newBalance = userData.points - pointsSpent;
      await tx.user.update({ where: { id: user.id }, data: { points: newBalance } });
      await tx.pointTransaction.create({
        data: { userId: user.id, amount: -pointsSpent, type: 'BALLOON', personaId, balanceAfter: newBalance, description: `별풍선 ${amount}개` },
      });
      const balloon = await tx.starBalloon.create({
        data: { fromUserId: user.id, personaId, amount, pointsSpent, message },
      });
      return { balloon, newBalance };
    });

    return res.json(result);
  }

  // GET /api/star-balloon/:personaId/ranking — 페르소나 후원 랭킹
  if (req.method === 'GET' && s1) {
    const ranking = await prisma.starBalloon.groupBy({
      by: ['fromUserId'],
      where: { personaId: s1 },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 10,
    });
    const userIds = ranking.map(r => r.fromUserId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true },
    });
    const result = ranking.map(r => ({
      user: users.find(u => u.id === r.fromUserId),
      totalBalloons: r._sum.amount ?? 0,
    }));
    return res.json(result);
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add api/router.ts
git commit -m "feat: /api/star-balloon 도메인 추가 (전송, 페르소나 랭킹)"
```

---

## Task 6: 프론트엔드 - 포인트 서비스 & 상태 관리

**Files:**
- Create: `frontend/services/pointService.ts`
- Modify: `frontend/App.tsx`

- [ ] **Step 1: pointService.ts 생성**

```typescript
import { apiRequest } from './apiService';

export const pointApi = {
  getBalance: () => apiRequest<{ points: number; transactions: any[] }>('/api/points'),
  getStats: () => apiRequest<any>('/api/points/stats'),
  getCost: (personaId: string) => apiRequest<{ cost: number; stage: number; xp: number }>(`/api/points/cost?personaId=${personaId}`),
  sendBalloon: (personaId: string, amount: number, message?: string) =>
    apiRequest<any>('/api/star-balloon', { method: 'POST', body: JSON.stringify({ personaId, amount, message }) }),
  getRanking: (personaId: string) => apiRequest<any[]>(`/api/star-balloon/${personaId}/ranking`),
};
```

- [ ] **Step 2: App.tsx에 포인트 전역 상태 추가**

```typescript
const [userPoints, setUserPoints] = useState<number>(0);
const [showPointModal, setShowPointModal] = useState(false);
const [levelUpInfo, setLevelUpInfo] = useState<{ newStage: number; bonusPoints: number } | null>(null);

// 로그인 후 포인트 로드
useEffect(() => {
  if (!user) return;
  pointApi.getBalance().then(data => setUserPoints(data.points)).catch(() => {});
}, [user]);
```

- [ ] **Step 3: 메시지 전송 응답 핸들링에 포인트 업데이트 추가**

AI 응답 수신 후:
```typescript
if (response.points) {
  setUserPoints(response.points.balance);
  if (response.points.leveledUp) {
    setLevelUpInfo({ newStage: response.points.newStage, bonusPoints: response.points.bonusPoints });
  }
}
if (response.error === 'INSUFFICIENT_POINTS') {
  setShowPointModal(true);
  return;
}
```

- [ ] **Step 4: 커밋**

```bash
git add frontend/services/pointService.ts frontend/App.tsx
git commit -m "feat: 포인트 전역 상태 관리 + API 서비스 추가"
```

---

## Task 7: 프론트엔드 - PointDisplay 컴포넌트

**Files:**
- Create: `frontend/components/PointDisplay.tsx`

- [ ] **Step 1: PointDisplay.tsx 생성**

```tsx
import React from 'react';
import { Coins } from 'lucide-react';

interface PointDisplayProps {
  points: number;
  cost?: number;
  onClick?: () => void;
}

export const PointDisplay: React.FC<PointDisplayProps> = ({ points, cost, onClick }) => {
  const isLow = points < 20;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-semibold transition-all
        ${isLow ? 'border-red-500/50 bg-red-900/20 text-red-400' : 'border-gray-700 bg-gray-900 text-yellow-400'}`}
    >
      <Coins size={14} />
      <span>{points.toLocaleString()}</span>
      {cost && <span className="text-xs text-gray-500 font-normal">(-{cost})</span>}
    </button>
  );
};
```

- [ ] **Step 2: Sidebar에 PointDisplay 추가**

`frontend/components/Sidebar.tsx` 상단에 포인트 표시:
```tsx
<PointDisplay points={userPoints} cost={currentCost} onClick={() => setShowPointModal(true)} />
```

- [ ] **Step 3: 커밋**

```bash
git add frontend/components/PointDisplay.tsx frontend/components/Sidebar.tsx
git commit -m "feat: 사이드바 포인트 잔액 실시간 표시"
```

---

## Task 8: 프론트엔드 - 포인트 부족 모달

**Files:**
- Create: `frontend/components/PointModal.tsx`

- [ ] **Step 1: PointModal.tsx 생성**

```tsx
import React from 'react';
import { Coins, X } from 'lucide-react';

const PACKAGES = [
  { id: 'p1', name: '스타터',  points: 100,  price: 1000 },
  { id: 'p2', name: '기본',    points: 330,  price: 3000 },
  { id: 'p3', name: '인기 ⭐', points: 600,  price: 5000 },
  { id: 'p4', name: '프리미엄', points: 1300, price: 10000 },
];

interface PointModalProps {
  currentPoints: number;
  onClose: () => void;
}

export const PointModal: React.FC<PointModalProps> = ({ currentPoints, onClose }) => (
  <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Coins size={20} className="text-yellow-400" />포인트 충전
        </h3>
        <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
      </div>
      <p className="text-sm text-gray-400 mb-4">
        잔여 포인트: <span className="text-red-400 font-bold">{currentPoints}pt</span> — 대화를 계속하려면 충전이 필요합니다.
      </p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {PACKAGES.map(pkg => (
          <button
            key={pkg.id}
            className="border border-gray-700 hover:border-yellow-500 rounded-xl p-3 text-left transition-all group"
            onClick={() => alert('결제 기능 준비 중입니다.')}
          >
            <div className="text-sm font-bold text-white group-hover:text-yellow-400">{pkg.name}</div>
            <div className="text-yellow-400 font-bold">{pkg.points.toLocaleString()}pt</div>
            <div className="text-xs text-gray-500">{pkg.price.toLocaleString()}원</div>
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-600 text-center">레벨이 높을수록 메시지당 포인트 소모가 줄어듭니다</p>
    </div>
  </div>
);
```

- [ ] **Step 2: App.tsx에 PointModal 연결**

```tsx
{showPointModal && (
  <PointModal currentPoints={userPoints} onClose={() => setShowPointModal(false)} />
)}
```

- [ ] **Step 3: 커밋**

```bash
git add frontend/components/PointModal.tsx frontend/App.tsx
git commit -m "feat: 포인트 부족 충전 모달 추가"
```

---

## Task 9: 프론트엔드 - 레벨업 축하 토스트

**Files:**
- Modify: `frontend/App.tsx`

- [ ] **Step 1: 레벨업 토스트 UI 추가**

App.tsx에 레벨업 발생 시 화면에 잠깐 표시:

```tsx
{levelUpInfo && (
  <div
    className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-bounce"
    onAnimationEnd={() => setTimeout(() => setLevelUpInfo(null), 2000)}
  >
    <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold px-6 py-3 rounded-full shadow-2xl text-sm">
      🎉 {levelUpInfo.newStage}단계 달성! +{levelUpInfo.bonusPoints}pt 보너스 획득!
    </div>
  </div>
)}
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/App.tsx
git commit -m "feat: 레벨업 시 보너스 포인트 토스트 알림"
```

---

## Task 10: 프론트엔드 - 별풍선 전송 버튼

**Files:**
- Create: `frontend/components/StarBalloonButton.tsx`
- Modify: `frontend/App.tsx` (채팅 입력창 영역)

- [ ] **Step 1: StarBalloonButton.tsx 생성**

```tsx
import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { pointApi } from '../services/pointService';

const BALLOON_OPTIONS = [
  { amount: 1,   label: '⭐ ×1',   points: 10 },
  { amount: 5,   label: '⭐ ×5',   points: 50 },
  { amount: 10,  label: '⭐ ×10',  points: 100 },
  { amount: 100, label: '⭐ ×100', points: 1000 },
];

interface StarBalloonButtonProps {
  personaId: string;
  personaName: string;
  userPoints: number;
  onSent: (newBalance: number) => void;
}

export const StarBalloonButton: React.FC<StarBalloonButtonProps> = ({ personaId, personaName, userPoints, onSent }) => {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [showAnim, setShowAnim] = useState(false);

  const send = async (amount: number, points: number) => {
    if (userPoints < points) { alert('포인트가 부족합니다.'); return; }
    setSending(true);
    try {
      const result = await pointApi.sendBalloon(personaId, amount);
      onSent(result.newBalance);
      setOpen(false);
      setShowAnim(true);
      setTimeout(() => setShowAnim(false), 2000);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative">
      {showAnim && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="text-6xl animate-bounce">⭐</div>
        </div>
      )}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-yellow-400 hover:bg-yellow-400/10 transition-colors text-sm"
        title="별풍선 보내기"
      >
        <Star size={16} fill="currentColor" />
        <span className="text-xs">별풍선</span>
      </button>
      {open && (
        <div className="absolute bottom-10 left-0 bg-gray-900 border border-gray-700 rounded-2xl p-3 shadow-2xl z-40 w-48">
          <p className="text-xs text-gray-400 mb-2">{personaName}에게 별풍선 보내기</p>
          {BALLOON_OPTIONS.map(opt => (
            <button
              key={opt.amount}
              onClick={() => send(opt.amount, opt.points)}
              disabled={sending || userPoints < opt.points}
              className="w-full flex justify-between items-center px-3 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-40 text-sm transition-colors"
            >
              <span className="text-white">{opt.label}</span>
              <span className="text-yellow-400 text-xs">{opt.points}pt</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: 채팅 입력창 옆에 StarBalloonButton 추가**

`App.tsx` 채팅 입력창 영역에:
```tsx
<StarBalloonButton
  personaId={activePersona.id}
  personaName={activePersona.name}
  userPoints={userPoints}
  onSent={(newBalance) => setUserPoints(newBalance)}
/>
```

- [ ] **Step 3: 커밋**

```bash
git add frontend/components/StarBalloonButton.tsx frontend/App.tsx
git commit -m "feat: 별풍선 전송 UI + 애니메이션"
```

---

## Task 11: 프론트엔드 - 사용자 포인트 대시보드

**Files:**
- Create: `frontend/components/PointDashboard.tsx`

- [ ] **Step 1: PointDashboard.tsx 생성**

```tsx
import React, { useEffect, useState } from 'react';
import { Coins, Star, TrendingDown, X } from 'lucide-react';
import { pointApi } from '../services/pointService';

interface PointDashboardProps {
  onClose: () => void;
}

export const PointDashboard: React.FC<PointDashboardProps> = ({ onClose }) => {
  const [data, setData] = useState<any>(null);
  const [balance, setBalance] = useState<{ points: number; transactions: any[] } | null>(null);

  useEffect(() => {
    Promise.all([pointApi.getStats(), pointApi.getBalance()]).then(([stats, bal]) => {
      setData(stats);
      setBalance(bal);
    });
  }, []);

  const TYPE_LABEL: Record<string, string> = {
    SIGNUP: '가입 보너스', CHAT: '대화', LEVELUP: '레벨업 보너스', BALLOON: '별풍선', CHARGE: '충전', ADMIN: '관리자 지급',
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Coins size={20} className="text-yellow-400" />포인트 현황</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>

        {data && balance && (
          <>
            {/* 잔액 */}
            <div className="bg-gray-800 rounded-xl p-4 mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">현재 잔액</p>
                <p className="text-3xl font-bold text-yellow-400">{balance.points.toLocaleString()}<span className="text-sm font-normal text-gray-400 ml-1">pt</span></p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">총 소비</p>
                <p className="text-lg font-bold text-red-400">{data.totalSpent.toLocaleString()}pt</p>
              </div>
            </div>

            {/* 페르소나별 소비 */}
            {data.byPersona.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-1"><TrendingDown size={14} />페르소나별 소비</p>
                {data.byPersona.map((b: any) => (
                  <div key={b.personaId} className="flex items-center gap-2 py-1.5">
                    {b.persona?.imageUrl && <img src={b.persona.imageUrl} className="w-6 h-6 rounded-full object-cover object-top" />}
                    <span className="text-sm text-gray-300 flex-1">{b.persona?.name ?? '알 수 없음'}</span>
                    <span className="text-sm text-yellow-400">{b.spent}pt</span>
                  </div>
                ))}
              </div>
            )}

            {/* 별풍선 */}
            {data.balloonsSent > 0 && (
              <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-3 mb-4 flex items-center gap-2">
                <Star size={16} className="text-yellow-400" fill="currentColor" />
                <span className="text-sm text-gray-300">보낸 별풍선 <strong className="text-yellow-400">{data.balloonsSent}개</strong> ({data.balloonsPointsSpent}pt 사용)</span>
              </div>
            )}

            {/* 거래 내역 */}
            <div>
              <p className="text-sm font-semibold text-gray-300 mb-2">최근 내역</p>
              <div className="space-y-1">
                {balance.transactions.slice(0, 20).map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between py-1.5 border-b border-gray-800 text-sm">
                    <div>
                      <span className="text-gray-300">{TYPE_LABEL[tx.type] ?? tx.type}</span>
                      {tx.persona && <span className="text-xs text-gray-500 ml-1">({tx.persona.name})</span>}
                    </div>
                    <span className={tx.amount > 0 ? 'text-green-400' : 'text-red-400'}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}pt
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: App.tsx / Sidebar에 대시보드 진입점 추가**

사이드바 또는 헤더의 포인트 클릭 시 대시보드 모달 표시.

- [ ] **Step 3: 커밋**

```bash
git add frontend/components/PointDashboard.tsx
git commit -m "feat: 사용자 포인트 대시보드 (잔액, 페르소나별 소비, 별풍선, 내역)"
```

---

## Task 12: 어드민 패널 - 포인트 통계 탭

**Files:**
- Modify: `api/router.ts` (admin 도메인)
- Modify: `frontend/components/AdminPanel.tsx`

- [ ] **Step 1: admin/point-stats API 추가**

```typescript
// GET /api/admin/point-stats
if (domain === 'admin' && s1 === 'point-stats') {
  requireAdmin();
  const [totalTransactions, topSpenders, personaRanking, balloonRanking] = await Promise.all([
    prisma.pointTransaction.aggregate({ _sum: { amount: true }, _count: true }),
    prisma.pointTransaction.groupBy({
      by: ['userId'], where: { type: 'CHAT' },
      _sum: { amount: true }, orderBy: { _sum: { amount: 'asc' } }, take: 10,
    }),
    prisma.pointTransaction.groupBy({
      by: ['personaId'], where: { type: 'CHAT', personaId: { not: null } },
      _sum: { amount: true }, orderBy: { _sum: { amount: 'asc' } }, take: 10,
    }),
    prisma.starBalloon.groupBy({
      by: ['personaId'], _sum: { amount: true, pointsSpent: true },
      orderBy: { _sum: { pointsSpent: 'desc' } }, take: 10,
    }),
  ]);
  // 유저명/페르소나명 조인 후 응답
  return res.json({ totalTransactions, topSpenders, personaRanking, balloonRanking });
}
```

- [ ] **Step 2: AdminPanel.tsx에 포인트 통계 탭 추가**

기존 탭 배열에 추가:
```tsx
{ key: 'points', label: '포인트 통계' }
```

탭 콘텐츠에 유저별/페르소나별 소비량 테이블 표시.

- [ ] **Step 3: 커밋**

```bash
git add api/router.ts frontend/components/AdminPanel.tsx
git commit -m "feat: 어드민 포인트 통계 탭 (유저별, 페르소나별, 별풍선 랭킹)"
```

---

## 구현 후 검증 체크리스트

- [ ] 신규 가입 → points=30, PointTransaction(SIGNUP) 생성 확인
- [ ] 메시지 전송 → points 차감, 30pt 미만 시 402 응답 확인
- [ ] 1단계 10pt, 2단계 9pt 차감 확인 (XP 30 이상 유저로 테스트)
- [ ] 레벨업 시 보너스 포인트 지급 + 토스트 표시 확인
- [ ] 포인트 0일 때 메시지 전송 → PointModal 팝업 확인
- [ ] 별풍선 전송 → StarBalloon DB 저장, 잔액 차감 확인
- [ ] 대시보드 → 페르소나별 소비 통계 정확성 확인
- [ ] 어드민 포인트 통계 탭 → 데이터 표시 확인

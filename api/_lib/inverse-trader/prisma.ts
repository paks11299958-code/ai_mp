/**
 * 인버스 ETF 1호가 스캘핑 — Prisma 클라이언트 접근자.
 *
 * ai_mp 의 다른 코드(local-api.cjs)와 같은 방식으로 PrismaPg 어댑터 + PrismaClient 를 쓴다.
 * 서버리스에서 커넥션이 폭증하지 않도록 globalThis 에 싱글턴으로 물려둔다.
 *
 * ★ Inverse* 모델은 아직 `prisma generate` 로 클라이언트에 반영되지 않았을 수 있다
 *   (묶음 A 에서 스키마만 추가한 상태). 그래서 PrismaClient 를 그대로 쓰지 않고
 *   db.ts 의 구조적 인터페이스(InverseTraderDb)로 캐스팅해 넘긴다.
 *   배포 전 `npx prisma generate` + 마이그레이션이 반드시 선행되어야 실제로 동작한다.
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../src/generated/prisma/index.js';
import type { InverseTraderDb } from './db.js';

const GLOBAL_KEY = '__inverseTraderPrisma__';

/** 프로세스 공용 PrismaClient. 없으면 만들고, 있으면 재사용한다. */
export function getPrisma(): PrismaClient {
    const g = globalThis as any;
    if (!g[GLOBAL_KEY]) {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error('DATABASE_URL 이 설정되지 않아 인버스 자동매매 DB에 접근할 수 없습니다.');
        }
        const adapter = new PrismaPg({ connectionString });
        g[GLOBAL_KEY] = new PrismaClient({ adapter });
    }
    return g[GLOBAL_KEY] as PrismaClient;
}

/**
 * 인버스 자동매매 모듈이 쓰는 DB 핸들.
 * PrismaClient 를 InverseTraderDb 로 캐스팅해서 돌려준다(구조적 호환).
 */
export function getInverseDb(): InverseTraderDb {
    return getPrisma() as unknown as InverseTraderDb;
}

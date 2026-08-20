/**
 * 개발AI 콘솔 — 어드민 API (1단계: 프로젝트 CRUD + 명세 버전).
 *
 * 텔레그램으로 한 줄씩 지시하던 허드 개발 파이프라인을, 어드민에서 명세를 쓰고
 * 진행을 보고 결과를 받는 작업대로 옮긴다.
 *
 * ★호출 형태는 인버스 탭과 같다 — vercel.json 의 마지막 rewrite 가 동적 세그먼트
 *   경로를 router.ts(404) 로 보내므로, 프런트는 `/api/devai?action=list` 처럼
 *   **쿼리스트링**으로 부른다. 자세한 이유는 api/devai/index.ts 주석 참고.
 *
 * 1단계 범위: list / get / create / update(=새 버전 INSERT) / delete
 *   ★명세 수정은 UPDATE 가 아니라 **새 버전 INSERT** 다. 덮어쓰면 '비포/애프터'가 사라진다.
 *   실행(start)·이벤트·결과는 2~3단계에서 붙인다.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { getPrisma } from '../_lib/inverse-trader/prisma.js';

/** 동시에 개발을 돌릴 수 있는 프로젝트 수. ★사장 결정(2026-08-20): 1건.
 *  pane 안 claude 하나가 400MB~3.2GB를 먹는데 서버2는 3.9GB다. */
export const MAX_CONCURRENT_RUNNING = 1;

/** 실행 중으로 간주하는 상태들(동시 실행 제한 판정용) */
const RUNNING_STATUSES = ['planned', 'awaiting_approval', 'running', 'review'];

async function requireAdmin(req: VercelRequest, res: VercelResponse): Promise<boolean> {
    const userId = requireAuth(req, res);
    if (userId === null) return false;
    try {
        const user = await getPrisma().user.findUnique({ where: { id: userId } });
        if (!user || user.role !== 'ADMIN') {
            res.status(403).json({ error: '관리자만 사용할 수 있습니다.' });
            return false;
        }
        return true;
    } catch (e: any) {
        res.status(500).json({ error: `권한 확인에 실패했습니다: ${e?.message ?? String(e)}` });
        return false;
    }
}

const str = (v: any, max = 20000): string => String(v ?? '').slice(0, max);

/** 참조 URL 배열 정규화. 문자열(줄바꿈 구분)도 배열도 받는다. */
function normalizeRefUrls(input: any): string {
    let arr: string[] = [];
    if (Array.isArray(input)) arr = input.map(v => String(v));
    else if (typeof input === 'string') arr = input.split('\n');
    arr = arr.map(s => s.trim()).filter(Boolean).slice(0, 50);
    return JSON.stringify(arr);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const action = String(req.query.action ?? '').trim();
    if (!(await requireAdmin(req, res))) return;

    const prisma = getPrisma();

    try {
        switch (action) {
            // ── 목록 ──────────────────────────────────────────────
            case 'list': {
                const rows = await prisma.devProject.findMany({
                    orderBy: { updatedAt: 'desc' },
                    take: 100,
                    include: {
                        versions: { orderBy: { version: 'desc' }, take: 1 },
                        _count: { select: { versions: true, files: true, events: true } },
                    },
                });
                const runningCount = rows.filter(r => RUNNING_STATUSES.includes(r.status)).length;
                return res.status(200).json({
                    projects: rows.map(r => ({
                        id: r.id, title: r.title, status: r.status,
                        herdrProjectId: r.herdrProjectId, workdir: r.workdir,
                        latestVersion: r.versions[0]?.version ?? 0,
                        counts: r._count,
                        createdAt: r.createdAt, updatedAt: r.updatedAt,
                    })),
                    // 화면이 "지금 새로 시작할 수 있는가"를 바로 알 수 있게 함께 준다.
                    concurrency: {
                        running: runningCount,
                        max: MAX_CONCURRENT_RUNNING,
                        canStart: runningCount < MAX_CONCURRENT_RUNNING,
                    },
                });
            }

            // ── 단건 조회(버전 이력 포함 = 비포/애프터) ─────────────
            case 'get': {
                const id = str(req.query.id ?? req.body?.id, 200);
                if (!id) return res.status(400).json({ error: 'id 가 필요합니다.' });
                const p = await prisma.devProject.findUnique({
                    where: { id },
                    include: {
                        versions: { orderBy: { version: 'desc' } },
                        files: { orderBy: { createdAt: 'desc' } },
                        events: { orderBy: { at: 'desc' }, take: 200 },
                        result: true,
                    },
                });
                if (!p) return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
                return res.status(200).json({ project: p });
            }

            // ── 생성 (v1 명세와 함께) ──────────────────────────────
            case 'create': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'POST 로 호출하세요.' });
                const b = req.body ?? {};
                const title = str(b.title, 300).trim();
                if (!title) return res.status(400).json({ error: '제목을 입력하세요.' });

                const created = await prisma.devProject.create({
                    data: {
                        title,
                        status: 'draft',
                        workdir: str(b.workdir, 500).trim() || '/home/paks11299958/ai_mp',
                        versions: {
                            create: {
                                version: 1,
                                features: str(b.features),
                                specBody: str(b.specBody),
                                refUrls: normalizeRefUrls(b.refUrls),
                                note: str(b.note, 500) || '최초 작성',
                            },
                        },
                    },
                    include: { versions: true },
                });
                return res.status(200).json({ project: created });
            }

            // ── 수정 = 새 버전 INSERT (★덮어쓰지 않는다) ────────────
            case 'update': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'POST 로 호출하세요.' });
                const b = req.body ?? {};
                const id = str(b.id, 200);
                if (!id) return res.status(400).json({ error: 'id 가 필요합니다.' });

                const p = await prisma.devProject.findUnique({
                    where: { id },
                    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
                });
                if (!p) return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });

                const last = p.versions[0];
                const nextVersion = (last?.version ?? 0) + 1;
                const features = b.features === undefined ? (last?.features ?? '') : str(b.features);
                const specBody = b.specBody === undefined ? (last?.specBody ?? '') : str(b.specBody);
                const refUrls = b.refUrls === undefined
                    ? (last?.refUrls ?? '[]') : normalizeRefUrls(b.refUrls);

                // 내용이 하나도 안 바뀌었으면 버전을 늘리지 않는다(빈 버전 적체 방지).
                const unchanged = last
                    && features === last.features
                    && specBody === last.specBody
                    && refUrls === last.refUrls;

                const updated = await prisma.devProject.update({
                    where: { id },
                    data: {
                        title: b.title === undefined ? p.title : (str(b.title, 300).trim() || p.title),
                        status: b.status === undefined ? p.status : str(b.status, 40),
                        workdir: b.workdir === undefined ? p.workdir : str(b.workdir, 500),
                        ...(unchanged ? {} : {
                            versions: {
                                create: {
                                    version: nextVersion, features, specBody, refUrls,
                                    note: str(b.note, 500) || `v${nextVersion} 수정`,
                                },
                            },
                        }),
                    },
                    include: { versions: { orderBy: { version: 'desc' } } },
                });
                return res.status(200).json({ project: updated, versionAdded: !unchanged });
            }

            // ── 삭제 ──────────────────────────────────────────────
            case 'delete': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'POST 로 호출하세요.' });
                const id = str(req.body?.id, 200);
                if (!id) return res.status(400).json({ error: 'id 가 필요합니다.' });
                const p = await prisma.devProject.findUnique({ where: { id } });
                if (!p) return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
                if (RUNNING_STATUSES.includes(p.status)) {
                    return res.status(400).json({
                        error: `진행 중인 프로젝트는 삭제할 수 없습니다(상태: ${p.status}). 먼저 중단하세요.`,
                    });
                }
                await prisma.devProject.delete({ where: { id } });  // 하위는 Cascade
                return res.status(200).json({ deleted: true, id });
            }

            default:
                return res.status(400).json({
                    error: `알 수 없는 action 입니다: ${action || '(없음)'}`,
                    allowed: ['list', 'get', 'create', 'update', 'delete'],
                });
        }
    } catch (e: any) {
        return res.status(500).json({ error: `처리 중 오류: ${e?.message ?? String(e)}` });
    }
}

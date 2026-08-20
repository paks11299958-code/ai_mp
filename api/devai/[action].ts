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
 * 1단계: list / get / create / update(=새 버전 INSERT) / delete
 *   ★명세 수정은 UPDATE 가 아니라 **새 버전 INSERT** 다. 덮어쓰면 '비포/애프터'가 사라진다.
 * 2단계: link(허드 프로젝트 물리기) / sync(진행·커밋·결과 가져오기) / export(명세서 .md)
 *   ★sync 는 rag/state/projects/<ID>.json 을 **읽기만** 한다. 파이프라인 쪽을 고치지
 *     않으므로 허드가 죽어도 어드민은 산다(허드가 dev_agent 를 대체하지 않은 것과 같은 원칙).
 *
 * 3단계: approve(승인/반려) — rag/state/approvals/<taskId>.json 에 결정을 쓴다.
 *   ★텔레그램 버튼과 **같은 큐**(approval_queue.py)를 쓰므로 어느 쪽으로 눌러도 동작한다.
 *   진행 이벤트는 파이프라인이 devai_events.py 로 DB에 직접 적는다(실시간).
 *
 * 남은 단계: 4)디자인 선택 5)텔레그램 축소
 */

import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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

/** 허드 4단계 상태 파일 위치. 파이프라인이 여기에 묶음 진행을 적는다. */
const HERDR_STATE_DIR = '/home/paks11299958/rag/state/projects';
/** 승인 결정 큐. approval_queue.py 가 여기를 폴링한다(텔레그램 버튼과 같은 경로). */
const APPROVAL_DIR = '/home/paks11299958/rag/state/approvals';

/**
 * 허드 프로젝트 상태 파일을 읽는다. 없거나 깨졌으면 null.
 * ★읽기만 한다 — 파이프라인 쪽 파일을 고치지 않는다.
 */
function readHerdrState(herdrProjectId: string): any | null {
    // 경로 조작 방지: 파일명에 쓸 수 있는 문자만 허용
    if (!/^[A-Za-z0-9_-]+$/.test(herdrProjectId)) return null;
    try {
        const raw = readFileSync(`${HERDR_STATE_DIR}/${herdrProjectId}.json`, 'utf8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/**
 * 이번 작업으로 바뀐 sites/<slug> 를 찾아 실제 주소를 만든다.
 *
 * ★설명문에서 찾으면 안 된다 — 계획 LLM이 `sites/` 접두사를 빼먹으면 매칭이 실패해
 *   메인 페이지 주소가 안내된다(2026-08-19 실사고). 가장 확실한 근거는
 *   **커밋이 실제로 건드린 파일 목록**이다. hermes.py 의 _detect_site_url 과 같은 원칙.
 */
function detectSiteUrl(workdir: string, commits: string[]): string | null {
    if (!commits.length) return null;
    for (const c of commits) {
        if (!/^[0-9a-f]{7,40}$/i.test(c)) continue;
        try {
            const out = execFileSync('git', ['show', '--name-only', '--pretty=format:', c], {
                cwd: workdir, encoding: 'utf8', timeout: 15_000,
            });
            for (const line of out.split('\n')) {
                const m = /^sites\/([a-z0-9][a-z0-9_-]*)\//.exec(line.trim());
                // _preview 는 시안 보관용이라 안내할 주소가 아니다
                if (m && m[1] !== '_preview') {
                    return `https://aichat.dbzone.kr/sites/${m[1]}/`;
                }
            }
        } catch { /* 커밋이 없거나 git 실패 — 다음 커밋으로 */ }
    }
    return null;
}

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

            // ── 허드 상태 동기화 (2단계) ────────────────────────────
            //   rag/state/projects/<herdrProjectId>.json 을 읽어 묶음 진행·커밋·
            //   완료 보고를 이벤트와 결과로 옮긴다.
            //   ★파이프라인 쪽을 고치지 않고 **읽기만** 한다 — 허드가 죽어도 어드민은 산다.
            case 'sync': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'POST 로 호출하세요.' });
                const id = str(req.body?.id, 200);
                if (!id) return res.status(400).json({ error: 'id 가 필요합니다.' });

                const p = await prisma.devProject.findUnique({ where: { id } });
                if (!p) return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
                if (!p.herdrProjectId) {
                    return res.status(400).json({ error: '아직 파이프라인에 연결되지 않았습니다(herdrProjectId 없음).' });
                }

                const state = readHerdrState(p.herdrProjectId);
                if (!state) {
                    return res.status(404).json({ error: `허드 상태 파일을 찾을 수 없습니다: ${p.herdrProjectId}` });
                }

                const batches: any[] = Array.isArray(state.batches) ? state.batches : [];
                // 이미 기록된 묶음 이벤트는 건너뛴다(중복 방지).
                const existing = await prisma.devProjectEvent.findMany({
                    where: { projectId: id, phase: 'batch_done' },
                    select: { meta: true },
                });
                const seen = new Set(existing.map(e => {
                    try { return JSON.parse(e.meta ?? '{}').batch; } catch { return null; }
                }).filter(Boolean));

                let added = 0;
                for (const b of batches) {
                    if (b?.status !== 'done' || seen.has(b.name)) continue;
                    await prisma.devProjectEvent.create({
                        data: {
                            projectId: id, actor: 'developer', phase: 'batch_done',
                            message: `묶음 ${b.name} 완료 — ${str(b.title, 200)}`,
                            meta: JSON.stringify({ batch: b.name, commit: b.commit ?? null }),
                        },
                    });
                    added++;
                }

                const commits = batches.filter(b => b?.commit).map(b => String(b.commit).slice(0, 12));
                const doneAll = batches.length > 0 && batches.every(b => b?.status === 'done');
                const summary = batches
                    .filter(b => b?.report)
                    .map(b => `[${b.name}] ${String(b.report).split('\n')[0].slice(0, 200)}`)
                    .join('\n');

                const nextStatus = doneAll ? 'done'
                    : state.status === 'failed' ? 'failed'
                    : p.status;

                await prisma.devProject.update({ where: { id }, data: { status: nextStatus } });
                await prisma.devProjectResult.upsert({
                    where: { projectId: id },
                    create: {
                        projectId: id, commits: JSON.stringify(commits),
                        summary: summary || null, deployUrl: detectSiteUrl(p.workdir, commits),
                    },
                    update: {
                        commits: JSON.stringify(commits),
                        summary: summary || null, deployUrl: detectSiteUrl(p.workdir, commits),
                    },
                });

                const fresh = await prisma.devProject.findUnique({
                    where: { id },
                    include: { result: true, events: { orderBy: { at: 'desc' }, take: 50 } },
                });
                return res.status(200).json({
                    project: fresh, eventsAdded: added,
                    batches: batches.map(b => ({ name: b.name, title: b.title, status: b.status, commit: b.commit ?? null })),
                });
            }

            // ── 파이프라인 연결 (허드 프로젝트 ID 물리기) ────────────
            case 'link': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'POST 로 호출하세요.' });
                const id = str(req.body?.id, 200);
                const herdrProjectId = str(req.body?.herdrProjectId, 100).trim();
                if (!id || !herdrProjectId) {
                    return res.status(400).json({ error: 'id 와 herdrProjectId 가 필요합니다.' });
                }
                if (!/^[A-Za-z0-9_-]+$/.test(herdrProjectId)) {
                    return res.status(400).json({ error: '허드 프로젝트 ID 형식이 올바르지 않습니다.' });
                }
                if (!readHerdrState(herdrProjectId)) {
                    return res.status(404).json({ error: `허드 상태 파일이 없습니다: ${herdrProjectId}` });
                }
                const updated = await prisma.devProject.update({
                    where: { id }, data: { herdrProjectId, status: 'running' },
                });
                await prisma.devProjectEvent.create({
                    data: {
                        projectId: id, actor: 'user', phase: 'plan',
                        message: `파이프라인 연결: ${herdrProjectId}`,
                    },
                });
                return res.status(200).json({ project: updated });
            }

            // ── 승인/반려 (3단계) ───────────────────────────────────
            //   파이프라인은 rag/state/approvals/<taskId>.json 을 폴링해 결정을 읽는다
            //   (approval_queue.py). 어드민은 그 파일을 쓰는 것으로 승인을 대신한다.
            //   ★텔레그램 버튼과 같은 큐를 쓰므로 어느 쪽으로 눌러도 동작한다.
            case 'approve': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'POST 로 호출하세요.' });
                const id = str(req.body?.id, 200);
                const taskId = str(req.body?.taskId, 100).trim();
                const decision = str(req.body?.decision, 20).trim();
                if (!id || !taskId) return res.status(400).json({ error: 'id 와 taskId 가 필요합니다.' });
                if (!['approved', 'rejected'].includes(decision)) {
                    return res.status(400).json({ error: "decision 은 'approved' 또는 'rejected' 여야 합니다." });
                }
                if (!/^[A-Za-z0-9_-]+$/.test(taskId)) {
                    return res.status(400).json({ error: 'taskId 형식이 올바르지 않습니다.' });
                }
                const p = await prisma.devProject.findUnique({ where: { id } });
                if (!p) return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });

                try {
                    mkdirSync(APPROVAL_DIR, { recursive: true });
                    // approval_queue.record 와 같은 페이로드 + 원자적 쓰기(임시파일 → rename)
                    const payload = JSON.stringify({ task_id: taskId, decision, ts: Date.now() / 1000 });
                    const tmp = `${APPROVAL_DIR}/.${taskId}.${process.pid}.tmp`;
                    writeFileSync(tmp, payload, 'utf8');
                    renameSync(tmp, `${APPROVAL_DIR}/${taskId}.json`);
                } catch (e: any) {
                    return res.status(500).json({ error: `결정 기록에 실패했습니다: ${e?.message ?? String(e)}` });
                }

                await prisma.devProjectEvent.create({
                    data: {
                        projectId: id, actor: 'user', phase: 'approval',
                        message: `${decision === 'approved' ? '승인' : '반려'} — ${taskId}`,
                        meta: JSON.stringify({ taskId, decision }),
                    },
                });
                await prisma.devProject.update({
                    where: { id },
                    data: { status: decision === 'approved' ? 'running' : 'canceled' },
                });
                return res.status(200).json({ ok: true, taskId, decision });
            }

            // ── 명세서 다운로드 (마크다운) ──────────────────────────
            case 'export': {
                const id = str(req.query.id ?? req.body?.id, 200);
                if (!id) return res.status(400).json({ error: 'id 가 필요합니다.' });
                const p = await prisma.devProject.findUnique({
                    where: { id },
                    include: { versions: { orderBy: { version: 'desc' }, take: 1 }, result: true },
                });
                if (!p) return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
                const v = p.versions[0];
                const urls = (() => {
                    try { return JSON.parse(v?.refUrls ?? '[]') as string[]; } catch { return []; }
                })();
                const md = [
                    `# ${p.title}`, '',
                    `> 프로젝트 \`${p.id}\` · v${v?.version ?? 0} · ${new Date(p.updatedAt).toLocaleString('ko-KR')}`, '',
                    '## 기능', '', (v?.features || '(없음)'), '',
                    ...(urls.length ? ['## 참조 사이트', '', ...urls.map(u => `- ${u}`), ''] : []),
                    '## 명세', '', (v?.specBody || '(없음)'), '',
                    ...(p.result?.deployUrl ? ['## 결과', '', `- 배포: ${p.result.deployUrl}`, ''] : []),
                ].join('\n');
                res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
                res.setHeader('Content-Disposition',
                    `attachment; filename="spec-${p.id}.md"`);
                return res.status(200).send(md);
            }

            default:
                return res.status(400).json({
                    error: `알 수 없는 action 입니다: ${action || '(없음)'}`,
                    allowed: ['list', 'get', 'create', 'update', 'delete', 'sync', 'link', 'approve', 'export'],
                });
        }
    } catch (e: any) {
        return res.status(500).json({ error: `처리 중 오류: ${e?.message ?? String(e)}` });
    }
}

// 골프 예약 스케줄 실행기 — 1분마다 cron으로 실행
// 사용법: node golf/schedule-runner.js
require('dotenv').config({ path: '/home/paks11299958/shared-api/.env' });

const { spawn }    = require('child_process');
const { PrismaPg } = require('/home/paks11299958/ai_mp/node_modules/@prisma/adapter-pg');
const { PrismaClient } = require('/home/paks11299958/ai_mp/src/generated/prisma/index.js');
const crypto = require('crypto');

const BOOKER_SCRIPT = '/home/paks11299958/ai_mp/golf/booker.js';
const ALGORITHM     = 'aes-256-gcm';

function decryptPw(stored) {
    const { iv, tag, data } = JSON.parse(stored);
    const key      = Buffer.from(process.env.COOKIE_ENC_KEY, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    return decipher.update(Buffer.from(data, 'hex')).toString() + decipher.final('utf8');
}

async function run() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    const prisma  = new PrismaClient({ adapter });

    try {
        // 시각이 된 pending 스케줄 조회
        const dues = await prisma.$queryRawUnsafe(`
            SELECT s.*, u.email AS "userEmail", u.phone AS "userPhone",
                   c."loginId", c."loginPw"
            FROM "GolfBookingSchedule" s
            JOIN "User"       u ON u.id = s."userId"
            JOIN "GolfCourse" c ON c.id = s."courseId"
            WHERE s.status = 'pending' AND s."scheduledAt" <= NOW()
        `);

        if (!dues.length) {
            await prisma.$disconnect();
            return;
        }

        console.log(`[골프스케줄] ${dues.length}건 실행 시작`);

        for (const row of dues) {
            // running으로 먼저 업데이트 (중복 실행 방지)
            await prisma.$executeRawUnsafe(
                `UPDATE "GolfBookingSchedule" SET status='running', "updatedAt"=NOW() WHERE id=$1`,
                row.id
            );

            let plainPw = '';
            try { plainPw = decryptPw(row.loginPw); }
            catch (e) {
                await prisma.$executeRawUnsafe(
                    `UPDATE "GolfBookingSchedule" SET status='failed', "resultMsg"=$1, "updatedAt"=NOW() WHERE id=$2`,
                    '로그인 정보 복호화 실패', row.id
                );
                continue;
            }

            const env = {
                ...process.env,
                GOLF_LOGIN_ID: row.loginId,
                GOLF_LOGIN_PW: plainPw,
            };
            if (row.userEmail) env.NOTIFY_EMAIL = row.userEmail;
            if (row.userPhone) env.NOTIFY_PHONE = row.userPhone;

            // booker.js 실행 후 결과 수집
            await new Promise(resolve => {
                let output = '';
                const child = spawn('node', [BOOKER_SCRIPT, row.golfDate, row.timePeriod], {
                    env, stdio: ['ignore', 'pipe', 'pipe'],
                });
                child.stdout.on('data', d => { output += d.toString(); });
                child.stderr.on('data', d => { output += d.toString(); });
                child.on('close', async code => {
                    const success = code === 0;
                    let msg = output.trim().split('\n').pop() || '';
                    try { const j = JSON.parse(msg); msg = j.ok ? `예약 완료 (${j.time} ${j.course})` : j.error; } catch {}
                    await prisma.$executeRawUnsafe(
                        `UPDATE "GolfBookingSchedule" SET status=$1, "resultMsg"=$2, "updatedAt"=NOW() WHERE id=$3`,
                        success ? 'success' : 'failed', msg, row.id
                    );
                    console.log(`[골프스케줄] #${row.id} → ${success ? '성공' : '실패'}: ${msg}`);
                    resolve(null);
                });
            });
        }
    } catch (e) {
        console.error('[골프스케줄] 오류:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

run();

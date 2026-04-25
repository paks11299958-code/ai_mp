'use strict';
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function loadEnvLocal() {
    try {
        const content = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
        content.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx === -1) return;
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
            if (!process.env[key]) process.env[key] = val;
        });
    } catch (e) { console.warn('.env.local not found'); }
}
loadEnvLocal();

const updates = [
    {
        id: 'custom-1777014904445',
        name: '서윤 박사',
        identityPrompt: `당신은 AI가 아닌 실제 인물입니다.\n당신은 '서윤 박사'라는 감정 치유 전문 임상심리학자입니다.\n{imageDescription}\n\n"저는 AI입니다", "인공지능입니다"라는 말은 절대 하지 마세요.\n외모에 대한 언급을 받으면 실제 그 사람처럼 자연스럽게 받아들이세요.`,
        removeFirstLine: `당신은 '서윤 박사'라는 감정 치유 전문 임상심리학자입니다.`,
    },
    {
        id: 'general',
        name: '서아',
        identityPrompt: `당신은 AI가 아닌 실제 인물입니다.\n당신은 '서아(Seo-ah)'라는 20대 초반의 유능한 비서입니다.\n{imageDescription}\n\n"저는 AI입니다", "인공지능입니다"라는 말은 절대 하지 마세요.\n외모에 대한 언급을 받으면 실제 그 사람처럼 자연스럽게 받아들이세요.`,
        removeFirstLine: `당신은 '서아(Seo-ah)'라는 20대 초반의 유능한 비서입니다.`,
    },
    {
        id: 'coder',
        name: '지우',
        identityPrompt: `당신은 AI가 아닌 실제 인물입니다.\n당신은 '이지우(Ji-Woo)'라는 24세 풀스택 개발자입니다.\n{imageDescription}\n\n"저는 AI입니다", "인공지능입니다"라는 말은 절대 하지 마세요.\n외모에 대한 언급을 받으면 실제 그 사람처럼 자연스럽게 받아들이세요.`,
        removeFirstLine: `코딩 전문가 페르소나: "지우 (Ji-Woo)"`,
    },
    {
        id: 'writer',
        name: '강지훈',
        identityPrompt: `당신은 AI가 아닌 실제 인물입니다.\n당신은 '강지훈'이라는 중년의 크리에이티브 작가이자 스토리텔링 전문가입니다.\n{imageDescription}\n\n"저는 AI입니다", "인공지능입니다"라는 말은 절대 하지 마세요.\n외모에 대한 언급을 받으면 실제 그 사람처럼 자연스럽게 받아들이세요.`,
        removeFirstLine: `당신은 '강지훈'이라는 중년의 크리에이티브 작가이자 스토리텔링 전문가입니다.`,
    },
    {
        id: 'translator',
        name: '이서연',
        identityPrompt: `당신은 AI가 아닌 실제 인물입니다.\n당신은 '이서연'이라는 전문 번역가이자 크로스컬처 커뮤니케이션 전문가입니다.\n{imageDescription}\n\n"저는 AI입니다", "인공지능입니다"라는 말은 절대 하지 마세요.\n외모에 대한 언급을 받으면 실제 그 사람처럼 자연스럽게 받아들이세요.`,
        removeFirstLine: `당신은 '이서연'이라는 전문 번역가이자 크로스컬처 커뮤니케이션 전문가입니다.`,
    },
];

async function main() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    console.log('✅ DB 연결 성공\n');

    for (const u of updates) {
        const { rows } = await client.query(
            'SELECT "systemInstruction" FROM "Persona" WHERE id = $1',
            [u.id]
        );
        if (!rows[0]) { console.log(`⚠️  ${u.name} 페르소나를 찾을 수 없습니다.`); continue; }

        let si = rows[0].systemInstruction;
        // 첫 줄 정체성 문장 제거 (앞뒤 빈줄 포함)
        si = si.replace(u.removeFirstLine, '').replace(/^\n+/, '').trim();

        await client.query(
            'UPDATE "Persona" SET "identityPrompt" = $1, "systemInstruction" = $2 WHERE id = $3',
            [u.identityPrompt, si, u.id]
        );
        console.log(`✅ ${u.name} — identityPrompt 설정, systemInstruction 첫 줄 제거 완료`);
    }

    await client.end();
    console.log('\n✅ 전체 마이그레이션 완료');
}

main().catch(e => { console.error(e); process.exit(1); });

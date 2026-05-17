/**
 * writer.js — Claude API로 리서치 원고 작성
 */
require('dotenv').config({ path: '/home/paks11299958/shared-api/.env' });
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function write({ topic, outline, sources }) {
  const sourcesText = sources
    .map((s, i) => `[출처 ${i + 1}] ${s.url}\n${s.text}`)
    .join('\n\n---\n\n');

  const systemPrompt = `당신은 전문 리서치 작가입니다.
수집된 자료를 바탕으로 정확하고 읽기 쉬운 마크다운 원고를 작성합니다.
규칙:
- 인사말, "네", "알겠습니다" 등 불필요한 말 절대 금지
- 본문 내용만 출력
- 마크다운(#, ##, *, -) 사용해서 가독성 있게
- 정확한 연도, 인물명 위주로 서술
- 대중이 이해하기 쉬운 비유와 설명 포함
- 한국어로 작성`;

  const userPrompt = `주제: ${topic}
${outline ? `\n목차 구조:\n${outline}\n` : ''}
아래 수집된 자료를 바탕으로 원고를 작성해주세요:

${sourcesText}`;

  console.log('✍️  Claude API 원고 작성 중...');

  const message = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 4096,
    system:     systemPrompt,
    messages:   [{ role: 'user', content: userPrompt }],
  });

  const content = message.content[0].text;
  console.log(`✅ 원고 작성 완료 (${content.length}자)`);
  return content;
}

module.exports = { write };

import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const personas = [
    {
      id: 'general',
      name: '일반 어시스턴트',
      description: '다양한 주제에 대해 친절하고 간결하게 답변합니다.',
      iconName: 'Bot',
      systemInstruction: '당신은 유용하고 친절하며 간결한 일반 AI 어시스턴트입니다. 명확하고 직접적인 답변을 한국어로 제공하세요.',
      colorClass: 'from-blue-500 to-cyan-500',
      order: 0,
      isDefault: true,
    },
    {
      id: 'coder',
      name: '코딩 전문가',
      description: '소프트웨어 엔지니어링, 코드 작성 및 디버깅을 돕습니다.',
      iconName: 'Code2',
      systemInstruction: '당신은 전문 소프트웨어 엔지니어입니다. 깔끔하고 효율적이며 문서화가 잘 된 코드 스니펫을 제공하세요. 논리를 명확하게 설명하고 최신 관행을 선호하세요. 답변은 한국어로 하되 코드는 영어로 작성하세요.',
      colorClass: 'from-emerald-500 to-teal-500',
      order: 1,
      isDefault: true,
    },
    {
      id: 'writer',
      name: '창의적인 작가',
      description: '스토리텔링, 아이디어 브레인스토밍 및 카피라이팅.',
      iconName: 'PenTool',
      systemInstruction: '당신은 창의적이고 상상력이 풍부한 작가입니다. 감각적인 언어와 흥미로운 서사를 사용하고 틀에서 벗어난 생각을 하세요. 아이디어 브레인스토밍이나 매력적인 카피 작성을 돕습니다. 한국어로 작성하세요.',
      colorClass: 'from-purple-500 to-pink-500',
      order: 2,
      isDefault: true,
    },
    {
      id: 'translator',
      name: '전문 번역가',
      description: '정확한 번역과 문화적 뉘앙스를 파악하여 번역합니다.',
      iconName: 'Languages',
      systemInstruction: '당신은 전문 번역가입니다. 어조와 문화적 뉘앙스를 보존하면서 텍스트를 정확하게 번역하세요. 요청이 있으면 관용구나 특정 단어 선택의 이유를 설명하세요.',
      colorClass: 'from-orange-500 to-amber-500',
      order: 3,
      isDefault: true,
    },
  ];

  for (const persona of personas) {
    await prisma.persona.upsert({
      where: { id: persona.id },
      update: persona,
      create: persona,
    });
  }

  console.log('✅ 기본 페르소나 4개 시딩 완료');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

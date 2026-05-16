const { Client } = require('pg');

const DB_URL = 'postgresql://aichat_user:aichat_9958@34.50.27.95:5432/aichat';

const CATEGORIES = [
  { code: '50000000', name: '패션의류',     emoji: '👗', order: 1, keywords: JSON.stringify(['반팔티','원피스','청바지','레깅스','자켓','후드티','셔츠','니트','반바지','민소매']) },
  { code: '50000001', name: '패션잡화',     emoji: '👜', order: 2, keywords: JSON.stringify(['운동화','가방','모자','선글라스','벨트','지갑','시계','슬리퍼','부츠','샌들']) },
  { code: '50000005', name: '화장품/미용',  emoji: '💄', order: 3, keywords: JSON.stringify(['선크림','파운데이션','립스틱','마스크팩','세럼','토너','클렌징','향수','쿠션','아이크림']) },
  { code: '50000002', name: '가전/디지털',  emoji: '💻', order: 4, keywords: JSON.stringify(['에어컨','노트북','이어폰','공기청정기','냉장고','선풍기','TV','로봇청소기','에어프라이어','청소기']) },
  { code: '50000003', name: '가구/인테리어',emoji: '🪑', order: 5, keywords: JSON.stringify(['소파','침대','책상','조명','커튼','매트리스','수납장','선반','카펫','옷장']) },
  { code: '50000008', name: '식품',         emoji: '🍱', order: 6, keywords: JSON.stringify(['라면','커피','과자','김치','단백질','홍삼','견과류','냉동식품','프로틴','비타민']) },
  { code: '50000006', name: '스포츠/레저',  emoji: '⚽', order: 7, keywords: JSON.stringify(['요가매트','런닝화','헬스장갑','자전거','텐트','등산화','수영복','골프공','배드민턴','낚시']) },
  { code: '50000004', name: '생활/건강',    emoji: '🏠', order: 8, keywords: JSON.stringify(['세제','치약','칫솔','물통','마스크','체중계','혈압계','안마기','족욕기','공기청정기']) },
  { code: '50000009', name: '유아동/출산',  emoji: '🍼', order: 9, keywords: JSON.stringify(['기저귀','분유','유모차','아기옷','장난감','아기띠','카시트','물티슈','이유식','젖병']) },
  { code: '50000010', name: '반려동물',     emoji: '🐾', order: 10, keywords: JSON.stringify(['사료','간식','패드','하네스','장난감','캣타워','샴푸','케이지','옷','모래']) },
];

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  console.log('네이버 쇼핑 카테고리 시드 시작...');

  for (const cat of CATEGORIES) {
    await client.query(
      `INSERT INTO "NaverShoppingCategory" (code, name, emoji, keywords, "order")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (code) DO UPDATE SET name=$2, emoji=$3, keywords=$4, "order"=$5`,
      [cat.code, cat.name, cat.emoji, cat.keywords, cat.order]
    );
    console.log(`  ✅ ${cat.emoji} ${cat.name}`);
  }

  console.log(`\n완료: ${CATEGORIES.length}개 카테고리 등록`);
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });

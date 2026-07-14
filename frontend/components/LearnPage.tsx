import React, { useEffect, useState } from 'react';
import { authApi } from '../services/apiService';
import { captureRefFromUrl } from '../services/referral';

// 📚 학습자료 페이지 (/learn/homepage) — 지우의 "AI로 홈페이지 만들기" 단계별 강의 자료.
// 강의장에서 주소/QR로 직접 접속하는 용도라 EmbedChat·ConsultPage처럼 AppContent
// 진입 전 얼리리턴으로 렌더된다(비회원 접근 가능, 앱 훅·컨텍스트 비의존).
// 시안 파일은 public/learn/designs/*.html 정적 서빙(다운로드 시 index.html로 저장).

const COURSE_STEPS = [
    { id: 'step1', no: 1, emoji: '📝', title: '기획 — 어떤 홈페이지를 만들까?' },
    { id: 'step2', no: 2, emoji: '🎨', title: 'AI로 디자인 시안 만들기' },
    { id: 'step3', no: 3, emoji: '💾', title: '시안 다운로드 & VS Code 준비' },
    { id: 'step4', no: 4, emoji: '🚀', title: '로컬호스트로 띄우기' },
    { id: 'step5', no: 5, emoji: '✨', title: 'Claude Code로 내 마음대로 고치기' },
];

// 시안 갤러리 — public/learn/designs/ 정적 파일과 1:1
const DESIGNS = [
    { file: '/learn/designs/ochang-a.html', name: '시안 A — 모던 클린', desc: '깔끔한 화이트+인디고. 신뢰감 있는 공식 홈페이지 느낌' },
    { file: '/learn/designs/ochang-b.html', name: '시안 B — 따뜻한 커뮤니티', desc: '크림+오렌지. 동네 모임의 정겨운 분위기' },
    { file: '/learn/designs/ochang-c.html', name: '시안 C — 다크 테크', desc: '다크+네온. AI 연구회다운 실험실 무드' },
];

// 2단계 — AI에 붙여넣는 디자인 생성 프롬프트 (제미나이·챗GPT·클로드 공용)
const DESIGN_PROMPT = `오창AI 연구회 커뮤니티 홈페이지를 만들어줘.

- 목적: AI를 함께 배우고 만들어가는 지역 모임(오창AI 연구회) 소개
- 메뉴: 소개 / 활동소식 / 스터디자료 / 가입안내
- 분위기: 따뜻하고 신뢰감 있게, 모바일에서도 예쁘게
- 조건: HTML 파일 하나(index.html)로 완성하고, CSS는 파일 안에 포함해줘.
  이미지 없이 이모지와 색만으로 꾸며줘.`;

// 2단계 — 디자인 시안 "이미지"를 먼저 만드는 프롬프트(제미나이·챗GPT 이미지 생성)
const IMAGE_GEN_PROMPT = `오창AI 연구회 커뮤니티 홈페이지의 웹디자인 시안 이미지를 만들어줘.

- 상단에 로고와 메뉴(소개/활동소식/스터디자료/가입안내)
- 그 아래 큰 환영 문구가 있는 히어로 영역과 버튼
- 활동을 소개하는 카드 3개
- 분위기: 따뜻하고 신뢰감 있는 커뮤니티, 한국어
- 데스크톱 웹사이트 화면 한 장으로`;

// 2단계 — 이미지(스케치·시안)를 첨부해서 홈페이지로 바꾸는 프롬프트
const IMAGE_PROMPT = `첨부한 이미지의 디자인을 그대로 구현한 홈페이지를 만들어줘.

- 배치(메뉴 위치·섹션 순서)와 색 분위기를 이미지와 최대한 비슷하게
- 글자가 잘 안 보이면 어울리는 예시 문구로 채워줘
- 조건: HTML 파일 하나(index.html)로 완성하고, CSS는 파일 안에 포함해줘.
  이미지 파일 없이 이모지와 색만으로 꾸며줘.`;

const CLAUDE_CODE_PROMPTS = [
    { label: '로컬 서버 띄우기', text: '이 폴더의 index.html을 로컬 서버로 띄워줘. 브라우저에서 볼 수 있는 주소를 알려줘.' },
    { label: '색 바꾸기', text: '헤더와 버튼 색을 파란색 계열로 바꿔줘.' },
    { label: '섹션 추가', text: '모임 사진을 넣을 갤러리 섹션을 활동소식 아래에 추가해줘. 사진은 일단 회색 박스로 자리만 잡아줘.' },
    { label: '모바일 최적화', text: '휴대폰에서 봤을 때 글자가 잘리거나 메뉴가 넘치지 않게 고쳐줘.' },
];

// 📖 용어 사전 — 본문에서 단어를 드래그(셀렉트)하면 뜻 툴팁이 뜬다(초보자 배려).
// 키는 소문자 정규화 형태. 값 = 한두 문장 설명.
const GLOSSARY: Record<string, string> = {
    'html': "웹페이지의 '뼈대'를 만드는 언어예요. 제목·글·버튼 같은 내용을 담습니다. 우리가 만드는 index.html이 바로 HTML 파일이에요.",
    'css': "웹페이지를 '꾸미는' 언어예요(색·글씨·배치). 이번 수업에서는 HTML 파일 안에 함께 넣어 파일 하나로 관리해요.",
    'index.html': "홈페이지의 대문 파일이에요. 주소만 입력하면 서버가 기본으로 이 파일을 보여줍니다. 그래서 파일 이름이 중요해요.",
    '로컬호스트': "'내 컴퓨터 자신'을 가리키는 주소예요. 인터넷에 올리기 전에 내 컴퓨터에서만 미리 보는 무대입니다.",
    'localhost': "'내 컴퓨터 자신'을 가리키는 주소예요. 인터넷에 올리기 전에 내 컴퓨터에서만 미리 보는 무대입니다.",
    '프롬프트': "AI에게 건네는 부탁의 말이에요. 구체적으로 쓸수록 원하는 결과가 나옵니다.",
    'vs code': "마이크로소프트가 만든 무료 코드 편집기예요. 편집 + 로컬서버 + 터미널을 한 화면에서 해결해줍니다.",
    'live server': "VS Code에 설치하는 확장 프로그램이에요. 클릭 한 번으로 내 컴퓨터에 작은 웹서버를 켜줍니다(localhost:5500).",
    '터미널': "글자로 명령을 내리는 검은 창이에요. VS Code에서는 Ctrl+` 로 열어요 (` = 숫자 1 왼쪽의 물결(~) 키).",
    'claude code': "터미널에서 쓰는 AI 개발 도우미예요(PC 전용). 말로 부탁하면 파일 수정부터 서버 실행까지 대신해줍니다.",
    '아티팩트': "클로드 앱이 코드 결과를 바로 '미리보기 화면'으로 보여주는 기능이에요. 폰에서도 완성 모습을 즉시 확인할 수 있어요.",
    '서버': "요청을 받으면 웹페이지를 건네주는 프로그램이에요. localhost는 내 컴퓨터 속 작은 서버입니다.",
    '브라우저': "크롬·엣지·사파리처럼 웹페이지를 보는 프로그램이에요.",
    'file://': "서버 없이 파일을 '직접' 열었다는 표시예요. 구경은 되지만, 진짜 웹사이트 방식은 http(localhost)입니다.",
    '확장': "VS Code에 기능을 더하는 부품이에요. 폰에 앱을 설치하는 것과 같아요.",
    '새로고침': "브라우저가 페이지를 다시 불러오게 하는 거예요(F5). 수정한 결과를 확인하는 기본 동작입니다.",
};

// 📝 학습평가 — 10문제×10점=100점 만점, 다 맞으면 합격(서버 기록→'완료' 배지·다음 코스 조건).
// 출제는 랜덤 순서, 오답이면 해설과 함께 같은 문제 재출제(맞힐 때까지 = 완전학습).
const QUIZ: Array<{ q: string; options: string[]; answer: number; explain: string }> = [
    { q: '홈페이지의 "대문 파일" 이름으로 저장해야 하는 것은?', options: ['home.txt', 'index.html', 'main.doc', 'page.css'], answer: 1, explain: '서버는 주소만 입력받으면 기본으로 index.html을 보여줘요. 그래서 파일 이름이 꼭 index.html이어야 합니다.' },
    { q: 'AI에게 디자인을 부탁할 때 꼭 넣어야 하는 조건은?', options: ['"파일을 여러 개로 나눠줘"', '"HTML 파일 하나로, CSS 포함해서"', '"이미지를 최대한 많이 넣어줘"', '"영어로 만들어줘"'], answer: 1, explain: '파일이 하나여야 초보자도 저장·실행이 쉬워요. CSS까지 한 파일에 담아달라고 해야 합니다.' },
    { q: 'localhost(로컬호스트)란 무엇일까요?', options: ['유명한 웹사이트 이름', '내 컴퓨터 자신을 가리키는 주소', '와이파이 공유기 이름', 'AI 프로그램 이름'], answer: 1, explain: 'localhost는 "내 컴퓨터 자신"을 가리키는 주소예요. 인터넷에 올리기 전에 내 컴퓨터에서만 미리 보는 무대입니다.' },
    { q: '파일을 더블클릭해서 열면 주소가 file:// 로 시작해요. 이것의 의미는?', options: ['홈페이지가 인터넷에 올라갔다', '서버 없이 파일을 직접 열었다', '파일이 고장났다', '바이러스에 걸렸다'], answer: 1, explain: 'file://은 서버 없이 파일을 "구경"하는 방식이에요. 진짜 웹사이트 방식은 서버로 여는 것(localhost)입니다.' },
    { q: 'VS Code에서 클릭 한 번으로 로컬 서버를 켜주는 확장 프로그램은?', options: ['Photoshop', 'Live Server', 'Excel', 'Zoom'], answer: 1, explain: 'Live Server 확장을 설치하고 index.html을 우클릭 → "Open with Live Server"를 누르면 localhost:5500으로 열려요.' },
    { q: 'HTML과 CSS의 역할을 바르게 짝지은 것은?', options: ['HTML=꾸미기, CSS=뼈대', 'HTML=뼈대(내용), CSS=꾸미기(색·배치)', '둘 다 이미지 편집용', 'HTML=계산, CSS=저장'], answer: 1, explain: 'HTML은 제목·글·버튼 같은 내용(뼈대)을 담고, CSS는 색·글씨·배치로 꾸미는 역할이에요.' },
    { q: '코드를 수정했는데 브라우저에 반영이 안 될 때 제일 먼저 할 일은?', options: ['컴퓨터를 포맷한다', '저장(Ctrl+S) 후 새로고침(F5)', '새 컴퓨터를 산다', 'AI에게 항의한다'], answer: 1, explain: '수정 → 저장(Ctrl+S) → 새로고침(F5)이 기본 사이클이에요. 저장을 빼먹는 경우가 가장 많아요.' },
    { q: '폴더 이름을 my-homepage처럼 영어로 만드는 이유는?', options: ['영어 공부를 위해', '일부 개발 도구가 한글 경로에서 오작동할 수 있어서', '한글은 저장이 안 돼서', '보안 때문에'], answer: 1, explain: '일부 개발 도구가 한글 경로에서 오작동할 수 있어요. 폴더·파일 이름은 영어로 하는 습관을 들이면 좋아요.' },
    { q: 'Claude Code(클로드 코드)는 무엇일까요?', options: ['게임 이름', 'PC 터미널에서 말로 부탁하는 AI 개발 도우미', '폰 배경화면 앱', '암호 프로그램'], answer: 1, explain: 'Claude Code는 PC 터미널에서 쓰는 AI 도우미예요. "서버 띄워줘", "색 바꿔줘"라고 부탁하면 대신 해줍니다.' },
    { q: '폰의 클로드 앱으로 할 수 있는 것은?', options: ['아무것도 못 한다', '아티팩트 미리보기로 홈페이지 생성·수정', 'localhost 서버 실행', 'VS Code 설치'], answer: 1, explain: '클로드 앱은 결과를 아티팩트(미리보기)로 바로 보여줘서 폰에서도 생성·수정이 돼요. 단, localhost 실습은 PC가 필요합니다.' },
];

const shuffle = <T,>(arr: T[]): T[] =>
    arr.map(v => [Math.random(), v] as const).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

// 프롬프트 복사 블록 — 복사 버튼 + 2초 "복사됨" 피드백
const CopyBlock: React.FC<{ text: string; label?: string }> = ({ text, label }) => {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            // http/구형 브라우저 폴백
            const ta = document.createElement('textarea');
            ta.value = text; document.body.appendChild(ta);
            ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="relative bg-[#1E1B2E] rounded-xl border border-[#8E6FB7]/30 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#8E6FB7]/20">
                <span className="text-xs font-semibold text-[#C4A9E0]">{label ?? '프롬프트'}</span>
                <button
                    onClick={copy}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${copied ? 'bg-green-500/20 text-green-300' : 'bg-[#8E6FB7] text-white hover:bg-[#7A5FA0]'}`}
                >
                    {copied ? '✓ 복사됨!' : '📋 복사'}
                </button>
            </div>
            <pre className="px-4 py-3 text-[13px] leading-relaxed text-gray-200 whitespace-pre-wrap break-words font-sans">{text}</pre>
        </div>
    );
};

// 📣 추천 링크 공유 박스 — 회원이 자기 ?ref 링크로 강의를 퍼뜨린다(친구 가입 시 양쪽 +1000P)
const ReferralShareBox: React.FC<{ code: string }> = ({ code }) => {
    const [copied, setCopied] = useState(false);
    if (!code) return null;
    const link = `${window.location.origin}/learn/homepage?ref=${encodeURIComponent(code)}`;
    const copy = async () => {
        try { await navigator.clipboard.writeText(link); } catch {
            const ta = document.createElement('textarea');
            ta.value = link; document.body.appendChild(ta);
            ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    const share = async () => {
        try {
            await navigator.share({ title: 'AI로 홈페이지 만들기 — 무료 강의', text: '코딩 몰라도 홈페이지를 만들어 내 컴퓨터에서 띄우는 무료 강의! 이 링크로 가입하면 우리 둘 다 +1000P 🎁', url: link });
        } catch { copy(); }
    };
    return (
        <div className="bg-gradient-to-r from-[#FF6B9D]/10 to-[#8E6FB7]/10 border border-[#FF6B9D]/30 rounded-2xl p-4">
            <div className="font-extrabold text-sm">📣 이 강의를 친구에게 선물하세요</div>
            <p className="text-xs text-[#6E6480] mt-1 leading-relaxed">
                아래는 <b>나만의 추천 링크</b>예요. 친구가 이 링크로 와서 가입하면 <b>친구도 나도 +1,000P</b>!
            </p>
            <div className="mt-2.5 bg-white border border-[#8E6FB7]/20 rounded-lg pl-3 pr-1.5 py-1.5 flex items-center gap-2">
                <code className="text-[11px] text-[#6E5DA3] break-all flex-1">{link}</code>
                <button onClick={copy}
                        className={`flex-shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-md ${copied ? 'bg-green-100 text-green-700' : 'bg-[#8E6FB7] text-white hover:bg-[#7A5FA0]'}`}>
                    {copied ? '✓ 복사됨' : '복사'}
                </button>
                <button onClick={share}
                        className="flex-shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-md bg-[#FF6B9D] text-white hover:bg-[#E05589]">
                    공유
                </button>
            </div>
        </div>
    );
};

// 🎬 강의 영상 — 회원 전용 스트리밍(시청토큰 ?t=, 공개 URL 없음).
// 본문엔 작은 버튼만 두고(화면 점유 최소화) 클릭 시 모달에서 재생.
// 모달은 이어보기 플레이리스트: 어느 단계로 열어도 끝까지 자동 연속 재생.
const VIDEO_META = [
    { step: 'step1', title: '1단계 기획', dur: '1:03' },
    { step: 'step2', title: '2단계 AI 디자인 시안', dur: '1:09' },
    { step: 'step3', title: '3단계 다운로드 & VS Code', dur: '0:45' },
    { step: 'step4', title: '4단계 로컬호스트', dur: '1:01' },
    { step: 'step5', title: '5단계 Claude Code 수정', dur: '0:50' },
];

// ⬇ VS Code 원클릭 다운로드 — 마이크로소프트 공식 '항상 최신' 고정 링크(주소 찾기 불필요).
// 접속 기기 OS를 감지해 맞는 버튼을 크게, 다른 OS는 작은 링크로(윈도우·맥 둘 다).
const VSCODE_DL = {
    win: 'https://update.code.visualstudio.com/latest/win32-x64-user/stable',
    mac: 'https://update.code.visualstudio.com/latest/darwin-universal/stable',
};
const VSCodeDownload: React.FC = () => {
    const isMac = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
    const [mainLabel, mainUrl] = isMac ? ['Mac용', VSCODE_DL.mac] : ['Windows용', VSCODE_DL.win];
    const [otherLabel, otherUrl] = isMac ? ['Windows용은 여기', VSCODE_DL.win] : ['Mac용은 여기', VSCODE_DL.mac];
    return (
        <div className="bg-[#F5EFFA] border border-[#8E6FB7]/25 rounded-xl p-4 text-center">
            <a href={mainUrl}
               className="inline-block bg-[#0078D4] hover:bg-[#106EBE] text-white font-extrabold text-sm px-6 py-3 rounded-xl">
                ⬇ VS Code 다운로드 ({mainLabel} · 항상 최신버전)
            </a>
            <p className="text-xs text-[#9A8FB0] mt-2">
                누르면 바로 다운로드가 시작돼요 — 마이크로소프트 공식 링크라 늘 최신 버전입니다.
                다른 컴퓨터라면 <a href={otherUrl} className="underline font-semibold text-[#6E5DA3]">{otherLabel}</a>
            </p>
            <p className="text-xs text-[#6E5DA3] font-semibold mt-1.5">
                💡 노트북·데스크탑 구분은 없어요 — 윈도우 컴퓨터라면 종류와 상관없이 이 파일 하나면 됩니다.
            </p>
        </div>
    );
};

// Claude Code 설치 — 파일 다운로드가 아니라 명령 한 줄(앤트로픽 공식 설치 방식).
// VS Code 버튼과 같은 경험을 주기 위해: 버튼 클릭=명령 자동 복사+다음 할 일 3단계 표시.
const CLAUDE_INSTALL_WIN = 'irm https://claude.ai/install.ps1 | iex';
const CLAUDE_INSTALL_MAC = 'curl -fsSL https://claude.ai/install.sh | bash';

const ClaudeCodeInstall: React.FC = () => {
    const [copied, setCopied] = useState<'win' | 'mac' | null>(null);
    const copy = async (which: 'win' | 'mac') => {
        const cmd = which === 'win' ? CLAUDE_INSTALL_WIN : CLAUDE_INSTALL_MAC;
        try { await navigator.clipboard.writeText(cmd); } catch {
            const ta = document.createElement('textarea');
            ta.value = cmd; document.body.appendChild(ta);
            ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        }
        setCopied(which);
    };
    return (
        <div className="bg-[#FDF3EC] border border-[#D97757]/30 rounded-xl p-4 text-center">
            <button onClick={() => copy('win')}
                    className="inline-block bg-[#D97757] hover:bg-[#C2643F] text-white font-extrabold text-sm px-6 py-3 rounded-xl">
                🤖 Claude Code 설치 (Windows · 클릭하면 설치 명령 복사)
            </button>
            <p className="text-xs text-[#9A8FB0] mt-2">
                Claude Code는 파일 다운로드가 아니라 <b>명령 한 줄 설치</b> 방식이에요(앤트로픽 공식 — 늘 최신버전).
            </p>
            {/* 복사될 명령을 눈으로 확인할 수 있게 항상 노출(왕초보 안심) */}
            <div className="mt-2.5 space-y-1.5 text-left">
                {([['Windows', 'win', CLAUDE_INSTALL_WIN], ['Mac', 'mac', CLAUDE_INSTALL_MAC]] as const).map(([os, key, cmd]) => (
                    <div key={key} className="bg-[#1E1B2E] rounded-lg pl-3 pr-1.5 py-1.5 flex items-center gap-2">
                        <span className="text-[10px] font-extrabold text-[#C4A9E0] w-14 flex-shrink-0">{os}</span>
                        <code className="text-[12px] text-gray-200 break-all flex-1">{cmd}</code>
                        <button onClick={() => copy(key)}
                                className={`flex-shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-md ${copied === key ? 'bg-green-500/20 text-green-300' : 'bg-[#8E6FB7] text-white hover:bg-[#7A5FA0]'}`}>
                            {copied === key ? '✓ 복사됨' : '복사'}
                        </button>
                    </div>
                ))}
            </div>
            {copied && (
                <div className="mt-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800 text-left leading-relaxed">
                    ✓ <b>설치 명령이 복사됐어요!</b> 이제 이 순서대로:
                    {copied === 'win' ? (
                        <span className="block mt-1">① 시작메뉴에서 <b>"PowerShell"</b> 검색해 열기 → ② <b>붙여넣기(Ctrl+V)</b> → ③ <b>Enter</b></span>
                    ) : (
                        <span className="block mt-1">① 런치패드에서 <b>"터미널"</b> 검색해 열기 → ② <b>붙여넣기(Cmd+V)</b> → ③ <b>Enter</b></span>
                    )}
                </div>
            )}
        </div>
    );
};

// 영상 모달 — 이어보기 플레이리스트(자동 다음 재생 + 하단 칩 점프)
const VideoModal: React.FC<{ idx: number; token: string; onJump: (idx: number) => void; onClose: () => void; onExpired: () => void }> =
    ({ idx, token, onJump, onClose, onExpired }) => {
    const meta = VIDEO_META[idx];
    return (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={onClose}>
            <div className="w-full max-w-3xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-2 text-white">
                    <span className="text-sm font-extrabold">🎬 {meta.title} <span className="opacity-50 font-medium text-xs">({idx + 1}/{VIDEO_META.length} · 끝나면 다음 영상 자동 재생)</span></span>
                    <button onClick={onClose} className="text-2xl leading-none px-2 opacity-80 hover:opacity-100">×</button>
                </div>
                <video
                    key={`${meta.step}-${token}`}
                    controls
                    autoPlay
                    controlsList="nodownload noremoteplayback"
                    disablePictureInPicture
                    playsInline
                    className="w-full aspect-video bg-black rounded-xl"
                    src={`/api/learn/video/${meta.step}?t=${encodeURIComponent(token)}`}
                    onContextMenu={e => e.preventDefault()}
                    onError={onExpired}
                    onEnded={() => { if (idx + 1 < VIDEO_META.length) onJump(idx + 1); }}
                />
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {VIDEO_META.map((v, i) => (
                        <button key={v.step} onClick={() => onJump(i)}
                                className={`flex-shrink-0 text-xs font-bold px-3 py-2 rounded-full border transition-colors ${i === idx ? 'bg-[#8E6FB7] border-[#8E6FB7] text-white' : 'border-white/30 text-white/80 hover:border-white/70'}`}>
                            {i + 1}. {v.title.replace(/^\d단계 /, '')} <span className="opacity-60">{v.dur}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

// 단계 섹션 래퍼 — 번호 뱃지 + 제목 + 내용
const Step: React.FC<{ step: typeof COURSE_STEPS[number]; children: React.ReactNode }> = ({ step, children }) => (
    <section id={step.id} className="scroll-mt-20">
        <div className="flex items-center gap-3 mb-4">
            <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#8E6FB7] text-white font-extrabold flex items-center justify-center text-sm">{step.no}</span>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#2D2438]">{step.emoji} {step.title}</h2>
        </div>
        <div className="space-y-4">{children}</div>
    </section>
);

const Tip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="bg-[#F5EFFA] border border-[#8E6FB7]/25 rounded-xl px-4 py-3 text-sm text-[#5A4A6E] leading-relaxed">
        💡 {children}
    </div>
);

// "이게 보이면 성공" — 초보자가 자기 진행이 맞는지 확인하는 기준점
const Success: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800 leading-relaxed">
        ✅ <b>이게 보이면 성공:</b> {children}
    </div>
);

// "모바일에서는" — 폰으로 따라오는 수강생용 단계별 안내(가능/대안/PC 필요 명시)
const Mobile: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 text-sm text-sky-900 leading-relaxed">
        📱 <b>모바일에서는:</b> {children}
    </div>
);

// 🆘 막혔을 때 — 강의장에서 실제로 나오는 질문 모음 (접이식)
const FAQS: Array<[string, string]> = [
    ['다운받은 파일이 어디 있는지 모르겠어요', '파일 탐색기(⊞윈도우 키+E)를 열고 왼쪽의 "다운로드"를 클릭하세요. 최근 받은 파일이 맨 위에 있어요. 브라우저 오른쪽 위의 ↓(다운로드) 아이콘을 눌러 "폴더에 표시"를 해도 됩니다.'],
    ['다운로드한 파일을 더블클릭하면 브라우저로 열려요. 잘못된 건가요?', '아니에요, 정상이에요! 더블클릭으로 열리는 건 "파일로 열기"이고, 우리가 배우는 건 "서버로 열기(localhost)"예요. 4단계의 Live Server나 Claude Code를 쓰면 주소창에 localhost가 뜹니다.'],
    ['AI가 준 코드가 너무 길어서 어디까지 복사해야 할지 모르겠어요', '코드 블록 오른쪽 위의 "복사" 버튼을 누르면 전체가 복사돼요. 메모장이 아니라 VS Code에 붙여넣고 index.html로 저장하세요.'],
    ['Live Server를 설치했는데 우클릭 메뉴에 안 보여요', 'VS Code를 완전히 껐다 켜 보세요. 그래도 안 되면 "폴더"를 연 게 아니라 "파일"만 연 경우예요. 파일 > 폴더 열기로 my-homepage 폴더를 다시 여세요.'],
    ['localhost 화면이 하얗게만 나와요', '파일 이름이 index.html이 맞는지 확인하세요(index.html.txt처럼 뒤에 .txt가 붙는 경우가 많아요). 그리고 파일이 폴더 안에 있는지도요.'],
    ['수정했는데 브라우저에 반영이 안 돼요', '저장(Ctrl+S)을 먼저! 그다음 브라우저 새로고침(F5)이에요. Live Server는 저장하면 자동 새로고침됩니다.'],
    ['claude에게 부탁했는데 index.html이 없다고 해요', '지금 터미널이 index.html이 있는 폴더 "밖"에서 실행 중이라 그래요. VS Code에서 파일 > 폴더 열기로 my-homepage 폴더를 연 다음, 터미널을 새로 열고(Ctrl+`) 다시 claude를 실행하세요. VS Code 터미널은 열어 둔 폴더에서 시작됩니다.'],
    ['꼭 VS Code를 써야 하나요? 다른 건 안 되나요?', '아니요, 필수는 아니에요. 코드 수정은 메모장으로도 되고, 열어보는 건 더블클릭으로도 됩니다. 다만 VS Code는 무료인 데다 편집기+로컬서버(Live Server)+Claude Code 터미널을 한 화면에서 해결해줘서 수업 기준으로 삼았어요. Cursor 같은 다른 편집기를 이미 쓰신다면 그대로 쓰셔도 됩니다.'],
    ['폰에 있는 클로드(Claude) 앱으로는 안 되나요?', '절반 이상 됩니다! 클로드 앱에 2단계 프롬프트를 넣으면 결과가 "미리보기(아티팩트)" 화면으로 바로 떠서, 폰에서도 완성된 홈페이지 모습을 즉시 보고 "파란색으로 바꿔줘" 같은 수정 요청까지 할 수 있어요. 챗GPT·제미나이 앱도 비슷한 미리보기(캔버스)를 지원합니다. 다만 폰의 클로드 앱은 PC 터미널 도구인 Claude Code와는 달라서, 파일로 저장해 로컬호스트로 띄우는 3~4단계는 PC가 필요해요.'],
];

const FaqItem: React.FC<{ q: string; a: string }> = ({ q, a }) => (
    <details className="bg-white border border-[#8E6FB7]/15 rounded-xl px-4 py-3 group">
        <summary className="text-sm font-bold cursor-pointer list-none flex gap-2">
            <span className="text-[#D85C95] flex-shrink-0">Q.</span>{q}
        </summary>
        <p className="text-sm text-[#4A4058] mt-2 pl-6 leading-relaxed">{a}</p>
    </details>
);

// 📝 학습평가 섹션 — 랜덤 출제·즉시 채점·오답 재출제·100점 합격 기록
const QuizSection: React.FC<{ record: { passed: boolean; passedAt: string | null } | null; onPassed: () => void }> = ({ record, onPassed }) => {
    const [mode, setMode] = useState<'idle' | 'run' | 'done'>('idle');
    const [order, setOrder] = useState<number[]>([]);          // 셔플된 문제 인덱스
    const [pos, setPos] = useState(0);                          // 현재 몇 번째 문제인지
    const [optOrder, setOptOrder] = useState<number[]>([]);     // 현재 문제의 보기 셔플
    const [phase, setPhase] = useState<'answer' | 'wrong' | 'correct'>('answer');
    const [picked, setPicked] = useState<number | null>(null);
    const [saveFailed, setSaveFailed] = useState(false);

    const start = () => {
        const o = shuffle(QUIZ.map((_, i) => i));
        setOrder(o); setPos(0);
        setOptOrder(shuffle(QUIZ[o[0]].options.map((_, i) => i)));
        setPhase('answer'); setPicked(null); setSaveFailed(false);
        setMode('run');
    };

    const qi = order[pos] ?? 0;
    const question = QUIZ[qi];
    const score = pos * 10; // 맞힌 문제 수 × 10 (맞혀야만 다음으로 진행)

    const pick = (optIdx: number) => {
        if (phase !== 'answer') return;
        setPicked(optIdx);
        setPhase(optIdx === question.answer ? 'correct' : 'wrong');
    };

    const retrySame = () => { // 오답 → 같은 문제, 보기만 다시 셔플
        setOptOrder(shuffle(question.options.map((_, i) => i)));
        setPicked(null); setPhase('answer');
    };

    const next = async () => {
        if (pos + 1 < order.length) {
            const np = pos + 1;
            setPos(np);
            setOptOrder(shuffle(QUIZ[order[np]].options.map((_, i) => i)));
            setPicked(null); setPhase('answer');
            return;
        }
        // 10문제 완주 = 100점 합격 → 서버 기록(실패 시 로컬 보존 + 안내)
        setMode('done');
        try {
            const r = await fetch('/api/learn/quiz-record', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ course: 'homepage', score: 100 }),
            });
            if (!r.ok) throw new Error(String(r.status));
            onPassed();
        } catch {
            localStorage.setItem('learnQuizPass.homepage', new Date().toISOString());
            setSaveFailed(true);
            onPassed();
        }
    };

    return (
        <section id="quiz" className="scroll-mt-20">
            <div className="flex items-center gap-3 mb-4">
                <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#6E5DA3] text-white font-extrabold flex items-center justify-center text-sm">📝</span>
                <h2 className="text-lg sm:text-xl font-extrabold text-[#2D2438]">학습평가 — 10문제 도전</h2>
            </div>

            {mode === 'idle' && (
                <div className="bg-white border border-[#8E6FB7]/15 rounded-2xl p-6 text-center">
                    {record?.passed ? (
                        <>
                            <div className="text-4xl mb-2">🏅</div>
                            <p className="font-extrabold text-green-600 text-lg">100점 합격!</p>
                            <p className="text-xs text-[#9A8FB0] mt-1">
                                합격일: {record.passedAt ? new Date(record.passedAt).toLocaleDateString('ko-KR') : '기록됨'} — 다음 코스가 열리면 바로 입장할 수 있어요.
                            </p>
                            <button onClick={start} className="mt-4 text-sm font-bold text-[#6E5DA3] border border-[#8E6FB7]/40 px-5 py-2.5 rounded-xl hover:bg-[#F5EFFA]">
                                🔄 다시 도전하기
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="text-4xl mb-2">📝</div>
                            <p className="text-sm text-[#4A4058] leading-relaxed">
                                이 단원을 잘 이해했는지 확인해 볼까요?<br />
                                <b>10문제 × 10점 = 100점 만점.</b> 다 맞히면 <b>합격</b>이 기록되고 다음 학습으로 넘어갈 수 있어요.<br />
                                틀려도 괜찮아요 — 해설을 보고 같은 문제를 다시 풀 수 있습니다.
                            </p>
                            <button onClick={start} className="mt-4 bg-[#8E6FB7] hover:bg-[#7A5FA0] text-white font-extrabold px-8 py-3 rounded-xl">
                                평가 시작하기 →
                            </button>
                        </>
                    )}
                </div>
            )}

            {mode === 'run' && (
                <div className="bg-white border border-[#8E6FB7]/15 rounded-2xl p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-extrabold text-[#6E5DA3]">문제 {pos + 1} / {order.length}</span>
                        <span className="text-xs font-extrabold text-[#D85C95]">현재 {score}점</span>
                    </div>
                    {/* 진행 바 */}
                    <div className="h-1.5 bg-[#F0E8F8] rounded-full mb-4 overflow-hidden">
                        <div className="h-full bg-[#8E6FB7] rounded-full transition-all" style={{ width: `${(pos / order.length) * 100}%` }} />
                    </div>
                    <p className="font-bold text-[15px] text-[#2D2438] leading-relaxed mb-4">Q. {question.q}</p>
                    <div className="grid gap-2">
                        {optOrder.map(oi => {
                            const isPicked = picked === oi;
                            const isAnswer = oi === question.answer;
                            let cls = 'bg-[#FAF8FC] border-[#8E6FB7]/20 hover:border-[#8E6FB7]/60';
                            if (phase === 'correct' && isAnswer) cls = 'bg-green-50 border-green-400';
                            if (phase === 'wrong' && isPicked) cls = 'bg-red-50 border-red-300';
                            return (
                                <button key={oi} onClick={() => pick(oi)} disabled={phase !== 'answer'}
                                        className={`text-left text-sm font-semibold border rounded-xl px-4 py-3 transition-colors ${cls}`}>
                                    {question.options[oi]}
                                </button>
                            );
                        })}
                    </div>

                    {phase === 'correct' && (
                        <div className="mt-4">
                            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
                                ✅ <b>정답이에요! +10점</b>
                            </div>
                            <button onClick={next} className="mt-3 w-full bg-[#8E6FB7] hover:bg-[#7A5FA0] text-white font-extrabold py-3 rounded-xl">
                                {pos + 1 < order.length ? '다음 문제 →' : '결과 보기 🎉'}
                            </button>
                        </div>
                    )}
                    {phase === 'wrong' && (
                        <div className="mt-4">
                            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800 leading-relaxed">
                                ❌ <b>아쉬워요!</b> {question.explain}
                            </div>
                            <button onClick={retrySame} className="mt-3 w-full bg-[#D85C95] hover:bg-[#C04A82] text-white font-extrabold py-3 rounded-xl">
                                같은 문제 다시 풀기 🔄
                            </button>
                        </div>
                    )}
                </div>
            )}

            {mode === 'done' && (
                <div className="bg-gradient-to-br from-[#8E6FB7] to-[#6E5DA3] rounded-2xl p-8 text-center text-white">
                    <div className="text-5xl mb-3">🎉</div>
                    <p className="text-2xl font-extrabold">100점 합격!</p>
                    <p className="text-sm opacity-90 mt-2 leading-relaxed">
                        10문제를 모두 맞혔어요. 합격이 기록되었고,<br />다음 학습 코스가 열리면 바로 입장할 수 있습니다.
                    </p>
                    {saveFailed && (
                        <p className="text-xs mt-2 opacity-80">⚠ 서버 저장이 잠시 안 되어 이 기기에 임시 저장했어요. 다음 접속 때 다시 저장됩니다.</p>
                    )}
                    <button onClick={() => setMode('idle')} className="mt-5 bg-white text-[#6E5DA3] font-extrabold text-sm px-6 py-3 rounded-xl">
                        확인
                    </button>
                </div>
            )}
        </section>
    );
};

// 로그인으로 보내기 — 복귀 경로를 심고 메인의 로그인 화면(?login=1)으로
const goLogin = () => {
    sessionStorage.setItem('afterAuthRedirect', '/learn/homepage');
    window.location.href = '/?login=1';
};

// 비가입자 게이트 — 코스 소개 + 얻는 것 목록으로 가입 유도(사장 결정: 회원 전용)
const GuestGate: React.FC = () => (
    <div className="min-h-screen bg-[#FAF8FC] flex items-center justify-center px-4 py-10">
        <div className="max-w-md w-full text-center">
            <div className="text-5xl mb-4">🔒</div>
            <span className="inline-block bg-[#FF6B9D]/10 text-[#D85C95] text-xs font-bold px-3 py-1.5 rounded-full mb-3">무료 학습 코스 · 회원 전용</span>
            <h1 className="text-2xl font-extrabold text-[#2D2438] leading-snug">🏠 AI로 홈페이지 만들어<br />내 컴퓨터에서 띄워보기</h1>
            <p className="mt-3 text-sm text-[#6E6480] leading-relaxed">
                코딩을 몰라도 따라 할 수 있는 5단계 강의예요.<br /><b>무료 회원가입</b>만 하면 전부 열립니다.
            </p>
            <div className="mt-5 bg-white border border-[#8E6FB7]/15 rounded-2xl p-5 text-left space-y-2.5">
                {[
                    '📚 5단계 따라하기 강의 (기획 → 완성)',
                    '🎨 홈페이지 디자인 시안 3종 다운로드',
                    '📋 AI에게 그대로 붙여넣는 프롬프트 모음',
                    '🆘 막혔을 때 보는 FAQ',
                    '🎁 지금 가입하면 보너스 1,000P',
                ].map(t => (
                    <div key={t} className="flex items-start gap-2 text-sm text-[#4A4058]"><span className="text-green-500 font-bold">✓</span>{t}</div>
                ))}
            </div>
            <button onClick={goLogin} className="mt-6 w-full bg-[#8E6FB7] hover:bg-[#7A5FA0] text-white font-extrabold py-3.5 rounded-xl">
                무료 회원가입하고 시작하기 →
            </button>
            <button onClick={goLogin} className="mt-2.5 w-full text-sm font-semibold text-[#6E5DA3] py-2">
                이미 회원이에요 · 로그인
            </button>
            <button onClick={() => { window.location.href = '/'; }} className="mt-1 w-full text-xs text-[#9A8FB0] py-2">
                ← AI 스퀘어 둘러보기
            </button>
        </div>
    </div>
);

export const LearnPage: React.FC = () => {
    // 추천 링크(?ref=코드) 캡처 — 얼리리턴 라우트라 App 본체 캡처가 안 돌아 여기서 1회.
    // 게스트가 친구 링크로 와서 게이트 가입하면 추천 보상(+1000P 양쪽)이 이어진다.
    useEffect(() => { captureRefFromUrl(); }, []);

    // 회원 전용 게이트 — 토큰 없으면 즉시 게이트, 있으면 /auth/me로 유효성 확인.
    // 네트워크 오류(서버 순단)는 열어줌: 강의 중 일시 장애로 수강생 전원이 막히는 것 방지.
    const [auth, setAuth] = useState<'checking' | 'ok' | 'guest'>(() => localStorage.getItem('token') ? 'checking' : 'guest');
    useEffect(() => {
        if (auth !== 'checking') return;
        fetch('/api/auth/me', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
            .then(r => setAuth(r.ok ? 'ok' : 'guest'))
            .catch(() => setAuth('ok'));
    }, [auth]);

    // 🎬 시청 전용 토큰(30분 만료) — <video>는 인증 헤더를 못 보내 쿼리 토큰으로 재생.
    // 만료로 재생 오류가 나면 20분 경과 시에만 1회 재발급(오류 루프 방지).
    const [videoToken, setVideoToken] = useState('');
    const videoTokenAt = React.useRef(0);
    const fetchVideoToken = React.useCallback(() => {
        fetch('/api/learn/video-token', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
            .then(r => (r.ok ? r.json() : null))
            .then(d => { if (d?.token) { setVideoToken(d.token); videoTokenAt.current = Date.now(); } })
            .catch(() => {});
    }, []);
    useEffect(() => { if (auth === 'ok') fetchVideoToken(); }, [auth, fetchVideoToken]);
    const onVideoExpired = React.useCallback(() => {
        if (Date.now() - videoTokenAt.current > 20 * 60 * 1000) fetchVideoToken();
    }, [fetchVideoToken]);
    // 🎬 영상 모달 — null=닫힘, 숫자=현재 재생 중인 인덱스(이어보기)
    const [videoIdx, setVideoIdx] = useState<number | null>(null);

    // 📣 내 추천 코드 — 강의 공유 링크(?ref=) 생성용 (친구 가입 시 양쪽 +1000P)
    const [refCode, setRefCode] = useState('');
    useEffect(() => {
        if (auth !== 'ok') return;
        authApi.referral().then(d => setRefCode(d.code || '')).catch(() => {});
    }, [auth]);

    // 📝 학습평가 합격 기록 — 제목 옆 (학습/완료) 배지 + 평가 섹션 상태의 근거.
    // 서버 기록 우선, 실패 시 로컬 임시 기록 폴백.
    const [record, setRecord] = useState<{ passed: boolean; passedAt: string | null } | null>(null);
    useEffect(() => {
        if (auth !== 'ok') return;
        fetch('/api/learn/quiz-record?course=homepage', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        })
            .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
            .then(d => setRecord({ passed: !!d.passed, passedAt: d.passedAt ?? null }))
            .catch(() => {
                const local = localStorage.getItem('learnQuizPass.homepage');
                setRecord({ passed: !!local, passedAt: local });
            });
    }, [auth]);

    // 스크롤 스파이 — 지금 보고 있는 단계를 목차(칩/사이드바)에 선택 표시.
    // 화면 상단 20%~40% 밴드에 걸린 섹션을 활성으로 판단(제목이 그 근처에 올 때 자연 전환).
    const [activeStep, setActiveStep] = useState('');
    useEffect(() => {
        if (auth !== 'ok') return;
        const obs = new IntersectionObserver(entries => {
            const vis = entries.filter(e => e.isIntersecting)
                .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
            if (vis[0]) setActiveStep(vis[0].target.id);
        }, { rootMargin: '-15% 0px -60% 0px' });
        document.querySelectorAll('section[id^="step"], section#faq, section#quiz').forEach(el => obs.observe(el));
        return () => obs.disconnect();
    }, [auth]);

    // 활성 칩이 모바일 칩 바 밖에 있으면 보이게 따라 스크롤(세로 점프 방지 block:nearest)
    useEffect(() => {
        if (!activeStep) return;
        document.querySelector(`a[data-chip="${activeStep}"]`)
            ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }, [activeStep]);

    // 📖 단어 셀렉트 → 용어 툴팁. selectionchange는 드래그 중 연발되므로 250ms 디바운스.
    const [tip, setTip] = useState<{ term: string; desc: string; x: number; y: number } | null>(null);
    useEffect(() => {
        if (auth !== 'ok') return;
        let timer: ReturnType<typeof setTimeout>;
        const onSel = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                const sel = window.getSelection();
                const raw = sel?.toString().trim() ?? '';
                const key = raw.toLowerCase().replace(/[.,!?'"()“”]/g, '').trim();
                const desc = GLOSSARY[key];
                if (!raw || raw.length > 24 || !desc || !sel || sel.rangeCount === 0) { setTip(null); return; }
                const rect = sel.getRangeAt(0).getBoundingClientRect();
                setTip({
                    term: raw,
                    desc,
                    x: Math.min(Math.max(rect.left + rect.width / 2, 150), window.innerWidth - 150),
                    y: Math.min(rect.bottom + 10, window.innerHeight - 40),
                });
            }, 250);
        };
        document.addEventListener('selectionchange', onSel);
        return () => { clearTimeout(timer); document.removeEventListener('selectionchange', onSel); };
    }, [auth]);

    if (auth === 'guest') return <GuestGate />;
    if (auth === 'checking') {
        return (
            <div className="min-h-screen bg-[#FAF8FC] flex items-center justify-center">
                <p className="text-sm text-[#9A8FB0]">확인 중...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FAF8FC] text-[#2D2438]">
            {/* 헤더 */}
            <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-[#8E6FB7]/15">
                <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
                    <button onClick={() => { window.location.href = '/'; }} className="flex items-center gap-1.5 text-sm text-[#6E5DA3] font-semibold">
                        ← AI 스퀘어
                    </button>
                    <span className="text-sm font-extrabold text-[#2D2438]">📚 지우의 학습자료</span>
                    <span className="w-16" />
                </div>
            </header>

            {/* 🎬 영상 모달 — 이어보기 플레이리스트 */}
            {videoIdx !== null && videoToken && (
                <VideoModal idx={videoIdx} token={videoToken} onJump={setVideoIdx}
                            onClose={() => setVideoIdx(null)} onExpired={onVideoExpired} />
            )}

            {/* 📖 용어 툴팁 — 셀렉트한 단어가 사전에 있으면 그 아래 말풍선 */}
            {tip && (
                <div className="fixed z-50 -translate-x-1/2 max-w-[280px] bg-[#2D2438] text-white rounded-xl px-4 py-3 shadow-2xl pointer-events-none"
                     style={{ left: tip.x, top: tip.y }}>
                    <div className="text-xs font-extrabold text-[#C4A9E0] mb-1">📖 {tip.term}</div>
                    <div className="text-[13px] leading-relaxed">{tip.desc}</div>
                </div>
            )}

            {/* 모바일 전용 — 얇은 단계 칩 바(가로 스크롤). 큰 목차 카드 대신 어지러움 최소화 */}
            <nav className="lg:hidden sticky top-14 z-10 bg-[#FAF8FC]/95 backdrop-blur border-b border-[#8E6FB7]/10">
                <div className="flex gap-2 overflow-x-auto px-4 py-2.5" style={{ scrollbarWidth: 'none' }}>
                    {COURSE_STEPS.map(s => {
                        const on = activeStep === s.id;
                        return (
                            <a key={s.id} href={`#${s.id}`} data-chip={s.id}
                               className={`flex-shrink-0 flex items-center gap-1.5 border rounded-full pl-1.5 pr-3 py-1 transition-colors ${on ? 'bg-[#8E6FB7] border-[#8E6FB7]' : 'bg-white border-[#8E6FB7]/20'}`}>
                                <span className={`w-5 h-5 rounded-full text-[10px] font-extrabold flex items-center justify-center ${on ? 'bg-white text-[#6E5DA3]' : 'bg-[#8E6FB7] text-white'}`}>{s.no}</span>
                                <span className={`text-xs font-semibold whitespace-nowrap ${on ? 'text-white' : ''}`}>{s.title.split(' — ')[0]}</span>
                            </a>
                        );
                    })}
                    <a href="#faq" data-chip="faq"
                       className={`flex-shrink-0 flex items-center border rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${activeStep === 'faq' ? 'bg-[#D85C95] border-[#D85C95] text-white' : 'bg-white border-[#D85C95]/25 text-[#D85C95]'}`}>🆘 막혔을 때</a>
                    <a href="#quiz" data-chip="quiz"
                       className={`flex-shrink-0 flex items-center border rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${activeStep === 'quiz' ? 'bg-[#6E5DA3] border-[#6E5DA3] text-white' : 'bg-white border-[#6E5DA3]/25 text-[#6E5DA3]'}`}>📝 학습평가{record?.passed ? ' ✅' : ''}</a>
                    {videoToken && (
                        <button onClick={() => setVideoIdx(0)}
                                className="flex-shrink-0 flex items-center gap-1 border rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap bg-[#1E1B2E] border-[#1E1B2E] text-white">
                            🎬 전체 영상
                        </button>
                    )}
                </div>
            </nav>

            <div className="max-w-5xl mx-auto lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10 lg:px-6">
            {/* 데스크톱 전용 — 왼쪽 고정 목차 */}
            <aside className="hidden lg:block">
                <nav className="sticky top-20 py-8 space-y-1.5">
                    <div className="text-xs font-extrabold text-[#9A8FB0] tracking-wider mb-3 px-3">목차</div>
                    {COURSE_STEPS.map(s => {
                        const on = activeStep === s.id;
                        return (
                            <a key={s.id} href={`#${s.id}`}
                               className={`flex items-center gap-2.5 rounded-lg px-3 py-2 border transition-colors ${on ? 'bg-[#8E6FB7] border-[#8E6FB7]' : 'border-transparent hover:bg-white hover:border-[#8E6FB7]/20'}`}>
                                <span className={`w-5 h-5 rounded-full text-[10px] font-extrabold flex items-center justify-center flex-shrink-0 ${on ? 'bg-white text-[#6E5DA3]' : 'bg-[#F0E8F8] text-[#6E5DA3]'}`}>{s.no}</span>
                                <span className={`text-[13px] font-semibold leading-tight ${on ? 'text-white' : ''}`}>{s.title.split(' — ')[0]}</span>
                            </a>
                        );
                    })}
                    <a href="#faq"
                       className={`flex items-center gap-2.5 rounded-lg px-3 py-2 border text-[13px] font-semibold transition-colors ${activeStep === 'faq' ? 'bg-[#D85C95] border-[#D85C95] text-white' : 'border-transparent text-[#D85C95] hover:bg-white hover:border-[#D85C95]/25'}`}>🆘 막혔을 때</a>
                    <a href="#quiz"
                       className={`flex items-center gap-2.5 rounded-lg px-3 py-2 border text-[13px] font-semibold transition-colors ${activeStep === 'quiz' ? 'bg-[#6E5DA3] border-[#6E5DA3] text-white' : 'border-transparent text-[#6E5DA3] hover:bg-white hover:border-[#6E5DA3]/25'}`}>📝 학습평가{record?.passed ? ' ✅' : ''}</a>
                    {videoToken && (
                        <button onClick={() => setVideoIdx(0)}
                                className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 mt-2 text-[13px] font-bold bg-[#1E1B2E] text-white hover:bg-[#2D2438] transition-colors">
                            <span className="w-5 h-5 rounded-full bg-[#FF6B9D] flex items-center justify-center text-[9px] flex-shrink-0">▶</span>
                            전체 영상 보기 <span className="opacity-50 font-medium">4:48</span>
                        </button>
                    )}
                </nav>
            </aside>

            <main className="max-w-2xl mx-auto lg:mx-0 lg:max-w-none px-4 lg:px-0 py-8 space-y-12 pb-24">
                {/* 코스 소개 */}
                <section className="text-center lg:text-left">
                    <span className="inline-block bg-[#FF6B9D]/10 text-[#D85C95] text-xs font-bold px-3 py-1.5 rounded-full mb-3">무료 학습 코스 · 1호</span>
                    <h1 className="text-2xl sm:text-3xl font-extrabold leading-snug">
                        🏠 AI로 홈페이지 만들어<br className="lg:hidden" /> 내 컴퓨터에서 띄워보기
                        {record && (
                            <span className={`align-middle inline-block ml-2 text-xs font-extrabold px-2.5 py-1 rounded-full ${record.passed ? 'bg-green-100 text-green-700' : 'bg-[#F0E8F8] text-[#6E5DA3]'}`}>
                                {record.passed ? '✅ 완료' : '📖 학습'}
                            </span>
                        )}
                    </h1>
                    <p className="mt-3 text-sm sm:text-base text-[#6E6480] leading-relaxed">
                        코딩을 몰라도 괜찮아요. AI에게 부탁해서 홈페이지 디자인을 만들고,<br className="hidden sm:block" />
                        내 컴퓨터(로컬호스트)에서 직접 띄워보는 것까지 5단계로 함께해요.
                    </p>
                    <p className="mt-2 text-xs text-[#9A8FB0]">실습 예제: 오창AI 연구회 — 배우고 만들어가는 커뮤니티 홈페이지</p>
                    <div className="mt-4 bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 text-sm text-sky-900 leading-relaxed text-left">
                        📱 <b>폰으로 보고 계신가요?</b> 1~2단계(기획·AI로 시안 만들기)는 폰으로도 충분히 실습할 수 있어요.
                        3단계부터(내 컴퓨터에서 띄우기)는 PC/노트북이 필요합니다 — 각 단계의 <b>"모바일에서는"</b> 파란 박스를 참고하세요.
                    </div>
                    <div className="mt-2.5 bg-[#F5EFFA] border border-[#8E6FB7]/25 rounded-xl px-4 py-3 text-sm text-[#5A4A6E] leading-relaxed text-left">
                        📖 <b>모르는 단어가 나오면 드래그해 보세요.</b> CSS, 로컬호스트, 터미널 같은 단어를
                        손가락이나 마우스로 선택하면 뜻이 말풍선으로 나타나요.
                    </div>
                    <div className="mt-2.5 text-left"><ReferralShareBox code={refCode} /></div>
                </section>

                {/* 1단계 — 기획 */}
                <Step step={COURSE_STEPS[0]}>
                    <p className="text-sm leading-relaxed text-[#4A4058]">
                        홈페이지를 만들기 전에 딱 4가지만 정하면 됩니다. 종이에 적어보세요.
                    </p>
                    <div className="bg-white border border-[#8E6FB7]/15 rounded-xl divide-y divide-[#8E6FB7]/10">
                        {[
                            ['① 이름', '홈페이지(모임)의 이름 — 예: 오창AI 연구회'],
                            ['② 목적', '무엇을 알리고 싶은가 — 예: AI를 함께 배우는 모임 소개와 회원 모집'],
                            ['③ 메뉴', '어떤 내용을 담을까 — 예: 소개 / 활동소식 / 스터디자료 / 가입안내'],
                            ['④ 분위기', '어떤 느낌이면 좋을까 — 예: 따뜻하고 신뢰감 있게'],
                        ].map(([k, v]) => (
                            <div key={k} className="px-4 py-3 flex gap-3 text-sm">
                                <span className="font-bold text-[#6E5DA3] flex-shrink-0 w-16">{k}</span>
                                <span className="text-[#4A4058]">{v}</span>
                            </div>
                        ))}
                    </div>
                    <Tip>이 4가지가 곧 다음 단계에서 AI에게 부탁하는 말(프롬프트)의 재료가 됩니다.</Tip>
                    <Mobile>폰 메모앱에 적으면 됩니다. 이 단계는 폰으로 100% 가능해요.</Mobile>
                    <Success>4칸이 다 채워진 메모가 손에 있다.</Success>
                </Step>

                {/* 2단계 — AI 디자인 */}
                <Step step={COURSE_STEPS[1]}>
                    <p className="text-sm leading-relaxed text-[#4A4058]">
                        아래 프롬프트를 <b>복사</b>해서 제미나이(gemini.google.com), 챗GPT(chatgpt.com), 클로드(claude.ai) 중
                        아무 곳에나 붙여넣어 보세요. 1단계에서 정한 내용으로 이름·메뉴·분위기만 바꾸면 내 모임 홈페이지가 됩니다.
                    </p>
                    <CopyBlock text={DESIGN_PROMPT} label="방법① 글로 부탁하기 — 디자인 생성 프롬프트 (제미나이·챗GPT·클로드 공용)" />
                    <Tip>
                        핵심은 마지막 조건이에요 — <b>"HTML 파일 하나로, CSS 포함"</b>. 파일이 하나여야
                        초보자도 저장·실행이 쉽습니다. AI가 코드를 주면 <b>index.html</b> 이름으로 저장하세요.
                    </Tip>

                    {/* 🖼️ 방법② — 이미지 만들기 → 이미지를 홈페이지로 변환 (2스텝) */}
                    <div className="bg-white border border-[#8E6FB7]/15 rounded-2xl p-4 sm:p-5 space-y-4">
                        <div>
                            <div className="font-extrabold text-sm">🖼️ 방법② 그림으로 부탁하기 — 이미지 → 홈페이지</div>
                            <p className="text-sm text-[#4A4058] leading-relaxed mt-1.5">
                                글 대신 <b>그림</b>으로 보여줘도 AI가 홈페이지를 만들어줘요. 2스텝입니다:
                                <b> 디자인 이미지를 준비</b>하고 → 그 이미지를 <b>첨부해서 코드로 변환</b>.
                            </p>
                        </div>

                        <div>
                            <p className="text-sm font-bold text-[#2D2438] mb-2">STEP 1. 디자인 이미지 준비 — 세 가지 길</p>
                            <div className="text-sm text-[#4A4058] space-y-1.5 mb-3">
                                <div>🎨 <b>AI로 이미지 만들기</b> — 제미나이·챗GPT에 아래 프롬프트로 시안 이미지를 생성</div>
                                <div>✏️ <b>손그림 스케치</b> — 종이에 메뉴 배치를 그려서 폰으로 찰칵! (네모와 글씨면 충분해요)</div>
                                <div>📷 <b>참고 화면</b> — 마음에 드는 분위기의 화면 캡처 (⚠️ 남의 사이트를 그대로 베끼면 저작권 문제가 될 수 있어요 — 분위기 참고용으로만)</div>
                            </div>
                            <CopyBlock text={IMAGE_GEN_PROMPT} label="STEP 1 — 시안 이미지 생성 프롬프트 (제미나이·챗GPT 이미지 생성)" />
                        </div>

                        <div>
                            <p className="text-sm font-bold text-[#2D2438] mb-2">STEP 2. 이미지를 첨부하고 홈페이지로 변환</p>
                            <p className="text-sm text-[#4A4058] leading-relaxed mb-2">
                                클로드·챗GPT·제미나이 채팅창의 <b>📎 첨부(+) 버튼</b>으로 준비한 이미지를 올리고, 아래 프롬프트를 함께 보내세요.
                            </p>
                            <CopyBlock text={IMAGE_PROMPT} label="STEP 2 — 이미지 → index.html 변환 프롬프트" />
                        </div>

                        <Tip>
                            강의 하이라이트로 추천 — <b>종이에 그린 손그림이 홈페이지가 되는 순간</b>,
                            "코딩은 이제 그리는 것"이라는 걸 모두가 체감합니다.
                        </Tip>
                    </div>

                    <p className="text-sm leading-relaxed text-[#4A4058] pt-2">
                        지우가 위 프롬프트로 미리 만들어 둔 시안 3종이에요. 마음에 드는 것을 골라 <b>미리보기</b>로 확인하고
                        <b> 다운로드</b>하면 바로 3단계로 넘어갈 수 있어요. (다운로드하면 index.html 파일로 저장됩니다)
                    </p>
                    <div className="grid gap-5">
                        {DESIGNS.map(d => (
                            <div key={d.file} className="bg-white border border-[#8E6FB7]/15 rounded-2xl overflow-hidden">
                                {/* 축소 미리보기 — 데스크톱 폭(1280)을 1/4로 스케일 */}
                                <div className="relative w-full overflow-hidden bg-gray-100" style={{ aspectRatio: '16/10' }}>
                                    <iframe
                                        src={d.file}
                                        title={d.name}
                                        tabIndex={-1}
                                        loading="lazy"
                                        className="absolute top-0 left-0 border-0 pointer-events-none"
                                        style={{ width: '400%', height: '400%', transform: 'scale(0.25)', transformOrigin: 'top left' }}
                                    />
                                </div>
                                <div className="px-4 py-3.5">
                                    <div className="font-extrabold text-sm">{d.name}</div>
                                    <div className="text-xs text-[#9A8FB0] mt-0.5">{d.desc}</div>
                                    <div className="flex gap-2 mt-3">
                                        <a href={d.file} target="_blank" rel="noopener noreferrer"
                                           className="flex-1 text-center text-xs font-bold py-2.5 rounded-lg border border-[#8E6FB7]/40 text-[#6E5DA3] hover:bg-[#F5EFFA]">
                                            🔍 미리보기
                                        </a>
                                        <a href={d.file} download="index.html"
                                           className="flex-1 text-center text-xs font-bold py-2.5 rounded-lg bg-[#8E6FB7] text-white hover:bg-[#7A5FA0]">
                                            ⬇ 다운로드 (index.html)
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Mobile>
                        이 단계도 폰으로 가능해요! 특히 <b>클로드 앱</b>은 위 프롬프트를 넣으면 결과가
                        <b> 미리보기(아티팩트)</b>로 바로 떠서, 폰 화면에서 완성된 홈페이지를 즉시 볼 수 있어요.
                        (챗GPT·제미나이 앱도 비슷한 미리보기 지원) 이미지 방법②도 폰이 오히려 편해요 —
                        <b> 손그림을 폰 카메라로 찍어 그 자리에서 첨부</b>하면 끝. 시안 <b>[미리보기]</b> 버튼도 폰에서 바로 열립니다.
                    </Mobile>
                    <Success>index.html 파일이 내 컴퓨터의 다운로드 폴더에 저장되어 있다. (AI로 직접 만들었다면 코드를 index.html로 저장했다)</Success>
                </Step>

                {/* 3단계 — VS Code */}
                <Step step={COURSE_STEPS[2]}>
                    <p className="text-sm leading-relaxed text-[#4A4058]">
                        VS Code는 우리의 작업실이에요. <b>설치 → 첫 실행 → 폴더 준비 → 열어서 테스트</b>, 네 걸음이면 끝납니다.
                    </p>
                    <VSCodeDownload />

                    <div className="bg-white border border-[#8E6FB7]/15 rounded-xl p-4">
                        <div className="font-extrabold text-sm mb-2">① VS Code 설치하기</div>
                        <ol className="text-sm text-[#4A4058] space-y-1.5 list-decimal list-inside">
                            <li>위 파란 버튼으로 받은 <b>VSCodeUserSetup...exe</b> 파일을 더블클릭</li>
                            <li><b>"동의합니다"</b> 선택 → 계속 <b>"다음"</b> (중간 옵션들은 그대로 둬도 괜찮아요)</li>
                            <li>마지막에 <b>"설치"</b> → 끝나면 <b>"종료"</b> — VS Code가 저절로 열리면 설치 성공! 🎉</li>
                        </ol>
                    </div>

                    <div className="bg-white border border-[#8E6FB7]/15 rounded-xl p-4">
                        <div className="font-extrabold text-sm mb-2">② 처음 켰을 때 — 당황하지 마세요</div>
                        <ol className="text-sm text-[#4A4058] space-y-1.5 list-decimal list-inside">
                            <li><b>화면이 온통 영어</b>여도 정상이에요! 잠시 뒤 오른쪽 아래에 <b>"표시 언어를 한국어로 변경..."</b> 알림이 뜨면
                                → <b>[설치 및 다시 시작]</b> 클릭. VS Code가 한국어로 변신합니다</li>
                            <li>알림을 놓쳤다면: 왼쪽의 <b>블록 4개 모양 아이콘(확장)</b> 클릭 → <b>"Korean"</b> 검색 → Korean Language Pack <b>Install</b> → 재시작</li>
                            <li>화면이 <b>어두운 색(다크 테마)</b>인 것도 정상이에요 — 개발자들이 눈 편하려고 쓰는 기본값입니다</li>
                        </ol>
                    </div>

                    <div className="bg-white border border-[#8E6FB7]/15 rounded-xl p-4">
                        <div className="font-extrabold text-sm mb-2">③ 작업 폴더 준비하기</div>
                        <ol className="text-sm text-[#4A4058] space-y-1.5 list-decimal list-inside">
                            <li>바탕화면 빈 곳에 <b>마우스 우클릭</b> → 새로 만들기 → 폴더 → 이름을 <b>my-homepage</b>로</li>
                            <li>다운로드 폴더에서 <b>index.html</b>을 클릭하고 <b>복사(Ctrl+C)</b> → my-homepage 폴더를 열고 <b>붙여넣기(Ctrl+V)</b></li>
                        </ol>
                    </div>

                    <div className="bg-white border border-[#8E6FB7]/15 rounded-xl p-4">
                        <div className="font-extrabold text-sm mb-2">④ VS Code로 폴더 열고 테스트</div>
                        <ol className="text-sm text-[#4A4058] space-y-1.5 list-decimal list-inside">
                            <li>VS Code에서 <b>파일 &gt; 폴더 열기</b> → 바탕화면의 <b>my-homepage</b> 선택</li>
                            <li>⚠️ <b>"이 폴더의 파일 작성자를 신뢰합니까?"</b> 창이 뜨면 → <b>"예, 작성자를 신뢰합니다"</b> 클릭.
                                방금 내가 만든 폴더니까 안심하세요 — 겁주는 게 아니라 확인 절차일 뿐이에요</li>
                            <li><b>테스트</b>: 왼쪽 목록의 index.html을 클릭 → 오른쪽에 <b>알록달록한 코드</b>가 보이면 통과! 🎉</li>
                        </ol>
                    </div>
                    {/* 왕초보 사고 다발 지점 2가지 — 다운로드 폴더 못 찾음 + 확장자 숨김 */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="bg-white border border-[#8E6FB7]/15 rounded-xl p-4">
                            <div className="font-extrabold text-sm mb-1.5">📂 다운받은 파일 찾기</div>
                            <p className="text-sm text-[#4A4058] leading-relaxed">
                                키보드 <b>⊞윈도우 키 + E</b>를 누르면 파일 탐색기가 열려요.
                                왼쪽 목록에서 <b>"다운로드"</b>를 클릭 — 방금 받은 파일이 맨 위에 있습니다.
                            </p>
                        </div>
                        <div className="bg-white border border-[#D85C95]/25 rounded-xl p-4">
                            <div className="font-extrabold text-sm mb-1.5">🔤 확장자 보이게 하기 (중요!)</div>
                            <p className="text-sm text-[#4A4058] leading-relaxed">
                                파일 이름이 ".html" 없이 그냥 <b>index</b>로만 보이면 확장자가 숨겨진 거예요.
                                파일 탐색기 위쪽 <b>보기 → 표시 → 파일 확장명</b>에 체크하세요.
                                이걸 켜야 index.html.<b>txt</b> 같은 이름 사고를 막을 수 있어요.
                            </p>
                        </div>
                    </div>
                    <Tip>폴더 이름을 영어로 하는 이유: 일부 개발 도구가 한글 경로에서 오작동할 수 있어서예요. 습관을 들이면 좋아요.</Tip>
                    <Mobile>
                        여기부터는 <b>PC/노트북이 필요해요</b>. 폰에서 만든 코드는 카카오톡 '나에게 보내기'나
                        이메일로 PC에 옮기면 이어서 할 수 있습니다. 지금 폰뿐이라면 이 단계부터는 눈으로 읽어두고, 집에서 노트북으로 해보세요.
                    </Mobile>
                    <Success>VS Code 왼쪽 파일 목록에 my-homepage 폴더와 그 안의 index.html이 보인다.</Success>
                </Step>

                {/* 4단계 — 로컬호스트 */}
                <Step step={COURSE_STEPS[3]}>
                    <div className="bg-white border-2 border-dashed border-[#D85C95]/40 rounded-xl p-4">
                        <div className="font-extrabold text-sm mb-1.5">🍭 준비운동 — 일단 더블클릭!</div>
                        <p className="text-sm text-[#4A4058] leading-relaxed">
                            다운로드한 index.html을 <b>더블클릭</b>해 보세요. 브라우저에 내 홈페이지가 바로 뜹니다.
                            축하해요, 벌써 절반은 성공! 다만 주소창을 보면 <b>file://</b> 로 시작하죠 —
                            이건 "파일 구경하기"예요. 이제 진짜 웹사이트처럼 <b>주소(localhost)로 여는 법</b>을 배워볼 차례입니다.
                        </p>
                    </div>
                    <p className="text-sm leading-relaxed text-[#4A4058]">
                        <b>로컬호스트(localhost)</b>란 "내 컴퓨터 안에서만 열리는 웹서버"예요.
                        인터넷에 올리기 전에 내 눈으로 먼저 확인하는 무대입니다. 방법은 두 가지 — 쉬운 길과 멋진 길.
                    </p>

                    <div className="bg-white border border-[#8E6FB7]/15 rounded-xl p-4">
                        <div className="font-extrabold text-sm mb-2">🅰 쉬운 길 — Live Server 확장</div>
                        <ol className="text-sm text-[#4A4058] space-y-1.5 list-decimal list-inside">
                            <li>VS Code 왼쪽의 블록 모양 아이콘(확장) 클릭</li>
                            <li>"Live Server" 검색 → 설치(Install)</li>
                            <li>index.html 파일을 우클릭 → <b>"Open with Live Server"</b></li>
                            <li>브라우저에 <b>localhost:5500</b> 주소로 내 홈페이지가 뜨면 성공! 🎉</li>
                        </ol>
                    </div>

                    <div className="bg-white border border-[#8E6FB7]/15 rounded-xl p-4">
                        <div className="font-extrabold text-sm mb-2">🅱 멋진 길 — Claude Code에게 부탁하기</div>
                        <ol className="text-sm text-[#4A4058] space-y-1.5 list-decimal list-inside mb-3">
                            <li>아래 <b>설치 명령</b>을 복사해 실행 — 윈도우는 시작메뉴에서 "PowerShell"을 검색해 열고 붙여넣기(Enter). 설치가 끝나면 이 창은 닫아도 돼요</li>
                            <li>⚠️ <b>중요: claude는 index.html이 있는 폴더 안에서 실행해야 해요.</b> 제일 쉬운 방법 —
                                3단계처럼 <b>VS Code로 my-homepage 폴더를 연 상태</b>에서 터미널 열기(<b>Ctrl + `</b>).
                                VS Code 터미널은 <b>열어 둔 폴더에서 자동으로 시작</b>되거든요
                                <span className="block text-xs text-[#9A8FB0] mt-0.5 ml-5">` 키 위치 = 키보드 <b>숫자 1 왼쪽</b>, 물결(~)이 그려진 키예요</span></li>
                            <li>터미널에 <b>claude</b> 입력해 실행 → 처음 한 번 로그인</li>
                            <li>아래 프롬프트를 붙여넣으면 알아서 서버를 띄워줍니다</li>
                        </ol>
                        <div className="space-y-2.5">
                            <ClaudeCodeInstall />
                            <CopyBlock text={CLAUDE_CODE_PROMPTS[0].text} label="설치 후 — 로컬 서버 띄우기 프롬프트" />
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 leading-relaxed mt-2.5">
                            🛡️ <b>설치 중 경고창이 떠도 정상이에요!</b> 파란 보안 경고나 "계속하시겠습니까?" 질문은
                            여러분이 뭘 잘못한 게 아닙니다. 공식 설치 프로그램이니 <b>"추가 정보 → 실행"</b> 또는 <b>Y(예)</b>를 눌러 진행하세요.
                        </div>
                    </div>
                    <Tip>주소창의 localhost는 내 컴퓨터에서만 보여요. 다른 사람에게 보여주려면 인터넷에 올려야 하는데, 그건 다음 코스에서 배워요.</Tip>
                    <Mobile>
                        localhost 실습은 PC 전용이지만, <b>비슷한 체험</b>은 폰으로도 돼요 — 안드로이드는 '파일' 앱에서
                        다운로드한 index.html을 눌러 <b>Chrome으로 열기</b>를 하면 내 폰 화면에 내 홈페이지가 뜹니다.
                        (아이폰은 파일 앱에서 미리보기로 확인) "내 기기에서 내 홈페이지를 열었다"는 경험은 동일해요.
                    </Mobile>
                    <Success>브라우저 주소창에 localhost로 시작하는 주소가 있고, 내 홈페이지가 화면에 떠 있다. 🎉</Success>
                </Step>

                {/* 5단계 — Claude Code 수정 */}
                <Step step={COURSE_STEPS[4]}>
                    <p className="text-sm leading-relaxed text-[#4A4058]">
                        여기가 제일 재밌는 부분! Claude Code에게 말로 부탁하고 → 브라우저 새로고침 → 바로 바뀐 모습 확인.
                        아래 프롬프트로 하나씩 실습해 보세요.
                    </p>
                    {CLAUDE_CODE_PROMPTS.slice(1).map(p => (
                        <CopyBlock key={p.label} text={p.text} label={`실습 — ${p.label}`} />
                    ))}
                    <Tip>정해진 문장은 없어요. "더 고급스럽게", "글씨 크게" 처럼 <b>친구에게 말하듯</b> 부탁하는 게 요령입니다.</Tip>
                    <Mobile>
                        Claude Code는 PC 전용이지만, 폰에서는 <b>클로드 앱</b>이 그 역할을 대신해요 —
                        기존 코드를 붙여넣고 "헤더를 파란색으로 바꿔줘"라고 하면 <b>미리보기(아티팩트)</b>가
                        바로 바뀐 모습으로 갱신됩니다. 보면서 고치는 경험은 폰에서도 똑같아요.
                    </Mobile>
                    <Success>부탁 → 저장 → 새로고침 사이클로 홈페이지가 내 말대로 바뀐다. 이제 여러분은 개발자예요!</Success>
                </Step>

                {/* 🆘 막혔을 때 — 강의장 단골 질문 */}
                <section id="faq" className="scroll-mt-20">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#D85C95] text-white font-extrabold flex items-center justify-center text-sm">🆘</span>
                        <h2 className="text-lg sm:text-xl font-extrabold text-[#2D2438]">막혔을 때 — 자주 나오는 질문</h2>
                    </div>
                    <div className="space-y-2.5">
                        {FAQS.map(([q, a]) => <FaqItem key={q} q={q} a={a} />)}
                    </div>
                </section>

                {/* 📝 학습평가 — 10문제 합격 시 '완료' 기록(구 지우 CTA 대체) */}
                <QuizSection record={record} onPassed={() => setRecord({ passed: true, passedAt: record?.passedAt ?? new Date().toISOString() })} />

                {/* 📣 완주 후 공유 — 추천 링크로 바이럴 */}
                <ReferralShareBox code={refCode} />
            </main>
            </div>
        </div>
    );
};

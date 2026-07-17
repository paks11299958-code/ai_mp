import React, { useState } from 'react';

interface Props {
    initialTab?: 'terms' | 'privacy';
    onClose: () => void;
}

export const TermsModal: React.FC<Props> = ({ initialTab = 'terms', onClose }) => {
    const [tab, setTab] = useState<'terms' | 'privacy'>(initialTab);

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
        }}>
            <div style={{
                background: '#FBF8F3',
                borderRadius: 16,
                width: '100%',
                maxWidth: 640,
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}>
                {/* 헤더 */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderBottom: '1px solid #E8DDD0',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={() => setTab('terms')}
                            style={{
                                padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                                fontSize: 13, fontWeight: 600,
                                background: tab === 'terms' ? '#8E6FB7' : 'transparent',
                                color: tab === 'terms' ? '#fff' : '#8B7355',
                                transition: 'all 0.2s',
                            }}
                        >
                            이용약관
                        </button>
                        <button
                            onClick={() => setTab('privacy')}
                            style={{
                                padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                                fontSize: 13, fontWeight: 600,
                                background: tab === 'privacy' ? '#8E6FB7' : 'transparent',
                                color: tab === 'privacy' ? '#fff' : '#8B7355',
                                transition: 'all 0.2s',
                            }}
                        >
                            개인정보처리방침
                        </button>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 20, color: '#A89080', lineHeight: 1,
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* 본문 */}
                <div style={{
                    overflowY: 'auto', padding: '24px 24px 32px',
                    fontSize: 13, color: '#4A3728', lineHeight: 1.8,
                    flex: 1,
                }}>
                    {tab === 'terms' ? <TermsContent /> : <PrivacyContent />}
                </div>
            </div>
        </div>
    );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#2D1F0E', marginBottom: 8, borderLeft: '3px solid #8E6FB7', paddingLeft: 10 }}>
            {title}
        </h3>
        <div style={{ paddingLeft: 13 }}>{children}</div>
    </div>
);

const TermsContent: React.FC = () => (
    <div>
        <p style={{ marginBottom: 20, color: '#7A6555', fontSize: 12 }}>
            시행일: 2026년 03월 09일 &nbsp;|&nbsp; 상호명: 입소문
        </p>

        <Section title="제1조 (목적)">
            <p>본 약관은 입소문(이하 "회사")가 운영하는 AI 페르소나 채팅 서비스(이하 "서비스")의 이용 조건 및 절차, 회사와 이용자의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.</p>
        </Section>

        <Section title="제2조 (정의)">
            <p>① "서비스"란 회사가 제공하는 AI 페르소나 채팅, 주식 분석, 명품 감정, 골프 예약, 오늘뉴스 등 일체의 서비스를 말합니다.<br />
            ② "이용자"란 본 약관에 동의하고 서비스를 이용하는 회원 및 비회원을 말합니다.<br />
            ③ "포인트"란 서비스 이용을 위해 충전하거나 지급받는 가상의 화폐 단위를 말합니다.</p>
        </Section>

        <Section title="제3조 (약관의 효력 및 변경)">
            <p>① 본 약관은 서비스 화면에 게시하거나 기타 방법으로 이용자에게 공지함으로써 효력이 발생합니다.<br />
            ② 회사는 필요한 경우 약관을 변경할 수 있으며, 변경된 약관은 공지 후 7일 이후부터 효력이 발생합니다.</p>
        </Section>

        <Section title="제4조 (서비스 이용)">
            <p>① 서비스는 연중무휴 24시간 제공을 원칙으로 하되, 시스템 점검 등의 사유로 일시 중단될 수 있습니다.<br />
            ② 일부 서비스는 포인트가 필요하며, 포인트 소진 시 해당 서비스 이용이 제한될 수 있습니다.</p>
        </Section>

        <Section title="제5조 (포인트 충전 및 환불 정책)">
            <p style={{ background: 'rgba(142,111,183,0.08)', borderRadius: 8, padding: '12px 14px', marginBottom: 8 }}>
                <strong>📌 충전 포인트 환불 정책</strong><br /><br />
                ① 충전된 포인트의 <strong>이용기간과 환불 가능 기간은 결제 시점으로부터 1년 이내</strong>로 제한됩니다.<br /><br />
                ② 유료 충전 포인트는 결제 후 7일 이내, 미사용 상태인 경우 전액 환불이 가능합니다.<br /><br />
                ③ 포인트가 일부 사용된 경우 잔여 포인트에 대해 환불이 가능합니다. 단, 환불 수수료(결제금액의 10%)가 부과될 수 있습니다.<br /><br />
                ④ 회사가 무료로 지급한 보너스 포인트(가입 보너스, 레벨업 보너스 등)는 환불 대상에서 제외됩니다.<br /><br />
                ⑤ 환불 요청은 고객센터(0502-468-0502)로 문의하시기 바랍니다.<br /><br />
                ⑥ 「전자상거래 등에서의 소비자보호에 관한 법률」에 따라 소비자의 청약철회 권리는 보장됩니다.
            </p>
        </Section>

        <Section title="제6조 (이용자의 의무)">
            <p>① 이용자는 다음 행위를 해서는 안 됩니다.<br />
            &nbsp;&nbsp;- 타인의 정보 도용 및 허위 정보 등록<br />
            &nbsp;&nbsp;- 서비스를 이용한 불법 행위<br />
            &nbsp;&nbsp;- AI 생성 콘텐츠를 악의적 목적으로 사용<br />
            &nbsp;&nbsp;- 서비스의 정상적인 운영을 방해하는 행위</p>
        </Section>

        <Section title="제7조 (면책 조항)">
            <p>① 회사는 천재지변, 전쟁, 기간통신사업자의 서비스 중단 등 불가항력적 사유로 인한 서비스 중단에 대해 책임을 지지 않습니다.<br />
            ② AI가 생성한 콘텐츠는 참고용이며, 투자·의료·법률 등 전문 분야에서의 최종 판단은 이용자 본인의 책임입니다.</p>
        </Section>

        <Section title="제8조 (분쟁 해결)">
            <p>본 약관에 관한 분쟁은 대한민국 법률을 적용하며, 분쟁 발생 시 회사 소재지 관할 법원을 전속 관할 법원으로 합니다.</p>
        </Section>

        <p style={{ marginTop: 24, fontSize: 12, color: '#A89080' }}>
            상호명: 입소문 &nbsp;|&nbsp; 대표자: 신지윤 &nbsp;|&nbsp; 사업자등록번호: 656-08-03261<br />
            통신판매업 신고번호: 제 2026-충북청주-0690호<br />
            주소: 충북 청주 흥덕 옥산 오송가락로 1056 청주리버파크자이 104-1303<br />
            고객센터: 0502-468-0502
        </p>
    </div>
);

const PrivacyContent: React.FC = () => (
    <div>
        <p style={{ marginBottom: 20, color: '#7A6555', fontSize: 12 }}>
            시행일: 2026년 03월 09일 &nbsp;|&nbsp; 상호명: 입소문
        </p>

        <Section title="제1조 (개인정보의 수집 및 이용 목적)">
            <p>입소문(이하 "회사")는 다음의 목적을 위해 개인정보를 수집·이용합니다.<br />
            &nbsp;&nbsp;- 회원 가입 및 서비스 이용을 위한 본인 확인<br />
            &nbsp;&nbsp;- 서비스 제공 및 운영<br />
            &nbsp;&nbsp;- 결제 처리 및 환불 처리<br />
            &nbsp;&nbsp;- 고객 문의 응대 및 분쟁 해결</p>
        </Section>

        <Section title="제2조 (수집하는 개인정보 항목)">
            <p>① <strong>필수 항목</strong>: 이메일 주소 또는 휴대폰 번호, 닉네임<br />
            ② <strong>선택 항목</strong>: 생년월일, 성별<br />
            ③ <strong>소셜 로그인 시 수집</strong>: 카카오 계정 이메일, 카카오 닉네임, 카카오 고유 ID<br />
            ④ <strong>얼굴·신체 이미지</strong>: 관상·손금·헤어스타일·시간여행 등 이미지 기반 기능 이용 시
            이용자가 직접 업로드한 사진. 관상·손금 등 분석형 기능은 분석 즉시 처리 후 저장하지 않으며,
            헤어·시간여행 등 결과 이미지 생성 기능은 아래 제3조의 기간 동안만 보관합니다.<br />
            ⑤ <strong>자동 수집</strong>: 접속 IP, 서비스 이용 기록, 결제 기록<br />
            ⑥ <strong>홈페이지 만들기 신청서</strong>: 업종·상호명·소개·메뉴/가격·주소·영업시간·전화번호 등
            이용자가 홈페이지 게시 목적으로 직접 입력한 정보. 입력한 내용은 <strong>누구나 접근 가능한
            공개 웹페이지에 그대로 게시</strong>되므로, 공개를 원하지 않는 정보(개인 휴대폰 번호, 자택 주소 등)는
            입력하지 않아야 합니다.</p>
        </Section>

        <Section title="제3조 (개인정보의 보유 및 이용 기간)">
            <p>① 회원 탈퇴 시까지 보유하며, 탈퇴 후 즉시 파기합니다.<br />
            ② <strong>얼굴·신체 이미지</strong>는 개인정보 최소보존 원칙에 따라 다음 기간 경과 후 자동 파기합니다.<br />
            &nbsp;&nbsp;- 헤어스타일 합성 결과 이미지: 생성 후 7일<br />
            &nbsp;&nbsp;- 시간여행(나이 변환) 저장 이미지: 저장 후 90일<br />
            &nbsp;&nbsp;- 관상·손금·닮은꼴 등 분석형 기능: 분석 즉시 처리, 별도 저장하지 않음<br />
            ③ 단, 관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.<br />
            &nbsp;&nbsp;- 전자상거래 관련 기록: 5년 (전자상거래법)<br />
            &nbsp;&nbsp;- 소비자 불만 또는 분쟁 처리 기록: 3년 (전자상거래법)<br />
            &nbsp;&nbsp;- 접속 기록: 3개월 (통신비밀보호법)</p>
        </Section>

        <Section title="제4조 (개인정보의 제3자 제공)">
            <p>회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 단, 다음의 경우는 예외입니다.<br />
            &nbsp;&nbsp;- 이용자가 사전에 동의한 경우<br />
            &nbsp;&nbsp;- 법령의 규정에 의거하거나 수사 목적으로 법령에 정해진 절차를 따르는 경우</p>
        </Section>

        <Section title="제5조 (개인정보 처리 위탁)">
            <p>회사는 서비스 제공을 위해 다음과 같이 개인정보 처리를 위탁합니다.<br />
            &nbsp;&nbsp;- Google Cloud Platform: 서버 인프라 운영<br />
            &nbsp;&nbsp;- Vercel: 웹 서비스 배포 및 운영<br />
            &nbsp;&nbsp;- 카카오: 소셜 로그인 인증<br />
            &nbsp;&nbsp;- Brevo(Sendinblue): 이메일 발송</p>
        </Section>

        <Section title="제6조 (이용자의 권리)">
            <p>이용자는 언제든지 다음의 권리를 행사할 수 있습니다.<br />
            &nbsp;&nbsp;- 개인정보 열람 요청<br />
            &nbsp;&nbsp;- 개인정보 수정 요청<br />
            &nbsp;&nbsp;- 개인정보 삭제 요청 (회원 탈퇴)<br />
            &nbsp;&nbsp;- 개인정보 처리 정지 요청<br /><br />
            권리 행사는 고객센터(0502-468-0502)로 문의하시기 바랍니다.</p>
        </Section>

        <Section title="제7조 (개인정보 보호책임자)">
            <p>개인정보 보호책임자: 신지윤<br />
            이메일: paks11299958@gmail.com<br />
            전화: 0502-468-0502</p>
        </Section>

        <Section title="제8조 (쿠키 사용)">
            <p>회사는 서비스 제공을 위해 쿠키를 사용합니다. 이용자는 브라우저 설정을 통해 쿠키 사용을 거부할 수 있으나, 일부 서비스 이용이 제한될 수 있습니다.</p>
        </Section>

        <p style={{ marginTop: 24, fontSize: 12, color: '#A89080' }}>
            상호명: 입소문 &nbsp;|&nbsp; 대표자: 신지윤 &nbsp;|&nbsp; 사업자등록번호: 656-08-03261<br />
            고객센터: 0502-468-0502 &nbsp;|&nbsp; 이메일: paks11299958@gmail.com
        </p>
    </div>
);

export default TermsModal;

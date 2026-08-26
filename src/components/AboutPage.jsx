const LAWS = [
  {
    name: '개인정보 보호법',
    note: '만 14세 미만 보호자 동의(제22조의2), 주민번호 처리 제한, 안전조치의무 등',
    url: 'https://www.law.go.kr/법령/개인정보보호법',
  },
  {
    name: 'AI 기본법 (2026-01-22 시행)',
    note: '유·초·중등 학생 평가 AI는 고영향 인공지능 — 심사가 필요한 법적 이유',
    url: 'https://www.law.go.kr/법령/인공지능발전과신뢰기반조성등에관한기본법',
  },
  {
    name: '개인정보의 안전성 확보조치 기준',
    note: '개인정보보호위원회 고시 — 접근통제·암호화·인증정보 보호',
    url: 'https://www.law.go.kr/LSW//admRulInfoP.do?admRulSeq=2100000265956&chrClsCd=010201',
  },
  {
    name: '아동·청소년 개인정보 보호 가이드라인',
    note: '개인정보보호위원회(2022) — 연령 확인, 법정대리인 동의 절차',
    url: 'https://www.korea.kr/briefing/policyBriefingView.do?newsId=148903862',
  },
  {
    name: '교육부 「교육분야 인공지능 윤리원칙」(2022)',
    note: '"사람의 성장을 지원하는 인공지능" — 10대 원칙',
    url: 'https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=294&lev=0&statusYN=W&s=moe&m=020402&opType=N&boardSeq=92297',
  },
  {
    name: '국가 인공지능 윤리기준 (2020)',
    note: '과기정통부 — 3대 원칙·10대 요건',
    url: 'https://ai.kisdi.re.kr/aieth/main/contents.do?menuNo=400029',
  },
  {
    name: 'KISA 소프트웨어 개발보안 가이드',
    note: '하드코딩 비밀키·XSS 등 보안약점의 공인 분류 — 규칙 스캔의 기준',
    url: 'https://www.kisa.or.kr/2060204/form?postSeq=5&lang_type=KO&page=1',
  },
  {
    name: '시도교육청 생성형 AI 가이드라인',
    note: '서울시교육청 학교급별 활용 지침 등 — 개인정보의 AI 입력 금지 원칙',
    url: 'https://enews.sen.go.kr/news/view.do?bbsSn=190482&step1=3&step2=1',
  },
]

export default function AboutPage({ onStart }) {
  return (
    <div className="about">
      <section className="hero">
        <span className="hero-badge">교육청 공인인증을 향한 심사 인프라</span>
        <h1>
          선생님이 만든 앱,
          <br />
          <em>증거로</em> 검증합니다
        </h1>
        <p className="hero-sub">
          에듀 세이프(EduSafe)는 교사가 바이브 코딩으로 만든 앱을 공인 기관이
          점검·검수·평가하기 위한 심사 시스템입니다.
        </p>
        <span className="hero-trust">자기신고 없음 · 증거 중심 · 최종 판정은 사람이 합니다</span>
      </section>

      <section className="home-why">
        <h2>왜 필요한가요</h2>
        <div className="why-grid">
          <div className="why-item">
            <strong>🧒 학생의 정보가 담깁니다</strong>
            <p>
              감정 기록, 성적, 이름 — 교사 제작 앱은 민감한 정보를 다루기 쉽습니다. 이용자
              대부분이 만 14세 미만이라 개인정보 보호법의 가장 엄격한 보호가 적용됩니다.
            </p>
          </div>
          <div className="why-item">
            <strong>⚖️ 법이 시행되었습니다</strong>
            <p>
              2026년 1월 시행된 AI 기본법은 유·초·중등 <strong>학생 평가에 쓰이는 AI</strong>를
              고영향 인공지능으로 분류합니다. 학교 현장의 AI 앱은 이제 법이 주시하는 영역입니다.
            </p>
          </div>
          <div className="why-item">
            <strong>🔍 선의만으로는 부족합니다</strong>
            <p>
              자가점검은 정직한 답변을 전제하지만, 심사는 통과하고 싶은 사람을 전제합니다.
              그래서 자기신고 대신 코드에서 수집한 <strong>증거</strong>로 판정합니다.
            </p>
          </div>
          <div className="why-item">
            <strong>🌱 혁신을 멈추지 않게</strong>
            <p>
              목표는 금지가 아니라 안전한 통과입니다. 심사 도구를 공개해 누구나 제출 전에
              모의심사를 해볼 수 있습니다.
            </p>
          </div>
        </div>
      </section>

      <section className="home-how">
        <h2>어떻게 심사하나요</h2>
        <ol>
          <li>
            <strong>저장소 로드 + 규칙 스캔</strong> — GitHub 주소만으로 30여 종의 보안 규칙을
            검사합니다 (API 키 불필요).
          </li>
          <li>
            <strong>AI 분류 추론</strong> — 교무·행정 / 교과 도구 / 학습 콘텐츠 / 학급 운영
            4트랙 중 어디인지 근거와 함께 제안하고, 심사자가 확정합니다.
          </li>
          <li>
            <strong>루브릭 판정</strong> — 루브릭 v1.0(필수 7 + 점수 14 + 수동 5)에 대해 AI가
            판정 초안을 작성합니다. 모든 판정에 근거 코드 인용이 강제됩니다.
          </li>
          <li>
            <strong>심사자 승인·번복</strong> — 항목마다 근거를 확인하고 승인 또는 번복하며,
            번복 사유는 기록으로 남습니다.
          </li>
          <li>
            <strong>심사 보고서</strong> — 커밋 해시·루브릭 버전이 고정된 보고서를 생성합니다
            (인쇄/PDF, 개선 권고 포함).
          </li>
        </ol>
      </section>

      <section className="home-why">
        <h2>신뢰의 장치</h2>
        <div className="why-grid">
          <div className="why-item">
            <strong>📎 근거 없는 판정은 강등</strong>
            <p>
              근거 인용이 없는 충족/미충족 판정은 자동으로 &lsquo;판단불가&rsquo;로 내려갑니다.
              AI가 확신을 흉내 내지 못하게 코드로 강제합니다.
            </p>
          </div>
          <div className="why-item">
            <strong>⏸️ 판단불가가 남으면 보류</strong>
            <p>
              사람의 확인이 필요한 항목이 하나라도 남아 있으면 종합 판정은 무조건
              &lsquo;보류&rsquo;입니다.
            </p>
          </div>
          <div className="why-item">
            <strong>👩‍⚖️ 최종 판정은 사람</strong>
            <p>
              AI는 심사단을 대체하지 않습니다 — 심사단의 눈을 코드 속으로 데려갈 뿐입니다.
            </p>
          </div>
          <div className="why-item">
            <strong>🔒 커밋 지문으로 변조 방지</strong>
            <p>
              심사는 저장소의 커밋 해시(코드 전체의 고유 지문)에 고정됩니다. 인증 후 코드를
              고치면 지문이 달라져 인증받은 코드가 아님이 증명됩니다.
            </p>
          </div>
        </div>
      </section>

      <section className="home-how">
        <h2>심사 기준의 근거</h2>
        <ul className="about-laws">
          {LAWS.map((law) => (
            <li key={law.name}>
              <a href={law.url} target="_blank" rel="noreferrer">
                {law.name}
              </a>
              <span className="law-note">{law.note}</span>
            </li>
          ))}
        </ul>
        <p className="about-note">
          에듀 세이프의 판정은 법적 효력을 갖는 인증이 아닙니다. 공인 권위는 도구가 아니라
          심사단의 확인 기록과 기관의 인증 대장에서 나옵니다.
        </p>
      </section>

      <div className="about-cta">
        <button className="btn-primary" onClick={onStart}>
          ⚖️ 심사 시작하기
        </button>
      </div>
    </div>
  )
}

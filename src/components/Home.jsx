export default function Home({ goTo }) {
  return (
    <section className="home">
      <div className="hero">
        <div className="hero-badge">교사를 위한 무료 자가점검 도구</div>
        <h1>
          선생님이 만든 앱,
          <br />
          <em>안심하고</em> 학생에게 열어주세요
        </h1>
        <p className="hero-sub">
          바이브 코딩으로 만든 웹앱·사이트를 학생에게 배포하기 전에 —<br />
          보안 취약점, 개인정보보호법, AI 윤리를 한 번에 점검하세요.
        </p>
        <div className="hero-trust">
          🔒 검사할 코드는 <strong>브라우저 밖으로 전송되지 않아요</strong> · 회원가입 없음 · 무료
        </div>
      </div>

      <div className="home-cards">
        <button className="home-card" onClick={() => goTo('scan')}>
          <div className="home-card-icon">🔍</div>
          <h3>코드 보안 스캔</h3>
          <p>
            <strong>GitHub 주소만 붙여넣으면</strong> 저장소를 통째로 자동 검사해요. 노출된 API 키,
            열린 데이터베이스 규칙, XSS 위험 등 30여 종을 찾고, 발견된 문제마다{' '}
            <strong>AI에게 붙여넣을 수정 요청 프롬프트</strong>까지 만들어 드려요. 파일 업로드도
            돼요.
          </p>
          <span className="home-card-go">주소 넣고 검사하기 →</span>
        </button>

        <button className="home-card" onClick={() => goTo('privacy')}>
          <div className="home-card-icon">🪪</div>
          <h3>개인정보 점검</h3>
          <p>
            수집 최소화, 만 14세 미만 보호자 동의, 해외 서버 저장, 파기 계획까지 —
            개인정보보호법을 교사 눈높이 질문 12개로 풀었어요. 학생 데이터를 다루는 앱이라면 꼭
            확인하세요.
          </p>
          <span className="home-card-go">체크리스트 시작 →</span>
        </button>

        <button className="home-card" onClick={() => goTo('ethics')}>
          <div className="home-card-icon">🤖</div>
          <h3>AI 윤리 점검</h3>
          <p>
            교육부 「교육분야 인공지능 윤리원칙」을 바탕으로, AI 판정의 공정성·투명성·위기 대응까지
            12개 문항으로 점검해요. AI 기능이 없어도 바이브 코딩 자체의 책임 항목을 확인할 수
            있어요.
          </p>
          <span className="home-card-go">체크리스트 시작 →</span>
        </button>

        <button className="home-card" onClick={() => goTo('ops')}>
          <div className="home-card-icon">🧯</div>
          <h3>운영·복구 점검</h3>
          <p>
            코드에 잘못이 없어도 당하는 공격이 있어요 — 무료 한도를 소진시키는 도배, 계정 탈취.
            App Check, 2단계 인증, 백업, 긴급 대응까지 <strong>"무너졌을 때 다시 세우는
            준비"</strong>를 5문항으로 점검해요.
          </p>
          <span className="home-card-go">체크리스트 시작 →</span>
        </button>
      </div>

      <div className="home-how">
        <h2>이렇게 진행돼요</h2>
        <ol>
          <li>
            <strong>점검</strong> — 세 영역을 순서 상관없이, 일부만 해도 괜찮아요
          </li>
          <li>
            <strong>고치기</strong> — 발견된 문제마다 해결 방법과 AI 수정 요청 프롬프트를 드려요
          </li>
          <li>
            <strong>리포트</strong> — 종합 결과를 PNG로 저장해 연수 자료나 결재 참고자료로 쓰세요
          </li>
        </ol>
      </div>

      <div className="home-why">
        <h2>왜 점검이 필요한가요?</h2>
        <div className="why-grid">
          <div className="why-item">
            <strong>"소스 보기"는 누구나 눌러요</strong>
            <p>
              웹에 올린 코드는 전부 공개돼요. 코드 속 API 키와 비밀번호는 이미 노출된 것과
              같아요 — 실제로 노출된 키는 자동 수집 봇이 몇 분 안에 찾아냅니다.
            </p>
          </div>
          <div className="why-item">
            <strong>학생 데이터는 법이 지켜요</strong>
            <p>
              중학교 1학년 대부분은 만 14세 미만 — 개인정보 수집에 보호자 동의가 필요한
              나이예요. 좋은 의도로 만든 앱도 법을 지켜야 계속할 수 있어요.
            </p>
          </div>
          <div className="why-item">
            <strong>AI의 판단은 틀릴 수 있어요</strong>
            <p>
              감정 인식, 표정 채점, 유형 판정… AI 기능이 학생에게 낙인이 되지 않도록, 교육부 AI
              윤리원칙에 비추어 설계를 점검해요.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

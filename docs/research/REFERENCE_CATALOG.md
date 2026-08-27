# 교육용 웹서비스 보안·개인정보 레퍼런스 카탈로그

- 조사 기준일: 2026-08-22 (Asia/Seoul)
- 대상: 교사가 바이브 코딩으로 만든 웹앱·게임·API·AI 서비스를 점검하는 제품
- 범위: 대한민국 법령·정부 지침, 교육 분야 개인정보 자료, AI/바이브 코딩 보안, 일반 애플리케이션 보안, 공급망, 위험도 산정, 시험 자료

이 문서는 제품의 규칙과 보고서 근거를 설계하기 위한 조사 자료다. 개별 학교나 서비스에 대한 법률 자문 또는 준법 인증이 아니다. 링크의 문서가 개정될 수 있으므로 모든 판정에는 `source_id`, 문서 버전, 시행일, 점검 기준일을 함께 보관해야 한다.

## 1. 문서의 법적 무게

같은 “가이드”라도 효력이 다르다. 제품 화면과 보고서에서 아래 등급을 섞어 표현하지 않는다.

| 등급 | 의미 | 보고서 표현 예시 |
|---|---|---|
| `binding_law` | 법률·시행령 등 적용되는 법규 | “법적 의무 가능성 — 담당자 검토 필요” |
| `binding_notice` | 법령에 근거한 고시·행정규칙 | “안전조치 기준에서 요구” |
| `official_guidance` | 정부기관의 해설·안내서·업무지침 | “공식 안내서가 권고” |
| `consensus_standard` | 국제표준·산업 검증 기준 | “보안 표준 기준 미충족” |
| `community_guidance` | 공개 커뮤니티의 구현 지침 | “실무 보안 권고” |
| `taxonomy_or_intel` | 취약점 분류·점수·위협 인텔리전스 | “분류/우선순위 산정 근거” |
| `test_corpus` | 의도적으로 취약한 앱·벤치마크 | “탐지 성능 시험 자료” |

## 2. 가장 먼저 제품에 넣을 핵심 묶음

### 2.1 개인정보·학교 규칙 엔진

1. [개인정보 보호법 — 현행 2025-10-02 시행본](https://law.go.kr/LSW/lsInfoP.do?lsiSeq=270351)
2. [개인정보 보호법 시행령 — 현행 2026-08-20 시행본](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?lsJoLnkSeq=1033215557)
3. [개인정보의 안전성 확보조치 기준 — 개인정보위 고시 제2026-9호, 2026-07-01 시행](https://law.go.kr/admRulLsInfoP.do?admRulSeq=2100000281400)
4. [교육부 개인정보 보호지침 — 교육부훈령 제476호, 2024-02-07 시행](https://law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000236216&chrClsCd=010201)
5. [아동·청소년 개인정보 보호 안내서 — 개인정보위, 2024-12-30](https://www.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=&nttId=10896)
6. [AI 프라이버시 리스크 관리 모델 — 개인정보위, 2025-02-21](https://pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=G010030000&nttId=11014)
7. [초·중등교육법 제29조의2 — 지능정보기술 활용 학습지원 소프트웨어](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029394711)
8. [교육부·개인정보위 학습지원 소프트웨어 선정기준 발표 — 2025-12-29](https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=294&boardSeq=105007&lev=0&m=020402)
9. [개인정보위 현행 안내서 전체 목록 — 2026-07-31 기준](https://www.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=D010030040&nttId=12353)

이 묶음은 단순 키워드 탐지가 아니라 다음 질문에 답하는 구조화 체크리스트로 구현한다.

- 어떤 학생·보호자·교직원 데이터를 왜 수집하는가?
- 처리 근거, 필수/선택 구분, 보유기간, 파기 대상은 무엇인가?
- 만 14세 미만 동의와 법정대리인 확인이 필요한가?
- 건강·상담·장애·생체정보 같은 민감정보 또는 주민등록번호 등 고유식별정보가 있는가?
- AI·클라우드 업체가 수탁자인가, 자체 목적으로 재사용하는 제3자인가?
- 처리국가, 백업·로그 위치, 재수탁자를 포함한 국외이전이 있는가?
- 학생/보호자가 열람·정정·삭제·처리정지·동의철회를 할 수 있는가?
- 공립학교·교육청의 개인정보파일 등록, 영향평가, CPO 승인 또는 학교운영위원회 심의가 필요한가?

주의할 구분:

- 학번은 중요한 개인정보지만 법에서 말하는 고유식별정보(주민등록번호·여권번호·운전면허번호·외국인등록번호)는 아니다.
- 만 14세 미만 법정대리인 동의 규칙을 모든 18세 미만에게 동일하게 표시하면 부정확하다.
- 실제 학생 데이터, 운영 로그, 상담 기록, API 키는 외부 LLM으로 보내지 않는다. 먼저 로컬에서 탐지·마스킹하고 최소한의 코드 조각과 정적분석 결과만 보낸다.

### 2.2 일반 웹·API 보안 규칙 엔진

1. [OWASP ASVS 5.0.0](https://owasp.org/www-project-application-security-verification-standard/) — 검증 가능한 웹 보안 요구사항의 주 기준
2. [OWASP Top 10:2025](https://owasp.org/Top10/2025/0x00_2025-Introduction/) — 교사가 이해하기 쉬운 상위 위험 분류
3. [OWASP API Security Top 10:2023](https://owasp.org/www-project-api-security/) — BOLA/IDOR, 인증, 자원 고갈, SSRF 등 API 위험
4. [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/) — 발견별 수정 방법
5. [CWE 4.20](https://cwe.mitre.org/data/index.html) 및 [2025 CWE Top 25](https://cwe.mitre.org/top25/archive/2025/2025_cwe_top25.html) — 언어·도구 간 공통 취약점 ID

OWASP Top 10 자체도 이를 완전한 검증 표준으로 보지 않는다. 따라서 결과 화면의 쉬운 분류는 Top 10, 실제 점검 요구사항은 ASVS, 기계 판독 ID는 CWE로 연결하는 것이 적절하다.

### 2.3 바이브 코딩·AI 보안 묶음

1. [KISA 인공지능(AI) 보안 안내서 — 2026-03-13 정오 수정본](https://www.kisa.or.kr/2060204/form?lang_type=KO&postSeq=19)
2. [KISA AI 보안 레드티밍 가이드 — 2026-07-07](https://www.kisa.or.kr/401/form?lang_type=KO&page=1&postSeq=3713)
3. [KISA AI 보안 위협 대응 매뉴얼 — 2026-07-07](https://www.kisa.or.kr/401/form?page=1&postSeq=3712)
4. [OWASP Secure Coding with AI Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Coding_with_AI_Cheat_Sheet.html)
5. [OWASP LLM Prompt Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)
6. [OWASP MCP Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/MCP_Security_Cheat_Sheet.html)
7. [OWASP Top 10 for LLM/GenAI Applications 2025](https://genai.owasp.org/llm-top-10/)
8. [NIST SP 800-218A — 생성형 AI 모델을 위한 SSDF 보완 지침, 2024-07](https://csrc.nist.gov/pubs/sp/800/218/a/final)
9. [NIST AI 600-1 — Generative AI Profile, 2024-07-26](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
10. [영국 NCSC·CISA 등 Guidelines for Secure AI System Development v1.0, 2023-11-27](https://www.ncsc.gov.uk/collection/guidelines-secure-ai-system-development)

이 묶음으로 일반 정적분석이 놓치는 다음 항목을 별도 규칙으로 만든다.

- AI가 지어낸 패키지 이름과 타이포스쿼팅
- 오래됐거나 취약한 의존성, 잠금파일 누락, 무결성 검증 부재
- 저장소 README·이슈·웹페이지가 AI 에이전트를 조종하는 간접 프롬프트 인젝션
- MCP/플러그인/셸/브라우저 도구의 과도한 권한과 승인 없는 상태 변경
- `.env`, 학생 데이터, 운영 로그, 내부 URL이 모델 컨텍스트나 대화 기록으로 유출되는 문제
- AI가 보안 테스트를 삭제·조작하거나 범위를 벗어난 파일을 수정하는 문제
- 생성 코드를 검토 없이 배포하거나 CI/CD 자격증명으로 실행하는 문제
- 모델 출력 HTML/Markdown/URL/명령을 신뢰해 생기는 XSS·명령 실행·피싱

## 3. 대한민국 공식 레퍼런스

### 3.1 법령·고시·교육 분야

| 자료 | 발행기관/상태 | 제품에서 쓰는 곳 |
|---|---|---|
| [개인정보 보호법](https://law.go.kr/LSW/lsInfoP.do?lsiSeq=270351) | 국가법령정보센터, `binding_law` | 처리 근거, 최소수집, 동의, 민감/고유식별, 위탁, 국외이전, 권리, 자동화 결정, 유출 |
| [개인정보 보호법 시행령](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?lsJoLnkSeq=1033215557) | 국가법령정보센터, `binding_law` | 법정대리인 확인 방법, 영향평가 기준, 유출 신고 세부조건 |
| [안전성 확보조치 기준](https://law.go.kr/admRulLsInfoP.do?admRulSeq=2100000281400) | 개인정보위 고시 제2026-9호, `binding_notice` | 접근권한, 인증, 암호화, 키 관리, 악성코드 방지, 접속기록, 파기 |
| [표준 개인정보 보호지침](https://www.law.go.kr/행정규칙/표준개인정보보호지침) | 개인정보위 고시 제2025-4호, 2025-04-11 | 개인정보 생애주기, 파일 등록, 파기, 영상정보, 권리행사 |
| [개인정보 처리 방법에 관한 고시](https://www.law.go.kr/행정규칙/개인정보처리방법에관한고시) | 개인정보위 고시 제2025-5호, 2025-04-11 | 동의 화면 표현과 권리행사 서식 점검 |
| [개인정보 영향평가에 관한 고시](https://www.law.go.kr/LSW/admRulLsInfoP.do?admRulId=73485&efYd=0) | 개인정보위 고시 제2025-7호, 2025-09-05 | 공공기관 PIA 대상·절차와 AI 평가 분야 |
| [개인정보 국외 이전 운영 등에 관한 규정](https://law.go.kr/LSW/admRulLsInfoP.do?admRulSeq=2100000230332) | 개인정보위 고시 제2023-11호, 2023-10-16 | 해외 LLM/API의 근거, 고지·동의, 재이전, 보호조치 |
| [가명정보의 결합 및 반출 등에 관한 고시](https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000263732&chrClsCd=010201) | 개인정보위 고시 제2025-8호, 2025-09-09 | 교육데이터 결합·반출 통제 |
| [교육부 개인정보 보호지침](https://law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000236216&chrClsCd=010201) | 교육부훈령 제476호, `binding_notice`/기관 내부 규율 | 학교 개인정보파일, CPO 승인, 제공 기록, 처리방침, 유출 보고 |
| [개인정보 보호법 제22조의2](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1020398521) | 만 14세 미만 아동 조문 | 동의를 받아 처리하는 경우의 보호자 동의·확인, 쉬운 안내, 최소한의 확인정보 |
| [개인정보 보호법 제26조](https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1029331867) | 위탁 조문 | AI·클라우드 DPA, 재위탁, 감독, 삭제 |
| [개인정보 보호법 제28조의8](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029334953) | 국외이전 조문 | API 리전, 처리국가, 수령자·목적·기간 고지 |
| [개인정보 유출신고 안내](https://www.pipc.go.kr/np/default/page.do?mCode=D030040000) | 개인정보위, `official_guidance` | 72시간 대응 워크플로와 신고 분기 |
| [아동·청소년 개인정보 보호 안내서](https://www.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=&nttId=10896) | 개인정보위, 2024-12-30, `official_guidance` | 아동 친화 고지, 보호자 확인, 기본 보호설정, 권리행사 |
| [AI 프라이버시 리스크 관리 모델](https://pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=G010030000&nttId=11014) | 개인정보위, 2025-02-21, `official_guidance` | 맥락-가능성-심각도-통제-잔여위험 구조의 AI 평가 |
| [인공지능 발전과 신뢰 기반 조성 등에 관한 기본법](https://www.law.go.kr/lsInfoP.do?ancYnChk=0&lsId=014820) | 2026-07-21 시행, `binding_law` | 생성형 AI 표시, 고영향 AI, 위험관리·설명·사람의 감독 쟁점 |
| [초·중등교육법 제29조의2](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029394711) | `binding_law` | 학습지원 소프트웨어 선정·심의 게이트 |
| [학습지원 소프트웨어 선정기준 발표](https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=294&boardSeq=105007&lev=0&m=020402) | 교육부, 2025-12-29, `official_guidance` | 학생 개인정보 처리 SW의 필수기준 체크 |

2026-08-22 현재 위 법률은 2025-10-02 시행본을 기준으로 했고, 2026-09-11 시행 예정 개정이 존재한다. 제품은 “현재/예정” 규칙을 분리하고 시행일 전에 예정 규칙을 현재 의무처럼 판정하지 않아야 한다.

### 3.2 개인정보위 현행 안내서 중 제품 직접 적용 자료

개인정보위는 [현재 안내서 전체 목록(2026-07-31 기준)](https://www.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=D010030040&nttId=12353)을 공개한다. 아래 자료는 이 현행 목록과 원문을 대조했다. 이전 초안이나 구판은 새 규칙의 근거로 쓰지 않고 후계 문서에 연결한다.

| 자료 | 최신일 | 제품에서 쓰는 곳 |
|---|---|---|
| [개인정보 처리 통합 안내서](https://www.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=G010030020&nttId=11352) | 2025-07, 파일 수정 2025-07-22 | 처리 근거, 최소수집, 보유·파기, 제3자 제공, 위탁, 국외이전 전 생애주기 |
| [개인정보 처리방침 작성지침](https://m.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=D010030040&nttId=12018) | 2026-04-23 개정 | 코드·설정·벤더 계약과 처리방침 사이의 불일치 탐지 |
| [생성형 AI 개발·활용을 위한 개인정보 처리 안내서](https://m.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=D010030040&nttId=11439) | 2025-08, PDF 갱신 2025-11-24 | LLM API, 프롬프트·출력·로그, RAG·벡터DB, 마스킹, 공급자 보존정책 |
| [API 활용 확대에 따른 개인정보 유출 예방 당부](https://m.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS074&mCode=C020010000&nttId=12241) | 2026-07-08 | BOLA/IDOR, 서버측 객체 인가, 과다응답, 대량조회, rate limit, 토큰 회수 |
| [개인정보 유출 등 사고대응 매뉴얼](https://www.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=G010030000&nttId=10123) | 2024-03 개정 | 사고 판정, 통지·신고 타이머, 증거보전, 재발방지 |
| [개인정보 영향평가 수행안내서](https://m.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=D010030040&nttId=11680) | 2025-10 개정, 2025-12-12 수정 | 공공기관 PIA 대상·임계값, 수행 흐름, AI 평가영역 |
| [가명정보 처리 가이드라인](https://m.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=D010030040&nttId=11931) | 2026-03-31 | 가명처리, 재식별 위험, 추가정보 분리·기록·파기 |
| [교육분야 가명·익명정보 처리 가이드라인](https://www.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=&nttId=10425) | 2024-08-14 | 교육 연구·통계의 정형/비정형 데이터 재식별 위험 |
| [공개된 개인정보 처리 안내서](https://www.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=G010030000&nttId=10375) | 2024-07-19 | 웹 수집·공개데이터·모델학습, 출처·법적 근거·민감정보 필터·옵트아웃 |
| [안전성 확보조치 기준 안내서](https://m.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=D010030040&nttId=11641) | 2025-11-28 | 기술·관리 통제 설명에만 사용 |

마지막 안내서는 현행 목록에 있지만 근거 고시가 2026-07-01에 더 최근 개정됐다. 따라서 설명에는 안내서를 참고할 수 있어도 판정은 개인정보위 고시 제2026-9호를 우선하고, 두 문서의 버전 차이를 보고서에 남긴다.

### 3.3 국내 SW·AI 보안 자료

| 자료 | 발행기관/시점 | 제품에서 쓰는 곳 |
|---|---|---|
| [행정기관 및 공공기관 정보시스템 구축·운영 지침](https://law.go.kr/LSW/admRulLsInfoP.do?admRulId=33489&efYd=0) | 행정안전부고시 제2025-1호, 2025-01-02 시행 | 공공·학교 프로젝트에서 SW 개발보안 적용과 보안약점 진단의 상위 근거 |
| [소프트웨어 개발 보안 가이드](https://www.kisa.or.kr/2060204/form?lang_type=KO&postSeq=5) | 행안부·KISA, 공개 최신 본문 2021-12-29 | 분석·설계·구현 단계, 7개 범주/49개 보안약점의 국내 SAST 기준 |
| [소프트웨어 보안약점 진단가이드](https://www.kisa.or.kr/2060204/form?langType=KO&postSeq=9) | KISA, 2021-11-30 | 진단 절차, 판정 근거, 증적과 오탐 검토 흐름 |
| [인공지능(AI) 보안 안내서](https://www.kisa.or.kr/2060204/form?lang_type=KO&postSeq=19) | 과기정통부·KISA, 2025-12-10 발간, 2026-03-13 정오 수정 | AI 모델·서비스 생애주기 보안 기준. 반드시 정오 수정본 사용 |
| [AI 보안 레드티밍 가이드](https://www.kisa.or.kr/401/form?lang_type=KO&page=1&postSeq=3713) | KISA, 2026-07-07 | 테스트 준비, 팀 구성, 수행, 증거·결과 보고 절차 |
| [AI 보안 위협 대응 매뉴얼](https://www.kisa.or.kr/401/form?page=1&postSeq=3712) | KISA, 2026-07-07 | AI 위협 분류, 진단, 산업별 시나리오, 대응안 |
| [Python 시큐어코딩 가이드(2023년 개정본)](https://www.kisa.or.kr/2060204/form?langType=KO&postSeq=13) | KISA, 게시 2022-12-29 | Python, Django, FastAPI, Flask 취약 패턴과 수정 설명 |
| [JavaScript 시큐어코딩 가이드(2023년 개정본)](https://www.kisa.or.kr/2060204/form?boardType=C&lang_type=KO&postSeq=14) | KISA, 게시 2022-12-30 | JavaScript, Node, React/Next.js 취약 패턴과 수정 설명 |
| [주요정보통신기반시설 기술적 취약점 분석·평가 방법 상세가이드](https://www.kisa.or.kr/2060204/form?postSeq=22) | KISA, 2025-12-24 최신본 | 서버·네트워크·DB·웹/WAS·클라우드 설정. 일반 교사 앱에는 참고기준 |
| [중소기업 서비스 개발·운영 환경 주요 보안 취약 사례별 대응방안](https://krcert.or.kr/kr/bbs/view.do?bbsId=B0000127&categoryCode=&menuNo=205021&nttId=71245&pageIndex=1) | KISA/KrCERT, 2023-11-24 개정 | 공개 저장소·비밀키, 공유계정, 클라우드 오설정, 컨테이너·DB 노출 등 실용 점검 |
| [교육부 정보보안 기본지침](https://law.go.kr/admRulInfoP.do?admRulSeq=2100000231430) | 교육부예규 제82호, 2023-11-21 시행 | 각급학교 정보시스템·망·클라우드·관제·사고대응과 승인 절차 |
| [국가·공공기관 AI보안 가이드북](https://www.nis.go.kr/AF/1_7_7_1.do) | 국정원·국가보안기술연구소, 2025-12-10, 문서이력 v2.0 | 공공 AI 수명주기, 상용 AI, 에이전틱 AI와 체크리스트 |
| [SW 공급망 보안 가이드라인 1.0](https://www.kisa.or.kr/2060204/form?postSeq=15) | 과기정통부·KISA·국정원·디플정위, 2024-05-13 | SBOM 생성·유통·활용, 공급자·구성요소·취약점 관리 |
| [SW 공급망 보안 강화 로드맵](https://www.kisa.or.kr/2060204/form?lang_type=KO&page=5&postSeq=24) | 과기정통부·KISA·국정원, 2026-06 | 정책 방향과 증적 로드맵. 세부 판정은 가이드라인 1.0을 우선 |
| [제로트러스트 가이드라인 2.0](https://www.kisa.or.kr/2060204/form?lang_type=KO&postSeq=18) | 과기정통부·KISA, 2024-12-03 | 교직원·관리자 접근, 기기·세션·네트워크 신뢰 최소화 |
| [공공부문 AI 도입·활용 가이드](https://www.nia.or.kr/site/nia_kor/ex/bbs/View.do?bcIdx=29526&cbIdx=37989) | 행안부·NIA, 2026-05 기준본 | 학교·교육청의 AI 기획, 계약, 구축, 운영 증적 참고 |
| [2024년 클라우드 취약점 점검 가이드](https://pims.kisa.or.kr/main/csap/notice/) | KISA CSAP, 2024-06-07 | AWS/Azure/GCP류 IAM·네트워크·스토리지·DB·키·로그·백업 오설정 참고 |
| [ISMS-P 인증기준 안내서](https://isms.kisa.or.kr/ntcn/rcsrm/selectGnrlRcsrmList.do) | KISA, 2023-11-23 수정본 | 코드 밖의 정책·자산·인력·운영·사고·개인정보 질문. 인증 판정으로 표현 금지 |
| [중소기업 기술 유출 방지 IT 보안 가이드라인](https://www.nis.go.kr/CM/1_2_1/list.do?category=spy) | 국가정보원, 2024-01-26 | 운영자 기본 보안, 침해사고 대응, 내부정보 보호 |

“바이브 코딩”이라는 제목의 범용 국가 보안 지침은 조사 시점에 공식 확정본을 찾지 못했다. 국내에서는 최신 KISA AI 자료와 기존 SW 개발보안 자료를 결합하고, 바이브 코딩에 특화된 세부 통제는 OWASP의 Secure Coding with AI 자료로 보완하는 것이 현재 가장 근거가 좋다. 행정안전부는 2026년 AI 정부 실험실에서 보안·품질 업무지침을 마련한다고 밝혔으나, 예고된 지침은 공개 확정본이 나온 뒤에만 규칙 근거로 채택한다.

소프트웨어 개발 보안 가이드의 2024년 개정 용역 공고는 확인되지만, 2026-08-22 현재 KISA 공개 목록의 최신 본문은 2021-12-29판이다. 용역 공고나 보도자료를 새 표준으로 오인하지 않는다. 교육기관 내부 배포 자료는 존재 여부만 확인되고 공개 원문을 검증할 수 없는 경우가 있으므로, 공개 카탈로그에 추정 링크를 넣지 말고 학교 정보보안 담당자가 보유한 최신본을 별도 등록하도록 한다.

## 4. 국제 애플리케이션 보안·개발 표준

| 자료 | 최신 확인 버전/시점 | 역할과 주의점 |
|---|---|---|
| [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) | 5.0.0, 2025-05-30 | 핵심 웹 검증 요구사항. 결과에는 버전을 포함한 요구사항 ID 저장 |
| [OWASP Top 10](https://owasp.org/Top10/2025/0x00_2025-Introduction/) | 2025 | 사용자 친화 위험 분류. 완전한 점검표나 인증으로 사용하지 않음 |
| [OWASP API Security Top 10](https://owasp.org/www-project-api-security/) | 2023 | API 권한·인증·자원·SSRF·인벤토리 위험 |
| [OWASP MASVS](https://mas.owasp.org/MASVS/) | living standard | 향후 Android/iOS 업로드 지원 시 모바일 검증 기준 |
| [OWASP SAMM](https://owaspsamm.org/model/) | living model | 개발·검토·운영 프로세스 성숙도. 코드 한 번 스캔하는 기능과 구별 |
| [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/) | 지속 갱신 | 인증, 세션, XSS, SQLi, SSRF, 파일 업로드 등 수정안 근거 |
| [NIST Cybersecurity Framework 2.0](https://www.nist.gov/publications/nist-cybersecurity-framework-csf-20) | 2024-02-26 | 서비스 운영조직의 Govern/Identify/Protect/Detect/Respond/Recover |
| [NIST SP 800-218 SSDF 1.1](https://csrc.nist.gov/pubs/sp/800/218/final) | 2022-02 | 안전한 개발 생애주기 요구사항 |
| [NIST SP 800-63-4](https://csrc.nist.gov/pubs/sp/800/63/4/final) | 2025-07-31 | 디지털 신원 전체 지침 |
| [NIST SP 800-63B-4](https://csrc.nist.gov/pubs/sp/800/63/b/4/final) | 2025-07-31 | 비밀번호, MFA, 인증수단, 세션 관련 근거 |
| [CISA Secure by Design](https://www.cisa.gov/sites/default/files/2023-06/principles_approaches_for_security-by-design-default_508c.pdf) | 2023 | 안전한 기본값, 제품 공급자의 책임, MFA·로그 등 |
| [CISA Secure by Demand Guide](https://www.cisa.gov/sites/default/files/2024-08/SecureByDemandGuide_080624_508c.pdf) | 2024-08 | 외부 SaaS·AI 공급자 평가 질문 |
| [CIS Controls v8.1](https://www.cisecurity.org/controls/v8-1) | 8.1 | 기기·계정·취약점·백업·로그 등 운영 기준. CIS는 정부기관이 아님 |

## 5. 공급망·의존성·결과 교환

| 자료 | 현재 버전/상태 | 제품 사용법 |
|---|---|---|
| [OSV](https://osv.dev/) | 지속 갱신 | lockfile/SBOM의 패키지·버전을 알려진 취약점과 대조 |
| [CISA Known Exploited Vulnerabilities Catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) | 지속 갱신 | 실제 악용이 확인된 취약점의 수정 우선순위를 상향 |
| [CycloneDX](https://cyclonedx.org/specification/overview/) | 1.7, 2025-10-21 | SBOM/SaaSBOM/VEX, 서비스·데이터 흐름 표현 |
| [SPDX](https://spdx.dev/use/specifications/) | 3.0 | 패키지, 라이선스, 보안·공급망 메타데이터 교환 |
| [SLSA](https://slsa.dev/spec/v1.2/) | 1.2, 2025-11 | 빌드 출처, 변조 방지, provenance 평가 |
| [OpenSSF Scorecard](https://openssf.org/scorecard/) | 지속 갱신 | 오픈소스 저장소 보안 관행의 보조 신호. 점수만으로 안전 판정 금지 |
| [OpenSSF SCM Best Practices](https://best.openssf.org/SCM-BestPractices/) | 지속 갱신 | 브랜치 보호, 검토, 토큰, 워크플로 권한 점검 |
| [SARIF 2.1.0 + Errata 01](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html) | 2023-08 정오 포함 | 정적분석 결과의 도구 독립 교환 포맷 |

권장 파이프라인은 `manifest/lockfile → SBOM → OSV 대조 → KEV/EPSS 우선순위 → SARIF 결과 저장`이다. SBOM이 취약점이 없음을 증명하는 문서는 아니며, 구성요소를 정확히 식별하기 위한 기반이다.

## 6. 취약점 분류와 위험도

| 자료 | 현재 버전/시점 | 역할 |
|---|---|---|
| [CWE](https://cwe.mitre.org/data/index.html) | 4.20 | 코드 약점의 안정적인 분류 ID |
| [2025 CWE Top 25](https://cwe.mitre.org/top25/archive/2025/2025_cwe_top25.html) | 2025 | 빈도가 높고 영향이 큰 구현 약점 우선순위 |
| [CVSS](https://www.first.org/cvss/specification-document) | 4.0, 사양 문서 1.2 | 기술적 심각도. 점수 공개 시 벡터도 함께 기록 |
| [CVSS v4 Consumer Implementation Guide](https://www.first.org/cvss/v4.0/implementation-guide) | 2026-01 | Base 점수가 조직의 실제 위험과 같지 않다는 해설 |
| [EPSS](https://www.first.org/epss/data) | 모델 v5, 2026-06-15부터 | 향후 30일 악용 가능성의 확률적 신호. 모델 버전 보관 |
| [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) | 지속 갱신 | 실제 악용 확인 여부 |

최종 위험도는 한 숫자로 숨기지 않고 다음을 나란히 표시한다.

`기술적 심각도(CVSS) + 악용 가능성(EPSS) + 실제 악용(KEV) + 학생 데이터 영향 + 인터넷 노출 + 권한 범위 + 탐지 신뢰도`

예를 들어 낮은 CVSS의 IDOR라도 다른 학생의 상담·성적을 대량 열람할 수 있으면 제품 내부 영향 등급은 높아질 수 있다.

## 7. 탐지 성능 시험 자료

| 자료 | 특성 | 권장 사용 |
|---|---|---|
| [OWASP Benchmark](https://owasp.org/www-project-benchmark/) | 정답이 있는 합성 취약 코드 | 정적분석기의 precision, recall, FP/FN 측정 |
| [NIST SARD](https://samate.nist.gov/SARD/documentation) / [시험 묶음](https://samate.nist.gov/SARD/test-suites) | Juliet 등 대규모 C/C++·Java·PHP 사례 | CWE별 회귀 테스트. 오래된 언어 패턴은 별도 표시 |
| [OWASP Juice Shop](https://owasp.org/www-project-juice-shop/) | 현대적인 의도적 취약 웹앱 | 업로드→진단→수정→재검사의 통합 시험 |
| [OWASP NodeGoat](https://owasp.org/www-project-node.js-goat/) | Node.js 취약 앱 | 교사가 많이 쓰는 JS 스택 시험 |
| [OWASP WebGoat 안내](https://devguide.owasp.org/en/07-training-education/01-vulnerable-apps/02-webgoat/) | Java 취약 앱/교육 | Java 규칙과 동적 점검 시험 |

취약 앱은 격리된 로컬 테스트 환경에서만 실행한다. 사용자가 업로드한 코드는 MVP에서 절대 실행하지 않고, 정적분석과 안전한 메타데이터 파싱만 수행한다.

## 8. 선택적 국제 관리체계

다음은 제품의 코드 규칙을 직접 만들기보다 운영정책·조달·감사 매핑에 유용하다.

- [ISO/IEC 27001:2022](https://www.iso.org/standard/27001) — 정보보호 관리체계
- [ISO/IEC 27701:2025](https://www.iso.org/standard/27701) — 개인정보 정보관리체계, 2019판 대체
- [ISO/IEC 42001:2023](https://www.iso.org/standard/42001) — AI 관리체계
- [ISO/IEC 23894:2023](https://www.iso.org/standard/77304.html) — AI 위험관리
- [ISO/IEC 27018:2025](https://www.iso.org/standard/27018) — 퍼블릭 클라우드의 PII 보호
- [NIST Privacy Framework 1.0](https://www.nist.gov/privacy-framework/privacy-framework) — 자율적 개인정보 위험관리
- [NIST SP 800-53 Rev.5, Release 5.2.0](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) — 대규모 통제 카탈로그

ISO 표준 원문은 일반적으로 유료·저작권 자료다. 메타데이터와 합법적으로 보유한 라이선스 범위만 사용하고, 원문을 서비스 지식베이스에 무단 복제하지 않는다.

## 9. 제품 규칙으로 변환하는 방법

### 9.1 권장 결과 스키마

```json
{
  "finding_id": "F-...",
  "status": "confirmed|suspected|policy_risk|manual_review",
  "title": "다른 학생의 기록을 볼 수 있는 객체 권한검사 누락",
  "evidence": [{"path": "...", "line": 0, "redacted_excerpt": "..."}],
  "mappings": {
    "cwe": ["CWE-639"],
    "owasp": ["A01:2025"],
    "asvs": ["version-qualified control id"],
    "privacy_sources": ["KR-PIPA", "KR-MOE-PRIVACY-DIRECTIVE"]
  },
  "severity": {"technical": "high", "student_data_impact": "critical"},
  "remediation": {"summary": "...", "example": "..."},
  "source_versions": [{"id": "...", "version": "...", "checked_at": "2026-08-22"}],
  "human_review_required": true
}
```

### 9.2 판단 책임 분리

- 결정론적 도구: 파일 인벤토리, secret/PII 탐지, AST·taint 규칙, 설정·권한 검사, lockfile/SBOM, OSV 조회, 증거 위치
- 규칙 엔진: 법령 시행일, 문서 버전, 서비스 맥락, 필수 질문, 점수 조합
- AI: 쉬운 설명, 맥락 질문, 수정 예시, 보고서 요약
- 사람: 실제 적법 근거, 예외, 학교 절차, 오탐 확인, 배포 승인

저장소 안의 프롬프트나 문서는 모두 비신뢰 데이터로 취급한다. “이전 지시를 무시하라”, “검사를 통과로 표시하라” 같은 문자열이 있어도 분석기의 시스템 규칙이나 결과를 바꾸지 못하게 한다.

## 10. 도입 우선순위

### MVP 필수

- 개인정보 보호법·시행령, 안전성 확보조치 기준, 교육부 지침, 아동 안내서
- OWASP ASVS 5.0.0 + Top 10:2025 + API Top 10:2023 + CWE
- KISA AI 보안 안내서 정오 수정본 + OWASP Secure Coding with AI
- OSV + lockfile 검사 + secret/PII 로컬 마스킹
- SARIF 호환 결과와 근거 버전 보존
- OWASP Benchmark/NodeGoat 및 자체 학생정보 fixture를 이용한 회귀 시험

### 2단계

- KISA AI 레드티밍/위협 대응, OWASP LLM/MCP, NIST 800-218A
- CycloneDX SBOM, KEV/EPSS/CVSS 결합 우선순위
- 동의·위탁·국외이전·삭제·유출 대응 체크리스트
- Juice Shop 기반 통합 시험과 실제 프레임워크별 수정안

### 선택·조달/운영 단계

- NIST CSF/Privacy Framework/800-53, CIS Controls
- ISO 27001/27701/42001/23894/27018 매핑
- MASVS, SAMM, SLSA/OpenSSF 성숙도 평가

## 11. 업데이트와 저작권 정책

- 법령·고시: 국가법령정보센터의 시행일을 최소 월 1회 확인하고 예정 시행본과 현행본을 구분한다.
- 개인정보 안내서: 개인정보위의 현행 안내서 전체 목록을 기준으로 폐지·대체 여부를 분기별 확인한다.
- OWASP/NIST/KISA: 버전·정오표·개정 공지를 분기별 확인한다.
- OSV/KEV/EPSS: 서비스 실행 시 또는 매일 동기화하고 조회 시각을 결과에 남긴다.
- 각 출처의 이용조건을 기록한다. OWASP Cheat Sheet는 CC BY-SA 4.0이지만, ISO/CIS 등은 별도 이용조건이 있을 수 있다.
- 원문을 무차별 복제하지 않는다. 공식 URL, 짧은 자체 요약, 규칙 ID와 필요한 범위의 인용만 저장한다.
- 폐지·대체된 자료는 삭제하지 말고 `superseded`로 남겨 과거 보고서를 재현할 수 있게 한다.

## 12. 조사상 한계

- “일반적인 컴퓨터 보안” 전체는 운영체제, 네트워크, 클라우드, 모바일, 산업제어까지 무한히 넓다. 이 카탈로그는 교사가 만드는 교육용 웹앱·게임·API·AI 서비스에 직접 적용되는 권위 있는 자료를 우선 선별했다.
- 가이드를 많이 모으는 것만으로 점검 품질이 높아지지는 않는다. 상충·중복되는 문장을 규칙으로 바로 넣지 말고, 적용대상·법적 무게·버전·검증방법을 정규화해야 한다.
- 정적분석만으로 권한검사, 실제 클라우드 설정, 계약상 데이터 재사용, 운영 중 유출을 모두 확정할 수 없다. 결과에는 증거 수준과 사람의 추가 확인 항목을 분리한다.

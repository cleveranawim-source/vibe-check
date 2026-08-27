# 에듀 세이프 (EduSafe)

> 구 이름: 바이브체크(VibeCheck). 저장소 주소·배포 URL은 `vibe-check`를 유지한다.

**교사 제작 앱 심사·검수 시스템** — 공인 기관(교육청)의 심사자가 교사 바이브 코딩 앱의
보안과 전반적 내용을 최종 심사하기 위한 **심사자 전용 도구**. 최종 목표는 교육청
공인인증의 심사 인프라.

> 자기신고 없음 — 증거 중심. AI가 코드에서 증거를 수집해 판정 초안을 만들고,
> **최종 판정은 심사자(사람)가** 한다.

## 심사 흐름

```
① 저장소 로드/폴더 업로드 + 규칙 스캔   GitHub 주소 또는 프로젝트 폴더, API 키 불필요 (선별 단계)
                                  폴더 심사는 커밋 SHA 대신 콘텐츠 SHA-256 지문 기록
② AI 분류 추론                    4트랙(교무자동화/교과도구/학습콘텐츠/학급운영), 근거 제시 → 심사자 확정
                                  학습콘텐츠는 성취기준 태깅(교과·학년군·코드)
③ 루브릭 판정                     루브릭 v1.3 (필수 10 + 점수 15 + 수동 6, 쉬운 설명·법적 무게 표기)
                                  AI 판정 초안 — 모든 pass/fail에 근거 코드 인용 강제,
                                  근거 없으면 '판단불가'로 자동 강등
④ 심사자 승인/번복                번복은 사유와 함께 기록 보존
⑤ 심사 보고서                     커밋 SHA 고정(변조 방지), 개선 권고(교사 회신용),
                                  종합 판정(합격 후보/보류/불합격 후보), 인쇄/PDF
📚 심사 기록                       브라우저 로컬 대장, JSON 내보내기
```

## 신뢰성 원칙 (코드로 강제)

- AI 출력은 판정이 아니라 **판정 초안 + 근거 인용** (`validateJudgments`가 사후 강제)
- 근거 인용 없는 충족/미충족 → 판단불가로 강등, 응답 누락 항목 → 판단불가로 채움
- 판단불가가 하나라도 남으면 종합 판정은 무조건 **보류**
- 트리·파일 조회는 커밋 SHA 기준 — "이 심사는 커밋 X에 대한 것"이 실제로 성립
- 심사 대상 코드는 신뢰할 수 없는 입력으로 취급 (프로토타입 키 차단 등)

## 개발

Node.js 22.9 이상이 필요합니다.

```bash
npm install
npm run dev      # localhost:5173
npm test         # vitest 단위·계약 테스트 (PostgreSQL 통합 테스트는 테스트 DB 설정 시 포함)
npm run build && npm run deploy   # gh-pages 배포
```

## 점수 연동 블록체인 인증마크

서버가 재현한 자동 보안·개인정보 점수가 80점 이상이고 Critical 발견이 없으면 Base Sepolia의
Ethereum Attestation Service(EAS)에 인증마크를 발급할 수 있습니다. 브라우저가 보낸 점수나
심사 판정은 인증 근거로 신뢰하지 않으며, 서버가 요청한 GitHub commit SHA를 직접 내려받아
규칙 점수를 다시 계산합니다. AI·사람 심사 점수는 서버 불변 심사 기록을 도입하는 후속 단계까지
블록체인 발급 기준에서 제외합니다.
저장소 로드와 자동 스캔이 끝나면 심사 흐름 상단에 발급 가능 여부와 Silver/Gold 등급이 바로
표시되고, 승인된 심사자가 발급을 요청하면 서버가 동일 SHA를 재검사한 뒤 조건 통과 시에만 발급합니다.
로컬 폴더 심사는 서버가 원본을 독립 확인할 수 없어 자동 발급 대상이 아닙니다.

```bash
cp .env.example .env.local
npm run db:migrate:badges
npm run eas:register-schema
```

스키마 등록 결과 UID를 `EAS_SCHEMA_UID`에 넣고, 배포 빌드에서
`VITE_BLOCKCHAIN_BADGES_ENABLED=true`를 설정합니다. 발급 지갑의 개인키와
`BADGE_ISSUANCE_TOKEN`은 서버 환경변수로 보관하고 `VITE_` 변수나 프론트엔드 코드에 넣지
마세요. 현재 계정 기능이 없는 과제 버전에서는 심사자가 발급 시 승인 코드를 입력하며 브라우저에
저장하지 않습니다. 실제 운영에서는 이 임시 공용 코드를 기관 로그인·심사자 역할 권한으로
교체해야 합니다. 로컬 스크립트는 `.env.local`을 자동으로 읽습니다. 실제 발급에는 Base Sepolia faucet
테스트 ETH가 필요하며, 정적 GitHub Pages 배포와 별도로 `api/badges.js`를 Vercel Functions 같은
Node.js 서버 환경에 배포해야 합니다.

GitHub Pages와 Vercel API를 분리 배포할 때 필요한 값은 다음처럼 나눕니다.

| 위치 | 환경변수 | 값 |
|---|---|---|
| 프론트엔드 빌드 | `VITE_BLOCKCHAIN_BADGES_ENABLED` | `true` |
| 프론트엔드 빌드 | `VITE_BLOCKCHAIN_BADGE_API_URL` | `https://<Vercel 도메인>/api/badges` |
| Vercel 서버 | `DATABASE_URL_UNPOOLED` | advisory lock용 PostgreSQL direct 접속 문자열(`sslmode=require`). 없으면 `DATABASE_URL` 사용 |
| Vercel 서버 | `BADGE_ALLOWED_ORIGINS` | GitHub Pages의 origin, 예: `https://cleveranawim-source.github.io` |
| Vercel 서버 | `BADGE_ISSUANCE_TOKEN` | 32자 이상의 임의 승인 코드 |
| Vercel 서버 | `EAS_RPC_URL` | Base Sepolia HTTPS RPC |
| Vercel 서버 | `EAS_CHAIN_ID` | `84532` |
| Vercel 서버 | `EAS_SCHEMA_UID` | 등록 스크립트가 출력한 UID |
| Vercel 서버 | `EAS_ATTESTER_ADDRESS` | 아래 개인키에서 파생된 0이 아닌 지갑 주소 |
| Vercel 서버 | `EAS_ATTESTER_PRIVATE_KEY` | 발급 전용 지갑 개인키(배포 secret) |

서버/API를 먼저 배포한 뒤 프론트엔드의 절대 API URL을 설정해야 GitHub Pages가 자체
`/api/badges`를 조회해 404가 되는 일을 피할 수 있습니다. 공개 검증 GET은 발급 개인키가 없어도
동작하지만, POST 발급에는 주소와 개인키가 서로 일치해야 합니다.

온체인에는 저장소 ID·공개 URL·commit SHA·자동 점수·보고서/정책 해시만 기록하며 취약점 상세,
코드 조각, 개인정보는 기록하지 않습니다. 이 마크는 해당 커밋의 점검 기록이지 법적 인증이나
서비스 전체의 무결점 보증이 아닙니다.

## 구조

- `src/data/rubric.js` — 루브릭 v1.3 (버전 관리, 트랙 4종, 쉬운 설명·법적 무게 등급)
- `src/data/securityRules.js` — 규칙 스캔 40여 종 + 프로젝트 단위 규칙(App Check 부재 등)
- `src/lib/reviewAi.js` — AI 호출(분류·판정) + 응답 검증·강등 규칙
- `src/lib/reviewSummary.js` — 판정 집계 (오버라이드 우선순위, 종합 상태)
- `src/lib/github.js` — 저장소 로드 (커밋 SHA 고정)
- `src/lib/badgePolicy.js` — 점수·Critical·검사 완결성 기반 발급 정책
- `server/badges/` — 서버 재검사, PostgreSQL 멱등성, EAS 발급·온체인 검증
- `src/components/ReviewMode.jsx` / `ReviewReport.jsx` / `ReviewLedger.jsx`

설계·계획 문서: `docs/superpowers/` (스펙, 구현 계획, 독립 리뷰 반영 기록)
심사 기준의 법령·공식문서 근거: `docs/근거-법령-공식문서.md`

## 다음 단계

1. 파일럿 — 실제 교사 앱 5~10건 심사로 루브릭 v1.3 검증 (판정 정확도, 판단불가율, 소요 시간)
2. AI 인용의 실재 검증 (환각·프롬프트 주입 방어 강화)
3. 제출함·심사단 계정·공식 인증 대장 (기관 도입 단계)

# CLAUDE.md — 에듀 세이프 (EduSafe, 구 바이브체크)

앱 이름은 2026-08-27부터 **에듀 세이프(EduSafe)**. 저장소 주소·배포 URL·localStorage 키
(`vibecheck-ledger-v1`)는 구 이름을 유지한다 (URL 파손·기록 유실 방지).

## 정체성 (중요 — 2026-08-24 확정)

**교사 제작 앱 심사·검수 시스템.** 자가점검 도구가 아니다 — 공인 기관(교육청)이 교사가
바이브 코딩으로 만든 앱을 점검·검수·평가하는 도구이며, 최종 목표는 교육청 공인인증의
심사 인프라다. 자기신고 배제, 증거 중심: AI가 코드에서 증거를 수집해 판정 초안을 만들고
**최종 판정은 심사자(사람)가** 한다.

2026-08-27 갱신: **심사자 전용 도구로 확정** (설계 문서의 "모의심사 공개" 방침 폐기).
GitHub 공개 저장소 외에 **프로젝트 폴더 업로드 심사** 지원 — 커밋 SHA 대신 파일 전체의
SHA-256 콘텐츠 지문을 기록 (`src/lib/localFolder.js`). 루브릭 v1.1: 모든 항목에
`plain`(비전문가용 쉬운 설명) 추가, 판정 화면·보고서에 표시. v1.2: 팀원 실측 제안
(`docs/제안-루브릭-v1.2.md`) 중 우선순위 채택 — 클라이언트 위조·사칭·LLM 입력 고지(필수 3),
정답 비노출(점수), 학생 단위 삭제(수동) + 제출 완결성 사전 게이트(`src/lib/submissionGate.js`).
나머지 제안(실명 비노출, 학년도 전환 등)은 파일럿 후 2차 반영 예정.

설계 합의와 결정 이력: `docs/superpowers/specs/2026-08-24-review-mode-design.md`
구현 계획 + 독립 리뷰 반영 기록: `docs/superpowers/plans/2026-08-24-review-mode.md`
심사 기준의 법령·공식문서 근거: `docs/근거-법령-공식문서.md` (루브릭 개정 시 함께 재확인)

## 아키텍처

React 18 + Vite 6 정적 앱. AI는 심사자의 API 키로 브라우저에서 직접 호출
(@anthropic-ai/sdk, dangerouslyAllowBrowser, 기본 모델 claude-opus-5, 스트리밍).

- `src/data/rubric.js` — 루브릭 v1.2 (버전 관리 필수. 트랙 4종: admin/subject_tool/learning_content/class_ops, 필수 10+점수 15+수동 6)
- `src/data/securityRules.js` — 규칙 스캔 30여 종 + projectRules(프로젝트 단위: App Check 부재 등)
- `src/lib/reviewAi.js` — AI 호출·검증. **신뢰성 원칙이 코드로 강제됨**: 근거 인용 없는 pass/fail은 validateJudgments가 needs_human으로 강등, 누락 항목도 needs_human으로 채움
- `src/lib/reviewSummary.js` — 판정 집계 (오버라이드>AI>수동, 판단불가 남으면 무조건 '보류')
- `src/lib/github.js` — 저장소 로드. **트리·raw 조회는 커밋 SHA 기준** (해시 고정의 실질 — 브랜치명으로 되돌리지 말 것)
- `src/components/ReviewMode.jsx`(흐름) / `ReviewReport.jsx`(보고서) / `ReviewLedger.jsx`(심사 대장, localStorage `vibecheck-ledger-v1`)
- App.jsx: ReviewMode는 탭 전환 시 언마운트하지 않는다(진행 중 심사 유실 방지)

## 명령어

```bash
npm run dev      # localhost:5173
npm test         # vitest 38개 — 수정 후 반드시 실행
npm run build && npm run deploy   # gh-pages 배포 (커밋·푸시도 함께 할 것)
```

- 배포: https://cleveranawim-source.github.io/vibe-check/ (base './', gh-pages=dist)
- 팀 동기화: `npm run sync:team` → 팀 저장소(DevYonghunT/vibe-check) `main`으로 푸시.
  2026-08-27 팀 결정으로 이쪽 이력을 팀 main에 이식(옮겨심기)함. 팀원의 이전 작업
  (Vercel·api/·회의 문서, 별개 이력)은 팀 저장소 `team-vercel-backup` 브랜치에 보존됨
- UI 작업: 주소 뒤 `#demo-report` 를 붙이면 AI 호출 없이 데모 보고서가 열림 (`src/dev/DemoReport.jsx`)

## 관례

- 한국어 UI, 따뜻하지만 정확한 톤. 심사 대상 코드는 신뢰할 수 없는 입력으로 취급
- AI 응답·코드 인용은 React 텍스트 노드로만 렌더 (dangerouslySetInnerHTML 금지)
- 루브릭 항목·판정 로직 변경 시 RUBRIC_VERSION 올리고 테스트 갱신
- main 트렁크 직접 작업, 작업 단위 커밋

## 다음 단계 (2026-08-24 기준)

1. **파일럿**: 소유자 본인 앱 5~10건 실심사 (감정일기, 마음 점프, mind-rift 등 — mind-rift는
   저장소에 `allow write: if true` 열린 규칙이 스캔에서 발견된 상태) → 판정 정확도·판단불가율
   측정 → 루브릭 개정. 이 데이터가 교육청 제안 근거가 된다
2. AI 인용의 실재 검증 (validateJudgments에 files 전달, quote가 실제 파일에 있는지 확인 —
   환각·프롬프트 주입 방어)
3. 제출함·심사단 계정·공식 인증 대장 (기관 도입 단계, Firebase 검토)

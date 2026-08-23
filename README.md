# 바이브체크 (VibeCheck)

교사가 바이브 코딩으로 만든 웹앱·사이트를 학생에게 배포하기 전에 스스로 점검하는 무료 도구.

## 세 가지 점검

| 영역 | 방식 | 내용 |
|------|------|------|
| 🔍 보안 스캔 | 자동 (규칙 기반, 브라우저 내 처리) | 노출된 API 키, 열린 Firebase 규칙, XSS, 주민번호 수집 등 30여 종. 발견 항목마다 해결법 + AI 수정 요청 프롬프트 제공 |
| 🪪 개인정보 | 체크리스트 12문항 | 개인정보보호법 기반 (수집 최소화, 만 14세 미만 법정대리인 동의 제22조의2, 주민번호 제24조의2, 민감정보 제23조, 국외이전 제28조의8, 파기 제21조 등) |
| 🤖 AI 윤리 | 체크리스트 12문항 | 교육부 「교육분야 인공지능 윤리원칙」(2022) 10대 세부원칙 재구성 |

추가: **AI 정밀 분석** (선택) — 사용자가 자신의 Anthropic API 키를 입력하면 Claude(기본 claude-opus-5)가 코드 전체를 맥락까지 분석. 키는 저장되지 않음, 스트리밍 출력(marked+DOMPurify 렌더).

## 설계 원칙

- 규칙 스캔은 **코드가 브라우저 밖으로 나가지 않음** (그 자체로 개인정보 안전)
- 체크리스트 답변만 localStorage 저장, 코드·API 키는 저장하지 않음
- 발견 스니펫의 비밀키는 마스킹 표시
- 종합 리포트: 3영역 등급 + 우선조치 목록, PNG 저장(html-to-image)·인쇄
- 자가점검 참고용 면책 문구 포함 (법률 자문 아님)

## 개발·배포

```bash
npm install
npm run dev      # localhost:5173
npm run build    # dist/
npm run deploy   # gh-pages -d dist (GitHub 저장소 연결 후)
```

Vite `base: './'` — GitHub Pages 서브경로에서도 동작.

## 구조

- `src/data/securityRules.js` — 보안 규칙 30여 종 (패턴 + 교사 눈높이 설명 + 해결법 + AI 프롬프트)
- `src/data/privacyChecklist.js` / `ethicsChecklist.js` — 체크리스트 (게이트 질문 + 항목별 근거·개선팁·가중치)
- `src/lib/scanner.js` — 스캔 엔진 (minified 파일은 비밀키 계열만 검사, node_modules/dist 제외)
- `src/lib/scoring.js` — 점수·등급 (필수 항목 미준수 시 '위험')
- `src/lib/aiReview.js` — Claude API 스트리밍 (@anthropic-ai/sdk, dangerouslyAllowBrowser)

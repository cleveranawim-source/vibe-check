# 심사 모드(Review Mode) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 바이브체크에 심사 모드를 추가한다 — GitHub 주소 하나로 규칙 스캔 + AI 카테고리 추론 + AI 루브릭 판정(근거 인용 강제) + 심사자 오버라이드 + 커밋 해시가 고정된 심사 보고서를 생성.

**Architecture:** 기존 정적 React 앱 안의 별도 모드(App state 토글). AI 호출은 심사자의 API 키로 브라우저에서 직접(@anthropic-ai/sdk, dangerouslyAllowBrowser). 순수 로직(루브릭 무결성, JSON 파싱·검증, 판정 집계)은 vitest로 TDD, UI는 브라우저 검증. 스펙: `docs/superpowers/specs/2026-08-24-review-mode-design.md`.

**Tech Stack:** React 18 + Vite 6, @anthropic-ai/sdk(스트리밍), vitest(신규), GitHub REST API(기존 github.js 확장).

**작업 브랜치:** 프로젝트 관례에 따라 main 트렁크에서 작업, 작업(Task)마다 커밋.

---

## File Structure

| 파일 | 책임 |
|------|------|
| Create `src/data/rubric.js` | 루브릭 v1.0 — 트랙 4종, 항목(필수/점수, aiVerifiable), 버전 상수 |
| Create `src/lib/reviewAi.js` | AI 호출(카테고리 추론·루브릭 판정) + 순수 함수(JSON 추출, 결과 검증·강등 규칙) |
| Create `src/lib/reviewSummary.js` | 최종 판정 결정(오버라이드>AI>수동) + 합격후보/보류/불합격후보 집계 (순수) |
| Create `src/components/ReviewReport.jsx` | 인쇄 가능한 심사 보고서 (props만 받는 표시 컴포넌트) |
| Create `src/components/ReviewMode.jsx` | 심사 흐름 UI 상태기계 (setup→loaded→category→judged→report) |
| Create `tests/rubric.test.js` `tests/reviewAi.test.js` `tests/reviewSummary.test.js` | 순수 로직 테스트 |
| Modify `src/lib/github.js` | fetchRepoFiles가 head 커밋 SHA를 함께 반환 |
| Modify `src/App.jsx` | 헤더에 심사 모드 진입 버튼, mode 상태 |
| Modify `src/styles.css` | 심사 UI·보고서 스타일 |
| Modify `package.json` | vitest devDep + test 스크립트 |
| Modify `README.md` | 심사 모드 문서화 |

---

### Task 1: vitest 테스트 환경

**Files:** Modify: `package.json`

- [ ] **Step 1: vitest 설치**

Run: `cd /Users/yeolstudio/Claude/vibe-check && npm install -D vitest`
Expected: added N packages, 0 vulnerabilities

- [ ] **Step 2: test 스크립트 추가**

`package.json`의 `"scripts"`에 추가:

```json
"test": "vitest run --passWithNoTests"
```

- [ ] **Step 3: 실행 확인**

Run: `npm test`
Expected: `No test files found` + exit 0

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: vitest 테스트 환경 추가"
```

---

### Task 2: 루브릭 데이터 (rubric.js)

**Files:** Create: `src/data/rubric.js`, Test: `tests/rubric.test.js`

- [ ] **Step 1: 무결성 테스트 작성 (실패 확인용)**

`tests/rubric.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { RUBRIC_VERSION, TRACKS, rubricItems } from '../src/data/rubric.js'

describe('rubric integrity', () => {
  it('버전은 X.Y 형식', () => {
    expect(RUBRIC_VERSION).toMatch(/^\d+\.\d+$/)
  })
  it('트랙은 4종', () => {
    expect(Object.keys(TRACKS)).toEqual(['admin', 'subject_tool', 'learning_content', 'class_ops'])
  })
  it('id 중복 없음', () => {
    const ids = rubricItems.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('모든 항목 필드 유효', () => {
    for (const it of rubricItems) {
      expect(it.tracks.length).toBeGreaterThan(0)
      for (const t of it.tracks) expect(TRACKS[t]).toBeDefined()
      expect(['required', 'scored']).toContain(it.type)
      expect(it.weight).toBeGreaterThanOrEqual(1)
      expect(typeof it.aiVerifiable).toBe('boolean')
      expect(it.question.length).toBeGreaterThan(5)
    }
  })
  it('모든 트랙에 필수 항목이 1개 이상', () => {
    for (const t of Object.keys(TRACKS)) {
      const req = rubricItems.filter((i) => i.tracks.includes(t) && i.type === 'required')
      expect(req.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL (rubric.js 없음)

- [ ] **Step 3: rubric.js 작성**

`src/data/rubric.js` 전체:

```js
// 심사 루브릭 v1.0 — 판정의 재현성을 위해 버전 관리한다.
// type: 'required'(하나라도 미충족이면 불합격 후보) | 'scored'(가중 점수)
// aiVerifiable: true → AI가 코드에서 판정 초안 작성 / false → 심사자 수동 판정
export const RUBRIC_VERSION = '1.0'

export const TRACKS = {
  admin: { label: '교무·행정 자동화', icon: '🗂️', desc: '성적·출결·명단·문서 처리 등 교사 업무용 도구 (학생이 사용자가 아님)' },
  subject_tool: { label: '교과 수업 도구', icon: '📚', desc: '교사가 수업 진행에 조작하는 시연·판서·진행 도구' },
  learning_content: { label: '학습 콘텐츠·활동', icon: '🎯', desc: '학생이 직접 사용하는 학습·활동 앱' },
  class_ops: { label: '학급 운영·소통', icon: '🏫', desc: '알림, 자리배치, 모둠편성, 상담 예약 등 학급 운영 도구' },
}

const ALL = ['admin', 'subject_tool', 'learning_content', 'class_ops']
const STUDENT_FACING = ['learning_content', 'class_ops']

export const rubricItems = [
  // ───── 필수 요건 ─────
  { id: 'R-rrn', tracks: ALL, type: 'required', weight: 3, aiVerifiable: true,
    question: '주민등록번호를 수집·보관·처리하지 않는다',
    evidenceHint: '주민번호 입력 필드, 주민번호 형식 데이터, jumin/rrn 변수' },
  { id: 'R-secrets', tracks: ALL, type: 'required', weight: 3, aiVerifiable: true,
    question: '비밀키(API 키·토큰·개인키)가 코드·저장소에 노출되지 않는다',
    evidenceHint: 'sk-, AIza, AKIA, ghp_ 등 키 패턴, 하드코딩된 비밀번호' },
  { id: 'R-db-locked', tracks: ALL, type: 'required', weight: 3, aiVerifiable: true,
    question: '데이터베이스 쓰기가 전체 공개(allow write: if true 등)로 열려 있지 않다',
    evidenceHint: 'Firebase/RTDB 보안 규칙, Supabase RLS 언급' },
  { id: 'R-under14', tracks: STUDENT_FACING, type: 'required', weight: 3, aiVerifiable: true,
    question: '개인정보를 수집한다면, 만 14세 미만 보호자 동의에 대한 안내·절차가 앱에 있다 (수집하지 않으면 해당없음)',
    evidenceHint: '동의 안내 화면, 수집 항목·목적 고지 텍스트' },
  { id: 'R-crisis', tracks: STUDENT_FACING, type: 'required', weight: 3, aiVerifiable: true,
    question: '학생이 감정·고민을 입력하는 기능이 있다면, 위기 안내(교사·1388 등)가 있다 (그런 기능이 없으면 해당없음)',
    evidenceHint: '상담·감정 입력 UI, 1388·위기 안내 문구' },
  { id: 'R-admin-ext', tracks: ['admin'], type: 'required', weight: 3, aiVerifiable: true,
    question: '학생 실명·성적 등 실데이터가 외부 AI·외부 서버로 전송되지 않는다',
    evidenceHint: 'fetch/API 호출에 학생 데이터가 실리는 경로, AI API 호출부' },
  { id: 'R-admin-data', tracks: ['admin'], type: 'required', weight: 3, aiVerifiable: true,
    question: '학생 데이터 파일(명단·성적 csv/xlsx 등)이 저장소·배포물에 포함되어 있지 않다',
    evidenceHint: '이름·학번·연락처 열이 있는 데이터 파일' },

  // ───── 점수 요건 (aiVerifiable) ─────
  { id: 'S-minimal', tracks: ALL, type: 'scored', weight: 3, aiVerifiable: true,
    question: '꼭 필요한 최소한의 개인정보만 수집한다 (닉네임·임의코드로 대체 가능한 것은 대체)',
    evidenceHint: '입력 필드 목록, 저장되는 필드' },
  { id: 'S-consent', tracks: STUDENT_FACING, type: 'scored', weight: 2, aiVerifiable: true,
    question: '수집 전에 항목·목적·보관 기간을 알리는 안내가 있다',
    evidenceHint: '첫 화면 안내문, 동의 버튼' },
  { id: 'S-sensitive', tracks: STUDENT_FACING, type: 'scored', weight: 3, aiVerifiable: true,
    question: '감정·건강·상담 기록 등 민감한 정보를 익명·가명으로 다루거나 기기 밖으로 내보내지 않는다',
    evidenceHint: '감정기록 저장 구조, 식별자 종류' },
  { id: 'S-overseas', tracks: ALL, type: 'scored', weight: 1, aiVerifiable: true,
    question: 'Firebase 등 해외 서비스에 저장한다면 그 사실을 안내한다',
    evidenceHint: '저장 위치 안내 문구' },
  { id: 'S-access', tracks: STUDENT_FACING, type: 'scored', weight: 3, aiVerifiable: true,
    question: '학생 A의 데이터를 학생 B나 외부인이 볼 수 없는 구조다',
    evidenceHint: '조회 쿼리 범위, 교실 코드 구조, 보안 규칙' },
  { id: 'S-xss', tracks: ALL, type: 'scored', weight: 3, aiVerifiable: true,
    question: '사용자 입력이 검증 없이 HTML로 실행되는 경로(innerHTML 등)가 없다',
    evidenceHint: 'innerHTML/eval/document.write에 변수 삽입' },
  { id: 'S-https', tracks: ALL, type: 'scored', weight: 1, aiVerifiable: true,
    question: '모든 리소스·전송이 https를 사용한다',
    evidenceHint: 'http:// 주소' },
  { id: 'S-shared-device', tracks: STUDENT_FACING, type: 'scored', weight: 2, aiVerifiable: true,
    question: '공용 기기에서 이전 사용자의 정보가 남지 않는 처리(sessionStorage·기록 지우기 등)가 있다',
    evidenceHint: 'localStorage 사용처, 초기화 버튼' },
  { id: 'S-ai-transparency', tracks: ['learning_content'], type: 'scored', weight: 2, aiVerifiable: true,
    question: 'AI 생성 콘텐츠·판정에 AI가 만든 것임이 표시된다 (AI 기능이 없으면 해당없음)',
    evidenceHint: 'AI 배지·캡션 문구' },
  { id: 'S-ai-fallibility', tracks: ['learning_content'], type: 'scored', weight: 2, aiVerifiable: true,
    question: 'AI 판정류 기능에 "틀릴 수 있다"는 고지가 있다 (AI 기능이 없으면 해당없음)',
    evidenceHint: '결과 화면 안내 문구' },
  { id: 'S-quota', tracks: ALL, type: 'scored', weight: 2, aiVerifiable: true,
    question: '한도 소진 공격 대비(App Check 등 요청 출처 제한)가 있다 (외부 DB를 안 쓰면 해당없음)',
    evidenceHint: 'initializeAppCheck, reCAPTCHA' },
  { id: 'S-write-guard', tracks: ALL, type: 'scored', weight: 2, aiVerifiable: true,
    question: '쓰기 규칙에 크기·형식 검증 조건이 있어 무한 도배를 막는다 (외부 DB를 안 쓰면 해당없음)',
    evidenceHint: '보안 규칙의 size()·타입 검사' },
  { id: 'S-notice', tracks: ALL, type: 'scored', weight: 1, aiVerifiable: true,
    question: '운영자·문의처 안내가 앱에 있다',
    evidenceHint: '하단·정보 화면의 운영자 표기' },

  // ───── 심사자 수동 판정 (aiVerifiable: false) ─────
  { id: 'H-edu-fit', tracks: ['learning_content'], type: 'scored', weight: 3, aiVerifiable: false,
    question: '교육적 적절성 — 발달단계에 맞고, 낙인·서열화·비교 조장 요소가 없다',
    evidenceHint: '심사자가 실제 사용 흐름을 체험하고 판단' },
  { id: 'H-standards', tracks: ['learning_content'], type: 'scored', weight: 2, aiVerifiable: false,
    question: '명시한 성취기준과 활동 내용이 실제로 부합한다',
    evidenceHint: '태깅된 성취기준 대비 활동 내용' },
  { id: 'H-usability', tracks: ['subject_tool', 'learning_content'], type: 'scored', weight: 1, aiVerifiable: false,
    question: '수업 맥락에서 무리 없이 사용 가능하다 (준비 부담, 기기 요구, 소요 시간)',
    evidenceHint: '심사자 실사용 소감' },
  { id: 'H-retention', tracks: ALL, type: 'scored', weight: 2, aiVerifiable: false,
    question: '활동 종료 후 데이터 파기 계획이 확인된다',
    evidenceHint: '운영 계획 문서·심사 시 문답' },
  { id: 'H-2fa', tracks: ALL, type: 'scored', weight: 1, aiVerifiable: false,
    question: '운영 계정(GitHub·클라우드)에 2단계 인증이 켜져 있다',
    evidenceHint: '심사 시 계정 설정 확인' },
]
```

- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: rubric.test.js 5 passed

- [ ] **Step 5: Commit**

```bash
git add src/data/rubric.js tests/rubric.test.js
git commit -m "feat: 심사 루브릭 v1.0 데이터 (트랙 4종, 필수/점수/수동 항목)"
```

---

### Task 3: 판정 집계 (reviewSummary.js)

**Files:** Create: `src/lib/reviewSummary.js`, Test: `tests/reviewSummary.test.js`

- [ ] **Step 1: 테스트 작성**

`tests/reviewSummary.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { finalVerdict, computeSummary, STATUS_LABELS } from '../src/lib/reviewSummary.js'
import { rubricItems } from '../src/data/rubric.js'

const item = (id) => rubricItems.find((i) => i.id === id)

// admin 트랙 항목 전체를 주어진 기본값으로 채운 판정 객체를 만든다
function judgmentsFor(track, verdict) {
  const out = {}
  for (const it of rubricItems.filter((i) => i.tracks.includes(track) && i.aiVerifiable)) {
    out[it.id] = { itemId: it.id, verdict, evidence: [{ file: 'a.js', line: 1, quote: 'x' }], reasoning: '' }
  }
  return out
}
function humanFor(track, verdict) {
  const out = {}
  for (const it of rubricItems.filter((i) => i.tracks.includes(track) && !i.aiVerifiable)) {
    out[it.id] = { verdict, note: '' }
  }
  return out
}

describe('finalVerdict', () => {
  it('오버라이드가 AI 판정을 이긴다', () => {
    const it0 = item('R-rrn')
    const v = finalVerdict(it0, { 'R-rrn': { verdict: 'fail' } }, { 'R-rrn': { verdict: 'pass', note: '오탐' } }, {})
    expect(v).toBe('pass')
  })
  it('수동 항목은 humanInputs, 없으면 needs_human', () => {
    expect(finalVerdict(item('H-2fa'), {}, {}, {})).toBe('needs_human')
    expect(finalVerdict(item('H-2fa'), {}, {}, { 'H-2fa': { verdict: 'pass' } })).toBe('pass')
  })
})

describe('computeSummary', () => {
  it('전부 충족이면 합격 후보 100점', () => {
    const s = computeSummary('admin', judgmentsFor('admin', 'pass'), {}, humanFor('admin', 'pass'))
    expect(s.status).toBe('pass_candidate')
    expect(s.score).toBe(100)
  })
  it('필수 미충족 1개면 불합격 후보', () => {
    const j = judgmentsFor('admin', 'pass')
    j['R-rrn'].verdict = 'fail'
    const s = computeSummary('admin', j, {}, humanFor('admin', 'pass'))
    expect(s.status).toBe('fail_candidate')
    expect(s.requiredFails.map((i) => i.id)).toContain('R-rrn')
  })
  it('판단불가가 남으면 보류', () => {
    const j = judgmentsFor('admin', 'pass')
    j['S-minimal'].verdict = 'needs_human'
    const s = computeSummary('admin', j, {}, humanFor('admin', 'pass'))
    expect(s.status).toBe('hold')
  })
  it('해당없음은 분모에서 제외', () => {
    const j = judgmentsFor('admin', 'pass')
    j['S-quota'].verdict = 'na'
    const s = computeSummary('admin', j, {}, humanFor('admin', 'pass'))
    expect(s.score).toBe(100)
  })
  it('STATUS_LABELS 3종 존재', () => {
    expect(Object.keys(STATUS_LABELS)).toEqual(['pass_candidate', 'hold', 'fail_candidate'])
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: reviewSummary FAIL

- [ ] **Step 3: 구현**

`src/lib/reviewSummary.js` 전체:

```js
import { rubricItems } from '../data/rubric.js'

export const STATUS_LABELS = {
  pass_candidate: '합격 후보',
  hold: '보류 — 확인 필요',
  fail_candidate: '불합격 후보',
}

// 최종 판정 우선순위: 심사자 오버라이드 > AI 판정(aiVerifiable) 또는 심사자 수동 입력
export function finalVerdict(item, judgments, overrides, humanInputs) {
  if (overrides[item.id]?.verdict) return overrides[item.id].verdict
  if (item.aiVerifiable) return judgments[item.id]?.verdict ?? 'needs_human'
  return humanInputs[item.id]?.verdict ?? 'needs_human'
}

export function computeSummary(track, judgments, overrides, humanInputs) {
  const items = rubricItems.filter((it) => it.tracks.includes(track))
  const requiredFails = []
  const needsHuman = []
  let earned = 0
  let possible = 0
  for (const it of items) {
    const v = finalVerdict(it, judgments, overrides, humanInputs)
    if (v === 'needs_human') {
      needsHuman.push(it)
      continue
    }
    if (it.type === 'required' && v === 'fail') requiredFails.push(it)
    if (it.type === 'scored' && v !== 'na') {
      possible += it.weight
      if (v === 'pass') earned += it.weight
    }
  }
  const score = possible === 0 ? 100 : Math.round((earned / possible) * 100)
  let status
  if (requiredFails.length > 0) status = 'fail_candidate'
  else if (needsHuman.length > 0) status = 'hold'
  else status = 'pass_candidate'
  return { items, requiredFails, needsHuman, score, status }
}
```

- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: 전체 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/reviewSummary.js tests/reviewSummary.test.js
git commit -m "feat: 심사 판정 집계 (오버라이드 우선순위, 합격후보/보류/불합격후보)"
```

---

### Task 4: AI 호출·검증 (reviewAi.js)

**Files:** Create: `src/lib/reviewAi.js`, Test: `tests/reviewAi.test.js`

- [ ] **Step 1: 순수 함수 테스트 작성**

`tests/reviewAi.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { extractJson, validateCategory, validateJudgments } from '../src/lib/reviewAi.js'
import { rubricItems } from '../src/data/rubric.js'

describe('extractJson', () => {
  it('마크다운 펜스를 벗겨낸다', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })
  it('앞뒤 잡담을 무시하고 JSON만 파싱', () => {
    expect(extractJson('결과는 다음과 같습니다: [{"x":1}] 이상입니다.')).toEqual([{ x: 1 }])
  })
  it('JSON이 없으면 throw', () => {
    expect(() => extractJson('json 없음')).toThrow()
  })
})

describe('validateCategory', () => {
  it('정상 결과 통과', () => {
    const r = validateCategory({ category: 'admin', confidence: 0.9, evidence: ['a'], reasoning: 'b' })
    expect(r.category).toBe('admin')
  })
  it('알 수 없는 분류는 throw', () => {
    expect(() => validateCategory({ category: 'game' })).toThrow()
  })
  it('confidence는 0~1로 클램프', () => {
    expect(validateCategory({ category: 'admin', confidence: 7 }).confidence).toBe(1)
  })
})

describe('validateJudgments — 신뢰성 원칙', () => {
  const items = rubricItems.filter((i) => i.tracks.includes('admin') && i.aiVerifiable)
  it('근거 없는 fail은 needs_human으로 강등', () => {
    const out = validateJudgments([{ itemId: 'R-rrn', verdict: 'fail', evidence: [], reasoning: 'x' }], items)
    expect(out['R-rrn'].verdict).toBe('needs_human')
  })
  it('근거 있는 fail은 유지', () => {
    const out = validateJudgments(
      [{ itemId: 'R-rrn', verdict: 'fail', evidence: [{ file: 'a.js', line: 3, quote: 'jumin' }], reasoning: 'x' }],
      items
    )
    expect(out['R-rrn'].verdict).toBe('fail')
  })
  it('응답에 누락된 항목은 needs_human으로 채운다', () => {
    const out = validateJudgments([], items)
    for (const it of items) expect(out[it.id].verdict).toBe('needs_human')
  })
  it('모르는 itemId·이상한 verdict는 버린다', () => {
    const out = validateJudgments(
      [{ itemId: 'no-such', verdict: 'pass', evidence: [] }, { itemId: 'R-rrn', verdict: 'maybe', evidence: [] }],
      items
    )
    expect(out['no-such']).toBeUndefined()
    expect(out['R-rrn'].verdict).toBe('needs_human')
  })
  it('na는 근거 없어도 유지 (기능 부재 판정)', () => {
    const out = validateJudgments([{ itemId: 'S-quota', verdict: 'na', evidence: [], reasoning: 'DB 없음' }], items)
    expect(out['S-quota'].verdict).toBe('na')
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: reviewAi FAIL

- [ ] **Step 3: 구현**

`src/lib/reviewAi.js` 전체:

```js
import Anthropic from '@anthropic-ai/sdk'
import { TRACKS, RUBRIC_VERSION, rubricItems } from '../data/rubric.js'
import { MAX_AI_CHARS } from './aiReview.js'

export const VERDICT_LABELS = {
  pass: '충족',
  fail: '미충족',
  needs_human: '판단불가',
  na: '해당없음',
}
const VERDICT_SET = new Set(Object.keys(VERDICT_LABELS))

// ───── 순수 함수 ─────

export function extractJson(text) {
  let t = String(text).trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) t = fence[1].trim()
  const starts = ['{', '['].map((c) => t.indexOf(c)).filter((i) => i !== -1)
  if (starts.length === 0) throw new Error('응답에서 JSON을 찾지 못했어요')
  const start = Math.min(...starts)
  const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'))
  return JSON.parse(t.slice(start, end + 1))
}

export function validateCategory(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('분류 결과 형식 오류')
  if (!TRACKS[obj.category]) throw new Error(`알 수 없는 분류: ${obj.category}`)
  return {
    category: obj.category,
    confidence: Math.min(1, Math.max(0, Number(obj.confidence) || 0)),
    evidence: Array.isArray(obj.evidence) ? obj.evidence.filter((e) => typeof e === 'string').slice(0, 5) : [],
    reasoning: typeof obj.reasoning === 'string' ? obj.reasoning : '',
  }
}

// 신뢰성 원칙을 코드로 강제: 근거 인용 없는 pass/fail은 판단불가로 강등한다.
export function validateJudgments(raw, items) {
  const out = {}
  const arr = Array.isArray(raw) ? raw : []
  for (const j of arr) {
    if (!j || !VERDICT_SET.has(j.verdict)) continue
    if (!items.some((it) => it.id === j.itemId)) continue
    let verdict = j.verdict
    const evidence = Array.isArray(j.evidence)
      ? j.evidence
          .filter((e) => e && typeof e.quote === 'string' && e.quote.trim())
          .map((e) => ({ file: String(e.file || ''), line: Number(e.line) || 0, quote: String(e.quote).slice(0, 200) }))
          .slice(0, 4)
      : []
    let reasoning = typeof j.reasoning === 'string' ? j.reasoning : ''
    let demoted = false
    if ((verdict === 'pass' || verdict === 'fail') && evidence.length === 0) {
      verdict = 'needs_human'
      demoted = true
      reasoning = (reasoning ? reasoning + ' ' : '') + '(근거 인용이 없어 판단불가로 강등)'
    }
    out[j.itemId] = { itemId: j.itemId, verdict, evidence, reasoning, demoted }
  }
  for (const it of items) {
    if (!out[it.id]) {
      out[it.id] = { itemId: it.id, verdict: 'needs_human', evidence: [], reasoning: 'AI 응답에 누락 — 심사자 확인 필요', demoted: false }
    }
  }
  return out
}

// ───── 코드 섹션 조립 (150k자 상한, 잘린 파일은 명시) ─────

export function buildCodeSection(files) {
  let text = ''
  const included = []
  const excluded = []
  for (const f of files) {
    const chunk = `\n\n===== 파일: ${f.path} =====\n${f.text}`
    if (text.length + chunk.length > MAX_AI_CHARS) {
      excluded.push(f.path)
      continue
    }
    text += chunk
    included.push(f.path)
  }
  return { text, included, excluded }
}

// ───── AI 호출 ─────

async function callJson({ apiKey, model, system, user, onText }) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  const run = async (extra) => {
    const stream = client.messages.stream({
      model,
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content: extra ? `${user}\n\n${extra}` : user }],
    })
    if (onText) stream.on('text', onText)
    const final = await stream.finalMessage()
    if (final.stop_reason === 'refusal') throw new Error('모델이 이 요청의 처리를 거절했어요.')
    const text = final.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
    return extractJson(text)
  }
  try {
    return await run()
  } catch (err) {
    if (err instanceof SyntaxError || /JSON/.test(err.message)) {
      // 1회 재시도: JSON만 출력하라고 다시 요구
      return run('직전 응답이 JSON 형식이 아니었습니다. 이번에는 설명 없이 유효한 JSON만 출력하세요.')
    }
    throw err
  }
}

const CATEGORY_SYSTEM = `당신은 교사가 바이브 코딩으로 만든 프로그램을 분류하는 분류자입니다.
코드 전체를 읽고 다음 4가지 중 하나로 분류하세요.
- admin: 교무·행정 자동화 — 성적·출결·명단·문서 처리 등 교사 업무용. 학생이 사용자가 아님.
- subject_tool: 교과 수업 도구 — 교사가 수업 진행에 조작하는 시연·판서·타이머 등.
- learning_content: 학습 콘텐츠·활동 — 학생이 직접 사용하는 학습·활동 앱.
- class_ops: 학급 운영·소통 — 알림, 자리배치, 모둠편성, 상담 예약 등.
JSON만 출력: {"category":"...","confidence":0.0~1.0,"evidence":["코드에서 찾은 근거 (최대 3개)"],"reasoning":"한 문장"}`

export async function inferCategory({ apiKey, model, files }) {
  const { text } = buildCodeSection(files)
  const raw = await callJson({
    apiKey,
    model,
    system: CATEGORY_SYSTEM,
    user: `다음 프로그램을 분류하세요.\n${text}`,
  })
  return validateCategory(raw)
}

const JUDGE_SYSTEM = `당신은 교사 제작 교육용 프로그램의 공적 심사를 위한 코드 검증관입니다.
루브릭 v${RUBRIC_VERSION}의 각 항목을 코드에서 확인 가능한 사실만으로 판정합니다.

판정 규칙 (반드시 지킬 것):
1. verdict는 pass(충족) | fail(미충족) | na(해당없음) | needs_human(판단불가) 중 하나.
2. pass 또는 fail에는 반드시 evidence(파일·줄·코드 인용) 1개 이상을 제시할 것. 근거를 제시할 수 없으면 needs_human.
3. 확신이 없으면 fail이 아니라 needs_human으로 판정할 것 (과잉 판정 금지).
4. 항목이 전제하는 기능 자체가 앱에 없으면 na (reasoning에 왜 해당없는지 쓸 것).
5. 코드 밖의 사실(실제 운영, 동의 징구 여부)은 판정하지 말 것 — 코드에 나타난 것만.
6. 출력은 JSON 배열만, 모든 항목에 대해 하나씩:
[{"itemId":"...","verdict":"...","evidence":[{"file":"...","line":123,"quote":"코드 인용"}],"reasoning":"한두 문장"}]`

export async function judgeRubric({ apiKey, model, files, track, scanSummary, onText }) {
  const items = rubricItems.filter((it) => it.tracks.includes(track) && it.aiVerifiable)
  const { text, excluded } = buildCodeSection(files)
  const itemsJson = JSON.stringify(
    items.map((it) => ({ itemId: it.id, question: it.question, hint: it.evidenceHint })),
    null,
    2
  )
  const raw = await callJson({
    apiKey,
    model,
    system: JUDGE_SYSTEM,
    user: `[심사 항목 — ${TRACKS[track].label} 트랙]\n${itemsJson}\n\n[자동 규칙 검사 결과 — 참고용]\n${scanSummary || '없음'}\n\n[코드]${text}`,
    onText,
  })
  return { judgments: validateJudgments(raw, items), items, excluded }
}
```

- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: 전체 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/reviewAi.js tests/reviewAi.test.js
git commit -m "feat: 심사용 AI 호출·검증 (카테고리 추론, 루브릭 판정, 근거 강등 규칙)"
```

---

### Task 5: github.js — 커밋 해시 반환

**Files:** Modify: `src/lib/github.js`

- [ ] **Step 1: fetchRepoFiles에서 branches API로 head SHA 획득**

`fetchRepoFiles` 안, 트리 조회 전에 브랜치 정보를 가져오도록 수정. 기존:

```js
  const tree = await ghJson(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`
  )
```

를 다음으로 교체:

```js
  const branchInfo = await ghJson(
    `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`
  )
  const commitSha = branchInfo.commit?.sha || ''

  const tree = await ghJson(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`
  )
```

그리고 마지막 return을 다음으로 교체:

```js
  return { files, branch, commitSha, skippedCount, truncated: !!tree.truncated }
```

- [ ] **Step 2: 기존 기능 회귀 확인** — Run: `npm test` (통과) + 이후 Task 9 브라우저 검증에서 저장소 로드가 여전히 동작하는지 확인.

- [ ] **Step 3: Commit**

```bash
git add src/lib/github.js
git commit -m "feat: 저장소 로드 시 head 커밋 SHA 반환 (심사 시점 고정용)"
```

---

### Task 6: 심사 보고서 (ReviewReport.jsx)

**Files:** Create: `src/components/ReviewReport.jsx`

- [ ] **Step 1: 구현**

`src/components/ReviewReport.jsx` 전체:

```jsx
import { TRACKS, RUBRIC_VERSION } from '../data/rubric.js'
import { VERDICT_LABELS } from '../lib/reviewAi.js'
import { computeSummary, finalVerdict, STATUS_LABELS } from '../lib/reviewSummary.js'

const STATUS_COLORS = {
  pass_candidate: 'var(--ok)',
  hold: 'var(--warn)',
  fail_candidate: 'var(--danger)',
}

export default function ReviewReport({
  repoUrl,
  repoMeta, // { owner, repo, branch, commitSha }
  track,
  standards, // { subject, gradeBand, codes } | null
  scanCounts, // { critical, warning, info }
  judgments,
  overrides,
  humanInputs,
  opinion,
  reviewerName,
}) {
  const summary = computeSummary(track, judgments, overrides, humanInputs)

  return (
    <div className="review-report">
      <div className="rr-header">
        <div className="report-logo">🛡️ 바이브체크 심사 보고서</div>
        <h3>
          {repoMeta.owner}/{repoMeta.repo}
        </h3>
        <table className="rr-meta">
          <tbody>
            <tr><th>저장소</th><td>{repoUrl}</td></tr>
            <tr><th>브랜치 / 커밋</th><td>{repoMeta.branch} / <code>{repoMeta.commitSha.slice(0, 12) || '(확인 불가)'}</code></td></tr>
            <tr><th>심사일</th><td>{new Date().toLocaleDateString('ko-KR')}</td></tr>
            <tr><th>루브릭</th><td>v{RUBRIC_VERSION}</td></tr>
            <tr><th>분류</th><td>{TRACKS[track].icon} {TRACKS[track].label}</td></tr>
            {standards && (standards.subject || standards.codes) && (
              <tr><th>성취기준</th><td>{[standards.subject, standards.gradeBand, standards.codes].filter(Boolean).join(' · ')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rr-summary" style={{ borderColor: STATUS_COLORS[summary.status] }}>
        <div className="rr-status" style={{ color: STATUS_COLORS[summary.status] }}>
          {STATUS_LABELS[summary.status]}
        </div>
        <div className="rr-score">점수 요건 {summary.score}점</div>
        <div className="rr-scan">
          자동 스캔: 심각 {scanCounts.critical} · 경고 {scanCounts.warning} · 확인 필요 {scanCounts.info}
        </div>
        {summary.requiredFails.length > 0 && (
          <ul className="rr-fails">
            {summary.requiredFails.map((it) => (
              <li key={it.id}>필수 미충족 — {it.question}</li>
            ))}
          </ul>
        )}
        {summary.needsHuman.length > 0 && (
          <p className="rr-hold-note">판단 미완료 항목 {summary.needsHuman.length}건 — 심사자 확인 후 재집계 필요</p>
        )}
      </div>

      <table className="rr-table">
        <thead>
          <tr><th>구분</th><th>항목</th><th>판정</th><th>근거·비고</th></tr>
        </thead>
        <tbody>
          {summary.items.map((it) => {
            const v = finalVerdict(it, judgments, overrides, humanInputs)
            const j = judgments[it.id]
            const ov = overrides[it.id]
            const hi = humanInputs[it.id]
            return (
              <tr key={it.id} className={v === 'fail' ? 'rr-row-fail' : ''}>
                <td>{it.type === 'required' ? '필수' : `점수(${it.weight})`}</td>
                <td>{it.question}</td>
                <td className={`rr-verdict rr-${v}`}>{VERDICT_LABELS[v]}{ov ? ' (번복)' : ''}</td>
                <td>
                  {j?.evidence?.slice(0, 2).map((e, i) => (
                    <div key={i} className="rr-evidence">
                      <span>{e.file}:{e.line}</span> <code>{e.quote}</code>
                    </div>
                  ))}
                  {j?.reasoning && <div className="rr-reasoning">{j.reasoning}</div>}
                  {ov && <div className="rr-override">심사자 번복: {VERDICT_LABELS[ov.verdict]} — {ov.note || '사유 미기재'}</div>}
                  {!it.aiVerifiable && hi?.note && <div className="rr-reasoning">{hi.note}</div>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {opinion && (
        <div className="rr-opinion">
          <h4>종합 의견</h4>
          <p>{opinion}</p>
        </div>
      )}

      <div className="rr-sign">
        <div>심사자: {reviewerName || '____________'} (서명) ____________</div>
        <div>심사일: {new Date().toLocaleDateString('ko-KR')}</div>
      </div>

      <p className="report-disclaimer">
        본 보고서는 커밋 {repoMeta.commitSha.slice(0, 12) || '(미상)'}에 대한 심사 기록입니다. AI 판정은 초안이며
        최종 판정 권한은 심사자에게 있습니다. 코드 수정 시 재심사가 필요합니다. · 루브릭 v{RUBRIC_VERSION}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: 빌드 확인** — Run: `npm run build` / Expected: built (아직 어디서도 import 안 하므로 트리셰이킹될 뿐, 문법 오류만 검출)

- [ ] **Step 3: Commit**

```bash
git add src/components/ReviewReport.jsx
git commit -m "feat: 심사 보고서 컴포넌트 (커밋 해시·루브릭 버전·판정표·서명란)"
```

---

### Task 7: 심사 흐름 UI (ReviewMode.jsx)

**Files:** Create: `src/components/ReviewMode.jsx`

- [ ] **Step 1: 구현**

`src/components/ReviewMode.jsx` 전체:

```jsx
import { useState } from 'react'
import { parseGithubUrl, fetchRepoFiles } from '../lib/github.js'
import { scanFiles } from '../lib/scanner.js'
import { securityGrade } from '../lib/scoring.js'
import { AI_MODELS, friendlyApiError } from '../lib/aiReview.js'
import { TRACKS, rubricItems, RUBRIC_VERSION } from '../data/rubric.js'
import { inferCategory, judgeRubric, VERDICT_LABELS } from '../lib/reviewAi.js'
import ReviewReport from './ReviewReport.jsx'

const SUBJECTS = ['국어', '도덕', '사회', '역사', '수학', '과학', '기술·가정', '정보', '체육', '음악', '미술', '영어', '기타']
const GRADE_BANDS = ['초1-2', '초3-4', '초5-6', '중1-3', '고1-3']
const VERDICT_OPTIONS = ['pass', 'fail', 'na', 'needs_human']

export default function ReviewMode({ onExit }) {
  const [step, setStep] = useState('setup') // setup | category | judged | report
  const [repoUrl, setRepoUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(AI_MODELS[0].id)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const [repoMeta, setRepoMeta] = useState(null) // {owner, repo, branch, commitSha}
  const [files, setFiles] = useState([])
  const [scanResult, setScanResult] = useState(null)
  const [aiCategory, setAiCategory] = useState(null)
  const [track, setTrack] = useState(null)
  const [standards, setStandards] = useState({ subject: '', gradeBand: '', codes: '' })
  const [judgments, setJudgments] = useState({})
  const [excludedFiles, setExcludedFiles] = useState([])
  const [overrides, setOverrides] = useState({})
  const [humanInputs, setHumanInputs] = useState({})
  const [opinion, setOpinion] = useState('')
  const [reviewerName, setReviewerName] = useState('')

  const scanSummaryText = () => {
    if (!scanResult) return ''
    return scanResult.findings
      .map((f) => `- [${f.rule.severity}] ${f.rule.title} (${f.occurrences.length}곳)`)
      .join('\n')
  }

  const loadAndClassify = async () => {
    const parsed = parseGithubUrl(repoUrl)
    if (!parsed) return setError('주소 형식을 알 수 없어요. 예: https://github.com/아이디/저장소')
    if (!apiKey.trim()) return setError('심사자 API 키를 입력해 주세요.')
    setError('')
    try {
      setBusy('저장소 불러오는 중…')
      const result = await fetchRepoFiles({ ...parsed, onProgress: (d, t) => setBusy(`파일 내려받는 중… ${d}/${t}`) })
      if (result.files.length === 0) throw new Error('검사할 수 있는 파일이 없어요.')
      setRepoMeta({ owner: parsed.owner, repo: parsed.repo, branch: result.branch, commitSha: result.commitSha })
      setFiles(result.files)
      const scan = scanFiles(result.files)
      setScanResult(scan)
      setBusy('AI가 앱 분류를 추론하는 중…')
      const cat = await inferCategory({ apiKey: apiKey.trim(), model, files: result.files })
      setAiCategory(cat)
      setTrack(cat.category)
      setStep('category')
    } catch (err) {
      setError(friendlyApiError(err))
    } finally {
      setBusy('')
    }
  }

  const runJudgment = async () => {
    setError('')
    try {
      setBusy('AI가 루브릭 판정 초안을 작성하는 중… (1~3분)')
      const { judgments: j, excluded } = await judgeRubric({
        apiKey: apiKey.trim(),
        model,
        files,
        track,
        scanSummary: scanSummaryText(),
      })
      setJudgments(j)
      setExcludedFiles(excluded)
      setStep('judged')
    } catch (err) {
      setError(friendlyApiError(err))
    } finally {
      setBusy('')
    }
  }

  const setOverride = (id, verdict, note) => {
    if (!verdict) {
      const next = { ...overrides }
      delete next[id]
      setOverrides(next)
    } else {
      setOverrides({ ...overrides, [id]: { verdict, note: note ?? overrides[id]?.note ?? '' } })
    }
  }

  const trackItems = track ? rubricItems.filter((it) => it.tracks.includes(track)) : []
  const aiItems = trackItems.filter((it) => it.aiVerifiable)
  const humanItems = trackItems.filter((it) => !it.aiVerifiable)

  return (
    <section className="panel review-mode">
      <div className="panel-head">
        <h2><span className="panel-icon">⚖️</span> 심사 모드 <span className="rm-beta">베타</span></h2>
        <button className="btn-secondary" onClick={onExit}>자가점검으로 돌아가기</button>
      </div>
      <p className="panel-intro">
        AI가 코드에서 증거를 수집해 루브릭 v{RUBRIC_VERSION} 판정 초안을 만들고, 심사자가 최종 판정합니다.
        교사가 제출 전 스스로 돌려보는 <strong>모의심사</strong>로도 쓸 수 있어요. 분석 시 코드가 Anthropic 서버로 전송됩니다.
      </p>

      {error && <div className="ai-error">⚠️ {error}</div>}
      {busy && <div className="rm-busy">⏳ {busy}</div>}

      {step === 'setup' && (
        <div className="rm-setup">
          <label className="ai-label">심사 대상 GitHub 주소
            <input type="text" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/아이디/저장소" disabled={!!busy} />
          </label>
          <label className="ai-label">심사자 Anthropic API 키 (저장되지 않음)
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..." autoComplete="off" />
          </label>
          <label className="ai-label">모델
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {AI_MODELS.map((m) => (<option key={m.id} value={m.id}>{m.label}</option>))}
            </select>
          </label>
          <button className="btn-primary" onClick={loadAndClassify} disabled={!!busy || !repoUrl.trim() || !apiKey.trim()}>
            ① 저장소 불러오기 + 분류 추론
          </button>
        </div>
      )}

      {step === 'category' && aiCategory && (
        <div className="rm-category">
          <div className="rm-repo-line">
            📦 {repoMeta.owner}/{repoMeta.repo} ({repoMeta.branch}) · 커밋 <code>{repoMeta.commitSha.slice(0, 12)}</code> · 파일 {files.length}개
            {scanResult && ` · 자동 스캔 ${securityGrade(scanResult).score}점`}
          </div>
          <div className="rm-ai-suggest">
            <strong>AI 분류 추론:</strong> {TRACKS[aiCategory.category].icon} {TRACKS[aiCategory.category].label}
            {' '}(확신도 {(aiCategory.confidence * 100).toFixed(0)}%)
            <p className="rm-reasoning">{aiCategory.reasoning}</p>
            <ul>{aiCategory.evidence.map((e, i) => (<li key={i}>{e}</li>))}</ul>
          </div>
          <div className="rm-track-pick">
            <strong>심사자 확정 (트랙 선택)</strong>
            {Object.entries(TRACKS).map(([key, t]) => (
              <label key={key} className="rm-track-option">
                <input type="radio" name="track" checked={track === key} onChange={() => setTrack(key)} />
                <span>{t.icon} {t.label}</span> <em>{t.desc}</em>
              </label>
            ))}
          </div>
          {track === 'learning_content' && (
            <div className="rm-standards">
              <strong>성취기준 태깅 (선택)</strong>
              <div className="rm-standards-row">
                <select value={standards.subject} onChange={(e) => setStandards({ ...standards, subject: e.target.value })}>
                  <option value="">교과 선택</option>
                  {SUBJECTS.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
                <select value={standards.gradeBand} onChange={(e) => setStandards({ ...standards, gradeBand: e.target.value })}>
                  <option value="">학년군 선택</option>
                  {GRADE_BANDS.map((g) => (<option key={g} value={g}>{g}</option>))}
                </select>
              </div>
              <textarea rows={2} value={standards.codes} placeholder="성취기준 코드·문장 (예: [9국01-02] …)"
                onChange={(e) => setStandards({ ...standards, codes: e.target.value })} />
            </div>
          )}
          <button className="btn-primary" onClick={runJudgment} disabled={!!busy || !track}>
            ② 이 트랙으로 루브릭 판정 시작
          </button>
        </div>
      )}

      {step === 'judged' && (
        <div className="rm-judged">
          {excludedFiles.length > 0 && (
            <div className="ai-notice"><p>⚠️ 용량 초과로 분석에서 제외된 파일: {excludedFiles.join(', ')} — 판정의 한계로 보고서에 감안하세요.</p></div>
          )}
          <h3 className="rm-section-title">AI 판정 초안 — 항목별로 근거를 확인하고 승인하거나 번복하세요</h3>
          {aiItems.map((it) => {
            const j = judgments[it.id]
            const ov = overrides[it.id]
            return (
              <div key={it.id} className={`rm-item rm-v-${ov?.verdict || j?.verdict}`}>
                <div className="rm-item-head">
                  <span className={`rm-badge ${it.type}`}>{it.type === 'required' ? '필수' : `점수 ${it.weight}`}</span>
                  <strong>{it.question}</strong>
                  <span className={`rm-verdict rm-${ov?.verdict || j?.verdict}`}>
                    {VERDICT_LABELS[ov?.verdict || j?.verdict]}{ov ? ' (번복)' : ''}
                  </span>
                </div>
                {j?.evidence?.map((e, i) => (
                  <div key={i} className="rr-evidence"><span>{e.file}:{e.line}</span> <code>{e.quote}</code></div>
                ))}
                {j?.reasoning && <p className="rm-reasoning">{j.reasoning}</p>}
                <div className="rm-override-row">
                  <select value={ov?.verdict || ''} onChange={(e) => setOverride(it.id, e.target.value || null)}>
                    <option value="">AI 판정 승인</option>
                    {VERDICT_OPTIONS.map((v) => (<option key={v} value={v}>번복 → {VERDICT_LABELS[v]}</option>))}
                  </select>
                  {ov && (
                    <input type="text" placeholder="번복 사유 (기록에 남음)" value={ov.note}
                      onChange={(e) => setOverride(it.id, ov.verdict, e.target.value)} />
                  )}
                </div>
              </div>
            )
          })}

          <h3 className="rm-section-title">심사자 수동 판정 — AI가 코드만으로 판단할 수 없는 항목</h3>
          {humanItems.map((it) => {
            const hi = humanInputs[it.id]
            return (
              <div key={it.id} className="rm-item rm-human">
                <div className="rm-item-head">
                  <span className={`rm-badge ${it.type}`}>{it.type === 'required' ? '필수' : `점수 ${it.weight}`}</span>
                  <strong>{it.question}</strong>
                </div>
                <p className="rm-reasoning">{it.evidenceHint}</p>
                <div className="rm-override-row">
                  <select value={hi?.verdict || ''} onChange={(e) =>
                    setHumanInputs({ ...humanInputs, [it.id]: { verdict: e.target.value, note: hi?.note || '' } })}>
                    <option value="">판정 선택</option>
                    {VERDICT_OPTIONS.map((v) => (<option key={v} value={v}>{VERDICT_LABELS[v]}</option>))}
                  </select>
                  <input type="text" placeholder="판정 근거 메모" value={hi?.note || ''}
                    onChange={(e) => setHumanInputs({ ...humanInputs, [it.id]: { verdict: hi?.verdict || '', note: e.target.value } })} />
                </div>
              </div>
            )
          })}

          <label className="ai-label">종합 의견
            <textarea rows={3} value={opinion} onChange={(e) => setOpinion(e.target.value)}
              placeholder="심사자 종합 의견 (보고서에 표시)" />
          </label>
          <label className="ai-label rm-reviewer">심사자 이름
            <input type="text" value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} placeholder="예: ○○중학교 ○○○" />
          </label>
          <button className="btn-primary" onClick={() => setStep('report')}>③ 심사 보고서 생성</button>
        </div>
      )}

      {step === 'report' && (
        <div>
          <ReviewReport
            repoUrl={repoUrl}
            repoMeta={repoMeta}
            track={track}
            standards={track === 'learning_content' ? standards : null}
            scanCounts={securityGrade(scanResult).counts}
            judgments={judgments}
            overrides={overrides}
            humanInputs={humanInputs}
            opinion={opinion}
            reviewerName={reviewerName}
          />
          <div className="report-actions">
            <button className="btn-primary" onClick={() => window.print()}>🖨️ 인쇄 / PDF 저장</button>
            <button className="btn-secondary" onClick={() => setStep('judged')}>판정으로 돌아가기</button>
          </div>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: 빌드 확인** — Run: `npm run build` / Expected: built

- [ ] **Step 3: Commit**

```bash
git add src/components/ReviewMode.jsx
git commit -m "feat: 심사 흐름 UI (로드→분류 확정→AI 판정→오버라이드→보고서)"
```

---

### Task 8: App 통합 + 스타일

**Files:** Modify: `src/App.jsx`, `src/styles.css`

- [ ] **Step 1: App.jsx — mode 상태와 진입 버튼**

import에 추가:

```js
import ReviewMode from './components/ReviewMode.jsx'
```

`const [tab, setTab] = useState('home')` 아래에 추가:

```js
const [mode, setMode] = useState('self') // 'self' | 'review'
```

헤더의 `<nav className="tabs">` 바로 다음(닫힌 뒤)에 추가:

```jsx
<button className="review-toggle" onClick={() => setMode(mode === 'self' ? 'review' : 'self')}>
  {mode === 'self' ? '⚖️ 심사 모드' : '↩ 자가점검'}
</button>
```

`<main className="main">` 내부 전체를 다음 구조로 감싸기:

```jsx
<main className="main">
  {mode === 'review' ? (
    <ReviewMode onExit={() => setMode('self')} />
  ) : (
    <>
      {/* 기존 tab 렌더링 전체 그대로 */}
    </>
  )}
</main>
```

- [ ] **Step 2: styles.css — 심사 UI·보고서 스타일 (파일 끝 print 미디어쿼리 앞에 추가)**

```css
/* ───────── review mode ───────── */
.review-toggle {
  border: 1.5px solid var(--ink);
  background: var(--ink);
  color: #fff;
  border-radius: 99px;
  padding: 7px 14px;
  font-size: 0.85rem;
  font-weight: 700;
}

.rm-beta {
  font-size: 0.7rem;
  background: var(--warn-soft);
  color: var(--warn);
  border-radius: 99px;
  padding: 2px 8px;
  vertical-align: middle;
}

.rm-busy {
  background: var(--info-soft);
  border-radius: 10px;
  padding: 12px 15px;
  font-size: 0.9rem;
  margin-bottom: 14px;
}

.rm-setup { display: grid; gap: 14px; max-width: 560px; }

.rm-repo-line {
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 0.88rem;
  margin-bottom: 14px;
}

.rm-ai-suggest {
  background: var(--primary-soft);
  border-radius: 12px;
  padding: 16px 18px;
  font-size: 0.92rem;
  margin-bottom: 16px;
}

.rm-ai-suggest ul { padding-left: 20px; font-size: 0.85rem; margin-top: 6px; }

.rm-reasoning { font-size: 0.85rem; color: var(--muted); margin-top: 4px; }

.rm-track-pick { display: grid; gap: 8px; margin-bottom: 16px; }

.rm-track-option {
  display: flex; align-items: baseline; gap: 8px;
  border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px;
  font-size: 0.92rem; cursor: pointer;
}
.rm-track-option:has(input:checked) { border-color: var(--primary); background: var(--primary-soft); }
.rm-track-option em { font-style: normal; color: var(--muted); font-size: 0.8rem; }

.rm-standards { display: grid; gap: 8px; margin-bottom: 16px; }
.rm-standards-row { display: flex; gap: 8px; }
.rm-standards select, .rm-standards textarea {
  border: 1px solid var(--line); border-radius: 9px; padding: 9px 12px; font-family: inherit; font-size: 0.9rem;
}

.rm-section-title { font-size: 1.02rem; font-weight: 800; margin: 22px 0 10px; }

.rm-item { border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; }
.rm-item.rm-v-fail { border-color: #f0c4c4; background: #fffafa; }
.rm-item.rm-v-needs_human { border-color: #f0dbb8; }

.rm-item-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.rm-item-head strong { flex: 1; font-size: 0.93rem; }

.rm-badge { font-size: 0.72rem; font-weight: 700; border-radius: 99px; padding: 2px 9px; flex-shrink: 0; }
.rm-badge.required { background: var(--danger-soft); color: var(--danger); }
.rm-badge.scored { background: var(--info-soft); color: var(--info); }

.rm-verdict, .rr-verdict { font-weight: 800; font-size: 0.85rem; white-space: nowrap; }
.rm-pass, .rr-pass { color: var(--ok); }
.rm-fail, .rr-fail { color: var(--danger); }
.rm-needs_human, .rr-needs_human { color: var(--warn); }
.rm-na, .rr-na { color: var(--muted); }

.rm-override-row { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.rm-override-row select, .rm-override-row input {
  border: 1px solid var(--line); border-radius: 8px; padding: 7px 10px; font-size: 0.85rem; font-family: inherit;
}
.rm-override-row input { flex: 1; min-width: 200px; }

/* ───────── review report ───────── */
.review-report { background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius); padding: 28px 26px; }
.rr-header { text-align: center; margin-bottom: 18px; }
.rr-header h3 { font-size: 1.3rem; font-weight: 800; margin: 6px 0 12px; }
.rr-meta { margin: 0 auto; font-size: 0.85rem; border-collapse: collapse; }
.rr-meta th { text-align: right; color: var(--muted); padding: 3px 10px 3px 0; font-weight: 600; }
.rr-meta td { text-align: left; padding: 3px 0; }

.rr-summary { background: var(--paper); border: 2px solid var(--line); border-radius: 12px; padding: 16px 20px; text-align: center; margin-bottom: 16px; }
.rr-status { font-size: 1.3rem; font-weight: 800; }
.rr-score { font-size: 0.95rem; margin-top: 4px; }
.rr-scan { font-size: 0.82rem; color: var(--muted); margin-top: 4px; }
.rr-fails { text-align: left; padding-left: 22px; margin-top: 10px; font-size: 0.88rem; color: var(--danger); }
.rr-hold-note { font-size: 0.85rem; color: var(--warn); margin-top: 8px; }

.rr-table { width: 100%; border-collapse: collapse; font-size: 0.83rem; background: var(--paper); }
.rr-table th, .rr-table td { border: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; }
.rr-table th { background: var(--bg); }
.rr-row-fail { background: #fffafa; }

.rr-evidence { font-size: 0.78rem; margin: 3px 0; }
.rr-evidence span { color: var(--muted); font-weight: 600; }
.rr-evidence code { background: #f4f2ec; border-radius: 5px; padding: 2px 6px; font-size: 0.75rem; }
.rr-override { font-size: 0.8rem; color: var(--danger); font-weight: 600; margin-top: 3px; }

.rr-opinion { background: var(--paper); border: 1px solid var(--line); border-radius: 12px; padding: 14px 18px; margin-top: 14px; }
.rr-opinion h4 { font-size: 0.95rem; margin-bottom: 6px; }
.rr-opinion p { font-size: 0.9rem; white-space: pre-wrap; }

.rr-sign { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-top: 20px; font-size: 0.9rem; }
```

`@media print` 블록 안에 추가:

```css
  .review-toggle, .rm-busy { display: none !important; }
```

- [ ] **Step 3: 테스트+빌드** — Run: `npm test && npm run build` / Expected: 전체 passed + built

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx src/styles.css
git commit -m "feat: 심사 모드 앱 통합 (헤더 토글, 스타일)"
```

---

### Task 9: 브라우저 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: dev 서버에서 확인** — preview_start `vibe-check` 후:
  1. 콘솔 에러 없음
  2. 헤더 "⚖️ 심사 모드" 버튼 → ReviewMode 렌더, "↩ 자가점검" 복귀 동작
  3. setup 화면: 주소·키·모델 입력 UI, 키 없이 버튼 비활성
  4. 자가점검 모드 회귀: GitHub 스캔(예: `cleveranawim-source/real_smile`)이 여전히 동작 (github.js 수정 회귀 확인)
- [ ] **Step 2: AI 실경로(카테고리 추론→판정→보고서)는 API 키가 필요하므로 **파일럿(사용자 키)에서 검증** — 계획서에 한계로 명시하고 사용자에게 안내.

---

### Task 10: 문서·배포

**Files:** Modify: `README.md`

- [ ] **Step 1: README에 심사 모드 섹션 추가** (네 가지 점검 표 아래):

```markdown
## ⚖️ 심사 모드 (베타)

교육청 공인인증을 향한 심사 인프라. GitHub 주소 하나로:
규칙 스캔 → AI 카테고리 추론(4트랙: 교무자동화/교과도구/학습콘텐츠/학급운영, 심사자 확정)
→ 루브릭 v1.0 AI 판정 초안(모든 pass/fail에 근거 코드 인용 강제, 근거 없으면 판단불가로 강등)
→ 심사자 승인/번복(기록 보존) → 커밋 해시가 고정된 심사 보고서(인쇄/PDF).
자기신고 없음 — 증거 중심. 설계: `docs/superpowers/specs/2026-08-24-review-mode-design.md`
```

- [ ] **Step 2: 빌드·배포·푸시**

```bash
npm run build && npm run deploy
git add -A && git commit -m "feat: 심사 모드(Review Mode) 베타 — 증거 중심 AI 판정 + 심사자 최종 판정

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" && git push
```

- [ ] **Step 3: 라이브 확인** — `curl`로 새 번들 해시 반영 확인 후 배포 URL에서 심사 모드 진입 확인.

---

## Self-Review 결과

- **스펙 커버리지:** 심사 흐름 ①~⑤(Task 5·7), 신뢰성 원칙(Task 4 validateJudgments + JUDGE_SYSTEM), 루브릭 2층·버전(Task 2), 변조 방지 커밋 해시(Task 5·6), 공개 모의심사(Task 7 intro 문구), 성취기준 태깅(Task 7), 비범위 준수(제출함·계정·대장 없음) — 전부 대응됨.
- **플레이스홀더:** 없음 (모든 코드 완전 기재).
- **타입 일관성:** judgments는 `{[itemId]: {itemId, verdict, evidence[], reasoning, demoted}}`, overrides는 `{[itemId]: {verdict, note}}`, humanInputs는 `{[itemId]: {verdict, note}}` — Task 3/4/6/7에서 동일하게 사용됨. `finalVerdict(item, judgments, overrides, humanInputs)` 시그니처 일치 확인.
- **한계 명시:** AI 실경로 E2E는 심사자 키 필요 → 파일럿에서 검증 (Task 9).

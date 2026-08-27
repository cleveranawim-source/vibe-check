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
  // hasOwnProperty: '__proto__' 같은 프로토타입 체인 키가 검증을 통과하지 못하도록
  if (!Object.prototype.hasOwnProperty.call(TRACKS, obj.category)) {
    throw new Error(`알 수 없는 분류: ${obj.category}`)
  }
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
    if (final.stop_reason === 'refusal') {
      throw new Error('모델이 안전상 이유로 이 요청의 처리를 거절했어요. 다른 모델(Opus 5 등)로 다시 시도해 보세요.')
    }
    if (final.stop_reason === 'max_tokens') {
      throw new Error('응답이 길이 제한으로 잘렸어요. 파일 수를 줄여 다시 시도해 주세요.')
    }
    const text = final.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
    return extractJson(text)
  }
  try {
    return await run()
  } catch (err) {
    if (err instanceof SyntaxError || /JSON/.test(err.message || '')) {
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

export async function inferCategory({ apiKey, model, files, onText }) {
  const { text, excluded } = buildCodeSection(files)
  const raw = await callJson({
    apiKey,
    model,
    system: CATEGORY_SYSTEM,
    user: `다음 프로그램을 분류하세요.\n${text}`,
    onText,
  })
  return { ...validateCategory(raw), excludedFiles: excluded }
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

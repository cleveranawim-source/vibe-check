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

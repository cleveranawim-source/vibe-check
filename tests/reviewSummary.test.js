import { describe, it, expect } from 'vitest'
import { finalVerdict, computeSummary, STATUS_LABELS } from '../src/lib/reviewSummary.js'
import { rubricItems } from '../src/data/rubric.js'

const item = (id) => rubricItems.find((i) => i.id === id)

// 주어진 트랙의 AI 판정 항목 전체를 기본값으로 채운 판정 객체
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
  it('빈 문자열 verdict(판정 미선택)는 needs_human으로 수렴 — 유령 판정 방지', () => {
    expect(finalVerdict(item('H-2fa'), {}, {}, { 'H-2fa': { verdict: '', note: '메모만 입력' } })).toBe('needs_human')
    expect(finalVerdict(item('R-rrn'), { 'R-rrn': { verdict: '' } }, {}, {})).toBe('needs_human')
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
  it('빈 문자열 verdict가 남으면 보류 (합격 후보 우회 불가)', () => {
    const h = humanFor('admin', 'pass')
    h['H-2fa'] = { verdict: '', note: '메모만' }
    const s = computeSummary('admin', judgmentsFor('admin', 'pass'), {}, h)
    expect(s.status).toBe('hold')
  })
  it('심사자 번복(fail→pass)이 집계에서 불합격 후보를 해제한다', () => {
    const j = judgmentsFor('admin', 'pass')
    j['R-rrn'].verdict = 'fail'
    const s = computeSummary('admin', j, { 'R-rrn': { verdict: 'pass', note: '오탐 확인' } }, humanFor('admin', 'pass'))
    expect(s.status).toBe('pass_candidate')
  })
  it('필수 항목의 해당없음(na)은 불합격이 아니다', () => {
    const j = judgmentsFor('learning_content', 'pass')
    j['R-under14'].verdict = 'na'
    const s = computeSummary('learning_content', j, {}, humanFor('learning_content', 'pass'))
    expect(s.status).toBe('pass_candidate')
  })
  it('항목이 없는 트랙(비정상 값)은 절대 합격 후보가 아니다', () => {
    const s = computeSummary('__proto__', {}, {}, {})
    expect(s.status).toBe('hold')
    expect(s.items.length).toBe(0)
  })
})

import { describe, it, expect } from 'vitest'
import { buildSupplementRequest } from '../src/lib/supplementRequest.js'
import { linkReReview, recordKey } from '../src/lib/ledger.js'

const META = { source: 'github', owner: 'o', repo: 'r', branch: 'main', commitSha: 'abc123def4567890' }

describe('buildSupplementRequest', () => {
  it('판단불가 항목을 원인별로 나눠 담는다 (AI/수동/제출물)', () => {
    const r = buildSupplementRequest({
      repoMeta: META,
      track: 'admin', // 필수 5(R-rrn·secrets·db-locked·score-forge·admin-ext·admin-data)… aiVerifiable 전부
      judgments: { 'R-rrn': { verdict: 'needs_human', reasoning: '근거 없음' } },
      overrides: {},
      humanInputs: {},
      gate: [{ id: 'firebase-rules', ok: false, label: 'Firebase 보안 규칙 파일', detail: '규칙 파일을 요청하세요' }],
    })
    expect(r.submission.length).toBe(1)
    expect(r.codeEvidence.some((it) => it.id === 'R-rrn')).toBe(true)
    expect(r.humanDoc.some((it) => it.id === 'H-retention')).toBe(true) // 수동 항목 미입력 → 판단불가
    expect(r.count).toBeGreaterThan(2)
  })

  it('요청서 본문에 대상·항목·재심사 안내가 들어간다', () => {
    const r = buildSupplementRequest({
      repoMeta: META,
      track: 'admin',
      judgments: {},
      overrides: {},
      humanInputs: {},
      gate: [],
    })
    expect(r.text).toContain('심사 보완 요청서')
    expect(r.text).toContain('o/r')
    expect(r.text).toContain('재심사 안내')
  })

  it('판단불가가 없으면 count 0, text 빈 문자열', () => {
    const pass = (id) => [id, { verdict: 'pass', evidence: [{ file: 'a', line: 1, quote: 'x' }] }]
    const judgments = Object.fromEntries(
      ['R-rrn', 'R-secrets', 'R-db-locked', 'R-score-forge', 'R-admin-ext', 'R-admin-data', 'S-minimal', 'S-overseas', 'S-xss', 'S-https', 'S-quota', 'S-write-guard', 'S-notice'].map(pass)
    )
    const humanInputs = { 'H-retention': { verdict: 'pass' }, 'H-2fa': { verdict: 'pass' }, 'H-delete': { verdict: 'pass' } }
    const r = buildSupplementRequest({ repoMeta: META, track: 'admin', judgments, overrides: {}, humanInputs, gate: [] })
    expect(r.count).toBe(0)
    expect(r.text).toBe('')
  })
})

describe('linkReReview (재심사 회차)', () => {
  const rec = (over) => ({ source: 'github', owner: 'o', repo: 'r', commitSha: 'sha1', ...over })

  it('첫 심사는 1회차', () => {
    expect(linkReReview([], rec()).round).toBe(1)
  })

  it('같은 앱 재심사는 회차 증가 + 이전 SHA 연결', () => {
    const first = linkReReview([], rec({ commitSha: 'oldsha123' }))
    const second = linkReReview([first], rec({ commitSha: 'newsha456' }))
    expect(second.round).toBe(2)
    expect(second.prevSha).toBe('oldsha123')
  })

  it('로컬 폴더와 GitHub은 키가 다르다', () => {
    expect(recordKey(rec())).not.toBe(recordKey({ source: 'local', owner: null, repo: 'r' }))
  })
})

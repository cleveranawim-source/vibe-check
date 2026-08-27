import { describe, expect, it } from 'vitest'

import { BADGE_POLICY, evaluateBadgeEligibility } from '../src/lib/badgePolicy.js'

const result = ({ scanScore = 80, critical = 0, coverage = true, source = 'github', hasApplicationSource = true } = {}) => (
  evaluateBadgeEligibility({
    scanGrade: { score: scanScore, counts: { critical, warning: 0, info: 0 } },
    source,
    sourceCoverageComplete: coverage,
    hasApplicationSource,
  })
)

describe('badge policy', () => {
  it('서버 자동 점수가 경계값 80이고 Critical이 없으면 Silver', () => {
    expect(BADGE_POLICY.minimumScanScore).toBe(80)
    expect(result()).toMatchObject({ eligible: true, level: 'silver', effectiveScore: 80 })
  })

  it('자동 점수로 Gold를 결정한다', () => {
    expect(result({ scanScore: 90 })).toMatchObject({ eligible: true, level: 'gold', effectiveScore: 90 })
    expect(result({ scanScore: 89 })).toMatchObject({ eligible: true, level: 'silver', effectiveScore: 89 })
  })

  it('점수가 높아도 Critical, 불완전 소스, 앱 소스 부재는 발급하지 않는다', () => {
    expect(result({ scanScore: 100, critical: 1 }).reasonCodes).toContain('CRITICAL_FINDING_PRESENT')
    expect(result({ scanScore: 100, coverage: false }).reasonCodes).toContain('SOURCE_COVERAGE_INCOMPLETE')
    expect(result({ scanScore: 100, hasApplicationSource: false }).reasonCodes).toContain('APPLICATION_SOURCE_MISSING')
  })

  it('79점과 로컬 폴더는 발급하지 않는다', () => {
    expect(result({ scanScore: 79 }).reasonCodes).toContain('SCAN_SCORE_BELOW_THRESHOLD')
    expect(result({ source: 'local' }).reasonCodes).toContain('SOURCE_NOT_GITHUB')
  })

  it('잘못된 점수는 SCORE_UNAVAILABLE로 닫힌다', () => {
    expect(result({ scanScore: 101 })).toMatchObject({ eligible: false, scanScore: null })
    expect(result({ scanScore: -1 }).reasonCodes).toContain('SCORE_UNAVAILABLE')
  })
})

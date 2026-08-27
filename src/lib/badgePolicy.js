export const BADGE_POLICY_VERSION = '1.0.0'

export const BADGE_POLICY = Object.freeze({
  version: BADGE_POLICY_VERSION,
  minimumScanScore: 80,
  maximumCriticalFindings: 0,
  requireCompleteSourceCoverage: true,
  requireApplicationSource: true,
  supportedSource: 'github',
  expirationDays: 0,
  levels: Object.freeze({
    silver: Object.freeze({ minimumScore: 80, code: 2 }),
    gold: Object.freeze({ minimumScore: 90, code: 3 }),
  }),
})

export const BADGE_LEVELS = Object.freeze({
  silver: Object.freeze({ ...BADGE_POLICY.levels.silver, label: 'Silver' }),
  gold: Object.freeze({ ...BADGE_POLICY.levels.gold, label: 'Gold' }),
})

export const BADGE_REASON_LABELS = Object.freeze({
  SOURCE_NOT_GITHUB: '공개 GitHub 저장소 심사만 자동 발급할 수 있습니다.',
  SOURCE_COVERAGE_INCOMPLETE: '일부 검사 대상 파일을 확인하지 못해 발급할 수 없습니다.',
  APPLICATION_SOURCE_MISSING: '검사할 애플리케이션 소스 파일을 확인하지 못했습니다.',
  SCAN_SCORE_BELOW_THRESHOLD: `자동 보안 점수가 ${BADGE_POLICY.minimumScanScore}점 미만입니다.`,
  CRITICAL_FINDING_PRESENT: '치명적 보안 발견이 남아 있습니다.',
  SCORE_UNAVAILABLE: '점수가 확정되지 않았습니다.',
})

const isScore = (value) => Number.isInteger(value) && value >= 0 && value <= 100

export function evaluateBadgeEligibility({ scanGrade, source, sourceCoverageComplete = true, hasApplicationSource = true }) {
  const reasonCodes = []
  const scanScore = scanGrade?.score
  const criticalCount = scanGrade?.counts?.critical

  if (source !== BADGE_POLICY.supportedSource) reasonCodes.push('SOURCE_NOT_GITHUB')
  if (BADGE_POLICY.requireCompleteSourceCoverage && !sourceCoverageComplete) {
    reasonCodes.push('SOURCE_COVERAGE_INCOMPLETE')
  }
  if (BADGE_POLICY.requireApplicationSource && !hasApplicationSource) {
    reasonCodes.push('APPLICATION_SOURCE_MISSING')
  }
  if (!isScore(scanScore) || !Number.isInteger(criticalCount)) {
    reasonCodes.push('SCORE_UNAVAILABLE')
  } else {
    if (scanScore < BADGE_POLICY.minimumScanScore) {
      reasonCodes.push('SCAN_SCORE_BELOW_THRESHOLD')
    }
    if (criticalCount > BADGE_POLICY.maximumCriticalFindings) {
      reasonCodes.push('CRITICAL_FINDING_PRESENT')
    }
  }

  const eligible = reasonCodes.length === 0
  const effectiveScore = isScore(scanScore) ? scanScore : null
  const level = eligible
    ? (effectiveScore >= BADGE_POLICY.levels.gold.minimumScore ? 'gold' : 'silver')
    : null

  return Object.freeze({
    eligible,
    outcome: eligible ? 'eligible' : 'ineligible',
    reasonCodes: Object.freeze(reasonCodes),
    scanScore: isScore(scanScore) ? scanScore : null,
    effectiveScore,
    level,
    levelCode: level ? BADGE_LEVELS[level].code : null,
    policyVersion: BADGE_POLICY_VERSION,
  })
}

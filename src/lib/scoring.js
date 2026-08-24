import { SEVERITIES } from '../data/securityRules.js'

// 규칙 스캔 결과의 요약 점수 — 심사 흐름의 사전 스캔 표시에 사용
export function securityGrade(scanResult) {
  if (!scanResult) return { grade: 'pending', score: null }
  const counts = { critical: 0, warning: 0, info: 0 }
  for (const f of scanResult.findings) {
    counts[f.rule.severity] += Math.min(f.occurrences.length, 5)
  }
  let score = 100
  score -= counts.critical * SEVERITIES.critical.weight
  score -= counts.warning * SEVERITIES.warning.weight
  score -= counts.info * SEVERITIES.info.weight
  score = Math.max(0, Math.round(score))

  let grade
  if (counts.critical > 0) grade = 'danger'
  else if (counts.warning >= 3) grade = 'caution'
  else if (counts.warning > 0 || counts.info > 2) grade = 'good'
  else grade = 'safe'
  return { grade, score, counts }
}

import { SEVERITIES } from '../data/securityRules.js'
import { privacyItems, privacyAlwaysItems } from '../data/privacyChecklist.js'
import { ethicsItems, ethicsAlwaysItems } from '../data/ethicsChecklist.js'

// 등급: safe(안전) / good(양호) / caution(주의) / danger(위험) / pending(미점검)
export const GRADES = {
  safe: { label: '안전', color: 'var(--ok)', emoji: '🟢' },
  good: { label: '양호', color: 'var(--ok2)', emoji: '🟡' },
  caution: { label: '주의', color: 'var(--warn)', emoji: '🟠' },
  danger: { label: '위험', color: 'var(--danger)', emoji: '🔴' },
  pending: { label: '미점검', color: 'var(--muted)', emoji: '⚪' },
}

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

function checklistGrade(items, alwaysIds, gateAnswer, answers) {
  const active =
    gateAnswer === 'no' ? items.filter((it) => alwaysIds.includes(it.id)) : items
  if (gateAnswer == null) return { grade: 'pending', score: null, answered: 0, total: active.length }

  let earned = 0
  let possible = 0
  let answered = 0
  let hardFail = false
  for (const it of active) {
    const a = answers[it.id]
    if (!a) continue
    answered++
    if (a === 'na') continue
    possible += it.weight
    if (a === 'yes') earned += it.weight
    else if (it.weight >= 3) hardFail = true
  }
  if (answered < active.length) {
    return { grade: 'pending', score: null, answered, total: active.length }
  }
  const score = possible === 0 ? 100 : Math.round((earned / possible) * 100)
  let grade
  if (hardFail || score < 50) grade = 'danger'
  else if (score < 75) grade = 'caution'
  else if (score < 100) grade = 'good'
  else grade = 'safe'
  return { grade, score, answered, total: active.length }
}

export function privacyGrade(gateAnswer, answers) {
  return checklistGrade(privacyItems, privacyAlwaysItems, gateAnswer, answers)
}

export function ethicsGrade(gateAnswer, answers) {
  return checklistGrade(ethicsItems, ethicsAlwaysItems, gateAnswer, answers)
}

export function activeItems(items, alwaysIds, gateAnswer) {
  if (gateAnswer === 'no') return items.filter((it) => alwaysIds.includes(it.id))
  return items
}

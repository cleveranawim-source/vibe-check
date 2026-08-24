import { rubricItems } from '../data/rubric.js'

export const STATUS_LABELS = {
  pass_candidate: '합격 후보',
  hold: '보류 — 확인 필요',
  fail_candidate: '불합격 후보',
}

// 최종 판정 우선순위: 심사자 오버라이드 > AI 판정(aiVerifiable) 또는 심사자 수동 입력
// ||를 쓰는 이유: verdict가 빈 문자열('판정 선택' 미완료)인 경우도 needs_human으로 수렴해야 한다
export function finalVerdict(item, judgments, overrides, humanInputs) {
  if (overrides[item.id]?.verdict) return overrides[item.id].verdict
  if (item.aiVerifiable) return judgments[item.id]?.verdict || 'needs_human'
  return humanInputs[item.id]?.verdict || 'needs_human'
}

export function computeSummary(track, judgments, overrides, humanInputs) {
  const items = rubricItems.filter((it) => it.tracks.includes(track))
  // 항목이 하나도 없는 트랙(비정상 값)은 절대 합격 후보가 되면 안 된다
  if (items.length === 0) {
    return { items, requiredFails: [], needsHuman: [], score: 0, status: 'hold' }
  }
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

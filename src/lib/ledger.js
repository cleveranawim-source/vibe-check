// 재심사 연결: 같은 앱(저장소 또는 폴더명)의 기존 기록을 찾아 회차와 이전 심사를 잇는다.
export const recordKey = (r) => (r.source === 'local' || !r.owner ? `local:${r.repo}` : `gh:${r.owner}/${r.repo}`)

// records는 최신순 배열 (App의 ledger 그대로)
export function linkReReview(records, record) {
  const prior = records.find((r) => recordKey(r) === recordKey(record))
  if (!prior) return { ...record, round: 1, prevSha: null }
  return { ...record, round: (prior.round || 1) + 1, prevSha: prior.commitSha || null }
}

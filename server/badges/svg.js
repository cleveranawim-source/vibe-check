const escapeXml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;')

export function makeBlockchainBadgeSvg(badge) {
  const active = badge.status === 'valid'
  const label = active ? `EduSafe ${badge.badgeLevel}` : `EduSafe ${badge.status}`
  const detail = active ? `${badge.score}점 · ${badge.commitSha.slice(0, 7)}` : '검증 필요'
  const leftWidth = 112
  const rightWidth = Math.max(122, Math.round(detail.length * 7.2) + 20)
  const total = leftWidth + rightWidth
  const leftColor = active ? (badge.badgeLevel === 'gold' ? '#8a6410' : '#0a5c50') : '#6b7280'
  const rightColor = active ? (badge.badgeLevel === 'gold' ? '#fff4c2' : '#e3f2ee') : '#f1f5f9'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="24" role="img" aria-label="${escapeXml(label)}">
  <rect width="${leftWidth}" height="24" rx="4" fill="${leftColor}"/>
  <rect x="${leftWidth - 4}" width="4" height="24" fill="${leftColor}"/>
  <rect x="${leftWidth}" width="${rightWidth}" height="24" fill="${rightColor}"/>
  <rect x="${total - 4}" width="4" height="24" rx="4" fill="${rightColor}"/>
  <text x="10" y="16" font-family="-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif" font-size="12" font-weight="700" fill="#fff">${escapeXml(label)}</text>
  <text x="${leftWidth + 10}" y="16" font-family="ui-monospace,Menlo,monospace" font-size="11" fill="#24312e">${escapeXml(detail)}</text>
</svg>`
}

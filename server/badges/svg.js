const escapeXml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;')

export const BADGE_SVG_VARIANTS = Object.freeze(['compact', 'showcase'])

const SHOWCASE_PALETTES = Object.freeze({
  gold: Object.freeze({ accent: '#8a6410', surface: '#fff4c2', foreground: '#5d4308' }),
  silver: Object.freeze({ accent: '#46515d', surface: '#edf1f5', foreground: '#27313c' }),
  invalid: Object.freeze({ accent: '#596270', surface: '#f1f5f9', foreground: '#374151' }),
})

function normalizeBadge(badge) {
  const active = badge?.status === 'valid'
  const level = active && badge?.badgeLevel === 'gold'
    ? 'gold'
    : active && badge?.badgeLevel === 'silver' ? 'silver' : 'invalid'
  const score = active && Number.isFinite(Number(badge?.score))
    ? Math.max(0, Math.min(100, Math.round(Number(badge.score))))
    : null
  const commit = active && typeof badge?.commitSha === 'string'
    ? badge.commitSha.slice(0, 7)
    : null
  return { active, level, score, commit }
}

function makeCompactBadgeSvg(badge) {
  const { active, level, score, commit } = normalizeBadge(badge)
  const label = active ? `EduSafe ${level}` : 'EduSafe 검증 필요'
  const detail = active ? `${score}점 · ${commit}` : '검증 필요'
  const accessibleLabel = active
    ? `EduSafe ${level} 자동 보안 점검 통과, ${score}점, 커밋 ${commit}`
    : 'EduSafe 인증마크 검증 필요'
  const leftWidth = 112
  const rightWidth = Math.max(122, Math.round(detail.length * 7.2) + 20)
  const total = leftWidth + rightWidth
  const leftColor = active ? (level === 'gold' ? '#8a6410' : '#0a5c50') : '#6b7280'
  const rightColor = active ? (level === 'gold' ? '#fff4c2' : '#e3f2ee') : '#f1f5f9'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="24" viewBox="0 0 ${total} 24" role="img" aria-labelledby="badge-title badge-description">
  <title id="badge-title">${escapeXml(accessibleLabel)}</title>
  <desc id="badge-description">EAS 기반 오프체인 서명 인증마크</desc>
  <rect width="${leftWidth}" height="24" rx="4" fill="${leftColor}"/>
  <rect x="${leftWidth - 4}" width="4" height="24" fill="${leftColor}"/>
  <rect x="${leftWidth}" width="${rightWidth}" height="24" fill="${rightColor}"/>
  <rect x="${total - 4}" width="4" height="24" rx="4" fill="${rightColor}"/>
  <text x="10" y="16" font-family="-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif" font-size="12" font-weight="700" fill="#fff">${escapeXml(label)}</text>
  <text x="${leftWidth + 10}" y="16" font-family="ui-monospace,Menlo,monospace" font-size="11" fill="#24312e">${escapeXml(detail)}</text>
</svg>`
}

function makeShowcaseBadgeSvg(badge) {
  const { active, level, score, commit } = normalizeBadge(badge)
  const palette = SHOWCASE_PALETTES[level]
  const levelLabel = active ? level.toUpperCase() : '검증 필요'
  const statusLabel = active ? '유효' : badge?.status === 'revoked' ? '취소' : badge?.status === 'expired' ? '만료' : '확인 필요'
  const detailLabel = active ? `자동 보안 점검 · ${score}점` : '서명 상태를 확인해 주세요'
  const footerLabel = active ? `EAS SIGNED · GASLESS · ${commit}` : `EAS STATUS · ${String(badge?.status || 'INVALID').toUpperCase()}`
  const accessibleLabel = active
    ? `EduSafe ${levelLabel} 자동 보안 점검 인증마크, ${score}점, 커밋 ${commit}, EAS 오프체인 서명 유효`
    : `EduSafe 인증마크 ${statusLabel}, 서명 상태 확인 필요`
  const accessibleDescription = active
    ? 'EduSafe가 발급한 EAS 기반 가스리스 오프체인 서명 인증마크'
    : `EAS 기반 오프체인 인증마크의 현재 상태는 ${statusLabel}이며 서명 상태 확인이 필요합니다.`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="112" viewBox="0 0 360 112" role="img" aria-labelledby="showcase-title showcase-description">
  <title id="showcase-title">${escapeXml(accessibleLabel)}</title>
  <desc id="showcase-description">${escapeXml(accessibleDescription)}</desc>
  <defs><clipPath id="showcase-clip"><rect width="360" height="112" rx="16"/></clipPath></defs>
  <g clip-path="url(#showcase-clip)">
    <rect width="360" height="112" fill="${palette.surface}"/>
    <rect width="104" height="112" fill="${palette.accent}"/>
  </g>
  <rect x="0.75" y="0.75" width="358.5" height="110.5" rx="15.25" fill="none" stroke="${palette.accent}" stroke-width="1.5"/>
  <path d="M52 25 73 34v16c0 16-9 27-21 34-12-7-21-18-21-34V34z" fill="#fff" fill-opacity="0.12" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
  <path d="m41 52 8 8 15-17" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="52" y="101" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="9.5" font-weight="700" fill="#fff">EAS SIGNED</text>
  <text x="124" y="25" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="11" font-weight="700" fill="${palette.accent}">EDUSAFE</text>
  <text x="124" y="57" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="28" font-weight="800" fill="${palette.accent}">${escapeXml(levelLabel)}</text>
  <text x="124" y="79" font-family="-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif" font-size="13" font-weight="700" fill="${palette.foreground}">${escapeXml(detailLabel)}</text>
  <text x="124" y="99" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="10.5" font-weight="600" fill="${palette.foreground}">${escapeXml(footerLabel)}</text>
  <rect x="270" y="13" width="72" height="22" rx="11" fill="${palette.accent}"/>
  <text x="306" y="28" text-anchor="middle" font-family="-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif" font-size="10" font-weight="800" fill="#fff">${escapeXml(statusLabel)}</text>
</svg>`
}

export function makeBlockchainBadgeSvg(badge, { variant = 'compact' } = {}) {
  if (!BADGE_SVG_VARIANTS.includes(variant)) throw new TypeError('지원하지 않는 인증마크 SVG 디자인입니다.')
  return variant === 'showcase' ? makeShowcaseBadgeSvg(badge) : makeCompactBadgeSvg(badge)
}

// 인증 배지 발급: 실체는 공개 인증 대장(edusafe-registry)의 기록이고, 배지는 그 기록을
// 가리키는 표시일 뿐이다. 심사 커밋과 다른 코드에는 인증이 적용되지 않는다.
import { RUBRIC_VERSION, TRACKS } from '../data/rubric.js'

export const REGISTRY_URL = 'https://cleveranawim-source.github.io/edusafe-registry'
export const REGISTRY_REPO = 'https://github.com/cleveranawim-source/edusafe-registry'

const ID_PATTERN = /^ES-\d{4}-\d{4}$/

export function isValidCertId(id) {
  return ID_PATTERN.test(id)
}

export function buildCertification({ certId, repoMeta, repoUrl, track, summary, reviewerName, round = 1 }) {
  const issued = new Date()
  const expires = new Date(issued)
  expires.setFullYear(expires.getFullYear() + 1)
  const day = (d) => d.toISOString().slice(0, 10)
  const isLocal = repoMeta.source === 'local'
  const appName = repoMeta.owner ? `${repoMeta.owner}/${repoMeta.repo}` : repoMeta.repo

  const record = {
    id: certId,
    app: { name: appName, repoUrl: isLocal ? null : repoUrl, source: repoMeta.source },
    commitSha: repoMeta.commitSha,
    shaKind: isLocal ? 'content-sha256' : 'git-commit',
    rubricVersion: RUBRIC_VERSION,
    track,
    trackLabel: TRACKS[track].label,
    verdict: '합격',
    score: summary.score,
    round,
    reviewer: reviewerName || null,
    issuedAt: day(issued),
    expiresAt: day(expires),
    status: 'valid',
    note: '심사 커밋(지문) 기준 — 코드 변경 시 재심사 필요. 본 인증은 에듀 세이프 심사 통과 기록이며 법적 효력을 갖는 공인 인증이 아님.',
  }

  const sha7 = (repoMeta.commitSha || '').slice(0, 7)
  const badgeSvg = makeBadgeSvg(certId, sha7)
  const verifyUrl = `${REGISTRY_URL}/#${certId}`
  const badgeUrl = `${REGISTRY_URL}/badges/${certId}.svg`
  const snippetHtml = `<a href="${verifyUrl}" target="_blank" rel="noopener noreferrer"><img src="${badgeUrl}" alt="에듀 세이프 인증 ${certId}" height="24"></a>`
  const snippetMd = `[![에듀 세이프 인증 ${certId}](${badgeUrl})](${verifyUrl})`

  return { record, badgeSvg, verifyUrl, badgeUrl, snippetHtml, snippetMd }
}

// 셔츠 배지 스타일 SVG — 왼쪽 라벨 + 오른쪽 인증번호·커밋. 외부 의존 없는 단일 파일.
export function makeBadgeSvg(certId, sha7) {
  const right = `${certId} · ${sha7}`
  const leftW = 118
  const rightW = Math.round(right.length * 7.2) + 20
  const total = leftW + rightW
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="24" role="img" aria-label="에듀 세이프 인증 ${certId}">
  <rect width="${leftW}" height="24" rx="4" fill="#0a5c50"/>
  <rect x="${leftW - 4}" width="4" height="24" fill="#0a5c50"/>
  <rect x="${leftW}" width="${rightW}" height="24" fill="#e3f2ee"/>
  <rect x="${total - 4}" width="4" height="24" rx="4" fill="#e3f2ee"/>
  <text x="12" y="16" font-family="-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif" font-size="12" font-weight="700" fill="#ffffff">🛡 에듀 세이프 인증</text>
  <text x="${leftW + 10}" y="16" font-family="ui-monospace,Menlo,monospace" font-size="11" fill="#0a5c50">${right}</text>
</svg>`
}

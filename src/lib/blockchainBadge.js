export const BLOCKCHAIN_BADGE_ENABLED = import.meta.env.VITE_BLOCKCHAIN_BADGES_ENABLED === 'true'
export const BLOCKCHAIN_BADGE_API_URL = import.meta.env.VITE_BLOCKCHAIN_BADGE_API_URL || '/api/badges'
export const BLOCKCHAIN_BADGE_VARIANTS = Object.freeze(['compact', 'showcase'])

export class BlockchainBadgeApiError extends Error {
  constructor(code, message, status, details) {
    super(message)
    this.name = 'BlockchainBadgeApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export async function issueBlockchainBadge({ payload, issuanceToken, fetchImpl = fetch, apiUrl = BLOCKCHAIN_BADGE_API_URL }) {
  const response = await fetchImpl(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${issuanceToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  let body
  try {
    body = await response.json()
  } catch {
    throw new BlockchainBadgeApiError('invalid_badge_response', '인증 서버 응답을 읽지 못했습니다.', response.status)
  }
  if (!response.ok) {
    throw new BlockchainBadgeApiError(
      body?.error?.code || 'badge_request_failed',
      body?.error?.message || '가스리스 서명 인증 요청에 실패했습니다.',
      response.status,
      body?.error?.details,
    )
  }
  return body
}

export function buildBadgeLinks(uid, { apiUrl = BLOCKCHAIN_BADGE_API_URL, baseUrl, variant = 'compact' } = {}) {
  if (!BLOCKCHAIN_BADGE_VARIANTS.includes(variant)) {
    throw new TypeError('지원하지 않는 인증마크 디자인입니다.')
  }
  const fallbackBase = baseUrl || (typeof window === 'undefined' ? 'http://localhost' : window.location.href)
  const verify = new URL(apiUrl, fallbackBase)
  verify.searchParams.set('uid', uid)
  const badge = new URL(verify)
  badge.searchParams.set('format', 'svg')
  if (variant !== 'compact') badge.searchParams.set('variant', variant)
  return { verifyUrl: verify.toString(), badgeUrl: badge.toString() }
}

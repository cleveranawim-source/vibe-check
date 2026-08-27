import { describe, expect, it, vi } from 'vitest'

import { handleBadgeHttp } from '../server/badges/http.js'

const ORIGIN = 'https://edusafe.example'
const TOKEN = 'x'.repeat(32)
const UID = `0x${'a'.repeat(64)}`
const config = { allowedOrigins: [ORIGIN], issuanceToken: TOKEN }

function post(headers = {}, body = {}) {
  return new Request('https://api.example/api/badges', {
    method: 'POST',
    headers: { origin: ORIGIN, authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

describe('badge http', () => {
  it('POST는 정확한 origin과 발급 토큰을 요구한다', async () => {
    const service = { issue: vi.fn() }
    const unauthorized = await handleBadgeHttp(post({ authorization: 'Bearer wrong' }), { service, config })
    expect(unauthorized.status).toBe(401)
    expect(service.issue).not.toHaveBeenCalled()

    const foreign = await handleBadgeHttp(post({ origin: 'https://evil.example' }), { service, config })
    expect(foreign.status).toBe(403)
  })

  it('서버 발급 결과를 JSON으로 반환한다', async () => {
    const service = { issue: vi.fn(async () => ({ status: 'issued', uid: UID })) }
    const response = await handleBadgeHttp(post({}, { repositoryUrl: 'https://github.com/o/r' }), { service, config })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'issued', uid: UID })
  })

  it('GET format=svg는 검증된 동적 배지를 반환한다', async () => {
    const service = {
      verify: vi.fn(async () => ({
        status: 'valid', active: true, badgeLevel: 'gold', score: 92, commitSha: 'c'.repeat(40),
      })),
    }
    const response = await handleBadgeHttp(
      new Request(`https://api.example/api/badges?uid=${UID}&format=svg`),
      { service, config },
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('image/svg+xml')
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(await response.text()).toContain('EduSafe gold')
  })
})

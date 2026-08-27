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
    const svg = await response.text()
    expect(svg).toContain('EduSafe gold')
    expect(svg).toContain('height="24"')
    expect(svg).not.toContain('height="112"')
  })

  it('GET SVG의 기본값과 compact는 같은 기존 배지를 반환한다', async () => {
    const verified = {
      status: 'valid', active: true, badgeLevel: 'gold', score: 100, commitSha: 'c'.repeat(40),
    }
    const service = { verify: vi.fn(async () => verified) }

    const defaults = await handleBadgeHttp(
      new Request(`https://api.example/api/badges?uid=${UID}&format=svg`),
      { service, config },
    )
    const compact = await handleBadgeHttp(
      new Request(`https://api.example/api/badges?uid=${UID}&format=svg&variant=compact`),
      { service, config },
    )

    expect(defaults.status).toBe(200)
    expect(compact.status).toBe(200)
    expect(await compact.text()).toBe(await defaults.text())
  })

  it.each([
    { badgeLevel: 'gold', score: 100, label: 'Gold' },
    { badgeLevel: 'silver', score: 80, label: 'Silver' },
  ])('GET variant=showcase는 $score점 $label 대형 배지를 반환한다', async ({ badgeLevel, score, label }) => {
    const service = {
      verify: vi.fn(async () => ({
        status: 'valid', active: true, badgeLevel, score, commitSha: 'c'.repeat(40),
      })),
    }
    const response = await handleBadgeHttp(
      new Request(`https://api.example/api/badges?uid=${UID}&format=svg&variant=showcase`),
      { service, config },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('image/svg+xml')
    const svg = await response.text()
    expect(svg).toContain('width="360"')
    expect(svg).toContain('height="112"')
    expect(svg).toContain(`${score}점`)
    expect(svg).toMatch(new RegExp(`EduSafe ${label}`, 'i'))
  })

  it('compact Silver는 기존 색상을 유지한다', async () => {
    const service = {
      verify: vi.fn(async () => ({
        status: 'valid', active: true, badgeLevel: 'silver', score: 80, commitSha: 'd'.repeat(40),
      })),
    }
    const response = await handleBadgeHttp(
      new Request(`https://api.example/api/badges?uid=${UID}&format=svg`),
      { service, config },
    )
    const svg = await response.text()
    expect(svg).toContain('#0a5c50')
    expect(svg).toContain('#e3f2ee')
  })

  it.each([
    { status: 'revoked', label: '취소' },
    { status: 'expired', label: '만료' },
    { status: 'invalid', label: '확인 필요' },
  ])('showcase $status 상태는 유효 마크처럼 표시하지 않는다', async ({ status, label }) => {
    const service = {
      verify: vi.fn(async () => ({
        status, active: false, badgeLevel: 'gold', score: 100, commitSha: 'c'.repeat(40),
      })),
    }
    const response = await handleBadgeHttp(
      new Request(`https://api.example/api/badges?uid=${UID}&format=svg&variant=showcase`),
      { service, config },
    )
    const svg = await response.text()
    expect(svg).toContain('검증 필요')
    expect(svg).toContain(label)
    expect(svg).toContain('서명 상태 확인이 필요합니다')
    expect(svg).not.toContain('EduSafe가 발급한')
  })

  it('GET SVG는 허용하지 않은 variant를 거절한다', async () => {
    const service = {
      verify: vi.fn(async () => ({
        status: 'valid', active: true, badgeLevel: 'gold', score: 100, commitSha: 'c'.repeat(40),
      })),
    }
    const response = await handleBadgeHttp(
      new Request(`https://api.example/api/badges?uid=${UID}&format=svg&variant=wide`),
      { service, config },
    )

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      error: { code: 'invalid_badge_variant' },
    })
    expect(service.verify).not.toHaveBeenCalled()
  })
})

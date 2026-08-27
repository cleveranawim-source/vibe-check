import { describe, expect, it, vi } from 'vitest'

import { buildBadgeLinks, issueBlockchainBadge } from '../src/lib/blockchainBadge.js'

const UID = `0x${'a'.repeat(64)}`

describe('blockchain badge client', () => {
  it('발급 토큰과 판정 payload를 API에 전달한다', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ status: 'issued', uid: UID }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    const result = await issueBlockchainBadge({
      payload: { repositoryUrl: 'https://github.com/o/r', commitSha: 'a'.repeat(40) },
      issuanceToken: 'token',
      fetchImpl,
      apiUrl: 'https://api.example/badges',
    })
    expect(result.uid).toBe(UID)
    expect(fetchImpl).toHaveBeenCalledOnce()
    const [, options] = fetchImpl.mock.calls[0]
    expect(options.headers.Authorization).toBe('Bearer token')
  })

  it('UID로 검증·SVG 주소를 만든다', () => {
    const links = buildBadgeLinks(UID, { apiUrl: '/api/badges', baseUrl: 'https://edusafe.example/report' })
    expect(links.verifyUrl).toBe(`https://edusafe.example/api/badges?uid=${UID}`)
    expect(links.badgeUrl).toBe(`https://edusafe.example/api/badges?uid=${UID}&format=svg`)
  })

  it('기본값과 compact는 기존 주소를 유지하고 showcase만 variant를 추가한다', () => {
    const options = { apiUrl: '/api/badges', baseUrl: 'https://edusafe.example/report' }
    const defaults = buildBadgeLinks(UID, options)
    const compact = buildBadgeLinks(UID, { ...options, variant: 'compact' })
    const showcase = buildBadgeLinks(UID, { ...options, variant: 'showcase' })

    expect(compact).toEqual(defaults)
    expect(defaults.badgeUrl).not.toContain('variant=')
    expect(showcase.verifyUrl).toBe(defaults.verifyUrl)
    expect(showcase.badgeUrl).toBe(`${defaults.badgeUrl}&variant=showcase`)
  })

  it('허용하지 않은 배지 variant는 URL에 반영하지 않고 거절한다', () => {
    expect(() => buildBadgeLinks(UID, {
      apiUrl: '/api/badges',
      baseUrl: 'https://edusafe.example/report',
      variant: 'wide',
    })).toThrow(TypeError)
  })
})

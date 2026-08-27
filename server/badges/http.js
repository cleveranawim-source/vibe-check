import { timingSafeEqual } from 'node:crypto'

import { asBadgeError, BadgeError } from './errors.js'
import { makeBlockchainBadgeSvg } from './svg.js'

const MAX_BODY_BYTES = 64 * 1024

function json(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  })
}

function allowedOrigin(request, config) {
  const origin = request.headers.get('origin')
  if (!origin || !config.allowedOrigins.includes(origin)) {
    throw new BadgeError(403, 'origin_rejected', '허용되지 않은 요청 출처입니다.')
  }
  return origin
}

function safeTokenEqual(actual, expected) {
  const a = Buffer.from(actual || '')
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

function authorize(request, config) {
  const match = /^Bearer (.+)$/.exec(request.headers.get('authorization') || '')
  if (!match || !safeTokenEqual(match[1], config.issuanceToken)) {
    throw new BadgeError(401, 'issuance_unauthorized', '인증마크 발급 권한을 확인할 수 없습니다.')
  }
}

async function readJson(request) {
  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new BadgeError(413, 'request_too_large', '발급 요청이 너무 큽니다.')
  }
  const raw = await request.text()
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    throw new BadgeError(413, 'request_too_large', '발급 요청이 너무 큽니다.')
  }
  try {
    return JSON.parse(raw)
  } catch {
    throw new BadgeError(400, 'invalid_json', 'JSON 요청 형식이 올바르지 않습니다.')
  }
}

export async function handleBadgeHttp(request, { service, config }) {
  let corsOrigin = null
  try {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') {
      const origin = allowedOrigin(request, config)
      corsOrigin = origin
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          Vary: 'Origin',
        },
      })
    }
    if (request.method === 'POST') {
      const origin = allowedOrigin(request, config)
      corsOrigin = origin
      authorize(request, config)
      if (request.headers.get('content-type')?.split(';', 1)[0] !== 'application/json') {
        throw new BadgeError(415, 'json_required', '발급 요청은 application/json이어야 합니다.')
      }
      const result = await service.issue(await readJson(request))
      const status = ['submitting', 'submitted', 'submission_unknown'].includes(result.status) ? 202 : 200
      return json(result, status, { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' })
    }
    if (request.method === 'GET') {
      const uid = url.searchParams.get('uid') || ''
      const result = await service.verify(uid)
      if (url.searchParams.get('format') === 'svg') {
        return new Response(makeBlockchainBadgeSvg(result), {
          status: 200,
          headers: {
            'Content-Type': 'image/svg+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=60',
            'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; sandbox",
            'X-Content-Type-Options': 'nosniff',
            'X-Badge-Status': result.status,
            'Access-Control-Allow-Origin': '*',
          },
        })
      }
      return json(result, 200, { 'Access-Control-Allow-Origin': '*' })
    }
    return json({ error: { code: 'method_not_allowed', message: '지원하지 않는 요청 방식입니다.' } }, 405, { Allow: 'GET, POST, OPTIONS' })
  } catch (error) {
    const safe = asBadgeError(error)
    return json({
      error: {
        code: safe.code,
        message: safe.message,
        ...(safe.status < 500 && safe.details ? { details: safe.details } : {}),
      },
    }, safe.status, corsOrigin ? { 'Access-Control-Allow-Origin': corsOrigin, Vary: 'Origin' } : {})
  }
}

export { MAX_BODY_BYTES }

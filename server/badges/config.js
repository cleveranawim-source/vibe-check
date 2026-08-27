import { getAddress, isHexString } from 'ethers'

import {
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_EAS_ADDRESS,
  EAS_BADGE_SCHEMA_UID,
  ZERO_ADDRESS,
  ZERO_BYTES32,
} from './constants.js'
import { BadgeError } from './errors.js'

const PRIVATE_KEY = /^0x[0-9a-f]{64}$/i

function required(env, name, minimumLength = 1) {
  const value = env[name]
  if (typeof value !== 'string' || value.trim().length < minimumLength) {
    throw new BadgeError(503, 'badge_server_misconfigured', `${name} 환경변수가 필요합니다.`)
  }
  return value.trim()
}

function parseUrl(value, name, { allowLocalHttp = false } = {}) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new BadgeError(503, 'badge_server_misconfigured', `${name} 주소가 올바르지 않습니다.`)
  }
  const localHttp = allowLocalHttp && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !localHttp) {
    throw new BadgeError(503, 'badge_server_misconfigured', `${name}은 HTTPS 주소여야 합니다.`)
  }
  return url
}

function parseOrigins(value, allowLocalHttp) {
  const origins = [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean).map((item) => {
    const url = parseUrl(item, 'BADGE_ALLOWED_ORIGINS', { allowLocalHttp })
    if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
      throw new BadgeError(503, 'badge_server_misconfigured', '허용 Origin에는 경로·쿼리·인증정보를 넣을 수 없습니다.')
    }
    return url.origin
  }))]
  if (origins.length === 0) {
    throw new BadgeError(503, 'badge_server_misconfigured', '허용 Origin을 하나 이상 설정해야 합니다.')
  }
  return origins
}

export function parseBadgeConfig(env = process.env, { requireIssuer = true } = {}) {
  const environment = env.VERCEL_ENV || env.NODE_ENV || 'development'
  const allowLocalHttp = environment === 'development' || environment === 'test'
  const chainId = BigInt(env.EAS_CHAIN_ID || BASE_SEPOLIA_CHAIN_ID)
  if (chainId !== BASE_SEPOLIA_CHAIN_ID) {
    throw new BadgeError(503, 'badge_server_misconfigured', '과제용 발급 네트워크는 Base Sepolia(84532)만 허용합니다.')
  }

  const databaseUrl = required(env, 'DATABASE_URL')
  let database
  try {
    database = new URL(databaseUrl)
  } catch {
    throw new BadgeError(503, 'badge_server_misconfigured', 'DATABASE_URL 주소가 올바르지 않습니다.')
  }
  if (!['postgres:', 'postgresql:'].includes(database.protocol)) {
    throw new BadgeError(503, 'badge_server_misconfigured', 'DATABASE_URL은 PostgreSQL 주소여야 합니다.')
  }
  if (!allowLocalHttp && !['require', 'verify-full'].includes(database.searchParams.get('sslmode'))) {
    throw new BadgeError(503, 'badge_server_misconfigured', '운영 DATABASE_URL에는 sslmode=require 또는 verify-full이 필요합니다.')
  }

  const rpcUrl = parseUrl(required(env, 'EAS_RPC_URL'), 'EAS_RPC_URL', { allowLocalHttp }).toString()
  const schemaUid = required(env, 'EAS_SCHEMA_UID')
  if (!isHexString(schemaUid, 32) || schemaUid.toLowerCase() === ZERO_BYTES32) {
    throw new BadgeError(503, 'badge_server_misconfigured', 'EAS_SCHEMA_UID는 bytes32 형식이어야 합니다.')
  }
  if (schemaUid.toLowerCase() !== EAS_BADGE_SCHEMA_UID) {
    throw new BadgeError(503, 'badge_server_misconfigured', 'EAS_SCHEMA_UID가 현재 인증 데이터 스키마와 일치하지 않습니다.')
  }
  let attesterAddress
  try {
    attesterAddress = getAddress(required(env, 'EAS_ATTESTER_ADDRESS'))
    if (attesterAddress === ZERO_ADDRESS) throw new Error('zero address')
  } catch {
    throw new BadgeError(503, 'badge_server_misconfigured', 'EAS_ATTESTER_ADDRESS가 올바르지 않습니다.')
  }
  const privateKey = typeof env.EAS_ATTESTER_PRIVATE_KEY === 'string'
    ? env.EAS_ATTESTER_PRIVATE_KEY.trim()
    : ''
  if (requireIssuer && (!PRIVATE_KEY.test(privateKey) || BigInt(privateKey) === 0n)) {
    throw new BadgeError(503, 'badge_server_misconfigured', 'EAS_ATTESTER_PRIVATE_KEY 형식이 올바르지 않습니다.')
  }

  const allowedOrigins = requireIssuer
    ? Object.freeze(parseOrigins(required(env, 'BADGE_ALLOWED_ORIGINS'), allowLocalHttp))
    : Object.freeze([])
  const issuanceToken = requireIssuer ? required(env, 'BADGE_ISSUANCE_TOKEN', 32) : null

  return Object.freeze({
    environment,
    databaseUrl,
    allowedOrigins,
    issuanceToken,
    chainId,
    rpcUrl,
    easAddress: BASE_SEPOLIA_EAS_ADDRESS,
    schemaUid: schemaUid.toLowerCase(),
    attesterAddress,
    privateKey: requireIssuer ? privateKey : null,
    issuerEnabled: requireIssuer,
    confirmations: 1,
  })
}

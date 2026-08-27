import { describe, expect, it } from 'vitest'

import { parseBadgeConfig } from '../server/badges/config.js'
import { EAS_BADGE_SCHEMA_UID } from '../server/badges/constants.js'

const PRIVATE_KEY = `0x${'11'.repeat(32)}`
const ATTESTER_ADDRESS = '0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A'

const base = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/edusafe',
  EAS_SCHEMA_UID: EAS_BADGE_SCHEMA_UID,
  EAS_ATTESTER_ADDRESS: ATTESTER_ADDRESS,
}

const issuer = {
  ...base,
  BADGE_ALLOWED_ORIGINS: 'http://localhost:5173',
  BADGE_ISSUANCE_TOKEN: 'x'.repeat(32),
  EAS_ATTESTER_PRIVATE_KEY: PRIVATE_KEY,
}

describe('badge config', () => {
  it('RPC·발급 개인키·토큰 없이 공개 검증 설정을 읽을 수 있다', () => {
    const config = parseBadgeConfig(base, { requireIssuer: false })
    expect(config).toMatchObject({
      privateKey: null,
      issuanceToken: null,
      issuerEnabled: false,
      attesterAddress: ATTESTER_ADDRESS,
    })
    expect(config).not.toHaveProperty('rpcUrl')
  })

  it('advisory lock을 위해 unpooled PostgreSQL 주소를 우선 사용한다', () => {
    const config = parseBadgeConfig({
      ...base,
      DATABASE_URL_UNPOOLED: 'postgresql://postgres:postgres@localhost:5432/edusafe_direct',
    }, { requireIssuer: false })
    expect(config.databaseUrl).toContain('/edusafe_direct')
  })

  it('발급 설정은 승인 토큰과 개인키를 요구한다', () => {
    expect(() => parseBadgeConfig({
      ...base,
      BADGE_ALLOWED_ORIGINS: 'http://localhost:5173',
      BADGE_ISSUANCE_TOKEN: 'x'.repeat(32),
    })).toThrowError(/EAS_ATTESTER_PRIVATE_KEY/)

    expect(parseBadgeConfig(issuer)).toMatchObject({
      issuerEnabled: true,
      issuanceToken: 'x'.repeat(32),
      privateKey: PRIVATE_KEY,
      attesterAddress: ATTESTER_ADDRESS,
    })
  })

  it('발급 개인키와 공개 발급자 주소가 다르면 fail-closed한다', () => {
    expect(() => parseBadgeConfig({
      ...issuer,
      EAS_ATTESTER_PRIVATE_KEY: `0x${'22'.repeat(32)}`,
    })).toThrowError(/PRIVATE_KEY.*ADDRESS.*일치하지 않습니다/)
  })

  it('현재 데이터 계약과 다른 schema UID는 거절한다', () => {
    expect(() => parseBadgeConfig({
      ...base,
      EAS_SCHEMA_UID: `0x${'f'.repeat(64)}`,
    }, { requireIssuer: false })).toThrowError(/스키마/)
  })
})

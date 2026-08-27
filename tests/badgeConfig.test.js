import { describe, expect, it } from 'vitest'

import { parseBadgeConfig } from '../server/badges/config.js'
import { EAS_BADGE_SCHEMA_UID } from '../server/badges/constants.js'

const base = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/edusafe',
  EAS_RPC_URL: 'http://localhost:8545',
  EAS_SCHEMA_UID: EAS_BADGE_SCHEMA_UID,
  EAS_ATTESTER_ADDRESS: `0x${'1'.repeat(40)}`,
}

describe('badge config', () => {
  it('공개 검증 설정은 발급 개인키와 토큰 없이 읽을 수 있다', () => {
    expect(parseBadgeConfig({ ...base, EAS_ATTESTER_PRIVATE_KEY: `0x${'2'.repeat(64)}` }, { requireIssuer: false })).toMatchObject({
      privateKey: null,
      issuanceToken: null,
      issuerEnabled: false,
    })
  })

  it('발급 설정은 승인 토큰과 개인키를 요구한다', () => {
    expect(() => parseBadgeConfig(base)).toThrowError(/EAS_ATTESTER_PRIVATE_KEY/)
    expect(parseBadgeConfig({
      ...base,
      BADGE_ALLOWED_ORIGINS: 'http://localhost:5173',
      BADGE_ISSUANCE_TOKEN: 'x'.repeat(32),
      EAS_ATTESTER_PRIVATE_KEY: `0x${'2'.repeat(64)}`,
    })).toMatchObject({ issuerEnabled: true, issuanceToken: 'x'.repeat(32) })
  })

  it('현재 데이터 계약과 다른 schema UID는 거절한다', () => {
    expect(() => parseBadgeConfig({ ...base, EAS_SCHEMA_UID: `0x${'f'.repeat(64)}` }, { requireIssuer: false }))
      .toThrowError(/스키마/)
  })
})

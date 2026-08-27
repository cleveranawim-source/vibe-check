import { verifyTypedData } from 'ethers'
import { describe, expect, it } from 'vitest'

import {
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_EAS_ADDRESS,
  EAS_BADGE_SCHEMA,
  EAS_BADGE_SCHEMA_UID,
  ZERO_ADDRESS,
  ZERO_BYTES32,
} from '../server/badges/constants.js'
import {
  EAS_OFFCHAIN_TYPES,
  computeOffchainUid,
  computeSchemaUid,
  createEasGateway,
  decodeBadgeData,
  encodeBadgeData,
  makeOffchainDomain,
} from '../server/badges/easGateway.js'

const HEX = (char) => `0x${char.repeat(64)}`
const PRIVATE_KEY = `0x${'11'.repeat(32)}`
const ATTESTER_ADDRESS = '0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A'
const FIXED_SALT = `0x${'ab'.repeat(32)}`

const gatewayConfig = Object.freeze({
  chainId: BASE_SEPOLIA_CHAIN_ID,
  easAddress: BASE_SEPOLIA_EAS_ADDRESS,
  schemaUid: EAS_BADGE_SCHEMA_UID,
  attesterAddress: ATTESTER_ADDRESS,
  trustedAttesterAddresses: Object.freeze([ATTESTER_ADDRESS]),
  privateKey: PRIVATE_KEY,
})

const badgeInput = Object.freeze({
  subjectKey: HEX('1'),
  repositoryId: '900719925474099312345',
  repositoryUrl: 'https://github.com/example/app',
  commitSha: 'a'.repeat(40),
  reportHash: HEX('2'),
  score: 95,
  badgeLevelCode: 3,
  policyHash: HEX('3'),
  policyVersion: '1.0.0',
  rulesetVersion: '1.0.0',
  signedAt: '1700000000',
  expirationTime: '0',
})

describe('gasless EAS badge proof', () => {
  it('등록 스키마 UID가 결정적이고 bytes32이다', () => {
    expect(ZERO_ADDRESS).toHaveLength(42)
    const first = computeSchemaUid(EAS_BADGE_SCHEMA)
    const second = computeSchemaUid(EAS_BADGE_SCHEMA)
    expect(first).toBe(second)
    expect(first).toBe(EAS_BADGE_SCHEMA_UID)
    expect(first).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('공식 EAS offchain Version2 고정 벡터와 UID·서명이 일치한다', () => {
    // EAS SDK Offchain.getOffchainUID(Version2)의 필드 순서와 EIP-712 Attest 타입을 고정한다.
    const message = {
      version: 2,
      schema: EAS_BADGE_SCHEMA_UID,
      recipient: ZERO_ADDRESS,
      time: 1700000000n,
      expirationTime: 0n,
      revocable: true,
      refUID: ZERO_BYTES32,
      data: '0x1234',
      salt: FIXED_SALT,
    }
    const signature = '0x672bb3d0010925f235ef3f20bb592ae9cd06f5c4add0c2d4246d326fab5b2f6317011d8e1cafab123ca06ba7a5228271825ae213f4acb8d789be2b38dda13a4e1b'

    expect(computeOffchainUid(message)).toBe(
      '0x9eae8b303e284e7fed3ab7b895c0cdacc642b7f4c441ea85ae0bddf24b2c2192',
    )
    expect(verifyTypedData(makeOffchainDomain(gatewayConfig), EAS_OFFCHAIN_TYPES, message, signature))
      .toBe(ATTESTER_ADDRESS)
  })

  it('인증 payload를 순서와 타입 그대로 encode/decode한다', () => {
    const decoded = decodeBadgeData(encodeBadgeData(badgeInput))
    expect(decoded).toMatchObject({
      subjectKey: HEX('1'),
      repositoryId: '900719925474099312345',
      repositoryUrl: 'https://github.com/example/app',
      commitOid: 'a'.repeat(40),
      score: 95,
      badgeLevel: 3,
      policyVersion: '1.0.0',
      rulesetVersion: '1.0.0',
    })
  })

  it('RPC나 트랜잭션 없이 결정적 서명을 발급하고 로컬 검증한다', async () => {
    const gateway = createEasGateway(gatewayConfig, {
      randomBytesImpl: () => new Uint8Array(32).fill(0xab),
    })
    const proof = await gateway.issue(badgeInput)

    expect(gatewayConfig).not.toHaveProperty('rpcUrl')
    expect(proof).toMatchObject({
      uid: '0x366518b0d7a3afec07fc6411bc3150a4172874227dd7cbbf2964b7e4a274d43f',
      signature: '0xedf9580f226307f07a1003114e807689cea1509896281a1f77cf2a84c88b83d638f0c61966298484f0b9bea159eeb2ce91f36ab53255e8130eb27b19903d1dba1c',
      salt: FIXED_SALT,
      signedAt: '1700000000',
      expirationTime: '0',
      easVersion: 2,
      domainVersion: '1.2.0',
    })

    const verification = gateway.verify({
      ...proof,
      chainId: String(BASE_SEPOLIA_CHAIN_ID),
      easAddress: BASE_SEPOLIA_EAS_ADDRESS,
      schemaUid: EAS_BADGE_SCHEMA_UID,
      attesterAddress: ATTESTER_ADDRESS,
    }, 1700000001000)
    expect(verification).toMatchObject({
      active: true,
      uidMatches: true,
      signatureValid: true,
      trustedDomain: true,
      trustedAttester: true,
      expired: false,
      proof: {
        scheme: 'eas-offchain-v2',
        version: 2,
        signature: { v: expect.any(Number), r: expect.any(String), s: expect.any(String) },
        rawSignature: proof.signature,
      },
    })
    expect(verification.data.repositoryId).toBe('900719925474099312345')
  })

  it('발급 키와 공개 발급자 주소가 다르면 fail-closed한다', async () => {
    const gateway = createEasGateway({
      ...gatewayConfig,
      attesterAddress: `0x${'2'.repeat(40)}`,
    }, {
      randomBytesImpl: () => new Uint8Array(32).fill(0xab),
    })

    await expect(gateway.issue(badgeInput)).rejects.toMatchObject({
      status: 503,
      code: 'wrong_attester_key',
    })
  })
})

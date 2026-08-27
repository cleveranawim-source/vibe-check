import { Interface } from 'ethers'
import { describe, expect, it } from 'vitest'

import {
  EAS_BADGE_SCHEMA,
  EAS_BADGE_SCHEMA_UID,
  BASE_SEPOLIA_EAS_ADDRESS,
  ZERO_ADDRESS,
} from '../server/badges/constants.js'
import { EAS_ABI, computeSchemaUid, decodeBadgeData, encodeBadgeData, uidFromReceipt } from '../server/badges/easGateway.js'

const HEX = (char) => `0x${char.repeat(64)}`

describe('EAS badge contract', () => {
  it('스키마 UID가 결정적이고 bytes32이다', () => {
    expect(ZERO_ADDRESS).toHaveLength(42)
    const first = computeSchemaUid(EAS_BADGE_SCHEMA)
    const second = computeSchemaUid(EAS_BADGE_SCHEMA)
    expect(first).toBe(second)
    expect(first).toBe(EAS_BADGE_SCHEMA_UID)
    expect(first).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('온체인 payload를 순서와 타입 그대로 encode/decode한다', () => {
    const encoded = encodeBadgeData({
      subjectKey: HEX('1'),
      repositoryId: '123456789',
      repositoryUrl: 'https://github.com/example/app',
      commitSha: 'a'.repeat(40),
      reportHash: HEX('2'),
      score: 95,
      badgeLevelCode: 3,
      policyHash: HEX('3'),
      rulesetVersion: '1.0.0',
    })
    const decoded = decodeBadgeData(encoded)
    expect(decoded).toMatchObject({
      subjectKey: HEX('1'),
      repositoryId: '123456789',
      repositoryUrl: 'https://github.com/example/app',
      commitOid: 'a'.repeat(40),
      score: 95,
      badgeLevel: 3,
      rulesetVersion: '1.0.0',
    })
  })

  it('큰 GitHub 저장소 ID를 정밀도 손실 없이 문자열로 복원한다', () => {
    const repositoryId = '900719925474099312345'
    const decoded = decodeBadgeData(encodeBadgeData({
      subjectKey: HEX('1'),
      repositoryId,
      repositoryUrl: 'https://github.com/example/app',
      commitSha: 'a'.repeat(40),
      reportHash: HEX('2'),
      score: 95,
      badgeLevelCode: 3,
      policyHash: HEX('3'),
      rulesetVersion: '1.0.0',
    }))
    expect(decoded.repositoryId).toBe(repositoryId)
  })

  it('공식 EAS·schema·attester의 Attested event만 UID로 채택한다', () => {
    const uid = HEX('4')
    const attesterAddress = `0x${'1'.repeat(40)}`
    const iface = new Interface(EAS_ABI)
    const encoded = iface.encodeEventLog(iface.getEvent('Attested'), [
      ZERO_ADDRESS,
      attesterAddress,
      uid,
      EAS_BADGE_SCHEMA_UID,
    ])
    const receipt = { logs: [{ address: BASE_SEPOLIA_EAS_ADDRESS, topics: encoded.topics, data: encoded.data }] }
    const contract = { interface: iface }
    const expected = { easAddress: BASE_SEPOLIA_EAS_ADDRESS, schemaUid: EAS_BADGE_SCHEMA_UID, attesterAddress }

    expect(uidFromReceipt(contract, receipt, expected)).toBe(uid)
    expect(uidFromReceipt(contract, { logs: [{ ...receipt.logs[0], address: ZERO_ADDRESS }] }, expected)).toBeNull()
  })
})

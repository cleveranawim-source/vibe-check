import { Wallet } from 'ethers'
import { describe, expect, it, vi } from 'vitest'

import {
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_EAS_ADDRESS,
  EAS_BADGE_SCHEMA_UID,
} from '../server/badges/constants.js'
import { createEasGateway } from '../server/badges/easGateway.js'
import { BadgeService, parseIssueInput } from '../server/badges/service.js'

const UID = `0x${'a'.repeat(64)}`
const ADDRESS = `0x${'1'.repeat(40)}`
const SIGNATURE = `0x${'2'.repeat(130)}`
const SALT = `0x${'3'.repeat(64)}`
const INPUT = {
  repositoryUrl: 'https://github.com/example/app',
  commitSha: 'c'.repeat(40),
}

function fixture({ scanScore = 100, critical = 0, coverageComplete = true, hasApplicationSource = true } = {}) {
  return {
    result: {
      repositoryId: '12345',
      canonicalUrl: INPUT.repositoryUrl,
      commitSha: INPUT.commitSha,
      coverageComplete,
      hasApplicationSource,
    },
    scanResult: { findings: [] },
    scanGrade: { score: scanScore, counts: { critical, warning: 0, info: 0 } },
  }
}

function proof(overrides = {}) {
  return {
    uid: UID,
    signature: SIGNATURE,
    salt: SALT,
    encodedData: '0x1234',
    signedAt: String(Date.parse('2026-08-27T00:00:00.000Z') / 1000),
    expirationTime: '0',
    easVersion: 2,
    domainVersion: '1.2.0',
    ...overrides,
  }
}

function issuedRecord(overrides = {}) {
  return {
    id: 'badge-1',
    subjectKey: `0x${'d'.repeat(64)}`,
    repositoryUrl: INPUT.repositoryUrl,
    commitSha: INPUT.commitSha,
    repositoryId: '12345',
    score: 100,
    badgeLevel: 'gold',
    policyVersion: '1.0.0',
    reportHash: `0x${'e'.repeat(64)}`,
    policyHash: `0x${'f'.repeat(64)}`,
    rulesetVersion: '1.0.0',
    chainId: String(BASE_SEPOLIA_CHAIN_ID),
    easAddress: BASE_SEPOLIA_EAS_ADDRESS,
    schemaUid: EAS_BADGE_SCHEMA_UID,
    attesterAddress: ADDRESS,
    revokedAt: null,
    ...proof(),
    ...overrides,
  }
}

function verifiedAttestation(seed) {
  return {
    active: true,
    expired: false,
    signatureValid: true,
    uidMatches: true,
    trustedDomain: true,
    trustedAttester: true,
    recoveredAttester: seed.attesterAddress,
    proof: { scheme: 'eas-offchain-v2', uid: seed.uid },
    data: {
      subjectKey: seed.subjectKey,
      repositoryId: seed.repositoryId,
      repositoryUrl: seed.repositoryUrl,
      commitOid: seed.commitSha,
      reportHash: seed.reportHash,
      score: seed.score,
      badgeLevel: 3,
      policyHash: seed.policyHash,
      policyVersion: seed.policyVersion,
      rulesetVersion: seed.rulesetVersion,
    },
  }
}

function memoryRepository(existingRecord = null) {
  let record = existingRecord
  return {
    findBySubjectKey: vi.fn(async () => record),
    saveIssued: vi.fn(async (snapshot, signedProof) => {
      if (record) return { action: 'existing', record }
      record = { id: 'badge-1', revokedAt: null, ...snapshot, ...signedProof }
      return { action: 'created', record }
    }),
    findByUid: vi.fn(async (uid) => record?.uid.toLowerCase() === uid.toLowerCase() ? record : null),
    replaceRecord(nextRecord) {
      record = nextRecord
    },
    currentRecord() {
      return record
    },
  }
}

function makeService({ loaded = fixture(), repository = memoryRepository(), easGateway, attesterAddress = ADDRESS } = {}) {
  const gateway = easGateway || {
    issue: vi.fn(async () => proof()),
    verify: vi.fn((record) => verifiedAttestation(record)),
  }
  return {
    repository,
    gateway,
    service: new BadgeService({
      repository,
      easGateway: gateway,
      repositoryLoader: vi.fn(async () => loaded),
      now: () => Date.parse('2026-08-27T00:00:00.000Z'),
      attesterAddress,
    }),
  }
}

describe('badge service', () => {
  it('클라이언트가 점수를 보내면 거절한다', () => {
    expect(() => parseIssueInput({ ...INPUT, score: 100 })).toThrowError(/점수/)
    expect(() => parseIssueInput({ ...INPUT, decisions: { R: 'pass' } })).toThrowError(/점수/)
    expect(() => parseIssueInput({ ...INPUT, signature: SIGNATURE })).toThrowError(/서버가 직접 계산/)
  })

  it('GitHub 저장소 루트 HTTPS 주소만 허용한다', () => {
    expect(() => parseIssueInput({ ...INPUT, repositoryUrl: 'https://github.com:444/example/app' })).toThrowError(/github\.com/)
    expect(() => parseIssueInput({ ...INPUT, repositoryUrl: 'https://github.com/example/app/tree/main' })).toThrowError(/루트/)
    expect(() => parseIssueInput({ repositoryUrl: 'DEMO100', commitSha: 'DEMO-ONLY' })).toThrowError(/GitHub 저장소 주소/)
    expect(() => parseIssueInput({ repositoryUrl: 'DEMO80', commitSha: 'DEMO80-ONLY' })).toThrowError(/GitHub 저장소 주소/)
    expect(() => parseIssueInput({ ...INPUT, demoOnly: true })).toThrowError(/서버가 직접 계산/)
  })

  it('서버 재계산 결과가 통과하면 가스 없이 서명하고 발급 결과를 저장한다', async () => {
    const { service, repository, gateway } = makeService()
    const result = await service.issue(INPUT)

    expect(result).toMatchObject({
      status: 'issued',
      credentialType: 'eas-offchain-v2',
      onchain: false,
      gasFee: '0',
      uid: UID,
      score: 100,
      badgeLevel: 'gold',
      reused: false,
    })
    expect(result).not.toHaveProperty('txHash')
    expect(repository.findBySubjectKey).toHaveBeenCalledOnce()
    expect(repository.saveIssued).toHaveBeenCalledOnce()
    expect(gateway.issue).toHaveBeenCalledOnce()
  })

  it('Critical, 불완전 소스 또는 앱 소스 부재이면 DB·서명 호출 없이 미발급한다', async () => {
    const critical = makeService({ loaded: fixture({ scanScore: 100, critical: 1 }) })
    const criticalResult = await critical.service.issue(INPUT)
    expect(criticalResult.status).toBe('not_eligible')
    expect(critical.repository.findBySubjectKey).not.toHaveBeenCalled()
    expect(critical.gateway.issue).not.toHaveBeenCalled()

    const partial = makeService({ loaded: fixture({ coverageComplete: false }) })
    const partialResult = await partial.service.issue(INPUT)
    expect(partialResult.eligibility.reasonCodes).toContain('SOURCE_COVERAGE_INCOMPLETE')
    expect(partial.repository.findBySubjectKey).not.toHaveBeenCalled()

    const empty = makeService({ loaded: fixture({ hasApplicationSource: false }) })
    const emptyResult = await empty.service.issue(INPUT)
    expect(emptyResult.eligibility.reasonCodes).toContain('APPLICATION_SOURCE_MISSING')
    expect(empty.repository.findBySubjectKey).not.toHaveBeenCalled()
  })

  it('이미 발급된 동일 snapshot은 기존 UID를 재사용하고 다시 서명하지 않는다', async () => {
    const repository = memoryRepository()
    const built = makeService({ repository })

    const first = await built.service.issue(INPUT)
    const second = await built.service.issue(INPUT)

    expect(first).toMatchObject({ status: 'issued', uid: UID, reused: false })
    expect(second).toMatchObject({ status: 'issued', uid: UID, reused: true })
    expect(built.gateway.issue).toHaveBeenCalledOnce()
    expect(repository.saveIssued).toHaveBeenCalledOnce()
  })

  it('기존 인증과 현재 서버 재검사 snapshot이 다르면 오래된 인증을 재사용하지 않는다', async () => {
    const repository = memoryRepository(issuedRecord({ reportHash: `0x${'9'.repeat(64)}` }))
    const built = makeService({ repository })

    await expect(built.service.issue(INPUT)).rejects.toMatchObject({
      status: 409,
      code: 'badge_snapshot_conflict',
    })
    expect(built.gateway.issue).not.toHaveBeenCalled()
  })

  it('동시 저장 경쟁에서 다른 요청이 먼저 만든 인증을 반환하면 그 UID를 재사용한다', async () => {
    const winner = issuedRecord({ uid: `0x${'9'.repeat(64)}` })
    const repository = {
      findBySubjectKey: vi.fn(async () => null),
      saveIssued: vi.fn(async () => ({ action: 'existing', record: winner })),
      findByUid: vi.fn(),
    }
    const gateway = {
      issue: vi.fn(async () => proof()),
      verify: vi.fn((record) => verifiedAttestation(record)),
    }
    const { service } = makeService({ repository, easGateway: gateway })

    const result = await service.issue(INPUT)

    expect(result).toMatchObject({ status: 'issued', uid: winner.uid, reused: true })
    expect(repository.saveIssued).toHaveBeenCalledOnce()
  })

  it('서명된 payload와 저장 snapshot이 달라지면 서명 자체가 유효해도 invalid로 닫는다', async () => {
    const privateKey = `0x${'11'.repeat(32)}`
    const signer = new Wallet(privateKey)
    const gateway = createEasGateway({
      privateKey,
      attesterAddress: signer.address,
      trustedAttesterAddresses: [signer.address],
      chainId: BASE_SEPOLIA_CHAIN_ID,
      easAddress: BASE_SEPOLIA_EAS_ADDRESS,
      schemaUid: EAS_BADGE_SCHEMA_UID,
    }, {
      randomBytesImpl: () => Uint8Array.from({ length: 32 }, (_, index) => index + 1),
    })
    const repository = memoryRepository()
    const { service } = makeService({ repository, easGateway: gateway, attesterAddress: signer.address })
    const issued = await service.issue(INPUT)
    const stored = repository.currentRecord()
    repository.replaceRecord({ ...stored, reportHash: `0x${'9'.repeat(64)}` })

    const verified = await service.verify(issued.uid)

    expect(verified).toMatchObject({
      status: 'invalid',
      active: false,
      signatureValid: true,
      uidMatches: true,
      matchesSnapshot: false,
    })
  })
})

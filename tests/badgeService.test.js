import { describe, expect, it, vi } from 'vitest'

import { EAS_BADGE_SCHEMA_UID } from '../server/badges/constants.js'
import { BadgeService, parseIssueInput } from '../server/badges/service.js'

const UID = `0x${'a'.repeat(64)}`
const TX = `0x${'b'.repeat(64)}`
const ADDRESS = `0x${'1'.repeat(40)}`
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

function issuedRecord() {
  return {
    id: 'badge-1', state: 'issued', uid: UID, txHash: TX,
    repositoryUrl: INPUT.repositoryUrl, commitSha: INPUT.commitSha,
    repositoryId: '12345', score: 100, badgeLevel: 'gold', policyVersion: '1.0.0',
    subjectKey: `0x${'d'.repeat(64)}`, reportHash: `0x${'e'.repeat(64)}`,
    policyHash: `0x${'f'.repeat(64)}`, rulesetVersion: '1.0.0',
    chainId: '84532', schemaUid: EAS_BADGE_SCHEMA_UID, attesterAddress: ADDRESS,
    expiresAt: null,
  }
}

function verifiedAttestation(seed) {
  return {
    active: true,
    revoked: false,
    expired: false,
    issuedAt: '2026-08-27T00:00:00.000Z',
    schema: seed.schemaUid,
    attester: seed.attesterAddress,
    data: {
      subjectKey: seed.subjectKey,
      repositoryId: seed.repositoryId,
      repositoryUrl: seed.repositoryUrl,
      commitOid: seed.commitSha,
      reportHash: seed.reportHash,
      score: seed.score,
      badgeLevel: 3,
      policyHash: seed.policyHash,
      rulesetVersion: seed.rulesetVersion,
    },
  }
}

function memoryRepository(existingRecord = null) {
  let record = existingRecord
  return {
    reserve: vi.fn(async (input) => {
      if (record) return { action: 'existing', record }
      record = { ...input, id: 'badge-1', state: 'submitting', uid: null, txHash: null }
      return { action: 'issue', record }
    }),
    markSubmitted: vi.fn(async (_id, txHash) => {
      record = { ...record, state: 'submitted', txHash }
      return record
    }),
    markConfirmed: vi.fn(async (_id, issued) => {
      record = { ...record, state: 'issued', uid: issued.uid, txHash: issued.txHash }
      return record
    }),
    markFailure: vi.fn(),
    findByUid: vi.fn(async () => record),
  }
}

function makeService({ loaded = fixture(), repository = memoryRepository(), easGateway } = {}) {
  const gateway = easGateway || {
    issue: vi.fn(async (_input, { onBroadcast }) => {
      await onBroadcast(TX)
      return { uid: UID, txHash: TX }
    }),
    reconcile: vi.fn(),
    verify: vi.fn(),
  }
  return {
    repository,
    gateway,
    service: new BadgeService({
      repository,
      easGateway: gateway,
      repositoryLoader: vi.fn(async () => loaded),
      now: () => Date.parse('2026-08-27T00:00:00.000Z'),
      attesterAddress: ADDRESS,
    }),
  }
}

describe('badge service', () => {
  it('클라이언트가 점수를 보내면 거절한다', () => {
    expect(() => parseIssueInput({ ...INPUT, score: 100 })).toThrowError(/점수/)
    expect(() => parseIssueInput({ ...INPUT, decisions: { R: 'pass' } })).toThrowError(/점수/)
  })

  it('GitHub 저장소 루트 HTTPS 주소만 허용한다', () => {
    expect(() => parseIssueInput({ ...INPUT, repositoryUrl: 'https://github.com:444/example/app' })).toThrowError(/github\.com/)
    expect(() => parseIssueInput({ ...INPUT, repositoryUrl: 'https://github.com/example/app/tree/main' })).toThrowError(/루트/)
  })

  it('서버 재계산 결과가 통과하면 한 번만 EAS를 발급한다', async () => {
    const { service, repository, gateway } = makeService()
    const result = await service.issue(INPUT)
    expect(result).toMatchObject({ status: 'issued', uid: UID, txHash: TX, score: 100, badgeLevel: 'gold' })
    expect(repository.reserve).toHaveBeenCalledOnce()
    expect(repository.markSubmitted).toHaveBeenCalledWith('badge-1', TX)
    expect(gateway.issue).toHaveBeenCalledOnce()
  })

  it('발급 잠금이 전달한 repository로 예약과 상태 저장을 수행한다', async () => {
    const lockedRepository = memoryRepository()
    const rootRepository = {
      reserve: vi.fn(() => { throw new Error('root executor must not be used inside the lock') }),
      withIssuanceLock: vi.fn((callback) => callback(lockedRepository)),
    }
    const { service } = makeService({ repository: rootRepository })

    const result = await service.issue(INPUT)

    expect(result).toMatchObject({ status: 'issued', uid: UID })
    expect(rootRepository.withIssuanceLock).toHaveBeenCalledOnce()
    expect(rootRepository.reserve).not.toHaveBeenCalled()
    expect(lockedRepository.reserve).toHaveBeenCalledOnce()
    expect(lockedRepository.markSubmitted).toHaveBeenCalledOnce()
    expect(lockedRepository.markConfirmed).toHaveBeenCalledOnce()
  })

  it('기존 UID 재검증도 발급 잠금이 전달한 repository를 사용한다', async () => {
    const seed = issuedRecord()
    const lockedRepository = memoryRepository(seed)
    const rootRepository = {
      findByUid: vi.fn(() => { throw new Error('root executor must not be used inside the lock') }),
      withIssuanceLock: vi.fn((callback) => callback(lockedRepository)),
    }
    const gateway = {
      issue: vi.fn(),
      reconcile: vi.fn(),
      verify: vi.fn(async () => verifiedAttestation(seed)),
    }
    const { service } = makeService({ repository: rootRepository, easGateway: gateway })

    const result = await service.issue(INPUT)

    expect(result).toMatchObject({ status: 'issued', uid: UID, reused: true })
    expect(rootRepository.findByUid).not.toHaveBeenCalled()
    expect(lockedRepository.findByUid).toHaveBeenCalledWith(UID)
  })

  it('Critical, 불완전 소스 또는 앱 소스 부재이면 DB·EAS 호출 없이 미발급한다', async () => {
    const critical = makeService({ loaded: fixture({ scanScore: 100, critical: 1 }) })
    const criticalResult = await critical.service.issue(INPUT)
    expect(criticalResult.status).toBe('not_eligible')
    expect(critical.repository.reserve).not.toHaveBeenCalled()
    expect(critical.gateway.issue).not.toHaveBeenCalled()

    const partial = makeService({ loaded: fixture({ coverageComplete: false }) })
    const partialResult = await partial.service.issue(INPUT)
    expect(partialResult.eligibility.reasonCodes).toContain('SOURCE_COVERAGE_INCOMPLETE')
    expect(partial.repository.reserve).not.toHaveBeenCalled()

    const empty = makeService({ loaded: fixture({ hasApplicationSource: false }) })
    const emptyResult = await empty.service.issue(INPUT)
    expect(emptyResult.eligibility.reasonCodes).toContain('APPLICATION_SOURCE_MISSING')
    expect(empty.repository.reserve).not.toHaveBeenCalled()
  })

  it('이미 발급된 동일 snapshot은 기존 UID를 반환하고 재발급하지 않는다', async () => {
    const seed = issuedRecord()
    const repository = memoryRepository(seed)
    const gateway = {
      issue: vi.fn(),
      reconcile: vi.fn(),
      verify: vi.fn(async () => verifiedAttestation(seed)),
    }
    const built = makeService({ repository, easGateway: gateway })
    const { service } = built
    const result = await service.issue(INPUT)
    expect(result).toMatchObject({ status: 'issued', uid: UID, reused: true })
    expect(gateway.issue).not.toHaveBeenCalled()
  })

  it('submitted 작업은 tx receipt에서 UID를 복구하고 재발급하지 않는다', async () => {
    const seed = {
      id: 'badge-1', state: 'submitted', uid: null, txHash: TX,
      repositoryUrl: INPUT.repositoryUrl, commitSha: INPUT.commitSha, score: 100,
      badgeLevel: 'gold', policyVersion: '1.0.0', expiresAt: null,
    }
    const repository = memoryRepository(seed)
    const gateway = {
      issue: vi.fn(),
      verify: vi.fn(),
      reconcile: vi.fn(async () => ({ status: 'confirmed', uid: UID, txHash: TX })),
    }
    const { service } = makeService({ repository, easGateway: gateway })
    const result = await service.issue(INPUT)
    expect(result).toMatchObject({ status: 'issued', uid: UID, reused: true })
    expect(gateway.reconcile).toHaveBeenCalledWith(TX)
    expect(gateway.issue).not.toHaveBeenCalled()
  })
})

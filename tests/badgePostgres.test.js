import pg from 'pg'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { PostgresBadgeRepository } from '../server/badges/repository.js'

const databaseUrl = process.env.BADGE_TEST_DATABASE_URL
const integration = databaseUrl ? describe : describe.skip
const pool = databaseUrl ? new pg.Pool({ connectionString: databaseUrl, max: 20, connectionTimeoutMillis: 1_000 }) : null
const repository = pool ? new PostgresBadgeRepository(pool) : null
const hex = (char) => `0x${char.repeat(64)}`
const hexNumber = (number, bytes = 32) => `0x${number.toString(16).padStart(bytes * 2, '0')}`

const snapshot = {
  subjectKey: hex('1'),
  repositoryId: '12345',
  repositoryUrl: 'https://github.com/example/app',
  commitSha: 'a'.repeat(40),
  score: 92,
  badgeLevel: 'gold',
  reportHash: hex('2'),
  policyHash: hex('3'),
  policyVersion: '1.0.0',
  rulesetVersion: '1.0.0',
  chainId: '84532',
  easAddress: `0x${'5'.repeat(40)}`,
  schemaUid: hex('6'),
  attesterAddress: `0x${'4'.repeat(40)}`,
  signedAt: '1787788800',
  expirationTime: '0',
}

function proof(sequence = 1) {
  return {
    uid: hexNumber(sequence),
    signature: hexNumber(sequence, 65),
    salt: hexNumber(sequence + 100),
    encodedData: `0x${sequence.toString(16).padStart(4, '0')}`,
    signedAt: snapshot.signedAt,
    expirationTime: snapshot.expirationTime,
    easVersion: 2,
    domainVersion: '1.2.0',
  }
}

integration('badge PostgreSQL repository', () => {
  beforeEach(async () => {
    await pool.query('DELETE FROM badge_offchain_attestations')
  })

  afterAll(async () => {
    await pool.end()
  })

  it('동일 snapshot 20개 동시 저장에도 발급 row가 하나이고 승자의 UID를 재사용한다', async () => {
    const saves = await Promise.all(
      Array.from({ length: 20 }, (_, index) => repository.saveIssued(snapshot, proof(index + 1))),
    )

    expect(saves.filter((item) => item.action === 'created')).toHaveLength(1)
    expect(saves.filter((item) => item.action === 'existing')).toHaveLength(19)
    expect(new Set(saves.map((item) => item.record.uid)).size).toBe(1)
    const count = await pool.query('SELECT count(*)::int AS count FROM badge_offchain_attestations')
    expect(count.rows[0].count).toBe(1)
  })

  it('발급 proof를 저장하고 subject key와 UID로 다시 찾는다', async () => {
    const signedProof = proof()
    const saved = await repository.saveIssued(snapshot, signedProof)

    expect(saved).toMatchObject({ action: 'created', record: { uid: signedProof.uid } })
    expect(await repository.findBySubjectKey(snapshot.subjectKey)).toMatchObject({
      subjectKey: snapshot.subjectKey,
      uid: signedProof.uid,
      signature: signedProof.signature,
      signedAt: snapshot.signedAt,
      expirationTime: '0',
    })
    expect(await repository.findByUid(signedProof.uid)).toMatchObject({
      subjectKey: snapshot.subjectKey,
      uid: signedProof.uid,
    })
  })

  it('같은 subject key에 다른 보고서 해시는 충돌로 닫는다', async () => {
    await repository.saveIssued(snapshot, proof(1))

    await expect(repository.saveIssued({ ...snapshot, reportHash: hex('7') }, proof(2)))
      .rejects.toMatchObject({ status: 409, code: 'badge_snapshot_conflict' })
  })
})

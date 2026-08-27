import pg from 'pg'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { PostgresBadgeRepository } from '../server/badges/repository.js'

const databaseUrl = process.env.BADGE_TEST_DATABASE_URL
const integration = databaseUrl ? describe : describe.skip
const pool = databaseUrl ? new pg.Pool({ connectionString: databaseUrl, max: 3, connectionTimeoutMillis: 1_000 }) : null
const repository = pool ? new PostgresBadgeRepository(pool) : null
const hex = (char) => `0x${char.repeat(64)}`

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
  expiresAt: null,
}

integration('badge PostgreSQL repository', () => {
  beforeEach(async () => {
    await pool.query('DELETE FROM badge_attestations')
  })

  afterAll(async () => {
    await pool.end()
  })

  it('동일 snapshot 20개 동시 요청에도 발급 row가 하나다', async () => {
    const reservations = await Promise.all(Array.from({ length: 20 }, () => repository.reserve(snapshot)))
    expect(reservations.filter((item) => item.action === 'issue')).toHaveLength(1)
    const count = await pool.query('SELECT count(*)::int AS count FROM badge_attestations')
    expect(count.rows[0].count).toBe(1)
  })

  it('broadcast와 confirmation을 저장하고 UID로 다시 찾는다', async () => {
    const reserved = await repository.reserve(snapshot)
    const txHash = hex('5')
    const uid = hex('6')
    await repository.markSubmitted(reserved.record.id, txHash)
    await repository.markConfirmed(reserved.record.id, { uid, txHash })
    expect(await repository.findByUid(uid)).toMatchObject({ state: 'issued', uid, txHash })
  })

  it('같은 subject key에 다른 보고서 해시는 충돌로 닫는다', async () => {
    await repository.reserve(snapshot)
    await expect(repository.reserve({ ...snapshot, reportHash: hex('7') })).rejects.toMatchObject({
      status: 409,
      code: 'badge_snapshot_conflict',
    })
  })

  it('broadcast 뒤 장애 상태에도 tx hash를 보존하고 receipt 복구가 가능하다', async () => {
    const reserved = await repository.reserve(snapshot)
    const txHash = hex('7')
    const unknown = await repository.markFailure(reserved.record.id, {
      code: 'receipt_timeout',
      ambiguous: true,
      txHash,
    })
    expect(unknown).toMatchObject({ state: 'submission_unknown', txHash })

    const uid = hex('8')
    expect(await repository.markConfirmed(reserved.record.id, { uid, txHash }))
      .toMatchObject({ state: 'issued', uid, txHash })
  })

  it('서로 다른 발급도 같은 locked client로 DB 작업하며 직렬 실행된다', async () => {
    let active = 0
    let maximum = 0
    const run = (char, repositoryId) => repository.withIssuanceLock(async (lockedRepository) => {
      active += 1
      maximum = Math.max(maximum, active)
      const reserved = await lockedRepository.reserve({
        ...snapshot,
        subjectKey: hex(char),
        repositoryId,
        commitSha: char.repeat(40),
      })
      expect(reserved.action).toBe('issue')
      await new Promise((resolve) => setTimeout(resolve, 20))
      active -= 1
    })
    await Promise.all([run('4', '400'), run('5', '500'), run('6', '600')])
    expect(maximum).toBe(1)
  })
})

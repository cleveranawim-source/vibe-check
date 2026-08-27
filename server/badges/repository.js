import { randomUUID } from 'node:crypto'

import { BadgeError } from './errors.js'

const columns = `
  id, subject_key, repository_id, repository_url, commit_sha,
  score, badge_level, report_hash, policy_hash, policy_version, ruleset_version,
  chain_id, eas_contract, schema_uid, state, attempt_count,
  eas_uid, tx_hash, attester_address, expires_at, failure_code,
  created_at, updated_at
`

function mapRow(row) {
  if (!row) return null
  return {
    id: row.id,
    subjectKey: row.subject_key,
    repositoryId: row.repository_id,
    repositoryUrl: row.repository_url,
    commitSha: row.commit_sha,
    score: row.score,
    badgeLevel: row.badge_level,
    reportHash: row.report_hash,
    policyHash: row.policy_hash,
    policyVersion: row.policy_version,
    rulesetVersion: row.ruleset_version,
    chainId: String(row.chain_id),
    easAddress: row.eas_contract,
    schemaUid: row.schema_uid,
    state: row.state,
    attemptCount: row.attempt_count,
    uid: row.eas_uid,
    txHash: row.tx_hash,
    attesterAddress: row.attester_address,
    expiresAt: row.expires_at?.toISOString?.() || row.expires_at || null,
    failureCode: row.failure_code,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  }
}

function assertSameSnapshot(existing, input) {
  const fields = [
    'repositoryId', 'repositoryUrl', 'commitSha', 'score', 'badgeLevel', 'reportHash',
    'policyHash', 'policyVersion', 'rulesetVersion', 'chainId', 'easAddress', 'schemaUid',
    'attesterAddress',
  ]
  if (fields.some((field) => String(existing[field]).toLowerCase() !== String(input[field]).toLowerCase())) {
    throw new BadgeError(409, 'badge_snapshot_conflict', '같은 저장소·커밋·정책에 서로 다른 심사 결과가 이미 등록되어 있습니다.')
  }
}

export class PostgresBadgeRepository {
  constructor(pool, executor = pool) {
    this.pool = pool
    this.executor = executor
  }

  async reserve(input) {
    const values = [
      randomUUID(), input.subjectKey, input.repositoryId, input.repositoryUrl, input.commitSha,
      input.score, input.badgeLevel, input.reportHash, input.policyHash,
      input.policyVersion, input.rulesetVersion, input.chainId, input.easAddress, input.schemaUid,
      input.attesterAddress, input.expiresAt,
    ]
    const inserted = await this.executor.query(
      `INSERT INTO badge_attestations (
         id, subject_key, repository_id, repository_url, commit_sha,
         score, badge_level, report_hash, policy_hash, policy_version, ruleset_version,
         chain_id, eas_contract, schema_uid, attester_address, expires_at,
         state, attempt_count
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         $11, $12, $13, $14, $15, $16, 'submitting', 1
       ) ON CONFLICT (subject_key) DO NOTHING
       RETURNING ${columns}`,
      values,
    )
    if (inserted.rowCount === 1) return { action: 'issue', record: mapRow(inserted.rows[0]) }

    const found = await this.executor.query(`SELECT ${columns} FROM badge_attestations WHERE subject_key = $1`, [input.subjectKey])
    const existing = mapRow(found.rows[0])
    if (!existing) throw new BadgeError(503, 'badge_reservation_failed', '인증 발급 작업을 예약하지 못했습니다.')
    assertSameSnapshot(existing, input)

    if (existing.state === 'failed' && existing.attemptCount < 3) {
      const retried = await this.executor.query(
        `UPDATE badge_attestations
         SET state = 'submitting', attempt_count = attempt_count + 1,
             tx_hash = NULL, failure_code = NULL, updated_at = now()
         WHERE id = $1 AND state = 'failed' AND attempt_count < 3
         RETURNING ${columns}`,
        [existing.id],
      )
      if (retried.rowCount === 1) return { action: 'issue', record: mapRow(retried.rows[0]) }
    }

    const latest = await this.executor.query(`SELECT ${columns} FROM badge_attestations WHERE id = $1`, [existing.id])
    return { action: 'existing', record: mapRow(latest.rows[0]) }
  }

  async markSubmitted(id, txHash) {
    const result = await this.executor.query(
      `UPDATE badge_attestations
       SET state = 'submitted', tx_hash = $2, updated_at = now()
       WHERE id = $1 AND state = 'submitting'
       RETURNING ${columns}`,
      [id, txHash.toLowerCase()],
    )
    if (result.rowCount !== 1) throw new BadgeError(409, 'badge_state_conflict', '발급 상태가 예상과 다릅니다.')
    return mapRow(result.rows[0])
  }

  async markConfirmed(id, { uid, txHash }) {
    const result = await this.executor.query(
      `UPDATE badge_attestations
       SET state = 'issued', eas_uid = $2, tx_hash = $3, failure_code = NULL, updated_at = now()
       WHERE id = $1 AND state IN ('submitting', 'submitted', 'submission_unknown')
       RETURNING ${columns}`,
      [id, uid.toLowerCase(), txHash.toLowerCase()],
    )
    if (result.rowCount !== 1) throw new BadgeError(409, 'badge_state_conflict', '발급 완료 상태를 저장하지 못했습니다.')
    return mapRow(result.rows[0])
  }

  async markFailure(id, { code, ambiguous = false, txHash = null }) {
    const result = await this.executor.query(
      `UPDATE badge_attestations
       SET state = $2, failure_code = $3, tx_hash = COALESCE(tx_hash, $4), updated_at = now()
       WHERE id = $1 AND state IN ('submitting', 'submitted', 'submission_unknown')
       RETURNING ${columns}`,
      [id, ambiguous ? 'submission_unknown' : 'failed', code, txHash?.toLowerCase?.() || null],
    )
    return mapRow(result.rows[0])
  }

  async withIssuanceLock(callback) {
    const client = await this.pool.connect()
    try {
      await client.query("SELECT pg_advisory_lock(hashtext('edusafe-eas-issuer-v1'))")
      return await callback(new PostgresBadgeRepository(this.pool, client))
    } finally {
      try {
        await client.query("SELECT pg_advisory_unlock(hashtext('edusafe-eas-issuer-v1'))")
      } finally {
        client.release()
      }
    }
  }

  async findByUid(uid) {
    const result = await this.executor.query(`SELECT ${columns} FROM badge_attestations WHERE eas_uid = $1`, [uid.toLowerCase()])
    return mapRow(result.rows[0])
  }
}

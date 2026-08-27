import { randomUUID } from 'node:crypto'

import { BadgeError } from './errors.js'

const columns = `
  id, subject_key, repository_id, repository_url, commit_sha,
  score, badge_level, report_hash, policy_hash, policy_version, ruleset_version,
  chain_id, eas_contract, schema_uid, eas_version, domain_version,
  eas_uid, attester_address, signature, salt, encoded_data,
  signed_at, expiration_time, revoked_at, created_at
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
    easVersion: row.eas_version,
    domainVersion: row.domain_version,
    uid: row.eas_uid,
    attesterAddress: row.attester_address,
    signature: row.signature,
    salt: row.salt,
    encodedData: row.encoded_data,
    signedAt: String(row.signed_at),
    expirationTime: String(row.expiration_time),
    revokedAt: row.revoked_at?.toISOString?.() || row.revoked_at || null,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
  }
}

function assertSameSnapshot(existing, input) {
  const fields = [
    'repositoryId', 'repositoryUrl', 'commitSha', 'score', 'badgeLevel', 'reportHash',
    'policyHash', 'policyVersion', 'rulesetVersion', 'chainId', 'easAddress', 'schemaUid',
  ]
  if (fields.some((field) => String(existing[field]).toLowerCase() !== String(input[field]).toLowerCase())) {
    throw new BadgeError(409, 'badge_snapshot_conflict', '같은 저장소·커밋·정책에 서로 다른 심사 결과가 이미 등록되어 있습니다.')
  }
}

export class PostgresBadgeRepository {
  constructor(pool) {
    this.pool = pool
  }

  async findBySubjectKey(subjectKey) {
    const result = await this.pool.query(
      `SELECT ${columns} FROM badge_offchain_attestations WHERE subject_key = $1`,
      [subjectKey.toLowerCase()],
    )
    return mapRow(result.rows[0])
  }

  async saveIssued(input, proof) {
    const values = [
      randomUUID(), input.subjectKey, input.repositoryId, input.repositoryUrl, input.commitSha,
      input.score, input.badgeLevel, input.reportHash, input.policyHash, input.policyVersion,
      input.rulesetVersion, input.chainId, input.easAddress, input.schemaUid,
      proof.easVersion, proof.domainVersion, proof.uid, input.attesterAddress,
      proof.signature, proof.salt, proof.encodedData, proof.signedAt, proof.expirationTime,
    ]
    const inserted = await this.pool.query(
      `INSERT INTO badge_offchain_attestations (
         id, subject_key, repository_id, repository_url, commit_sha,
         score, badge_level, report_hash, policy_hash, policy_version, ruleset_version,
         chain_id, eas_contract, schema_uid, eas_version, domain_version,
         eas_uid, attester_address, signature, salt, encoded_data, signed_at, expiration_time
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
         $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
       ) ON CONFLICT (subject_key) DO NOTHING
       RETURNING ${columns}`,
      values,
    )
    if (inserted.rowCount === 1) return { action: 'created', record: mapRow(inserted.rows[0]) }

    const existing = await this.findBySubjectKey(input.subjectKey)
    if (!existing) throw new BadgeError(503, 'badge_save_failed', '서명 인증마크를 저장하지 못했습니다.')
    assertSameSnapshot(existing, input)
    return { action: 'existing', record: existing }
  }

  async findByUid(uid) {
    const result = await this.pool.query(
      `SELECT ${columns} FROM badge_offchain_attestations WHERE eas_uid = $1`,
      [uid.toLowerCase()],
    )
    return mapRow(result.rows[0])
  }
}

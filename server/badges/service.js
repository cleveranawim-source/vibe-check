import { BADGE_LEVELS, BADGE_POLICY, BADGE_POLICY_VERSION, evaluateBadgeEligibility } from '../../src/lib/badgePolicy.js'
import { parseGithubUrl, fetchRepoFiles } from '../../src/lib/github.js'
import { scanFiles } from '../../src/lib/scanner.js'
import { securityGrade } from '../../src/lib/scoring.js'
import { SECURITY_RULESET_VERSION } from '../../src/data/securityRules.js'
import {
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_EAS_ADDRESS,
  BASE_SEPOLIA_EASSCAN_URL,
  EAS_BADGE_SCHEMA_UID,
} from './constants.js'
import { BadgeError } from './errors.js'
import { sha256Hex } from './hashing.js'

const COMMIT_SHA = /^[0-9a-f]{40}$/i
const BYTES32 = /^0x[0-9a-f]{64}$/i
const GITHUB_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,98}[A-Za-z0-9])?$/

export function parseIssueInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadgeError(422, 'invalid_badge_request', '발급 요청은 JSON 객체여야 합니다.')
  }
  if ('score' in value || 'summary' in value || 'scanScore' in value || 'reviewScore' in value || 'decisions' in value) {
    throw new BadgeError(422, 'client_score_rejected', '클라이언트가 보낸 점수는 발급에 사용할 수 없습니다.')
  }
  let url
  try {
    url = new URL(value.repositoryUrl)
  } catch {
    throw new BadgeError(422, 'invalid_repository_url', 'GitHub 저장소 주소가 올바르지 않습니다.')
  }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash) {
    throw new BadgeError(422, 'invalid_repository_url', '공개 github.com HTTPS 저장소 주소만 허용합니다.')
  }
  const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean)
  if (parts.length !== 2) throw new BadgeError(422, 'invalid_repository_url', '저장소 루트 주소만 입력해 주세요.')
  const owner = parts[0]
  const repo = parts[1].replace(/\.git$/i, '')
  if (!GITHUB_NAME.test(owner) || !GITHUB_NAME.test(repo)) {
    throw new BadgeError(422, 'invalid_repository_url', 'GitHub 소유자 또는 저장소 이름이 올바르지 않습니다.')
  }
  if (!COMMIT_SHA.test(value.commitSha || '')) {
    throw new BadgeError(422, 'invalid_commit_sha', '40자리 Git commit SHA가 필요합니다.')
  }
  return {
    repositoryUrl: `https://github.com/${owner}/${repo}`,
    owner,
    repo,
    commitSha: value.commitSha.toLowerCase(),
  }
}

export async function loadAndScanRepository(input) {
  const parsed = parseGithubUrl(input.repositoryUrl)
  if (!parsed) throw new BadgeError(422, 'invalid_repository_url', 'GitHub 저장소 주소가 올바르지 않습니다.')
  const result = await fetchRepoFiles({ ...parsed, commitSha: input.commitSha })
  if (!result.repositoryId || !/^\d+$/.test(result.repositoryId)) {
    throw new BadgeError(502, 'github_repository_id_missing', 'GitHub 저장소 식별자를 확인하지 못했습니다.')
  }
  if (result.commitSha.toLowerCase() !== input.commitSha) throw new BadgeError(409, 'commit_resolution_mismatch', '요청한 commit을 정확히 확인하지 못했습니다.')
  if (result.files.length === 0) throw new BadgeError(422, 'no_scannable_source', '검사할 수 있는 소스 파일이 없습니다.')
  const scanResult = scanFiles(result.files)
  return { result, scanResult, scanGrade: securityGrade(scanResult) }
}

function publicRecord(record) {
  return {
    status: record.state,
    uid: record.uid,
    txHash: record.txHash,
    subjectKey: record.subjectKey,
    repositoryUrl: record.repositoryUrl,
    commitSha: record.commitSha,
    score: record.score,
    badgeLevel: record.badgeLevel,
    reportHash: record.reportHash,
    policyHash: record.policyHash,
    policyVersion: record.policyVersion,
    rulesetVersion: record.rulesetVersion,
    chainId: Number(record.chainId),
    schemaUid: record.schemaUid,
    attesterAddress: record.attesterAddress,
    expiresAt: record.expiresAt,
    explorerUrl: record.uid ? `${BASE_SEPOLIA_EASSCAN_URL}/attestation/view/${record.uid}` : null,
  }
}

export class BadgeService {
  constructor({
    repository,
    easGateway,
    repositoryLoader = loadAndScanRepository,
    now = () => Date.now(),
    attesterAddress,
    chainId = BASE_SEPOLIA_CHAIN_ID,
    easAddress = BASE_SEPOLIA_EAS_ADDRESS,
    schemaUid = EAS_BADGE_SCHEMA_UID,
  }) {
    this.repository = repository
    this.easGateway = easGateway
    this.repositoryLoader = repositoryLoader
    this.now = now
    this.attesterAddress = attesterAddress
    this.chainId = chainId
    this.easAddress = easAddress
    this.schemaUid = schemaUid
  }

  async issue(rawInput) {
    const input = parseIssueInput(rawInput)
    const { result, scanResult, scanGrade } = await this.repositoryLoader(input)
    const sourceCoverageComplete = Boolean(result.coverageComplete)
    const eligibility = evaluateBadgeEligibility({
      scanGrade,
      source: 'github',
      sourceCoverageComplete,
      hasApplicationSource: Boolean(result.hasApplicationSource),
    })
    if (!eligibility.eligible) return { status: 'not_eligible', eligibility }

    const canonicalUrl = result.canonicalUrl
    const findingSummary = scanResult.findings
      .map((finding) => ({
        ruleId: finding.rule.id,
        severity: finding.rule.severity,
        count: finding.occurrences.length,
      }))
      .sort((a, b) => a.ruleId.localeCompare(b.ruleId))
    const reportHash = sha256Hex({
      version: 1,
      repositoryId: result.repositoryId,
      repositoryUrl: canonicalUrl,
      commitSha: input.commitSha,
      rulesetVersion: SECURITY_RULESET_VERSION,
      score: eligibility.scanScore,
      sourceCoverageComplete,
      hasApplicationSource: Boolean(result.hasApplicationSource),
      findings: findingSummary,
    })
    const policyHash = sha256Hex(BADGE_POLICY)
    const subjectKey = sha256Hex({
      namespace: 'edusafe-eas-badge-v1',
      chainId: this.chainId.toString(),
      easAddress: this.easAddress,
      schemaUid: this.schemaUid,
      attesterAddress: this.attesterAddress,
      repositoryId: result.repositoryId,
      commitSha: input.commitSha,
      rulesetVersion: SECURITY_RULESET_VERSION,
      policyHash,
    })
    const expiresAt = BADGE_POLICY.expirationDays > 0
      ? new Date(this.now() + BADGE_POLICY.expirationDays * 24 * 60 * 60 * 1000).toISOString()
      : null
    const snapshot = {
      subjectKey,
      repositoryId: result.repositoryId,
      repositoryUrl: canonicalUrl,
      commitSha: input.commitSha,
      score: eligibility.scanScore,
      badgeLevel: eligibility.level,
      badgeLevelCode: eligibility.levelCode,
      reportHash,
      policyHash,
      policyVersion: BADGE_POLICY_VERSION,
      rulesetVersion: SECURITY_RULESET_VERSION,
      chainId: this.chainId.toString(),
      easAddress: this.easAddress,
      schemaUid: this.schemaUid,
      attesterAddress: this.attesterAddress,
      expiresAt,
    }
    const reserveAndSubmit = async (repository = this.repository) => {
      const reservation = await repository.reserve(snapshot)
      if (reservation.action === 'existing') {
        let existing = reservation.record
        if (existing.uid) {
          const verified = await this.verify(existing.uid, repository)
          return {
            ...verified,
            status: verified.active ? 'issued' : verified.status,
            eligibility,
            reused: true,
          }
        }
        if (existing.txHash && ['submitted', 'submission_unknown'].includes(existing.state)) {
          const reconciled = await this.easGateway.reconcile(existing.txHash)
          if (reconciled.status === 'confirmed') {
            existing = await repository.markConfirmed(existing.id, reconciled)
          } else if (reconciled.status === 'failed') {
            existing = await repository.markFailure(existing.id, {
              code: 'eas_transaction_reverted',
              ambiguous: false,
              txHash: reconciled.txHash,
            })
          }
        }
        return { ...publicRecord(existing), eligibility, reused: true }
      }

      let txHash = null
      try {
        const persistedSnapshot = {
          ...reservation.record,
          badgeLevelCode: BADGE_LEVELS[reservation.record.badgeLevel].code,
        }
        const issued = await this.easGateway.issue(persistedSnapshot, {
          onBroadcast: async (hash) => {
            txHash = hash
            await repository.markSubmitted(reservation.record.id, hash)
          },
        })
        const confirmed = await repository.markConfirmed(reservation.record.id, issued)
        return { ...publicRecord(confirmed), eligibility, reused: false }
      } catch (error) {
        await repository.markFailure(reservation.record.id, {
          code: error?.code === 'INSUFFICIENT_FUNDS' ? 'insufficient_testnet_funds' : 'eas_submission_failed',
          ambiguous: Boolean(txHash),
          txHash,
        })
        if (error instanceof BadgeError) throw error
        throw new BadgeError(502, 'eas_submission_failed', 'Base Sepolia 인증 발급에 실패했습니다. 잠시 후 상태를 다시 확인해 주세요.')
      }
    }
    return this.repository.withIssuanceLock
      ? this.repository.withIssuanceLock(reserveAndSubmit)
      : reserveAndSubmit(this.repository)
  }

  async verify(uid, repository = this.repository) {
    if (!BYTES32.test(uid || '')) throw new BadgeError(422, 'invalid_attestation_uid', '인증 UID 형식이 올바르지 않습니다.')
    const record = await repository.findByUid(uid)
    if (!record) throw new BadgeError(404, 'badge_not_found', '등록된 인증마크를 찾을 수 없습니다.')
    const chain = await this.easGateway.verify(uid, this.now(), {
      schemaUid: record.schemaUid,
      attesterAddress: record.attesterAddress,
    })
    const data = chain.data
    const matchesSnapshot = (
      String(data.subjectKey).toLowerCase() === record.subjectKey.toLowerCase()
      && String(data.repositoryId) === String(record.repositoryId)
      && String(data.repositoryUrl) === record.repositoryUrl
      && String(data.commitOid).toLowerCase() === record.commitSha.toLowerCase()
      && String(data.reportHash).toLowerCase() === record.reportHash.toLowerCase()
      && Number(data.score) === record.score
      && Number(data.badgeLevel) === BADGE_LEVELS[record.badgeLevel]?.code
      && String(data.policyHash).toLowerCase() === record.policyHash.toLowerCase()
      && String(data.rulesetVersion) === record.rulesetVersion
      && String(chain.schema).toLowerCase() === record.schemaUid.toLowerCase()
      && String(chain.attester).toLowerCase() === record.attesterAddress.toLowerCase()
    )
    return {
      ...publicRecord(record),
      status: chain.active && matchesSnapshot ? 'valid' : chain.revoked ? 'revoked' : chain.expired ? 'expired' : 'invalid',
      active: chain.active && matchesSnapshot,
      matchesSnapshot,
      issuedAt: chain.issuedAt,
      chainId: Number(record.chainId),
      schema: chain.schema,
      attester: chain.attester,
    }
  }
}

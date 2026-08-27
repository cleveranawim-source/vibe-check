import { useEffect, useState } from 'react'
import {
  BADGE_POLICY,
  BADGE_REASON_LABELS,
  evaluateBadgeEligibility,
} from '../lib/badgePolicy.js'
import {
  BLOCKCHAIN_BADGE_ENABLED,
  buildBadgeLinks,
  issueBlockchainBadge,
} from '../lib/blockchainBadge.js'

export default function BlockchainBadge({
  repoUrl,
  repoMeta,
  scanGrade,
}) {
  if (repoMeta.demoOnly === true && repoMeta.source === 'demo') {
    return <DemoBlockchainBadge repoMeta={repoMeta} scanGrade={scanGrade} />
  }

  return <SignedBlockchainBadge repoUrl={repoUrl} repoMeta={repoMeta} scanGrade={scanGrade} />
}

function DemoBlockchainBadge({ repoMeta, scanGrade }) {
  const score = scanGrade?.score
  const level = score >= BADGE_POLICY.levels.gold.minimumScore
    ? 'Gold'
    : score >= BADGE_POLICY.levels.silver.minimumScore ? 'Silver' : null

  if (!level) {
    return (
      <section className="cert-box blockchain-cert ineligible" aria-label="블록체인 인증마크 데모 오류">
        <strong>🧪 데모 점수를 확인하지 못했습니다</strong>
        <p className="gh-hint">실제 인증이나 발급 요청은 실행되지 않았습니다.</p>
      </section>
    )
  }

  const levelClass = level.toLowerCase()

  return (
    <section className="cert-box blockchain-cert eligible" aria-label="블록체인 인증마크 데모">
      <div className="blockchain-cert-head">
        <div>
          <strong>🧪 {score}점 연동 인증마크 화면 데모</strong>
          <p className="gh-hint">
            <code>{repoMeta.repo}</code> 전용 로컬 미리보기입니다. 서버 재검사·지갑 서명·DB 저장은 실행하지 않습니다.
          </p>
        </div>
        <span className="badge-eligibility pass">DEMO · 실제 인증 아님</span>
      </div>

      <div className="badge-score-row">
        <span>자동 보안 <strong>{score}점</strong></span>
        <span>미리보기 등급 <strong>{level}</strong></span>
      </div>

      <div className="blockchain-issued demo-issued" role="status">
        <div className={`demo-badge-art ${levelClass}`} role="img" aria-label={`EduSafe ${level} ${score}점 데모 마크`}>
          <span>EduSafe {level}</span>
          <span>{score}점 · DEMO</span>
        </div>
        <div>
          <strong>{level} 인증마크 미리보기</strong>
          <code>{repoMeta.commitSha} · 실제 EAS UID 없음</code>
          <p className="gh-hint">
            실제 인증 아님 · 발급 API, 서명, DB 기록, 공개 검증 링크를 만들지 않습니다.
          </p>
        </div>
      </div>
    </section>
  )
}

function SignedBlockchainBadge({
  repoUrl,
  repoMeta,
  scanGrade,
}) {
  const eligibility = evaluateBadgeEligibility({
    scanGrade,
    source: repoMeta.source,
    sourceCoverageComplete: repoMeta.sourceCoverageComplete !== false,
    hasApplicationSource: repoMeta.hasApplicationSource !== false,
  })
  const [issuanceToken, setIssuanceToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setBusy(false)
    setError('')
    setResult(null)
    setCopied(false)
    setIssuanceToken('')
  }, [repoMeta.repositoryId, repoMeta.commitSha])

  const issue = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await issueBlockchainBadge({
        issuanceToken,
        payload: {
          repositoryUrl: repoMeta.canonicalUrl || repoUrl,
          commitSha: repoMeta.commitSha,
        },
      })
      setResult(response)
    } catch (err) {
      setError(err.message || '가스리스 서명 인증 발급에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const copySnippet = async () => {
    const links = buildBadgeLinks(result.uid)
    const markdown = `[![EduSafe ${result.badgeLevel} 인증](${links.badgeUrl})](${links.verifyUrl})`
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setError('클립보드 권한이 없어 삽입 코드를 복사하지 못했습니다.')
    }
  }

  return (
    <section className={`cert-box blockchain-cert ${eligibility.eligible ? 'eligible' : 'ineligible'}`}>
      <div className="blockchain-cert-head">
        <div>
          <strong>🔏 점수 연동 가스리스 EAS 인증마크</strong>
          <p className="gh-hint">
            서버가 다시 계산한 자동 보안·개인정보 점수가 {BADGE_POLICY.minimumScanScore}점 이상이고
            치명적 발견이 없을 때 Ethereum 지갑으로 EAS 오프체인 인증에 서명합니다. 가스비는 0원입니다.
          </p>
        </div>
        <span className={`badge-eligibility ${eligibility.eligible ? 'pass' : 'fail'}`}>
          {eligibility.eligible ? `${eligibility.level.toUpperCase()} 발급 가능` : '발급 조건 미충족'}
        </span>
      </div>

      <div className="badge-score-row">
        <span>자동 보안 <strong>{eligibility.scanScore ?? '—'}점</strong></span>
        <span>인증 기준 점수 <strong>{eligibility.effectiveScore ?? '—'}점</strong></span>
      </div>

      {!eligibility.eligible && (
        <ul className="badge-reasons">
          {eligibility.reasonCodes.map((code) => <li key={code}>{BADGE_REASON_LABELS[code] || code}</li>)}
        </ul>
      )}

      {eligibility.eligible && !BLOCKCHAIN_BADGE_ENABLED && (
        <p className="badge-config-note">
          발급 로직은 준비되어 있습니다. 배포 환경에서 <code>VITE_BLOCKCHAIN_BADGES_ENABLED=true</code>와
          인증 API 주소를 설정하면 이 화면에서 실제 발급이 활성화됩니다.
        </p>
      )}

      {eligibility.eligible && BLOCKCHAIN_BADGE_ENABLED && !result?.uid && (
        <form className="cert-row" onSubmit={issue}>
          <input
            type="password"
            value={issuanceToken}
            onChange={(event) => setIssuanceToken(event.target.value)}
            placeholder="과제용 심사자 발급 승인 코드"
            aria-label="과제용 가스리스 인증 발급 승인 코드"
            autoComplete="off"
            disabled={busy}
          />
          <button className="btn-primary" type="submit" disabled={busy || issuanceToken.length < 32}>
            {busy ? '서명 발급 중…' : '조건 확인 후 무료 발급'}
          </button>
        </form>
      )}

      {result?.status === 'not_eligible' && (
        <p className="ai-error">서버 재검사 결과 발급 기준을 충족하지 못했습니다.</p>
      )}

      {result && !result.uid && result.status !== 'not_eligible' && (
        <p className="badge-config-note">
          서명 인증을 저장하지 못했습니다. 서버 설정을 확인한 뒤 다시 시도해 주세요.
        </p>
      )}

      {result?.uid && result.status !== 'issued' && (
        <p className="ai-error" role="alert">
          기존 인증이 {result.status === 'revoked' ? '취소' : result.status === 'expired' ? '만료' : '검증 실패'} 상태입니다.
          자동으로 다시 발급하지 않습니다.
        </p>
      )}

      {result?.uid && result.status === 'issued' && (() => {
        const links = buildBadgeLinks(result.uid)
        return (
          <div className="blockchain-issued" role="status">
            <img src={links.badgeUrl} alt={`EduSafe ${result.badgeLevel} EAS 오프체인 인증마크`} height="24" />
            <div>
              <strong>EAS 오프체인 서명 발급 완료 · 가스비 0원</strong>
              <code>{result.uid}</code>
              <div className="cert-links">
                <a href={links.verifyUrl} target="_blank" rel="noopener noreferrer">서명 검증</a>
                <button type="button" className="btn-secondary" onClick={copySnippet}>
                  {copied ? '✅ 복사됨' : 'README 삽입 코드 복사'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {error && <p className="ai-error" role="alert">⚠️ {error}</p>}
      <p className="gh-hint">
        이 마크는 블록체인에 기록되지 않습니다. EAS/EIP-712 형식의 지갑 서명으로 발급자와 위변조 여부를 검증하며,
        표시된 커밋의 자동 규칙 점검 결과일 뿐 수동 심사 완료·무결점·법적 인증을 보장하지 않습니다.
      </p>
    </section>
  )
}

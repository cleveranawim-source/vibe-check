import { TRACKS, RUBRIC_VERSION } from '../data/rubric.js'
import { VERDICT_LABELS } from '../lib/reviewAi.js'
import { computeSummary, finalVerdict, STATUS_LABELS } from '../lib/reviewSummary.js'

const STATUS_COLORS = {
  pass_candidate: 'var(--ok)',
  hold: 'var(--warn)',
  fail_candidate: 'var(--danger)',
}

export default function ReviewReport({
  repoUrl,
  repoMeta, // { owner, repo, branch, commitSha }
  track,
  standards, // { subject, gradeBand, codes } | null
  scanCounts, // { critical, warning, info }
  scanFindings = [], // 규칙 스캔 발견 항목 — 개선 권고 섹션에 사용
  judgments,
  overrides,
  humanInputs,
  opinion,
  reviewerName,
}) {
  const summary = computeSummary(track, judgments, overrides, humanInputs)

  return (
    <div className="review-report">
      <div className="rr-header">
        <div className="report-logo">🛡️ 바이브체크 심사 보고서</div>
        <h3>
          {repoMeta.owner}/{repoMeta.repo}
        </h3>
        <table className="rr-meta">
          <tbody>
            <tr><th>저장소</th><td>{repoUrl}</td></tr>
            <tr><th>브랜치 / 커밋</th><td>{repoMeta.branch} / <code>{repoMeta.commitSha.slice(0, 12) || '(확인 불가)'}</code></td></tr>
            <tr><th>심사일</th><td>{new Date().toLocaleDateString('ko-KR')}</td></tr>
            <tr><th>루브릭</th><td>v{RUBRIC_VERSION}</td></tr>
            <tr><th>분류</th><td>{TRACKS[track].icon} {TRACKS[track].label}</td></tr>
            {standards && (standards.subject || standards.codes) && (
              <tr><th>성취기준</th><td>{[standards.subject, standards.gradeBand, standards.codes].filter(Boolean).join(' · ')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rr-summary" style={{ borderColor: STATUS_COLORS[summary.status] }}>
        <div className="rr-status" style={{ color: STATUS_COLORS[summary.status] }}>
          {STATUS_LABELS[summary.status]}
        </div>
        <div className="rr-score">점수 요건 {summary.score}점</div>
        <div className="rr-scan">
          자동 스캔: 심각 {scanCounts.critical} · 경고 {scanCounts.warning} · 확인 필요 {scanCounts.info}
        </div>
        {summary.requiredFails.length > 0 && (
          <ul className="rr-fails">
            {summary.requiredFails.map((it) => (
              <li key={it.id}>필수 미충족 — {it.question}</li>
            ))}
          </ul>
        )}
        {summary.needsHuman.length > 0 && (
          <p className="rr-hold-note">판단 미완료 항목 {summary.needsHuman.length}건 — 심사자 확인 후 재집계 필요</p>
        )}
      </div>

      <table className="rr-table">
        <thead>
          <tr><th>구분</th><th>항목</th><th>판정</th><th>근거·비고</th></tr>
        </thead>
        <tbody>
          {summary.items.map((it) => {
            const v = finalVerdict(it, judgments, overrides, humanInputs)
            const j = judgments[it.id]
            const ov = overrides[it.id]
            const hi = humanInputs[it.id]
            return (
              <tr key={it.id} className={v === 'fail' ? 'rr-row-fail' : ''}>
                <td>{it.type === 'required' ? '필수' : `점수(${it.weight})`}</td>
                <td>{it.question}</td>
                <td className={`rr-verdict rr-${v}`}>{VERDICT_LABELS[v]}{ov ? ' (번복)' : ''}</td>
                <td>
                  {j?.evidence?.slice(0, 2).map((e, i) => (
                    <div key={i} className="rr-evidence">
                      <span>{e.file}:{e.line}</span> <code>{e.quote}</code>
                    </div>
                  ))}
                  {j?.reasoning && <div className="rr-reasoning">{j.reasoning}</div>}
                  {ov && <div className="rr-override">심사자 번복: {VERDICT_LABELS[ov.verdict]} — {ov.note || '사유 미기재'}</div>}
                  {!it.aiVerifiable && hi?.note && <div className="rr-reasoning">{hi.note}</div>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {scanFindings.filter((f) => f.rule.severity !== 'info').length > 0 && (
        <div className="rr-opinion rr-recommend">
          <h4>개선 권고 (제작 교사 회신용)</h4>
          <ul>
            {scanFindings
              .filter((f) => f.rule.severity !== 'info')
              .slice(0, 10)
              .map((f) => (
                <li key={f.rule.id}>
                  <strong>{f.rule.title}</strong> ({f.occurrences.length}곳) — {f.rule.fix}
                </li>
              ))}
          </ul>
        </div>
      )}

      {opinion && (
        <div className="rr-opinion">
          <h4>종합 의견</h4>
          <p>{opinion}</p>
        </div>
      )}

      <div className="rr-sign">
        <div>심사자: {reviewerName || '____________'} (서명) ____________</div>
        <div>심사일: {new Date().toLocaleDateString('ko-KR')}</div>
      </div>

      <p className="report-disclaimer">
        본 보고서는 커밋 {repoMeta.commitSha.slice(0, 12) || '(미상)'}에 대한 심사 기록입니다. AI 판정은 초안이며
        최종 판정 권한은 심사자에게 있습니다. 코드 수정 시 재심사가 필요합니다. · 루브릭 v{RUBRIC_VERSION}
      </p>
    </div>
  )
}

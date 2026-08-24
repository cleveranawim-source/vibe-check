import { STATUS_LABELS } from '../lib/reviewSummary.js'

const STATUS_CLASS = {
  pass_candidate: 'ledger-pass',
  hold: 'ledger-hold',
  fail_candidate: 'ledger-fail',
}

export default function ReviewLedger({ records, onRemove }) {
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `바이브체크-심사기록-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2><span className="panel-icon">📚</span> 심사 기록</h2>
        {records.length > 0 && (
          <button className="btn-secondary" onClick={exportJson}>JSON 내보내기</button>
        )}
      </div>
      <p className="panel-intro">
        이 브라우저에 저장된 심사 대장입니다. 커밋 해시가 함께 기록되어 "어느 시점의 코드를 심사했는지"가
        남습니다. 기관 공식 대장으로 옮길 때는 JSON 내보내기를 사용하세요.
      </p>

      {records.length === 0 ? (
        <div className="report-empty">아직 저장된 심사 기록이 없어요. 심사 보고서 화면에서 "심사 기록에 저장"을 누르면 여기에 쌓입니다.</div>
      ) : (
        <div className="ledger-wrap">
          <table className="rr-table ledger-table">
            <thead>
              <tr>
                <th>심사일</th><th>앱</th><th>분류</th><th>커밋</th><th>판정</th><th>점수</th><th>심사자</th><th></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.date).toLocaleDateString('ko-KR')}</td>
                  <td>
                    <a href={r.repoUrl.startsWith('http') ? r.repoUrl : `https://github.com/${r.owner}/${r.repo}`}
                      target="_blank" rel="noopener noreferrer">
                      {r.owner}/{r.repo}
                    </a>
                  </td>
                  <td>{r.trackLabel}</td>
                  <td><code>{(r.commitSha || '').slice(0, 8)}</code></td>
                  <td className={STATUS_CLASS[r.status]}>{STATUS_LABELS[r.status] || r.status}</td>
                  <td>{r.score}점{r.needsHuman > 0 ? ` (미확인 ${r.needsHuman})` : ''}</td>
                  <td>{r.reviewerName || '—'}</td>
                  <td>
                    <button className="file-remove" aria-label="기록 삭제"
                      onClick={() => { if (confirm('이 심사 기록을 삭제할까요?')) onRemove(r.id) }}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

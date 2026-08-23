import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { GRADES } from '../lib/scoring.js'
import { SEVERITIES } from '../data/securityRules.js'
import { privacyItems, privacyAlwaysItems } from '../data/privacyChecklist.js'
import { ethicsItems, ethicsAlwaysItems } from '../data/ethicsChecklist.js'
import { activeItems } from '../lib/scoring.js'

function GradeCard({ title, icon, info }) {
  const g = GRADES[info.grade]
  return (
    <div className="grade-card" style={{ borderColor: g.color }}>
      <div className="grade-card-icon">{icon}</div>
      <div className="grade-card-title">{title}</div>
      <div className="grade-card-grade" style={{ color: g.color }}>
        {g.emoji} {g.label}
      </div>
      <div className="grade-card-score">{info.score != null ? `${info.score}점` : '점검 전'}</div>
    </div>
  )
}

export default function Report({
  appName,
  setAppName,
  scanResult,
  secInfo,
  privInfo,
  ethInfo,
  privacyGateAnswer,
  privacyAnswers,
  ethicsGateAnswer,
  ethicsAnswers,
}) {
  const reportRef = useRef(null)
  const [saving, setSaving] = useState(false)

  const anyDone = secInfo.grade !== 'pending' || privInfo.grade !== 'pending' || ethInfo.grade !== 'pending'

  const noItems = (items, alwaysIds, gateAnswer, answers) =>
    gateAnswer == null
      ? []
      : activeItems(items, alwaysIds, gateAnswer).filter((it) => answers[it.id] === 'no')

  const privNo = noItems(privacyItems, privacyAlwaysItems, privacyGateAnswer, privacyAnswers)
  const ethNo = noItems(ethicsItems, ethicsAlwaysItems, ethicsGateAnswer, ethicsAnswers)
  const criticalFindings = scanResult
    ? scanResult.findings.filter((f) => f.rule.severity === 'critical')
    : []
  const warningFindings = scanResult
    ? scanResult.findings.filter((f) => f.rule.severity === 'warning')
    : []

  const savePng = async () => {
    setSaving(true)
    try {
      const dataUrl = await toPng(reportRef.current, {
        pixelRatio: 2,
        backgroundColor: '#fdfbf7',
      })
      const a = document.createElement('a')
      a.download = `바이브체크-리포트-${appName || '내앱'}-${new Date().toISOString().slice(0, 10)}.png`
      a.href = dataUrl
      a.click()
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>
          <span className="panel-icon">📋</span> 종합 리포트
        </h2>
      </div>

      {!anyDone ? (
        <div className="report-empty">
          아직 점검한 영역이 없어요. 보안 스캔이나 체크리스트를 먼저 진행해 주세요. 일부만 진행해도
          리포트를 볼 수 있어요.
        </div>
      ) : (
        <>
          <label className="ai-label report-name">
            앱 이름 (리포트에 표시)
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="예: 우리 반 감정일기"
            />
          </label>

          <div className="report-sheet" ref={reportRef}>
            <div className="report-header">
              <div className="report-logo">🛡️ 바이브체크</div>
              <h3>{appName || '내 웹앱'} 안심 점검 리포트</h3>
              <p className="report-date">{new Date().toLocaleDateString('ko-KR')} · 자가점검 결과</p>
            </div>

            <div className="grade-cards">
              <GradeCard title="보안" icon="🔍" info={secInfo} />
              <GradeCard title="개인정보" icon="🪪" info={privInfo} />
              <GradeCard title="AI 윤리" icon="🤖" info={ethInfo} />
            </div>

            {(criticalFindings.length > 0 || privNo.some((i) => i.weight >= 3) || ethNo.some((i) => i.weight >= 3)) && (
              <div className="report-block report-urgent">
                <h4>🔴 우선 조치가 필요해요</h4>
                <ul>
                  {criticalFindings.map((f) => (
                    <li key={f.rule.id}>
                      [보안] {f.rule.title} ({f.occurrences.length}곳)
                    </li>
                  ))}
                  {privNo.filter((i) => i.weight >= 3).map((i) => (
                    <li key={i.id}>[개인정보] {i.title}</li>
                  ))}
                  {ethNo.filter((i) => i.weight >= 3).map((i) => (
                    <li key={i.id}>[AI 윤리] {i.title}</li>
                  ))}
                </ul>
              </div>
            )}

            {(warningFindings.length > 0 || privNo.some((i) => i.weight < 3) || ethNo.some((i) => i.weight < 3)) && (
              <div className="report-block">
                <h4>🟠 개선하면 좋아요</h4>
                <ul>
                  {warningFindings.map((f) => (
                    <li key={f.rule.id}>
                      [보안] {f.rule.title} ({f.occurrences.length}곳)
                    </li>
                  ))}
                  {privNo.filter((i) => i.weight < 3).map((i) => (
                    <li key={i.id}>[개인정보] {i.title}</li>
                  ))}
                  {ethNo.filter((i) => i.weight < 3).map((i) => (
                    <li key={i.id}>[AI 윤리] {i.title}</li>
                  ))}
                </ul>
              </div>
            )}

            {criticalFindings.length === 0 && warningFindings.length === 0 && privNo.length === 0 && ethNo.length === 0 && (
              <div className="report-block report-clear">
                <h4>🎉 점검한 범위에서는 조치할 항목이 발견되지 않았어요</h4>
                <p>배포 후에도 기능을 바꿀 때마다 다시 점검하는 습관이 앱을 안전하게 지켜줘요.</p>
              </div>
            )}

            <p className="report-disclaimer">
              본 리포트는 자가점검 참고용이며 법률 자문이나 보안 인증이 아닙니다. 자동 검사는 모든
              문제를 발견하지 못할 수 있습니다. · vibecheck
            </p>
          </div>

          <div className="report-actions">
            <button className="btn-primary" onClick={savePng} disabled={saving}>
              {saving ? '저장 중…' : '🖼️ PNG로 저장'}
            </button>
            <button className="btn-secondary" onClick={() => window.print()}>
              🖨️ 인쇄
            </button>
          </div>
        </>
      )}
    </section>
  )
}

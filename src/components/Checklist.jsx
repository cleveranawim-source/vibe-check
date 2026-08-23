import { activeItems } from '../lib/scoring.js'
import { GRADES } from '../lib/scoring.js'

const ANSWER_OPTIONS = [
  { value: 'yes', label: '예, 그렇게 하고 있어요' },
  { value: 'no', label: '아니요 / 잘 모르겠어요' },
  { value: 'na', label: '해당 없음' },
]

export default function Checklist({
  icon,
  title,
  intro,
  gate,
  items,
  alwaysIds,
  gateAnswer,
  answers,
  onGate,
  onAnswer,
  gradeInfo,
}) {
  const visible = gateAnswer == null ? [] : activeItems(items, alwaysIds, gateAnswer)
  const answeredCount = visible.filter((it) => answers[it.id]).length

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>
          <span className="panel-icon">{icon}</span> {title}
        </h2>
        {gradeInfo.grade !== 'pending' && (
          <span className="grade-chip" style={{ background: GRADES[gradeInfo.grade].color }}>
            {GRADES[gradeInfo.grade].emoji} {GRADES[gradeInfo.grade].label} · {gradeInfo.score}점
          </span>
        )}
      </div>
      <p className="panel-intro">{intro}</p>

      <div className="gate-card">
        <p className="gate-q">{gate.question}</p>
        <p className="gate-help">{gate.help}</p>
        <div className="gate-buttons">
          <button
            className={gateAnswer === 'yes' ? 'gate-btn active' : 'gate-btn'}
            onClick={() => onGate('yes')}
          >
            예
          </button>
          <button
            className={gateAnswer === 'no' ? 'gate-btn active' : 'gate-btn'}
            onClick={() => onGate('no')}
          >
            아니요
          </button>
        </div>
        {gateAnswer === 'no' && <p className="gate-no-note">✅ {gate.noResult}</p>}
      </div>

      {gateAnswer != null && (
        <>
          <div className="progress-row">
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${(answeredCount / visible.length) * 100}%` }}
              />
            </div>
            <span className="progress-label">
              {answeredCount} / {visible.length} 문항
            </span>
          </div>

          <div className="items">
            {visible.map((it, idx) => {
              const a = answers[it.id]
              return (
                <div key={it.id} className={`item-card ${a === 'no' ? 'item-no' : ''}`}>
                  <div className="item-head">
                    <span className="item-num">{idx + 1}</span>
                    <h3>{it.title}</h3>
                    {it.weight >= 3 && <span className="item-must">필수</span>}
                  </div>
                  <p className="item-desc">{it.desc}</p>
                  <p className="item-basis">근거: {it.basis}</p>
                  <div className="answer-row">
                    {ANSWER_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        className={`answer-btn ${a === opt.value ? `answer-${opt.value}` : ''}`}
                        onClick={() => onAnswer(it.id, opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {a === 'no' && (
                    <div className="item-fix">
                      <strong>이렇게 해보세요</strong>
                      <p>{it.fixTip}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}

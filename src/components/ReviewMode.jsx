import { useState } from 'react'
import { parseGithubUrl, fetchRepoFiles } from '../lib/github.js'
import { scanFiles } from '../lib/scanner.js'
import { securityGrade } from '../lib/scoring.js'
import { AI_MODELS, friendlyApiError } from '../lib/aiReview.js'
import { TRACKS, rubricItems, RUBRIC_VERSION } from '../data/rubric.js'
import { inferCategory, judgeRubric, VERDICT_LABELS } from '../lib/reviewAi.js'
import ReviewReport from './ReviewReport.jsx'

const SUBJECTS = ['국어', '도덕', '사회', '역사', '수학', '과학', '기술·가정', '정보', '체육', '음악', '미술', '영어', '기타']
const GRADE_BANDS = ['초1-2', '초3-4', '초5-6', '중1-3', '고1-3']
const VERDICT_OPTIONS = ['pass', 'fail', 'na', 'needs_human']

export default function ReviewMode({ onExit }) {
  const [step, setStep] = useState('setup') // setup | category | judged | report
  const [repoUrl, setRepoUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(AI_MODELS[0].id)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const [repoMeta, setRepoMeta] = useState(null) // {owner, repo, branch, commitSha}
  const [files, setFiles] = useState([])
  const [scanResult, setScanResult] = useState(null)
  const [aiCategory, setAiCategory] = useState(null)
  const [track, setTrack] = useState(null)
  const [standards, setStandards] = useState({ subject: '', gradeBand: '', codes: '' })
  const [judgments, setJudgments] = useState({})
  const [excludedFiles, setExcludedFiles] = useState([])
  const [overrides, setOverrides] = useState({})
  const [humanInputs, setHumanInputs] = useState({})
  const [opinion, setOpinion] = useState('')
  const [reviewerName, setReviewerName] = useState('')

  const scanSummaryText = () => {
    if (!scanResult) return ''
    return scanResult.findings
      .map((f) => `- [${f.rule.severity}] ${f.rule.title} (${f.occurrences.length}곳)`)
      .join('\n')
  }

  const loadAndClassify = async () => {
    const parsed = parseGithubUrl(repoUrl)
    if (!parsed) return setError('주소 형식을 알 수 없어요. 예: https://github.com/아이디/저장소')
    if (!apiKey.trim()) return setError('심사자 API 키를 입력해 주세요.')
    setError('')
    try {
      setBusy('저장소 불러오는 중…')
      const result = await fetchRepoFiles({ ...parsed, onProgress: (d, t) => setBusy(`파일 내려받는 중… ${d}/${t}`) })
      if (result.files.length === 0) throw new Error('검사할 수 있는 파일이 없어요.')
      setRepoMeta({ owner: parsed.owner, repo: parsed.repo, branch: result.branch, commitSha: result.commitSha })
      setFiles(result.files)
      const scan = scanFiles(result.files)
      setScanResult(scan)
      setBusy('AI가 앱 분류를 추론하는 중…')
      const cat = await inferCategory({ apiKey: apiKey.trim(), model, files: result.files })
      setAiCategory(cat)
      setTrack(cat.category)
      setStep('category')
    } catch (err) {
      setError(friendlyApiError(err))
    } finally {
      setBusy('')
    }
  }

  const runJudgment = async () => {
    setError('')
    try {
      setBusy('AI가 루브릭 판정 초안을 작성하는 중… (1~3분)')
      const { judgments: j, excluded } = await judgeRubric({
        apiKey: apiKey.trim(),
        model,
        files,
        track,
        scanSummary: scanSummaryText(),
      })
      setJudgments(j)
      setExcludedFiles(excluded)
      setStep('judged')
    } catch (err) {
      setError(friendlyApiError(err))
    } finally {
      setBusy('')
    }
  }

  const setOverride = (id, verdict, note) => {
    if (!verdict) {
      const next = { ...overrides }
      delete next[id]
      setOverrides(next)
    } else {
      setOverrides({ ...overrides, [id]: { verdict, note: note ?? overrides[id]?.note ?? '' } })
    }
  }

  const trackItems = track ? rubricItems.filter((it) => it.tracks.includes(track)) : []
  const aiItems = trackItems.filter((it) => it.aiVerifiable)
  const humanItems = trackItems.filter((it) => !it.aiVerifiable)

  return (
    <section className="panel review-mode">
      <div className="panel-head">
        <h2><span className="panel-icon">⚖️</span> 심사 모드 <span className="rm-beta">베타</span></h2>
        <button className="btn-secondary" onClick={onExit}>자가점검으로 돌아가기</button>
      </div>
      <p className="panel-intro">
        AI가 코드에서 증거를 수집해 루브릭 v{RUBRIC_VERSION} 판정 초안을 만들고, 심사자가 최종 판정합니다.
        교사가 제출 전 스스로 돌려보는 <strong>모의심사</strong>로도 쓸 수 있어요. 분석 시 코드가 Anthropic 서버로 전송됩니다.
      </p>

      {error && <div className="ai-error">⚠️ {error}</div>}
      {busy && <div className="rm-busy">⏳ {busy}</div>}

      {step === 'setup' && (
        <div className="rm-setup">
          <label className="ai-label">심사 대상 GitHub 주소
            <input type="text" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/아이디/저장소" disabled={!!busy} />
          </label>
          <label className="ai-label">심사자 Anthropic API 키 (저장되지 않음)
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..." autoComplete="off" />
          </label>
          <label className="ai-label">모델
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {AI_MODELS.map((m) => (<option key={m.id} value={m.id}>{m.label}</option>))}
            </select>
          </label>
          <button className="btn-primary" onClick={loadAndClassify} disabled={!!busy || !repoUrl.trim() || !apiKey.trim()}>
            ① 저장소 불러오기 + 분류 추론
          </button>
        </div>
      )}

      {step === 'category' && aiCategory && (
        <div className="rm-category">
          <div className="rm-repo-line">
            📦 {repoMeta.owner}/{repoMeta.repo} ({repoMeta.branch}) · 커밋 <code>{repoMeta.commitSha.slice(0, 12)}</code> · 파일 {files.length}개
            {scanResult && ` · 자동 스캔 ${securityGrade(scanResult).score}점`}
          </div>
          <div className="rm-ai-suggest">
            <strong>AI 분류 추론:</strong> {TRACKS[aiCategory.category].icon} {TRACKS[aiCategory.category].label}
            {' '}(확신도 {(aiCategory.confidence * 100).toFixed(0)}%)
            <p className="rm-reasoning">{aiCategory.reasoning}</p>
            <ul>{aiCategory.evidence.map((e, i) => (<li key={i}>{e}</li>))}</ul>
          </div>
          <div className="rm-track-pick">
            <strong>심사자 확정 (트랙 선택)</strong>
            {Object.entries(TRACKS).map(([key, t]) => (
              <label key={key} className="rm-track-option">
                <input type="radio" name="track" checked={track === key} onChange={() => setTrack(key)} />
                <span>{t.icon} {t.label}</span> <em>{t.desc}</em>
              </label>
            ))}
          </div>
          {track === 'learning_content' && (
            <div className="rm-standards">
              <strong>성취기준 태깅 (선택)</strong>
              <div className="rm-standards-row">
                <select value={standards.subject} onChange={(e) => setStandards({ ...standards, subject: e.target.value })}>
                  <option value="">교과 선택</option>
                  {SUBJECTS.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
                <select value={standards.gradeBand} onChange={(e) => setStandards({ ...standards, gradeBand: e.target.value })}>
                  <option value="">학년군 선택</option>
                  {GRADE_BANDS.map((g) => (<option key={g} value={g}>{g}</option>))}
                </select>
              </div>
              <textarea rows={2} value={standards.codes} placeholder="성취기준 코드·문장 (예: [9국01-02] …)"
                onChange={(e) => setStandards({ ...standards, codes: e.target.value })} />
            </div>
          )}
          <button className="btn-primary" onClick={runJudgment} disabled={!!busy || !track}>
            ② 이 트랙으로 루브릭 판정 시작
          </button>
        </div>
      )}

      {step === 'judged' && (
        <div className="rm-judged">
          {excludedFiles.length > 0 && (
            <div className="ai-notice"><p>⚠️ 용량 초과로 분석에서 제외된 파일: {excludedFiles.join(', ')} — 판정의 한계로 보고서에 감안하세요.</p></div>
          )}
          <h3 className="rm-section-title">AI 판정 초안 — 항목별로 근거를 확인하고 승인하거나 번복하세요</h3>
          {aiItems.map((it) => {
            const j = judgments[it.id]
            const ov = overrides[it.id]
            return (
              <div key={it.id} className={`rm-item rm-v-${ov?.verdict || j?.verdict}`}>
                <div className="rm-item-head">
                  <span className={`rm-badge ${it.type}`}>{it.type === 'required' ? '필수' : `점수 ${it.weight}`}</span>
                  <strong>{it.question}</strong>
                  <span className={`rm-verdict rm-${ov?.verdict || j?.verdict}`}>
                    {VERDICT_LABELS[ov?.verdict || j?.verdict]}{ov ? ' (번복)' : ''}
                  </span>
                </div>
                {j?.evidence?.map((e, i) => (
                  <div key={i} className="rr-evidence"><span>{e.file}:{e.line}</span> <code>{e.quote}</code></div>
                ))}
                {j?.reasoning && <p className="rm-reasoning">{j.reasoning}</p>}
                <div className="rm-override-row">
                  <select value={ov?.verdict || ''} onChange={(e) => setOverride(it.id, e.target.value || null)}>
                    <option value="">AI 판정 승인</option>
                    {VERDICT_OPTIONS.map((v) => (<option key={v} value={v}>번복 → {VERDICT_LABELS[v]}</option>))}
                  </select>
                  {ov && (
                    <input type="text" placeholder="번복 사유 (기록에 남음)" value={ov.note}
                      onChange={(e) => setOverride(it.id, ov.verdict, e.target.value)} />
                  )}
                </div>
              </div>
            )
          })}

          <h3 className="rm-section-title">심사자 수동 판정 — AI가 코드만으로 판단할 수 없는 항목</h3>
          {humanItems.map((it) => {
            const hi = humanInputs[it.id]
            return (
              <div key={it.id} className="rm-item rm-human">
                <div className="rm-item-head">
                  <span className={`rm-badge ${it.type}`}>{it.type === 'required' ? '필수' : `점수 ${it.weight}`}</span>
                  <strong>{it.question}</strong>
                </div>
                <p className="rm-reasoning">{it.evidenceHint}</p>
                <div className="rm-override-row">
                  <select value={hi?.verdict || ''} onChange={(e) =>
                    setHumanInputs({ ...humanInputs, [it.id]: { verdict: e.target.value, note: hi?.note || '' } })}>
                    <option value="">판정 선택</option>
                    {VERDICT_OPTIONS.map((v) => (<option key={v} value={v}>{VERDICT_LABELS[v]}</option>))}
                  </select>
                  <input type="text" placeholder="판정 근거 메모" value={hi?.note || ''}
                    onChange={(e) => setHumanInputs({ ...humanInputs, [it.id]: { verdict: hi?.verdict || '', note: e.target.value } })} />
                </div>
              </div>
            )
          })}

          <label className="ai-label">종합 의견
            <textarea rows={3} value={opinion} onChange={(e) => setOpinion(e.target.value)}
              placeholder="심사자 종합 의견 (보고서에 표시)" />
          </label>
          <label className="ai-label rm-reviewer">심사자 이름
            <input type="text" value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} placeholder="예: ○○중학교 ○○○" />
          </label>
          <button className="btn-primary" onClick={() => setStep('report')}>③ 심사 보고서 생성</button>
        </div>
      )}

      {step === 'report' && (
        <div>
          <ReviewReport
            repoUrl={repoUrl}
            repoMeta={repoMeta}
            track={track}
            standards={track === 'learning_content' ? standards : null}
            scanCounts={securityGrade(scanResult).counts}
            judgments={judgments}
            overrides={overrides}
            humanInputs={humanInputs}
            opinion={opinion}
            reviewerName={reviewerName}
          />
          <div className="report-actions">
            <button className="btn-primary" onClick={() => window.print()}>🖨️ 인쇄 / PDF 저장</button>
            <button className="btn-secondary" onClick={() => setStep('judged')}>판정으로 돌아가기</button>
          </div>
        </div>
      )}
    </section>
  )
}

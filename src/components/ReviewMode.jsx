import { useEffect, useRef, useState } from 'react'
import { parseGithubUrl, fetchRepoFiles } from '../lib/github.js'
import { readLocalFolder } from '../lib/localFolder.js'
import { checkSubmission } from '../lib/submissionGate.js'
import { scanFiles } from '../lib/scanner.js'
import { securityGrade } from '../lib/scoring.js'
import { AI_MODELS, friendlyApiError } from '../lib/aiReview.js'
import { TRACKS, rubricItems, RUBRIC_VERSION } from '../data/rubric.js'
import { inferCategory, judgeRubric, VERDICT_LABELS } from '../lib/reviewAi.js'
import { computeSummary } from '../lib/reviewSummary.js'
import { SEVERITIES } from '../data/securityRules.js'
import ReviewReport from './ReviewReport.jsx'

const metaTitle = (m) => (m.owner ? `${m.owner}/${m.repo}` : m.repo)
const shaWord = (m) => (m.source === 'local' ? '지문' : '커밋')

const SUBJECTS = ['국어', '도덕', '사회', '역사', '수학', '과학', '기술·가정', '정보', '체육', '음악', '미술', '영어', '기타']
const GRADE_BANDS = ['초1-2', '초3-4', '초5-6', '중1-3', '고1-3']
const VERDICT_OPTIONS = ['pass', 'fail', 'na', 'needs_human']

export default function ReviewMode({ onSaveRecord }) {
  const [step, setStep] = useState('setup') // setup | loaded | category | judged | report
  const [repoUrl, setRepoUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(AI_MODELS[0].id)
  const [busy, setBusy] = useState('')
  const [busyDetail, setBusyDetail] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')

  // 작업 중 경과 시간 표시 — 긴 AI 대기에서 "멈춘 게 아님"을 보여준다
  const isBusy = busy !== ''
  useEffect(() => {
    if (!isBusy) {
      setElapsed(0)
      return
    }
    const t0 = Date.now()
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000)
    return () => clearInterval(iv)
  }, [isBusy])

  // github: {source, owner, repo, branch, commitSha} / local: {source, repo: 폴더명, branch: '로컬 업로드', commitSha: 콘텐츠 지문}
  const [repoMeta, setRepoMeta] = useState(null)
  const folderInputRef = useRef(null)
  const [files, setFiles] = useState([])
  const [scanResult, setScanResult] = useState(null)
  const [gate, setGate] = useState([])
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

  // ① 저장소 로드 + 규칙 스캔 — API 키 없이 가능 (선별·사전 확인 단계)
  const loadRepo = async () => {
    const parsed = parseGithubUrl(repoUrl)
    if (!parsed) return setError('주소 형식을 알 수 없어요. 예: https://github.com/아이디/저장소')
    setError('')
    try {
      setBusy('저장소 불러오는 중…')
      const result = await fetchRepoFiles({ ...parsed, onProgress: (d, t) => setBusy(`파일 내려받는 중… ${d}/${t}`) })
      if (result.files.length === 0) throw new Error('검사할 수 있는 파일이 없어요.')
      setRepoMeta({ source: 'github', owner: parsed.owner, repo: parsed.repo, branch: result.branch, commitSha: result.commitSha })
      setFiles(result.files)
      setScanResult(scanFiles(result.files))
      setGate(checkSubmission(result.files, { source: 'github', skippedCount: result.skippedCount, truncated: result.truncated }))
      setStep('loaded')
    } catch (err) {
      setError(friendlyApiError(err))
    } finally {
      setBusy('')
    }
  }

  // ①′ 폴더 업로드 — 비공개 저장소·미공개 프로젝트용. 파일은 이 브라우저 밖으로 나가지 않는다(AI 단계 전까지)
  const loadFolder = async (fileList) => {
    if (!fileList || fileList.length === 0) return
    setError('')
    try {
      setBusy('폴더 파일 읽는 중…')
      const result = await readLocalFolder(fileList)
      setRepoUrl('')
      setRepoMeta({ source: 'local', owner: null, repo: result.folderName, branch: '로컬 업로드', commitSha: result.contentSha })
      setFiles(result.files)
      setScanResult(scanFiles(result.files))
      setGate(checkSubmission(result.files, { source: 'local', skippedCount: result.skippedCount }))
      setStep('loaded')
    } catch (err) {
      setError(friendlyApiError(err))
    } finally {
      setBusy('')
      if (folderInputRef.current) folderInputRef.current.value = ''
    }
  }

  // ② AI 분류 추론 — 여기부터 심사자 API 키 필요
  const classify = async () => {
    if (!apiKey.trim()) return setError('심사자 API 키를 입력해 주세요.')
    setError('')
    let received = 0
    try {
      setBusy('AI가 앱 분류를 추론하는 중…')
      const cat = await inferCategory({
        apiKey: apiKey.trim(),
        model,
        files,
        onText: (t) => {
          received += t.length
          setBusyDetail(`AI 응답 수신 중 (${received}자)`)
        },
      })
      setAiCategory(cat)
      setTrack(cat.category)
      setStep('category')
    } catch (err) {
      setError(friendlyApiError(err))
    } finally {
      setBusy('')
      setBusyDetail('')
    }
  }

  const runJudgment = async () => {
    setError('')
    let received = 0
    try {
      setBusy('AI가 루브릭 판정 초안을 작성하는 중… (1~3분)')
      const { judgments: j, excluded } = await judgeRubric({
        apiKey: apiKey.trim(),
        model,
        files,
        track,
        scanSummary: scanSummaryText(),
        onText: (t) => {
          received += t.length
          setBusyDetail(`AI 응답 ${(received / 1000).toFixed(1)}k자 수신 중`)
        },
      })
      setJudgments(j)
      setExcludedFiles(excluded)
      setStep('judged')
    } catch (err) {
      setError(friendlyApiError(err))
    } finally {
      setBusy('')
      setBusyDetail('')
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

  // 새 심사 시작 — 진행 중 판정이 있으면 확인
  const resetReview = () => {
    if (
      Object.keys(judgments).length > 0 &&
      !confirm('진행 중인 심사 기록이 사라집니다. 새 심사를 시작할까요?')
    ) {
      return
    }
    setStep('setup')
    setRepoUrl('')
    setRepoMeta(null)
    setFiles([])
    setScanResult(null)
    setGate([])
    setAiCategory(null)
    setTrack(null)
    setStandards({ subject: '', gradeBand: '', codes: '' })
    setJudgments({})
    setExcludedFiles([])
    setOverrides({})
    setHumanInputs({})
    setOpinion('')
    setError('')
  }

  const saveRecord = () => {
    const summary = computeSummary(track, judgments, overrides, humanInputs)
    onSaveRecord({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      source: repoMeta.source,
      repoUrl,
      owner: repoMeta.owner,
      repo: repoMeta.repo,
      branch: repoMeta.branch,
      commitSha: repoMeta.commitSha,
      track,
      trackLabel: TRACKS[track].label,
      standards: track === 'learning_content' ? standards : null,
      rubricVersion: RUBRIC_VERSION,
      status: summary.status,
      score: summary.score,
      requiredFails: summary.requiredFails.length,
      needsHuman: summary.needsHuman.length,
      reviewerName,
      opinion,
    })
  }

  return (
    <section className="panel review-mode">
      <div className="panel-head">
        <h2><span className="panel-icon">⚖️</span> 앱 심사 <span className="rm-beta">베타</span></h2>
        {step !== 'setup' && (
          <button className="btn-secondary" onClick={resetReview}>새 심사 시작</button>
        )}
      </div>
      <p className="panel-intro">
        교사 제작 앱의 점검·검수·평가 도구입니다. AI가 코드에서 증거를 수집해 루브릭 v{RUBRIC_VERSION} 판정
        초안을 만들고, <strong>최종 판정은 심사자가</strong> 합니다. AI 분석 단계에서 코드가 Anthropic 서버로
        전송됩니다. 심사 대상 코드는 신뢰할 수 없는 입력으로 취급하세요 — 근거 인용을 반드시 직접 확인하세요.
      </p>

      {error && <div className="ai-error">⚠️ {error}</div>}
      {busy && (
        <div className="rm-busy" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <div className="rm-busy-text">
            <strong>{busy}</strong>
            <span className="rm-busy-sub">
              {busyDetail ? `${busyDetail} · ` : ''}경과 {elapsed}초 — 화면이 멈춘 게 아니에요, 작업이 진행되고 있어요
            </span>
          </div>
        </div>
      )}

      {step === 'setup' && (
        <div className="rm-setup">
          <label className="ai-label">심사 대상 GitHub 주소
            <input type="text" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !busy && repoUrl.trim()) loadRepo() }}
              placeholder="https://github.com/아이디/저장소" disabled={!!busy} />
          </label>
          <button className="btn-primary" onClick={loadRepo} disabled={!!busy || !repoUrl.trim()}>
            ① 저장소 불러오기 + 규칙 스캔
          </button>
          <div className="or-divider">또는</div>
          <input ref={folderInputRef} type="file" webkitdirectory="" multiple style={{ display: 'none' }}
            onChange={(e) => loadFolder(e.target.files)} />
          <button className="btn-secondary" onClick={() => folderInputRef.current?.click()} disabled={!!busy}>
            📁 프로젝트 폴더 업로드 + 규칙 스캔
          </button>
          <p className="gh-hint">
            GitHub 주소는 공개 저장소만 가능하고, 비공개·미공개 프로젝트는 폴더 업로드를 사용하세요. 폴더
            심사에는 커밋 해시 대신 파일 내용 전체의 SHA-256 지문이 기록됩니다. 심사자 API 키는 다음
            단계(AI 분석)부터 사용됩니다.
          </p>
        </div>
      )}

      {step === 'loaded' && repoMeta && (
        <div className="rm-loaded">
          <div className="rm-repo-line">
            {repoMeta.source === 'local' ? '📁' : '📦'} {metaTitle(repoMeta)} ({repoMeta.branch}) · {shaWord(repoMeta)} <code>{repoMeta.commitSha.slice(0, 12)}</code> · 파일 {files.length}개
          </div>
          <div className="rm-gate">
            <strong>제출 완결성 사전 게이트</strong>
            <ul>
              {gate.map((g) => (
                <li key={g.id} className={g.ok ? 'gate-ok' : 'gate-warn'}>
                  {g.ok ? (g.na ? '➖' : '✅') : '⚠️'} {g.label} — {g.detail}
                </li>
              ))}
            </ul>
            {gate.some((g) => !g.ok) && (
              <p className="gate-note">
                미비 항목이 있습니다 — 심사를 진행하기보다 제출자에게 보완을 요청(반려)하는 것을 권합니다.
              </p>
            )}
          </div>
          <div className="rm-scan-box">
            <strong>자동 규칙 스캔: {securityGrade(scanResult).score}점</strong>
            {scanResult.findings.length === 0 ? (
              <p className="rm-reasoning">등록된 패턴에서 발견된 문제 없음</p>
            ) : (
              <ul className="rm-scan-list">
                {scanResult.findings.map((f) => (
                  <li key={f.rule.id}>
                    <span className="sev-badge" style={{ background: SEVERITIES[f.rule.severity].color }}>
                      {SEVERITIES[f.rule.severity].label}
                    </span>{' '}
                    {f.rule.title} ({f.occurrences.length}곳)
                  </li>
                ))}
              </ul>
            )}
          </div>
          <label className="ai-label">심사자 Anthropic API 키 (저장되지 않음)
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..." autoComplete="off" disabled={!!busy} />
          </label>
          <label className="ai-label">모델
            <select value={model} onChange={(e) => setModel(e.target.value)} disabled={!!busy}>
              {AI_MODELS.map((m) => (<option key={m.id} value={m.id}>{m.label}</option>))}
            </select>
          </label>
          <button className="btn-primary" onClick={classify} disabled={!!busy || !apiKey.trim()}>
            ② AI 분류 추론
          </button>
        </div>
      )}

      {step === 'category' && aiCategory && (
        <div className="rm-category">
          <div className="rm-repo-line">
            {repoMeta.source === 'local' ? '📁' : '📦'} {metaTitle(repoMeta)} ({repoMeta.branch}) · {shaWord(repoMeta)} <code>{repoMeta.commitSha.slice(0, 12)}</code> · 파일 {files.length}개
            {scanResult && ` · 자동 스캔 ${securityGrade(scanResult).score}점`}
          </div>
          <div className="rm-ai-suggest">
            <strong>AI 분류 추론:</strong> {TRACKS[aiCategory.category].icon} {TRACKS[aiCategory.category].label}
            {' '}(확신도 {(aiCategory.confidence * 100).toFixed(0)}%)
            <p className="rm-reasoning">{aiCategory.reasoning}</p>
            <ul>{aiCategory.evidence.map((e, i) => (<li key={i}>{e}</li>))}</ul>
          </div>
          {aiCategory.excludedFiles?.length > 0 && (
            <div className="ai-notice"><p>⚠️ 용량 초과로 분류 분석에서 제외된 파일: {aiCategory.excludedFiles.join(', ')}</p></div>
          )}
          <div className="rm-track-pick">
            <strong>심사자 확정 (트랙 선택)</strong>
            {Object.entries(TRACKS).map(([key, t]) => (
              <label key={key} className="rm-track-option">
                <input type="radio" name="track" checked={track === key} onChange={() => setTrack(key)} disabled={!!busy} />
                <span>{t.icon} {t.label}</span> <em>{t.desc}</em>
              </label>
            ))}
          </div>
          {track === 'learning_content' && (
            <div className="rm-standards">
              <strong>성취기준 태깅 (선택)</strong>
              <div className="rm-standards-row">
                <select value={standards.subject} disabled={!!busy} onChange={(e) => setStandards({ ...standards, subject: e.target.value })}>
                  <option value="">교과 선택</option>
                  {SUBJECTS.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
                <select value={standards.gradeBand} disabled={!!busy} onChange={(e) => setStandards({ ...standards, gradeBand: e.target.value })}>
                  <option value="">학년군 선택</option>
                  {GRADE_BANDS.map((g) => (<option key={g} value={g}>{g}</option>))}
                </select>
              </div>
              <textarea rows={2} value={standards.codes} disabled={!!busy} placeholder="성취기준 코드·문장 (예: [9국01-02] …)"
                onChange={(e) => setStandards({ ...standards, codes: e.target.value })} />
            </div>
          )}
          <button className="btn-primary" onClick={runJudgment} disabled={!!busy || !track}>
            ③ 이 트랙으로 루브릭 판정 시작
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
                <p className="rm-plain">💡 {it.plain}</p>
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
                <p className="rm-plain">💡 {it.plain}</p>
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
          <button className="btn-primary" onClick={() => setStep('report')}>④ 심사 보고서 생성</button>
        </div>
      )}

      {step === 'report' && (
        <div>
          <ReviewReport
            repoUrl={repoUrl}
            repoMeta={repoMeta}
            track={track}
            standards={track === 'learning_content' ? standards : null}
            scanCounts={securityGrade(scanResult).counts ?? { critical: 0, warning: 0, info: 0 }}
            scanFindings={scanResult?.findings ?? []}
            judgments={judgments}
            overrides={overrides}
            humanInputs={humanInputs}
            opinion={opinion}
            reviewerName={reviewerName}
          />
          <div className="report-actions">
            <button className="btn-primary" onClick={() => window.print()}>🖨️ 인쇄 / PDF 저장</button>
            <button className="btn-secondary" onClick={saveRecord}>📚 심사 기록에 저장</button>
            <button className="btn-secondary" onClick={() => setStep('judged')}>판정으로 돌아가기</button>
          </div>
        </div>
      )}
    </section>
  )
}

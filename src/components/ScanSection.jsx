import { useRef, useState } from 'react'
import { CATEGORIES, SEVERITIES } from '../data/securityRules.js'
import { isScannableFile, scanFiles } from '../lib/scanner.js'
import { parseGithubUrl, fetchRepoFiles } from '../lib/github.js'
import { GRADES, securityGrade } from '../lib/scoring.js'
import AiSection from './AiSection.jsx'

function FindingCard({ finding }) {
  const [open, setOpen] = useState(finding.rule.severity === 'critical')
  const [copied, setCopied] = useState(false)
  const { rule, occurrences } = finding
  const sev = SEVERITIES[rule.severity]

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(rule.aiPrompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      window.prompt('아래 내용을 복사하세요', rule.aiPrompt)
    }
  }

  return (
    <div className={`finding sev-${rule.severity}`}>
      <button className="finding-head" onClick={() => setOpen(!open)}>
        <span className="sev-badge" style={{ background: sev.color }}>
          {sev.label}
        </span>
        <span className="finding-title">{rule.title}</span>
        <span className="finding-count">{occurrences.length}곳</span>
        <span className="finding-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="finding-body">
          <p className="finding-explain">{rule.explain}</p>
          <div className="finding-block">
            <strong>무슨 일이 생길 수 있나요?</strong>
            <p>{rule.risk}</p>
          </div>
          <div className="finding-block">
            <strong>어떻게 고치나요?</strong>
            <p>{rule.fix}</p>
          </div>
          <div className="finding-locs">
            <strong>발견 위치</strong>
            {occurrences.slice(0, 8).map((o, i) => (
              <div key={i} className="loc-row">
                <span className="loc-file">
                  {o.file}:{o.line}
                </span>
                <code>{o.snippet}</code>
              </div>
            ))}
            {occurrences.length > 8 && (
              <p className="loc-more">…외 {occurrences.length - 8}곳</p>
            )}
          </div>
          <div className="ai-prompt-box">
            <div className="ai-prompt-head">
              <strong>🤖 AI에게 이렇게 요청하세요</strong>
              <button className="copy-btn" onClick={copyPrompt}>
                {copied ? '복사됨 ✓' : '복사'}
              </button>
            </div>
            <p>{rule.aiPrompt}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ScanSection({ files, setFiles, scanResult, setScanResult }) {
  const [pasted, setPasted] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [repoUrl, setRepoUrl] = useState('')
  const [repoLoading, setRepoLoading] = useState(false)
  const [repoProgress, setRepoProgress] = useState('')
  const [repoError, setRepoError] = useState('')
  const [repoNote, setRepoNote] = useState('')
  const fileInput = useRef(null)
  const folderInput = useRef(null)

  const loadRepo = async () => {
    const parsed = parseGithubUrl(repoUrl)
    if (!parsed) {
      setRepoError('주소 형식을 알 수 없어요. 예: https://github.com/아이디/저장소')
      return
    }
    setRepoLoading(true)
    setRepoError('')
    setRepoNote('')
    setRepoProgress('파일 목록 가져오는 중…')
    try {
      const result = await fetchRepoFiles({
        ...parsed,
        onProgress: (d, t) => setRepoProgress(`파일 내려받는 중… ${d}/${t}`),
      })
      if (result.files.length === 0) {
        throw new Error('검사할 수 있는 파일(HTML/JS/CSS 등)이 이 저장소에 없어요.')
      }
      // 저장소 단위 검사: 이전 목록(다른 저장소·업로드 파일)과 섞이지 않도록 교체한다
      setFiles(result.files)
      setScanResult(scanFiles(result.files))
      setRepoNote(
        `✅ ${parsed.owner}/${parsed.repo} (${result.branch} 브랜치) — ${result.files.length}개 파일을 검사했어요.` +
          (result.skippedCount > 0 ? ` (이미지·라이브러리 등 ${result.skippedCount}개 제외)` : '')
      )
    } catch (err) {
      setRepoError(err.message)
    } finally {
      setRepoLoading(false)
      setRepoProgress('')
    }
  }

  const addFiles = async (fileList) => {
    const next = [...files]
    const rejected = []
    for (const file of fileList) {
      const check = isScannableFile(file)
      const path = file.webkitRelativePath || file.name
      if (!check.ok) {
        rejected.push({ path, reason: check.reason })
        continue
      }
      if (next.some((f) => f.path === path)) continue
      const text = await file.text()
      next.push({ path, name: file.name, size: file.size, text })
    }
    setFiles(next)
    setScanResult(null)
    if (rejected.length > 0 && rejected.length === fileList.length) {
      alert(
        '추가된 파일이 없어요.\n' +
          rejected.slice(0, 5).map((r) => `· ${r.path} — ${r.reason}`).join('\n')
      )
    }
  }

  const onDrop = async (e) => {
    e.preventDefault()
    setDragOver(false)
    await addFiles([...e.dataTransfer.files])
  }

  const addPasted = () => {
    if (!pasted.trim()) return
    const path = `붙여넣은-코드-${files.filter((f) => f.path.startsWith('붙여넣은')).length + 1}.txt`
    setFiles([...files, { path, name: path, size: pasted.length, text: pasted }])
    setPasted('')
    setScanResult(null)
  }

  const runScan = () => {
    if (files.length === 0) return
    setScanResult(scanFiles(files))
  }

  const removeFile = (path) => {
    setFiles(files.filter((f) => f.path !== path))
    setScanResult(null)
  }

  const gradeInfo = securityGrade(scanResult)

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>
          <span className="panel-icon">🔍</span> 코드 보안 스캔
        </h2>
        {scanResult && (
          <span className="grade-chip" style={{ background: GRADES[gradeInfo.grade].color }}>
            {GRADES[gradeInfo.grade].emoji} {GRADES[gradeInfo.grade].label} · {gradeInfo.score}점
          </span>
        )}
      </div>
      <p className="panel-intro">
        앱의 코드 파일을 올리면 바이브 코딩에서 자주 나오는 취약점 30여 종을 검사해요.{' '}
        <strong>코드는 브라우저 밖으로 전송되지 않아요</strong> — 검사는 전부 이 화면 안에서
        이루어집니다.
      </p>

      <div className="gh-loader">
        <label className="gh-label" htmlFor="gh-url">
          GitHub 주소로 바로 검사
        </label>
        <div className="gh-row">
          <input
            id="gh-url"
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !repoLoading && repoUrl.trim()) loadRepo()
            }}
            placeholder="https://github.com/아이디/저장소 (배포 주소 ○○.github.io/앱 도 돼요)"
            disabled={repoLoading}
          />
          <button
            className="btn-primary gh-btn"
            onClick={loadRepo}
            disabled={repoLoading || !repoUrl.trim()}
          >
            {repoLoading ? repoProgress || '불러오는 중…' : '불러와서 검사'}
          </button>
        </div>
        {repoError && <p className="gh-error">⚠️ {repoError}</p>}
        {repoNote && <p className="gh-note-ok">{repoNote}</p>}
        <p className="gh-hint">
          공개 저장소만 가능해요. 파일은 GitHub에서 이 브라우저로 직접 내려받아 검사하며, 다른
          서버로는 전송되지 않아요.
        </p>
      </div>

      <div className="or-divider">또는 파일 직접 올리기</div>

      <div
        className={`dropzone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <p className="drop-title">파일을 여기에 끌어다 놓으세요</p>
        <p className="drop-sub">HTML, JS, CSS, JSON, 보안규칙 파일 등</p>
        <div className="drop-buttons">
          <button className="btn-secondary" onClick={() => fileInput.current.click()}>
            파일 선택
          </button>
          <button className="btn-secondary" onClick={() => folderInput.current.click()}>
            폴더 통째로 선택
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(e) => addFiles([...e.target.files])}
        />
        <input
          ref={folderInput}
          type="file"
          webkitdirectory=""
          multiple
          hidden
          onChange={(e) => addFiles([...e.target.files])}
        />
      </div>

      <details className="paste-details">
        <summary>또는 코드를 직접 붙여넣기</summary>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="코드를 붙여넣으세요 (index.html 전체, 보안 규칙 등)"
          rows={8}
        />
        <button className="btn-secondary" onClick={addPasted} disabled={!pasted.trim()}>
          목록에 추가
        </button>
      </details>

      {files.length > 0 && (
        <div className="file-list">
          <strong>검사할 파일 ({files.length}개)</strong>
          <ul>
            {files.map((f) => (
              <li key={f.path}>
                <span className="file-path">{f.path}</span>
                <span className="file-size">{(f.size / 1024).toFixed(1)}KB</span>
                <button className="file-remove" onClick={() => removeFile(f.path)} aria-label="제거">
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button className="btn-primary" onClick={runScan}>
            🔍 검사 시작
          </button>
        </div>
      )}

      {scanResult && (
        <div className="scan-result">
          <div className="result-summary">
            <div className="score-big" style={{ color: GRADES[gradeInfo.grade].color }}>
              {gradeInfo.score}
              <span className="score-unit">점</span>
            </div>
            <div className="severity-counts">
              <span className="count-chip chip-critical">심각 {gradeInfo.counts.critical}</span>
              <span className="count-chip chip-warning">경고 {gradeInfo.counts.warning}</span>
              <span className="count-chip chip-info">확인 필요 {gradeInfo.counts.info}</span>
            </div>
          </div>

          {scanResult.findings.length === 0 ? (
            <div className="all-clear">
              🎉 등록된 패턴에서는 문제가 발견되지 않았어요! 다만 자동 검사가 모든 문제를 찾아내는
              것은 아니에요. 개인정보·AI 윤리 체크리스트와 AI 정밀 분석도 함께 활용해 보세요.
            </div>
          ) : (
            <>
              <p className="result-note">
                자동 검사에는 오탐(문제가 아닌데 잡히는 경우)이 있을 수 있어요. 각 항목의 설명을
                읽고 내 앱 상황에 맞는지 판단해 주세요.
              </p>
              <div className="findings">
                {scanResult.findings.map((f) => (
                  <FindingCard key={f.rule.id} finding={f} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {files.length > 0 && (
        <AiSection files={files} ruleFindings={scanResult ? scanResult.findings : []} />
      )}
    </section>
  )
}

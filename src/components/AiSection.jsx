import { useMemo, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { AI_MODELS, MAX_AI_CHARS, friendlyApiError, runAiReview } from '../lib/aiReview.js'

export default function AiSection({ files, ruleFindings }) {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(AI_MODELS[0].id)
  const [selected, setSelected] = useState(() => new Set(files.map((f) => f.path)))
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')

  // files가 바뀌면 새 파일을 선택 목록에 반영
  const fileSet = files.map((f) => f.path).join('|')
  useMemo(() => {
    setSelected(new Set(files.map((f) => f.path)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileSet])

  const selectedFiles = files.filter((f) => selected.has(f.path))
  const totalChars = selectedFiles.reduce((s, f) => s + f.text.length, 0)
  const overLimit = totalChars > MAX_AI_CHARS

  const toggle = (path) => {
    const next = new Set(selected)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    setSelected(next)
  }

  const run = async () => {
    setError('')
    setOutput('')
    setRunning(true)
    try {
      await runAiReview({
        apiKey: apiKey.trim(),
        model,
        files: selectedFiles,
        ruleFindings,
        onText: (t) => setOutput((prev) => prev + t),
      })
    } catch (err) {
      setError(friendlyApiError(err))
    } finally {
      setRunning(false)
    }
  }

  const html = useMemo(
    () => (output ? DOMPurify.sanitize(marked.parse(output)) : ''),
    [output]
  )

  return (
    <details className="ai-section">
      <summary>
        <span className="ai-summary-title">🤖 AI 정밀 분석 (선택 사항)</span>
        <span className="ai-summary-sub">내 Claude API 키로 코드 전체를 맥락까지 분석</span>
      </summary>
      <div className="ai-body">
        <div className="ai-notice">
          <p>
            <strong>주의:</strong> AI 분석을 실행하면 선택한 코드가 Anthropic(Claude) 서버로
            전송돼요. 학생 개인정보가 담긴 데이터 파일은 선택에서 빼 주세요. API 키는{' '}
            <strong>저장되지 않고</strong> 이 화면에서만 사용돼요. 키 발급:{' '}
            <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">
              console.anthropic.com
            </a>
          </p>
        </div>

        <label className="ai-label">
          Anthropic API 키
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            autoComplete="off"
          />
        </label>

        <label className="ai-label">
          모델
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {AI_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} ({m.note})
              </option>
            ))}
          </select>
        </label>

        <div className="ai-files">
          <strong>분석할 파일 선택</strong>
          {files.map((f) => (
            <label key={f.path} className="ai-file-row">
              <input
                type="checkbox"
                checked={selected.has(f.path)}
                onChange={() => toggle(f.path)}
              />
              <span>{f.path}</span>
              <span className="file-size">{(f.text.length / 1000).toFixed(1)}k자</span>
            </label>
          ))}
          <p className={`ai-total ${overLimit ? 'over' : ''}`}>
            선택 합계 {(totalChars / 1000).toFixed(0)}k자 / 최대 {MAX_AI_CHARS / 1000}k자
            {overLimit && ' — 파일을 줄여 주세요'}
          </p>
        </div>

        <button
          className="btn-primary"
          onClick={run}
          disabled={running || !apiKey.trim() || selectedFiles.length === 0 || overLimit}
        >
          {running ? '분석 중… (1~3분 걸릴 수 있어요)' : 'AI 분석 시작'}
        </button>

        {error && <div className="ai-error">⚠️ {error}</div>}
        {html && (
          <div className="ai-output">
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        )}
      </div>
    </details>
  )
}

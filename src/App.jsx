import { useEffect, useState } from 'react'
import Home from './components/Home.jsx'
import ScanSection from './components/ScanSection.jsx'
import Checklist from './components/Checklist.jsx'
import Report from './components/Report.jsx'
import { privacyGate, privacyItems, privacyAlwaysItems } from './data/privacyChecklist.js'
import { ethicsGate, ethicsItems, ethicsAlwaysItems } from './data/ethicsChecklist.js'
import { opsGate, opsItems, opsAlwaysItems } from './data/opsChecklist.js'
import { securityGrade, privacyGrade, ethicsGrade, opsGrade } from './lib/scoring.js'

const STORAGE_KEY = 'vibecheck-v1'

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

const TABS = [
  { id: 'home', label: '홈', icon: '🏠' },
  { id: 'scan', label: '보안 스캔', icon: '🔍' },
  { id: 'privacy', label: '개인정보', icon: '🪪' },
  { id: 'ethics', label: 'AI 윤리', icon: '🤖' },
  { id: 'ops', label: '운영·복구', icon: '🧯' },
  { id: 'report', label: '리포트', icon: '📋' },
]

export default function App() {
  const saved = loadSaved()
  const [tab, setTab] = useState('home')
  const [files, setFiles] = useState([])
  const [scanResult, setScanResult] = useState(null)
  const [appName, setAppName] = useState(saved.appName || '')
  const [privacyGateAnswer, setPrivacyGateAnswer] = useState(saved.privacyGateAnswer ?? null)
  const [privacyAnswers, setPrivacyAnswers] = useState(saved.privacyAnswers || {})
  const [ethicsGateAnswer, setEthicsGateAnswer] = useState(saved.ethicsGateAnswer ?? null)
  const [ethicsAnswers, setEthicsAnswers] = useState(saved.ethicsAnswers || {})
  const [opsGateAnswer, setOpsGateAnswer] = useState(saved.opsGateAnswer ?? null)
  const [opsAnswers, setOpsAnswers] = useState(saved.opsAnswers || {})

  // 체크리스트 답변만 로컬에 저장 (코드·API 키는 저장하지 않음)
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        appName,
        privacyGateAnswer,
        privacyAnswers,
        ethicsGateAnswer,
        ethicsAnswers,
        opsGateAnswer,
        opsAnswers,
      })
    )
  }, [appName, privacyGateAnswer, privacyAnswers, ethicsGateAnswer, ethicsAnswers, opsGateAnswer, opsAnswers])

  const secInfo = securityGrade(scanResult)
  const privInfo = privacyGrade(privacyGateAnswer, privacyAnswers)
  const ethInfo = ethicsGrade(ethicsGateAnswer, ethicsAnswers)
  const opsInfo = opsGrade(opsGateAnswer, opsAnswers)

  const goTo = (t) => {
    setTab(t)
    window.scrollTo({ top: 0 })
  }

  const resetAll = () => {
    if (!confirm('체크리스트 답변을 모두 지우고 새로 시작할까요? (파일 목록도 비워져요)')) return
    setFiles([])
    setScanResult(null)
    setAppName('')
    setPrivacyGateAnswer(null)
    setPrivacyAnswers({})
    setEthicsGateAnswer(null)
    setEthicsAnswers({})
    setOpsGateAnswer(null)
    setOpsAnswers({})
    localStorage.removeItem(STORAGE_KEY)
    setTab('home')
  }

  return (
    <div className="app">
      <header className="header">
        <button className="logo" onClick={() => goTo('home')}>
          🛡️ <strong>바이브체크</strong>
          <span className="logo-sub">교사 바이브 코딩 안심 점검소</span>
        </button>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? 'tab active' : 'tab'}
              onClick={() => goTo(t.id)}
            >
              <span className="tab-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="main">
        {tab === 'home' && <Home goTo={goTo} />}
        {tab === 'scan' && (
          <ScanSection
            files={files}
            setFiles={setFiles}
            scanResult={scanResult}
            setScanResult={setScanResult}
          />
        )}
        {tab === 'privacy' && (
          <Checklist
            icon="🪪"
            title="개인정보 점검"
            intro="학생의 개인정보를 다루는 앱이라면 개인정보보호법이 적용돼요. 교사 눈높이 질문으로 하나씩 확인해 볼게요. 답변은 이 브라우저에만 저장돼요."
            gate={privacyGate}
            items={privacyItems}
            alwaysIds={privacyAlwaysItems}
            gateAnswer={privacyGateAnswer}
            answers={privacyAnswers}
            onGate={setPrivacyGateAnswer}
            onAnswer={(id, v) => setPrivacyAnswers({ ...privacyAnswers, [id]: v })}
            gradeInfo={privInfo}
          />
        )}
        {tab === 'ethics' && (
          <Checklist
            icon="🤖"
            title="AI 윤리 점검"
            intro="교육부 「교육분야 인공지능 윤리원칙」(2022)을 교사 제작 앱 상황에 맞게 풀어낸 문항이에요. AI가 학생의 성장을 돕는 방향으로 쓰이는지 함께 살펴봐요."
            gate={ethicsGate}
            items={ethicsItems}
            alwaysIds={ethicsAlwaysItems}
            gateAnswer={ethicsGateAnswer}
            answers={ethicsAnswers}
            onGate={setEthicsGateAnswer}
            onAnswer={(id, v) => setEthicsAnswers({ ...ethicsAnswers, [id]: v })}
            gradeInfo={ethInfo}
          />
        )}
        {tab === 'ops' && (
          <Checklist
            icon="🧯"
            title="운영·복구 점검"
            intro="코드의 문이 잠겨 있어도, 한도 소진 공격이나 계정 탈취로 서비스가 마비될 수 있어요. '무너졌을 때 다시 세우는 준비'까지 함께 점검해요."
            gate={opsGate}
            items={opsItems}
            alwaysIds={opsAlwaysItems}
            gateAnswer={opsGateAnswer}
            answers={opsAnswers}
            onGate={setOpsGateAnswer}
            onAnswer={(id, v) => setOpsAnswers({ ...opsAnswers, [id]: v })}
            gradeInfo={opsInfo}
          />
        )}
        {tab === 'report' && (
          <Report
            appName={appName}
            setAppName={setAppName}
            scanResult={scanResult}
            secInfo={secInfo}
            privInfo={privInfo}
            ethInfo={ethInfo}
            privacyGateAnswer={privacyGateAnswer}
            privacyAnswers={privacyAnswers}
            ethicsGateAnswer={ethicsGateAnswer}
            ethicsAnswers={ethicsAnswers}
            opsInfo={opsInfo}
            opsGateAnswer={opsGateAnswer}
            opsAnswers={opsAnswers}
          />
        )}
      </main>

      <footer className="footer">
        <p>
          바이브체크는 자가점검 참고 도구이며 법률 자문·보안 인증이 아닙니다. 자동 검사는 모든
          문제를 발견하지 못할 수 있어요.
        </p>
        <p className="footer-links">
          근거: 개인정보보호법 · 교육부 「교육분야 인공지능 윤리원칙」(2022)
          <button className="link-btn" onClick={resetAll}>
            처음부터 다시
          </button>
        </p>
      </footer>
    </div>
  )
}

import { useEffect, useState } from 'react'
import ReviewMode from './components/ReviewMode.jsx'
import ReviewLedger from './components/ReviewLedger.jsx'
import DemoReport from './dev/DemoReport.jsx'

const LEDGER_KEY = 'vibecheck-ledger-v1'

function loadLedger() {
  try {
    return JSON.parse(localStorage.getItem(LEDGER_KEY)) || []
  } catch {
    return []
  }
}

export default function App() {
  const [view, setView] = useState('review') // 'review' | 'ledger'
  const [ledger, setLedger] = useState(loadLedger)

  useEffect(() => {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger))
  }, [ledger])

  // UI 작업용 데모 보고서 (#demo-report)
  if (window.location.hash === '#demo-report') {
    return (
      <div className="app">
        <main className="main">
          <DemoReport />
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <button className="logo" onClick={() => setView('review')}>
          🛡️ <strong>바이브체크</strong>
          <span className="logo-sub">교사 제작 앱 심사·검수 시스템</span>
        </button>
        <nav className="tabs">
          <button className={view === 'review' ? 'tab active' : 'tab'} onClick={() => setView('review')}>
            ⚖️ 심사
          </button>
          <button className={view === 'ledger' ? 'tab active' : 'tab'} onClick={() => setView('ledger')}>
            📚 심사 기록{ledger.length > 0 ? ` (${ledger.length})` : ''}
          </button>
        </nav>
      </header>

      <main className="main">
        {/* 진행 중 심사가 사라지지 않도록 ReviewMode는 언마운트하지 않고 숨긴다 */}
        <div style={view === 'review' ? undefined : { display: 'none' }}>
          <ReviewMode
            onSaveRecord={(record) => {
              setLedger((prev) => [record, ...prev])
              setView('ledger')
            }}
          />
        </div>
        {view === 'ledger' && (
          <ReviewLedger records={ledger} onRemove={(id) => setLedger((prev) => prev.filter((r) => r.id !== id))} />
        )}
      </main>

      <footer className="footer">
        <p>
          바이브체크 심사 시스템 — AI 판정은 초안이며 최종 판정 권한은 심사자에게 있습니다. 심사 기록은 이
          브라우저에만 저장됩니다.
        </p>
        <p className="footer-links">근거: 개인정보보호법 · 교육부 「교육분야 인공지능 윤리원칙」(2022) · 루브릭 v1.0</p>
      </footer>
    </div>
  )
}

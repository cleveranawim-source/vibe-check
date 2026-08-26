import { useEffect, useState } from 'react'
import ReviewMode from './components/ReviewMode.jsx'
import ReviewLedger from './components/ReviewLedger.jsx'
import AboutPage from './components/AboutPage.jsx'
import DemoReport from './dev/DemoReport.jsx'

// 구 이름(바이브체크) 시절 키 — 바꾸면 기존 심사 기록이 유실되므로 유지
const LEDGER_KEY = 'vibecheck-ledger-v1'

function loadLedger() {
  try {
    return JSON.parse(localStorage.getItem(LEDGER_KEY)) || []
  } catch {
    return []
  }
}

export default function App() {
  const [view, setView] = useState('about') // 'about' | 'review' | 'ledger'
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
        <button className="logo" onClick={() => setView('about')}>
          🛡️ <strong>에듀 세이프</strong>
          <span className="logo-sub">교사 제작 앱 심사·검수 시스템</span>
        </button>
        <nav className="tabs">
          <button className={view === 'about' ? 'tab active' : 'tab'} onClick={() => setView('about')}>
            🏠 소개
          </button>
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
        {view === 'about' && <AboutPage onStart={() => setView('review')} />}
      </main>

      <footer className="footer">
        <p>
          에듀 세이프(EduSafe) 심사 시스템 — AI 판정은 초안이며 최종 판정 권한은 심사자에게 있습니다. 심사 기록은 이
          브라우저에만 저장됩니다.
        </p>
        <p className="footer-links">근거: 개인정보 보호법 · AI 기본법(2026 시행) · 교육부 「교육분야 인공지능 윤리원칙」(2022) · 루브릭 v1.0</p>
      </footer>
    </div>
  )
}

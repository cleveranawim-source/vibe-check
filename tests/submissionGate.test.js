import { describe, it, expect } from 'vitest'
import { checkSubmission } from '../src/lib/submissionGate.js'

const f = (path, text = '') => ({ path, text })
const byId = (items, id) => items.find((i) => i.id === id)

describe('checkSubmission', () => {
  it('진입점과 규칙 파일이 있으면 전부 통과', () => {
    const items = checkSubmission(
      [f('index.html'), f('app.js', 'firebase.initializeApp(cfg)'), f('firestore.rules')],
      { source: 'github' }
    )
    expect(items.every((i) => i.ok)).toBe(true)
  })

  it('Firebase를 쓰는데 규칙 파일이 없으면 경고 (콘솔 내보내기 안내 포함)', () => {
    const items = checkSubmission([f('index.html'), f('app.js', 'const db = firebase.firestore()')], {})
    const g = byId(items, 'firebase-rules')
    expect(g.ok).toBe(false)
    expect(g.detail).toContain('firestore.rules')
  })

  it('Supabase를 쓰는데 RLS SQL이 없으면 경고, 있으면 통과', () => {
    const base = [f('index.html'), f('app.js', 'import { createClient } from "@supabase/supabase-js"')]
    expect(byId(checkSubmission(base, {}), 'supabase-rls').ok).toBe(false)
    const withRls = [...base, f('supabase/policies.sql', 'create policy "own rows" on posts ...')]
    expect(byId(checkSubmission(withRls, {}), 'supabase-rls').ok).toBe(true)
  })

  it('외부 DB 흔적이 없으면 규칙 파일 항목은 해당없음 통과', () => {
    const items = checkSubmission([f('index.html'), f('app.js', 'let x = 1')], {})
    expect(byId(items, 'rules')).toMatchObject({ ok: true, na: true })
  })

  it('진입점이 없으면 전체 소스 경고, 잘린 수집은 범위 경고', () => {
    const items = checkSubmission([f('src/app.js', 'x')], { truncated: true, skippedCount: 3 })
    expect(byId(items, 'entry').ok).toBe(false)
    expect(byId(items, 'coverage').ok).toBe(false)
  })
})

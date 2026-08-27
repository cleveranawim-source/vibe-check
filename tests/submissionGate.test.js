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

  it('외부 DB를 쓰는데 규칙 파일이 없으면 경고', () => {
    const items = checkSubmission([f('index.html'), f('app.js', 'const db = firebase.firestore()')], {})
    expect(byId(items, 'rules').ok).toBe(false)
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

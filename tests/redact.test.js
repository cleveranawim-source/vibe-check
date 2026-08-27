import { describe, it, expect } from 'vitest'
import { redactForAi } from '../src/lib/redact.js'

const f = (path, text) => ({ path, name: path.split('/').pop(), size: text.length, text })

describe('redactForAi — AI 전송 전 로컬 마스킹', () => {
  it('데이터 파일(csv 등)은 전송 목록에서 제외하고 존재만 남긴다', () => {
    const r = redactForAi([f('index.html', '<html></html>'), f('data/students.csv', '이름,전화\n김철수,010-1234-5678')])
    expect(r.files.map((x) => x.path)).toEqual(['index.html'])
    expect(r.excludedData).toEqual(['data/students.csv'])
  })

  it('탐지된 비밀키는 마스킹된다 — 흔적은 남아 판정 근거가 된다', () => {
    const key = 'sk-ant-' + 'a'.repeat(30)
    const r = redactForAi([f('app.js', `const k = "${key}"`)])
    expect(r.files[0].text).not.toContain(key)
    expect(r.files[0].text).toContain('[마스킹됨]')
  })

  it('깨끗한 파일은 그대로 통과한다', () => {
    const clean = f('app.js', 'const a = 1')
    const r = redactForAi([clean])
    expect(r.files[0]).toBe(clean)
    expect(r.excludedData).toEqual([])
  })
})

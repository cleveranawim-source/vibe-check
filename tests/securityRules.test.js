import { describe, it, expect } from 'vitest'
import rules, { projectRules } from '../src/data/securityRules.js'
import { scanFiles } from '../src/lib/scanner.js'

const rule = (id) => rules.find((r) => r.id === id)
const hits = (id, text) => {
  const r = rule(id)
  r.pattern.lastIndex = 0
  return r.pattern.test(text)
}

describe('v1.2 연동 규칙 패턴', () => {
  it('jwt-hardcoded: JWT 3분절 매칭, 일반 문자열 무시', () => {
    expect(hits('jwt-hardcoded', 'const t = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV"')).toBe(true)
    expect(hits('jwt-hardcoded', 'const greeting = "hello world"')).toBe(false)
  })

  it('webhook-url: Slack·Discord 웹훅 매칭', () => {
    expect(hits('webhook-url', 'fetch("https://hooks.slack.com/services/T000/B000/XXXX")')).toBe(true)
    expect(hits('webhook-url', 'fetch("https://discord.com/api/webhooks/123456/abc_DEF-ghi")')).toBe(true)
    expect(hits('webhook-url', 'fetch("https://discord.com/api/users/me")')).toBe(false)
  })

  it('client-score-write: 점수류 필드의 클라이언트 write 매칭', () => {
    expect(hits('client-score-write', 'db.collection("s").doc(id).set({ score: myScore })')).toBe(true)
    expect(hits('client-score-write', 'ref.update({ nickname: name })')).toBe(false)
  })

  it('answer-in-client: 정답 필드 매칭', () => {
    expect(hits('answer-in-client', '{"question":"1+1?","answer":"2"}')).toBe(true)
    expect(hits('answer-in-client', '{"question":"1+1?"}')).toBe(false)
  })

  it('external-ai-endpoint: AI API 주소 매칭', () => {
    expect(hits('external-ai-endpoint', 'fetch("https://api.openai.com/v1/chat/completions")')).toBe(true)
    expect(hits('external-ai-endpoint', 'fetch("https://api.github.com/repos")')).toBe(false)
  })

  it('student-data-file: 이름+연락처 열이 있는 csv만 잡음', () => {
    const r = projectRules.find((p) => p.id === 'student-data-file')
    const bad = [{ path: 'data/students.csv', text: '이름,학번,전화번호\n김철수,10101,010-1234-5678' }]
    const ok = [{ path: 'data/quiz.csv', text: 'question,answer\n1+1,2' }]
    expect(r.check(bad).length).toBe(1)
    expect(r.check(ok).length).toBe(0)
  })

  it('scanFiles 통합: 새 규칙이 발견 목록에 나타난다', () => {
    const files = [{ path: 'app.js', name: 'app.js', text: 'ref.set({ score: total })\nfetch("https://api.openai.com/v1/messages")' }]
    const ids = scanFiles(files).findings.map((f) => f.rule.id)
    expect(ids).toContain('client-score-write')
    expect(ids).toContain('external-ai-endpoint')
  })
})

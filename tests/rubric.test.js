import { describe, it, expect } from 'vitest'
import { RUBRIC_VERSION, TRACKS, rubricItems } from '../src/data/rubric.js'

describe('rubric integrity', () => {
  it('버전은 X.Y 형식', () => {
    expect(RUBRIC_VERSION).toMatch(/^\d+\.\d+$/)
  })
  it('트랙은 4종', () => {
    expect(Object.keys(TRACKS)).toEqual(['admin', 'subject_tool', 'learning_content', 'class_ops'])
  })
  it('id 중복 없음', () => {
    const ids = rubricItems.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('모든 항목 필드 유효', () => {
    for (const it of rubricItems) {
      expect(it.tracks.length).toBeGreaterThan(0)
      for (const t of it.tracks) expect(TRACKS[t]).toBeDefined()
      expect(['required', 'scored']).toContain(it.type)
      expect(it.weight).toBeGreaterThanOrEqual(1)
      expect(typeof it.aiVerifiable).toBe('boolean')
      expect(it.question.length).toBeGreaterThan(5)
    }
  })
  it('모든 트랙에 필수 항목이 1개 이상', () => {
    for (const t of Object.keys(TRACKS)) {
      const req = rubricItems.filter((i) => i.tracks.includes(t) && i.type === 'required')
      expect(req.length).toBeGreaterThan(0)
    }
  })
})

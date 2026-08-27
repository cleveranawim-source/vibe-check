import { describe, it, expect } from 'vitest'
import { buildCertification, isValidCertId, makeBadgeSvg } from '../src/lib/certification.js'

const META = { source: 'github', owner: 'o', repo: 'r', branch: 'main', commitSha: 'a1b2c3d4e5f67890' }
const SUMMARY = { status: 'pass_candidate', score: 87, requiredFails: [], needsHuman: [] }

describe('certification', () => {
  it('인증번호 형식 검증', () => {
    expect(isValidCertId('ES-2026-0001')).toBe(true)
    expect(isValidCertId('ES-2026-1')).toBe(false)
    expect(isValidCertId('BADGE-1')).toBe(false)
  })

  it('기록에 심사 커밋·루브릭 버전·유효기간이 들어간다', () => {
    const { record } = buildCertification({
      certId: 'ES-2026-0001', repoMeta: META, repoUrl: 'https://github.com/o/r',
      track: 'learning_content', summary: SUMMARY, reviewerName: '심사자',
    })
    expect(record.commitSha).toBe(META.commitSha)
    expect(record.rubricVersion).toMatch(/^\d+\.\d+$/)
    expect(record.status).toBe('valid')
    expect(record.expiresAt > record.issuedAt).toBe(true)
    expect(record.note).toContain('공인 인증이 아님')
  })

  it('배지 SVG와 삽입 코드가 인증번호·검증 주소를 담는다', () => {
    const cert = buildCertification({
      certId: 'ES-2026-0001', repoMeta: META, repoUrl: 'https://github.com/o/r',
      track: 'learning_content', summary: SUMMARY, reviewerName: '',
    })
    expect(cert.badgeSvg).toContain('ES-2026-0001')
    expect(cert.badgeSvg).toContain('a1b2c3d')
    expect(cert.snippetHtml).toContain(cert.verifyUrl)
    expect(cert.snippetMd).toContain(cert.badgeUrl)
  })

  it('로컬 폴더 심사도 지문 기준으로 발급된다', () => {
    const { record } = buildCertification({
      certId: 'ES-2026-0002', repoMeta: { source: 'local', owner: null, repo: '감정일기', commitSha: 'ff'.repeat(32) },
      repoUrl: '', track: 'learning_content', summary: SUMMARY, reviewerName: '',
    })
    expect(record.shaKind).toBe('content-sha256')
    expect(record.app.repoUrl).toBeNull()
  })

  it('makeBadgeSvg는 유효한 svg 문자열', () => {
    const svg = makeBadgeSvg('ES-2026-0003', 'abc1234')
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('에듀 세이프 인증')
  })
})

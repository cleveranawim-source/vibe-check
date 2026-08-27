import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import BlockchainBadge from '../src/components/BlockchainBadge.jsx'
import { BADGE_POLICY } from '../src/lib/badgePolicy.js'
import {
  BADGE_DEMO_TRIGGER,
  createBadgeDemoRepository,
  isBadgeDemoTrigger,
} from '../src/lib/badgeDemo.js'
import { scanFiles } from '../src/lib/scanner.js'
import { securityGrade } from '../src/lib/scoring.js'

describe('DEMO100 badge preview', () => {
  it('공백을 제외하고 정확한 대문자 트리거만 허용한다', () => {
    expect(isBadgeDemoTrigger(BADGE_DEMO_TRIGGER)).toBe(true)
    expect(isBadgeDemoTrigger(`  ${BADGE_DEMO_TRIGGER}  `)).toBe(true)

    for (const value of ['demo100', 'DEMO100x', 'xDEMO100', 'https://github.com/DEMO100/app', '']) {
      expect(isBadgeDemoTrigger(value)).toBe(false)
    }
  })

  it('실제 저장소나 인증 식별자로 가장하지 않고 기존 스캐너에서 100점이 나온다', () => {
    const demo = createBadgeDemoRepository()
    const grade = securityGrade(scanFiles(demo.files))

    expect(demo.repoMeta).toMatchObject({
      source: 'demo',
      demoOnly: true,
      commitSha: 'DEMO-ONLY',
      canonicalUrl: null,
    })
    expect(demo.repoMeta.commitSha).not.toMatch(/^[0-9a-f]{40}$/i)
    expect(grade).toMatchObject({ score: 100, counts: { critical: 0, warning: 0, info: 0 } })
    expect(grade.score).toBeGreaterThanOrEqual(BADGE_POLICY.levels.gold.minimumScore)
  })

  it('데모 마크에는 실제 발급 폼·UID·검증 링크가 없다', () => {
    const demo = createBadgeDemoRepository()
    const grade = securityGrade(scanFiles(demo.files))
    const html = renderToStaticMarkup(createElement(BlockchainBadge, {
      repoUrl: BADGE_DEMO_TRIGGER,
      repoMeta: demo.repoMeta,
      scanGrade: grade,
    }))

    expect(html).toContain('100점')
    expect(html).toContain('Gold')
    expect(html).toContain('DEMO')
    expect(html).toContain('실제 인증 아님')
    expect(html).not.toContain('<form')
    expect(html).not.toContain('type="password"')
    expect(html).not.toContain('서명 검증')
    expect(html).not.toContain('README 삽입')
    expect(html).not.toContain('/api/badges')
    expect(html).not.toMatch(/0x[0-9a-f]{64}/i)
  })
})

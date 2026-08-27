import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import BlockchainBadge from '../src/components/BlockchainBadge.jsx'
import { BADGE_POLICY } from '../src/lib/badgePolicy.js'
import {
  BADGE_DEMO_TRIGGER,
  SILVER_BADGE_DEMO_TRIGGER,
  createBadgeDemoRepository,
  isBadgeDemoTrigger,
} from '../src/lib/badgeDemo.js'
import { scanFiles } from '../src/lib/scanner.js'
import { securityGrade } from '../src/lib/scoring.js'

const DEMO_CASES = [
  { trigger: BADGE_DEMO_TRIGGER, score: 100, level: 'Gold', warning: 0 },
  { trigger: SILVER_BADGE_DEMO_TRIGGER, score: 80, level: 'Silver', warning: 4 },
]

describe('badge previews', () => {
  it('공백을 제외하고 정확한 대문자 데모 트리거만 허용한다', () => {
    expect(isBadgeDemoTrigger(BADGE_DEMO_TRIGGER)).toBe(true)
    expect(isBadgeDemoTrigger(`  ${BADGE_DEMO_TRIGGER}  `)).toBe(true)
    expect(isBadgeDemoTrigger(SILVER_BADGE_DEMO_TRIGGER)).toBe(true)
    expect(isBadgeDemoTrigger(`  ${SILVER_BADGE_DEMO_TRIGGER}  `)).toBe(true)

    for (const value of ['demo100', 'demo80', 'DEMO100x', 'DEMO80x', 'xDEMO100', 'https://github.com/DEMO80/app', '']) {
      expect(isBadgeDemoTrigger(value)).toBe(false)
    }
  })

  it.each(DEMO_CASES)('$trigger는 실제 식별자로 가장하지 않고 기존 스캐너에서 $score점이 나온다', ({ trigger, score, level, warning }) => {
    const demo = createBadgeDemoRepository(trigger)
    const grade = securityGrade(scanFiles(demo.files))

    expect(demo.repoMeta).toMatchObject({
      source: 'demo',
      demoOnly: true,
      repo: trigger,
      demoLevel: level.toLowerCase(),
      canonicalUrl: null,
    })
    expect(demo.repoMeta.commitSha).not.toMatch(/^[0-9a-f]{40}$/i)
    expect(grade).toMatchObject({ score, counts: { critical: 0, warning, info: 0 } })
    expect(grade.score).toBeGreaterThanOrEqual(BADGE_POLICY.minimumScanScore)
    if (level === 'Gold') expect(grade.score).toBeGreaterThanOrEqual(BADGE_POLICY.levels.gold.minimumScore)
    else expect(grade.score).toBeLessThan(BADGE_POLICY.levels.gold.minimumScore)
  })

  it.each(DEMO_CASES)('$trigger의 $level 마크에는 실제 발급 폼·UID·검증 링크가 없다', ({ trigger, score, level }) => {
    const demo = createBadgeDemoRepository(trigger)
    const grade = securityGrade(scanFiles(demo.files))
    const html = renderToStaticMarkup(createElement(BlockchainBadge, {
      repoUrl: trigger,
      repoMeta: demo.repoMeta,
      scanGrade: grade,
    }))

    expect(html).toContain(`${score}점`)
    expect(html).toContain(`EduSafe ${level}`)
    expect(html).toContain('showcase-badge')
    expect(html).toContain('width="360"')
    expect(html).toContain('height="112"')
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

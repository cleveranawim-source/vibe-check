export const BADGE_DEMO_TRIGGER = 'DEMO100'
export const SILVER_BADGE_DEMO_TRIGGER = 'DEMO80'
export const BADGE_DEMO_TRIGGERS = Object.freeze([
  BADGE_DEMO_TRIGGER,
  SILVER_BADGE_DEMO_TRIGGER,
])

const GOLD_DEMO_SOURCE = `<!doctype html>
<html lang="ko">
  <head><meta charset="utf-8"><title>EduSafe Demo</title></head>
  <body><main><h1>안전 점검 데모 앱</h1></main></body>
</html>`

// 경고 규칙 4건 × 5점 감점 = 80점. 검사할 문자열을 조립할 뿐 실행하지 않는다.
const DEMO_WARNING_CALL = ['ev', 'al'].join('')
const SILVER_DEMO_WARNINGS = ['One', 'Two', 'Three', 'Four']
  .map((suffix) => `${DEMO_WARNING_CALL}("demo${suffix}")`)
  .join('\n      ')
const SILVER_DEMO_SOURCE = `<!doctype html>
<html lang="ko">
  <head><meta charset="utf-8"><title>EduSafe Silver Demo</title></head>
  <body>
    <main><h1>개선 항목이 있는 데모 앱</h1></main>
    <script>
      ${SILVER_DEMO_WARNINGS}
    </script>
  </body>
</html>`

const DEMO_PRESETS = Object.freeze({
  [BADGE_DEMO_TRIGGER]: Object.freeze({ source: GOLD_DEMO_SOURCE, level: 'gold' }),
  [SILVER_BADGE_DEMO_TRIGGER]: Object.freeze({ source: SILVER_DEMO_SOURCE, level: 'silver' }),
})

export function isBadgeDemoTrigger(input) {
  return typeof input === 'string' && BADGE_DEMO_TRIGGERS.includes(input.trim())
}

export function createBadgeDemoRepository(input = BADGE_DEMO_TRIGGER) {
  const trigger = typeof input === 'string' ? input.trim() : ''
  const preset = DEMO_PRESETS[trigger]
  if (!preset) throw new TypeError('지원하지 않는 인증마크 데모 코드입니다.')

  const file = {
    path: 'index.html',
    name: 'index.html',
    size: new TextEncoder().encode(preset.source).byteLength,
    text: preset.source,
  }
  return Object.freeze({
    files: Object.freeze([Object.freeze(file)]),
    repoMeta: Object.freeze({
      source: 'demo',
      demoOnly: true,
      owner: 'EduSafe',
      repo: trigger,
      branch: 'demo',
      commitSha: `${trigger}-ONLY`,
      repositoryId: `${trigger.toLowerCase()}-only`,
      canonicalUrl: null,
      sourceCoverageComplete: true,
      hasApplicationSource: true,
      demoLevel: preset.level,
    }),
    skippedCount: 0,
    truncated: false,
  })
}

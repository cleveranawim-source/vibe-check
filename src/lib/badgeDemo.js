export const BADGE_DEMO_TRIGGER = 'DEMO100'

const DEMO_SOURCE = `<!doctype html>
<html lang="ko">
  <head><meta charset="utf-8"><title>EduSafe Demo</title></head>
  <body><main><h1>안전 점검 데모 앱</h1></main></body>
</html>`

export function isBadgeDemoTrigger(input) {
  return typeof input === 'string' && input.trim() === BADGE_DEMO_TRIGGER
}

export function createBadgeDemoRepository() {
  const file = {
    path: 'index.html',
    name: 'index.html',
    size: new TextEncoder().encode(DEMO_SOURCE).byteLength,
    text: DEMO_SOURCE,
  }
  return Object.freeze({
    files: Object.freeze([Object.freeze(file)]),
    repoMeta: Object.freeze({
      source: 'demo',
      demoOnly: true,
      owner: 'EduSafe',
      repo: 'DEMO100',
      branch: 'demo',
      commitSha: 'DEMO-ONLY',
      repositoryId: 'demo-only',
      canonicalUrl: null,
      sourceCoverageComplete: true,
      hasApplicationSource: true,
    }),
    skippedCount: 0,
    truncated: false,
  })
}

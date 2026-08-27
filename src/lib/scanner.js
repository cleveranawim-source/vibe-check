import rules, { projectRules } from '../data/securityRules.js'

const TEXT_EXTENSIONS = /\.(html?|css|jsx?|tsx?|mjs|cjs|json|jsonc|map|txt|md|mdx|vue|svelte|rules|env|yml|yaml|xml|svg|py|csv|tsv|toml|ini|conf|properties|lock|sql|sh|bash|zsh|go|rs|java|kt|kts|swift|php|rb|dart|scala|cs|fs|fsx|c|cc|cpp|cxx|h|hh|hpp|sol|lua|r|pl|pm|ex|exs|erl|hrl|clj|cljs|groovy|gradle|tf|hcl)$/i
const TEXT_FILENAMES = /^(Dockerfile(?:\..+)?|Containerfile(?:\..+)?|Makefile|Procfile|Gemfile|Rakefile|Podfile|CMakeLists\.txt|LICENSE(?:\..+)?|NOTICE(?:\..+)?|AUTHORS(?:\..+)?|CODEOWNERS|\.gitmodules|\.gitignore|\.gitattributes|\.dockerignore|\.npmrc|\.yarnrc)$/i
const APPLICATION_SOURCE_EXTENSIONS = /\.(html?|jsx?|tsx?|mjs|cjs|vue|svelte|py|go|rs|java|kt|kts|swift|php|rb|dart|scala|cs|fs|fsx|c|cc|cpp|cxx|h|hh|hpp|sol|lua|r|pl|pm|ex|exs|erl|hrl|clj|cljs|groovy)$/i
const SKIP_PATH = /(^|\/)(node_modules|\.git|dist|build|\.next|coverage|vendor)(\/|$)/
export const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB

// 경로 문자열 기준 판정 (GitHub 트리 등 File 객체가 없는 경우)
export function isScannablePath(path) {
  if (SKIP_PATH.test(path)) return false
  const name = path.split('/').pop()
  return TEXT_EXTENSIONS.test(name) || TEXT_FILENAMES.test(name) || /^\.env/.test(name)
}

export function isApplicationSourcePath(path) {
  if (SKIP_PATH.test(path)) return false
  return APPLICATION_SOURCE_EXTENSIONS.test(path.split('/').pop())
}

export function isScannableFile(file) {
  const path = file.webkitRelativePath || file.name
  if (SKIP_PATH.test(path)) return { ok: false, reason: '라이브러리/빌드 폴더' }
  if (file.size > MAX_FILE_SIZE) return { ok: false, reason: '2MB 초과' }
  if (!TEXT_EXTENSIONS.test(file.name) && !TEXT_FILENAMES.test(file.name) && !/^\.env/.test(file.name)) {
    return { ok: false, reason: '검사 대상 아닌 형식' }
  }
  return { ok: true }
}

// 압축(minified) 파일 판정: 평균 줄 길이가 매우 길면 번들로 간주
function looksMinified(text) {
  const lines = text.split('\n')
  if (lines.length === 0) return false
  const avg = text.length / lines.length
  return avg > 300
}

function maskSecret(snippet, match) {
  if (match.length <= 10) return snippet
  const masked = match.slice(0, 8) + '****' + match.slice(-4)
  return snippet.replace(match, masked)
}

function makeSnippet(line, match, shouldMask) {
  let snippet = line.trim()
  if (snippet.length > 160) {
    const idx = snippet.indexOf(match)
    const start = Math.max(0, idx - 40)
    snippet = (start > 0 ? '…' : '') + snippet.slice(start, start + 140) + '…'
  }
  return shouldMask ? maskSecret(snippet, match) : snippet
}

/**
 * files: [{ name, path, text }]
 * returns { findings, scanned, skipped }
 * findings: [{ rule, occurrences: [{ file, line, snippet }] }]
 */
export function scanFiles(files) {
  const byRule = new Map()
  const scanned = []
  const skipped = []

  for (const f of files) {
    const minified = looksMinified(f.text)
    scanned.push({ path: f.path, minified })

    const lines = f.text.split('\n')
    for (const rule of rules) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // 인증 점수에는 압축·긴 줄도 포함한다. 건너뛰면 한 줄로 합치는 것만으로 규칙을 우회할 수 있다.
        // 규칙별 제외 조건 (예: Firebase 설정의 apiKey는 Google 키 노출 규칙에서 제외)
        if (rule.excludeLine && rule.excludeLine.test(line)) continue
        rule.pattern.lastIndex = 0
        const m = rule.pattern.exec(line)
        if (m) {
          if (!byRule.has(rule.id)) byRule.set(rule.id, { rule, occurrences: [] })
          const bucket = byRule.get(rule.id)
          if (bucket.occurrences.length < 50) {
            bucket.occurrences.push({
              file: f.path,
              line: i + 1,
              snippet: makeSnippet(line, m[0], rule.maskSecret),
            })
          }
        }
      }
    }
  }

  for (const pr of projectRules) {
    const occurrences = pr.check(files)
    if (occurrences.length > 0) byRule.set(pr.id, { rule: pr, occurrences })
  }

  const severityOrder = { critical: 0, warning: 1, info: 2 }
  const findings = [...byRule.values()].sort(
    (a, b) => severityOrder[a.rule.severity] - severityOrder[b.rule.severity]
  )

  return { findings, scanned, skipped }
}

export function countBySeverity(findings) {
  const counts = { critical: 0, warning: 0, info: 0 }
  for (const f of findings) counts[f.rule.severity]++
  return counts
}

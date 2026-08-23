import rules, { projectRules } from '../data/securityRules.js'

const TEXT_EXTENSIONS = /\.(html?|css|jsx?|tsx?|mjs|cjs|json|txt|md|vue|svelte|rules|env|yml|yaml|xml|py)$/i
const SKIP_PATH = /(^|\/)(node_modules|\.git|dist|build|\.next|coverage|vendor)(\/|$)/
export const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB

// 경로 문자열 기준 판정 (GitHub 트리 등 File 객체가 없는 경우)
export function isScannablePath(path) {
  if (SKIP_PATH.test(path)) return false
  const name = path.split('/').pop()
  return TEXT_EXTENSIONS.test(name) || /^\.env/.test(name)
}

export function isScannableFile(file) {
  const path = file.webkitRelativePath || file.name
  if (SKIP_PATH.test(path)) return { ok: false, reason: '라이브러리/빌드 폴더' }
  if (file.size > MAX_FILE_SIZE) return { ok: false, reason: '2MB 초과' }
  if (!TEXT_EXTENSIONS.test(file.name) && !/^\.env/.test(file.name)) {
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
      if (minified && !rule.scanMinified) continue
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // 극단적으로 긴 줄(번들)은 비밀키 계열만 검사
        if (line.length > 2000 && !rule.scanMinified) continue
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

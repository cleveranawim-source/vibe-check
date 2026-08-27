// AI 전송 전 로컬 마스킹 (팀 조사 카탈로그 원칙 5: 실데이터·비밀키는 외부 LLM으로 보내지
// 않는다 — 로컬 탐지·마스킹 후 최소 전송).
// - 데이터 파일(csv 등)은 내용을 전송하지 않고 존재만 고지한다.
// - 탐지된 비밀키는 마스킹한다 — 마스킹 흔적 자체가 노출 증거로 남으므로 판정에는 지장 없다.
import rules from '../data/securityRules.js'

const DATA_FILE = /\.(csv|tsv|xlsx?)$/i
const SECRET_RULES = rules.filter((r) => r.category === 'secret' && r.maskSecret && r.pattern)

export function redactForAi(files) {
  const excludedData = []
  const out = []
  for (const f of files) {
    if (DATA_FILE.test(f.path)) {
      excludedData.push(f.path)
      continue
    }
    let text = f.text
    for (const r of SECRET_RULES) {
      const re = new RegExp(r.pattern.source, r.pattern.flags)
      text = text.replace(re, (m) =>
        m.length > 10 ? `${m.slice(0, 6)}****[마스킹됨]${m.slice(-2)}` : '****[마스킹됨]'
      )
    }
    out.push(text === f.text ? f : { ...f, text })
  }
  return { files: out, excludedData }
}

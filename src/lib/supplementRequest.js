// 판단불가 → 보완 요청서 자동 생성: 심사자가 문서를 쓰지 않고도 제작 교사에게
// "무엇을, 왜, 어떻게" 보완하면 되는지 전달할 수 있게 한다.
import { finalVerdict } from './reviewSummary.js'
import { TRACKS, RUBRIC_VERSION, rubricItems } from '../data/rubric.js'

export function buildSupplementRequest({ repoMeta, track, judgments, overrides, humanInputs, gate = [] }) {
  const items = rubricItems.filter((it) => it.tracks.includes(track))
  const needs = items.filter((it) => finalVerdict(it, judgments, overrides, humanInputs) === 'needs_human')
  const submission = gate.filter((g) => !g.ok)
  const humanDoc = needs.filter((it) => !it.aiVerifiable)
  const codeEvidence = needs.filter((it) => it.aiVerifiable)
  const count = submission.length + needs.length
  const text = count === 0 ? '' : renderText({ repoMeta, track, submission, humanDoc, codeEvidence, judgments })
  return { submission, humanDoc, codeEvidence, count, text }
}

function renderText({ repoMeta, track, submission, humanDoc, codeEvidence, judgments }) {
  const isLocal = repoMeta.source === 'local'
  const title = repoMeta.owner ? `${repoMeta.owner}/${repoMeta.repo}` : repoMeta.repo
  const sha = (repoMeta.commitSha || '').slice(0, 12)
  const lines = []
  lines.push('[에듀 세이프] 심사 보완 요청서')
  lines.push('─'.repeat(30))
  lines.push(`대상: ${title}`)
  lines.push(`${isLocal ? '콘텐츠 지문' : '커밋'}: ${sha}`)
  lines.push(`분류: ${TRACKS[track].label} · 루브릭 v${RUBRIC_VERSION}`)
  lines.push(`작성일: ${new Date().toLocaleDateString('ko-KR')}`)
  lines.push('')
  lines.push(
    `심사 중 아래 ${submission.length + humanDoc.length + codeEvidence.length}건을 확인하지 못해 종합 판정이 '보류'입니다.`
  )
  lines.push('보완해 주시면 재심사를 진행합니다. 어렵게 느껴지는 항목은 심사자에게 문의해 주세요.')

  let section = 0
  if (submission.length > 0) {
    lines.push('', `■ ${++section}. 제출물 보완 — 심사에 필요한 파일이 빠져 있어요`)
    submission.forEach((g, i) => {
      lines.push(`${i + 1}. ${g.label}`)
      lines.push(`   → ${g.detail}`)
    })
  }
  if (humanDoc.length > 0) {
    lines.push('', `■ ${++section}. 문서·답변으로 확인이 필요한 항목 — 코드 밖의 사실이라 여쭤봐요`)
    humanDoc.forEach((it, i) => {
      lines.push(`${i + 1}. ${it.question}`)
      lines.push(`   · 왜 필요한가요: ${it.plain}`)
      lines.push(`   · 요청: ${it.evidenceHint} — 문서나 답변으로 보내주세요.`)
    })
  }
  if (codeEvidence.length > 0) {
    lines.push('', `■ ${++section}. 코드에서 확인하지 못한 항목 — 위치를 알려주시면 빨라져요`)
    codeEvidence.forEach((it, i) => {
      const reason = judgments?.[it.id]?.reasoning || 'AI 분석에서 관련 근거를 찾지 못함'
      lines.push(`${i + 1}. ${it.question}`)
      lines.push(`   · 쉬운 설명: ${it.plain}`)
      lines.push(`   · 판정 보류 사유: ${reason}`)
      lines.push(`   · 요청: 관련 코드의 파일·위치를 알려주시거나, 그런 기능이 없다면 "해당없음"으로 회신해 주세요.`)
    })
  }

  lines.push('', '■ 재심사 안내')
  lines.push(
    isLocal
      ? '보완한 프로젝트 폴더를 다시 제출해 주세요. 재심사는 새 제출물의 지문에 대해 진행되며, 이번 심사와 연결되어 회차가 기록됩니다.'
      : `보완 사항을 저장소에 반영(커밋)한 뒤 알려주세요. 재심사는 새 커밋에 대해 진행되며, 이번 심사(커밋 ${sha})와 연결되어 회차가 기록됩니다.`
  )
  return lines.join('\n')
}

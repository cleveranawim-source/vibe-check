// UI 작업용 데모 보고서 — 주소 뒤에 #demo-report 를 붙이면 표시된다.
// AI 판정 없이 보고서 레이아웃을 확인·개선하기 위한 고정 데이터.
import ReviewReport from '../components/ReviewReport.jsx'
import { rubricItems } from '../data/rubric.js'

const LONG_QUOTE =
  'document.getElementById("roundEndFeedback").innerHTML = `<b>왜 도움이 될까요?</b><br>${r.note}` // 아주긴한줄코드인용이표를뚫고나가는지확인하는용도의토큰입니다아주아주깁니다'

export default function DemoReport() {
  const aiItems = rubricItems.filter((i) => i.tracks.includes('learning_content') && i.aiVerifiable)
  const cycle = ['pass', 'fail', 'needs_human', 'na']
  const judgments = {}
  aiItems.forEach((it, idx) => {
    const verdict = cycle[idx % 4]
    judgments[it.id] = {
      itemId: it.id,
      verdict,
      evidence:
        verdict === 'na'
          ? []
          : [
              { file: 'src/components/VeryLongComponentFileNameForTesting.jsx', line: 1431, quote: LONG_QUOTE },
              { file: 'index.html', line: 12, quote: '<meta name="description" content="...">' },
            ],
      reasoning: '데모 판정 사유입니다. 실제로는 AI가 코드를 근거로 한두 문장의 판단 이유를 적습니다.',
    }
  })
  const humanInputs = {}
  rubricItems
    .filter((i) => i.tracks.includes('learning_content') && !i.aiVerifiable)
    .forEach((it, idx) => {
      humanInputs[it.id] = { verdict: idx % 2 ? 'pass' : 'needs_human', note: '심사자 수동 판정 메모 데모' }
    })

  return (
    <ReviewReport
      repoUrl="https://github.com/cleveranawim-source/a-very-long-repository-name-for-layout-testing"
      repoMeta={{
        owner: 'cleveranawim-source',
        repo: 'a-very-long-repository-name-for-layout-testing',
        branch: 'main',
        commitSha: '53d6b9f97453abcdef1234567890abcdef123456',
      }}
      track="learning_content"
      standards={{
        subject: '국어',
        gradeBand: '중1-3',
        codes: '[9국01-02] 상대의 감정에 공감하며 적절하게 반응하는 대화를 나눈다.',
      }}
      scanCounts={{ critical: 1, warning: 2, info: 1 }}
      scanFindings={[
        {
          rule: {
            id: 'demo-1',
            severity: 'critical',
            title: 'Firebase 보안 규칙이 전체 공개(쓰기 허용)로 되어 있음',
            fix: '규칙을 "필요한 경로만, 필요한 조건에서만" 허용하도록 좁히세요. 예: 로그인한 본인 문서만 쓰기 가능.',
          },
          occurrences: [1],
        },
        {
          rule: {
            id: 'demo-2',
            severity: 'warning',
            title: 'innerHTML에 변수·입력값을 넣고 있음',
            fix: '텍스트만 넣을 곳에는 textContent를 쓰세요. HTML이 꼭 필요한 곳은 DOMPurify를 적용하세요.',
          },
          occurrences: [1, 2, 3],
        },
      ]}
      judgments={judgments}
      overrides={{ [aiItems[1]?.id]: { verdict: 'pass', note: '오탐 확인 — 데모 번복 기록' } }}
      humanInputs={humanInputs}
      opinion={'데모 종합 의견입니다.\n줄바꿈을 포함한 여러 문장이 들어갈 때의 레이아웃을 확인합니다.'}
      reviewerName="명지중학교 예열"
    />
  )
}

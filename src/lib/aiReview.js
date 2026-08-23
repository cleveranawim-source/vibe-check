import Anthropic from '@anthropic-ai/sdk'

export const AI_MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5 — 가장 정밀 (기본)', note: '$5/$25 per 1M tokens' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 — 균형형', note: '$3/$15 per 1M tokens' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — 절약형', note: '$1/$5 per 1M tokens' },
]

export const MAX_AI_CHARS = 150_000

const SYSTEM_PROMPT = `당신은 교사가 '바이브 코딩'(AI 도구로 코드 작성)으로 만든 교육용 웹앱을 점검하는 보안·개인정보 전문 리뷰어입니다.
독자는 개발 비전공자인 한국의 교사입니다. 학생(중학생 등 미성년자)이 사용할 앱이라는 점을 항상 고려하세요.

다음 구조의 마크다운으로 보고서를 작성하세요:

## 요약
전체 상태를 2~3문장으로. 심각한 문제가 있으면 첫 문장에서 바로 말할 것.

## 🔴 즉시 조치가 필요한 문제
비밀키 노출, 열린 DB 규칙, XSS, 개인정보 유출 경로 등. 각 항목마다:
- **무엇이 문제인지** (파일명과 대략의 위치)
- **왜 위험한지** (교사가 이해할 수 있는 비유나 시나리오)
- **고치는 방법** (구체적 수정 코드 또는 단계)

## 🟠 개선을 권장하는 부분
당장 사고는 아니지만 고치면 좋은 것들.

## 🪪 개인정보 관점
학생 개인정보(이름, 감정기록, 사진 등)가 수집·저장·전송되는 흐름을 짚고, 개인정보보호법 관점(수집 최소화, 만 14세 미만 보호자 동의, 파기 등)에서 확인할 점을 안내.

## ✅ 잘한 점
잘 설계된 부분을 1가지 이상 찾아 격려할 것.

규칙:
- 존댓말, 따뜻하지만 정확하게. 위험은 얼버무리지 말 것.
- 확실하지 않은 것은 "확인이 필요해요"로 구분할 것.
- 코드 수정 예시는 짧고 복사해서 쓸 수 있게.
- 문제가 거의 없으면 억지로 만들지 말고 그렇다고 말할 것.`

export async function runAiReview({ apiKey, model, files, ruleFindings, onText }) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  let codeSection = ''
  for (const f of files) {
    codeSection += `\n\n===== 파일: ${f.path} =====\n${f.text}`
  }

  let findingsSection = '없음'
  if (ruleFindings && ruleFindings.length > 0) {
    findingsSection = ruleFindings
      .map((f) => `- [${f.rule.severity}] ${f.rule.title} (${f.occurrences.length}곳)`)
      .join('\n')
  }

  const userMessage = `다음은 제가 만든 교육용 웹앱의 코드입니다. 보안·개인정보 관점에서 정밀 점검해 주세요.

[자동 규칙 검사에서 이미 발견된 항목 — 참고용]
${findingsSection}

[코드]${codeSection}`

  const stream = client.messages.stream({
    model,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  stream.on('text', (text) => onText(text))
  const final = await stream.finalMessage()

  if (final.stop_reason === 'refusal') {
    throw new Error('모델이 이 요청의 처리를 거절했어요. 코드에 민감한 내용이 포함되어 있는지 확인해 주세요.')
  }
  if (final.stop_reason === 'max_tokens') {
    onText('\n\n> ⚠️ 보고서가 길어 일부가 잘렸어요. 파일 수를 줄여 다시 시도해 보세요.')
  }
  return final
}

export function friendlyApiError(err) {
  if (err instanceof Anthropic.AuthenticationError) {
    return 'API 키가 올바르지 않아요. 키를 다시 확인해 주세요. (sk-ant-로 시작)'
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return '이 API 키로는 해당 모델을 쓸 수 없어요. 콘솔에서 크레딧과 권한을 확인해 주세요.'
  }
  if (err instanceof Anthropic.RateLimitError) {
    return '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.'
  }
  if (err instanceof Anthropic.BadRequestError) {
    return `요청에 문제가 있어요: ${err.message}`
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return '서버에 연결하지 못했어요. 네트워크(학교 방화벽 여부)를 확인해 주세요.'
  }
  if (err instanceof Anthropic.APIError) {
    return `API 오류 (${err.status}): ${err.message}`
  }
  return err?.message || '알 수 없는 오류가 발생했어요.'
}

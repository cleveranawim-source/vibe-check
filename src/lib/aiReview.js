import Anthropic from '@anthropic-ai/sdk'

export const AI_MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5 — 가장 정밀 (기본)', note: '$5/$25 per 1M tokens' },
  { id: 'claude-fable-5', label: 'Claude Fable 5 — 최고 성능 (Opus의 2배 비용)', note: '$10/$50 per 1M tokens' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 — 균형형', note: '$3/$15 per 1M tokens' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — 절약형', note: '$1/$5 per 1M tokens' },
]

export const MAX_AI_CHARS = 150_000
// (구 자가점검의 자유형 AI 분석은 심사 모드의 루브릭 판정으로 대체됨 — runAiReview 제거)

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

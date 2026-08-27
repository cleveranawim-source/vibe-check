export class BadgeError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.name = 'BadgeError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function asBadgeError(error) {
  if (error instanceof BadgeError) return error
  return new BadgeError(500, 'internal_error', '블록체인 인증 처리 중 오류가 발생했습니다.')
}

// 제출 완결성 사전 게이트 — 심사를 시작하기 전에 "심사할 수 있는 제출물인가"를 확인한다.
// 미비 항목이 있으면 심사 대신 반려·보완 요청을 권고 (판단불가 다발의 주원인 차단).
const DB_USAGE = /firebase|firestore|initializeApp|supabase|createClient\s*\(/i
const RULES_FILE = /(^|\/)((firestore|database|storage)\.rules|.*\.rules)$/i

export function checkSubmission(files, meta = {}) {
  const items = []

  const hasEntry = files.some((f) => /(^|\/)(index\.html|package\.json)$/i.test(f.path))
  items.push({
    id: 'entry',
    ok: hasEntry,
    label: '빌드 가능한 전체 소스',
    detail: hasEntry
      ? 'index.html 또는 package.json 확인'
      : '진입점(index.html·package.json)이 없습니다 — 전체 소스가 제출됐는지 확인하세요',
  })

  const usesDb = files.some((f) => DB_USAGE.test(f.text))
  const hasRules = files.some((f) => RULES_FILE.test(f.path))
  items.push({
    id: 'rules',
    ok: !usesDb || hasRules,
    na: !usesDb,
    label: '보안 규칙 파일 (firestore.rules 등)',
    detail: !usesDb
      ? '외부 DB 사용 흔적 없음 — 해당없음'
      : hasRules
        ? '규칙 파일 확인'
        : '외부 DB를 쓰는데 규칙 파일이 없습니다 — 이대로는 DB 관련 항목이 전부 판단불가가 됩니다. 규칙 파일을 요청하세요',
  })

  const isLocal = meta.source === 'local'
  items.push({
    id: 'pinned',
    ok: true,
    label: '심사 대상 고정',
    detail: isLocal
      ? '업로드 파일 전체의 SHA-256 지문으로 고정됨'
      : '커밋 SHA로 고정됨 — 배포물과 대조 시 이 커밋 기준',
  })

  if (meta.truncated || (meta.skippedCount ?? 0) > 0) {
    items.push({
      id: 'coverage',
      ok: !meta.truncated,
      label: '파일 수집 범위',
      detail: meta.truncated
        ? '저장소가 커서 파일 목록이 잘렸습니다 — 심사 범위 한계를 보고서에 명시하세요'
        : `${meta.skippedCount}개 파일이 크기·형식 제한으로 제외됨 (스캔 불가 형식 포함)`,
    })
  }

  return items
}

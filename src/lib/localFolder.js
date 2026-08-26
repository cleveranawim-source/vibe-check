// 프로젝트 폴더를 심사 대상으로 읽는다 (비공개 저장소·미공개 프로젝트 심사용).
// GitHub 로드와 같은 상한을 적용하고, 커밋 SHA 대신 파일 경로+내용 전체의 SHA-256
// 콘텐츠 지문을 계산한다 — "이 심사는 이 내용에 대한 것"의 로컬 대응물.
import { isScannablePath, MAX_FILE_SIZE } from './scanner.js'

const MAX_FILES = 200
const MAX_TOTAL_BYTES = 8 * 1024 * 1024

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * fileList: <input webkitdirectory>의 FileList (또는 File 배열)
 * returns { files: [{path, name, size, text}], folderName, contentSha, skippedCount }
 */
export async function readLocalFolder(fileList) {
  const all = [...fileList].map((f) => ({ f, raw: f.webkitRelativePath || f.name }))
  if (all.length === 0) throw new Error('폴더에서 파일을 읽지 못했어요.')

  // webkitRelativePath는 "폴더명/…"로 시작 — 모든 경로가 같은 최상위 폴더면 표시 경로에서 걷어낸다
  const first = all[0].raw.split('/')[0]
  const hasCommonRoot = all.every((e) => e.raw.split('/')[0] === first && e.raw.includes('/'))
  const folderName = hasCommonRoot ? first : '업로드 폴더'
  const entries = all.map((e) => ({
    f: e.f,
    path: hasCommonRoot ? e.raw.slice(first.length + 1) : e.raw,
  }))

  const candidates = entries.filter((e) => isScannablePath(e.path) && e.f.size <= MAX_FILE_SIZE)
  const selected = []
  let total = 0
  for (const e of candidates) {
    if (selected.length >= MAX_FILES || total + e.f.size > MAX_TOTAL_BYTES) break
    selected.push(e)
    total += e.f.size
  }
  const skippedCount = entries.length - selected.length

  const files = []
  for (const e of selected) {
    try {
      const text = await e.f.text()
      files.push({ path: e.path, name: e.path.split('/').pop(), size: text.length, text })
    } catch {
      // 개별 파일 실패는 건너뛴다 — skippedCount에는 이미 빠져 있으므로 별도 집계 없이 진행
    }
  }
  if (files.length === 0) throw new Error('검사할 수 있는 파일이 없어요. (html/js/css 등 텍스트 파일 기준)')

  files.sort((a, b) => a.path.localeCompare(b.path))
  const contentSha = await sha256Hex(files.map((f) => `${f.path}\0${f.text}\0`).join(''))
  return { files, folderName, contentSha, skippedCount }
}

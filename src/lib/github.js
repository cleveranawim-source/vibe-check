// GitHub 공개 저장소를 브라우저에서 직접 불러온다.
// api.github.com(저장소 정보·파일 목록)과 raw.githubusercontent.com(파일 내용) 모두
// CORS를 허용하므로 별도 서버 없이 동작한다. 비공개 저장소는 불가.
import { isScannablePath, MAX_FILE_SIZE } from './scanner.js'

const MAX_FILES = 200
const MAX_TOTAL_BYTES = 8 * 1024 * 1024
const CONCURRENCY = 8

// 지원 형식: github.com/아이디/저장소[/tree/브랜치], 아이디.github.io/저장소(배포 주소), 아이디/저장소
export function parseGithubUrl(input) {
  const s = input.trim().replace(/[?#].*$/, '').replace(/\.git$/, '').replace(/\/+$/, '')
  if (!s) return null

  let m = s.match(/^(?:https?:\/\/)?([a-z0-9-]+)\.github\.io(?:\/([^/?#]+))?/i)
  if (m) {
    return {
      owner: m[1],
      repo: m[2] ? decodeURIComponent(m[2]) : `${m[1]}.github.io`,
      branch: null,
    }
  }

  m = s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#]+)\/([^/?#]+)(?:\/tree\/([^?#]+))?/i)
  if (m) {
    return {
      owner: m[1],
      repo: decodeURIComponent(m[2]),
      branch: m[3] ? decodeURIComponent(m[3].split('/')[0]) : null,
    }
  }

  m = s.match(/^([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/)
  if (m) return { owner: m[1], repo: m[2], branch: null }

  return null
}

async function ghJson(url) {
  let res
  try {
    res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } })
  } catch {
    throw new Error('GitHub에 연결하지 못했어요. 네트워크(학교 방화벽 여부)를 확인해 주세요.')
  }
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('저장소를 찾을 수 없어요. 주소를 확인해 주세요. 비공개 저장소는 불러올 수 없으니 그 경우엔 파일을 직접 올려 주세요.')
    }
    if (res.status === 403 || res.status === 429) {
      throw new Error('GitHub 요청 한도(시간당 60회)를 넘었어요. 잠시 후 다시 시도하거나 파일을 직접 올려 주세요.')
    }
    throw new Error(`GitHub 응답 오류 (${res.status})`)
  }
  return res.json()
}

/**
 * returns { files: [{path, name, size, text}], branch, skippedCount, truncated }
 */
export async function fetchRepoFiles({ owner, repo, branch, onProgress }) {
  if (!branch) {
    const info = await ghJson(`https://api.github.com/repos/${owner}/${repo}`)
    branch = info.default_branch
  }

  const tree = await ghJson(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`
  )

  const blobs = (tree.tree || []).filter((e) => e.type === 'blob')
  const candidates = blobs.filter((e) => isScannablePath(e.path) && (e.size ?? 0) <= MAX_FILE_SIZE)

  const selected = []
  let total = 0
  for (const e of candidates) {
    if (selected.length >= MAX_FILES || total + (e.size ?? 0) > MAX_TOTAL_BYTES) break
    selected.push(e)
    total += e.size ?? 0
  }
  const skippedCount = blobs.length - selected.length

  const queue = [...selected]
  const files = []
  let done = 0
  const worker = async () => {
    while (queue.length > 0) {
      const e = queue.shift()
      try {
        const res = await fetch(
          encodeURI(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${e.path}`)
        )
        if (res.ok) {
          const text = await res.text()
          files.push({ path: e.path, name: e.path.split('/').pop(), size: text.length, text })
        }
      } catch {
        // 개별 파일 실패는 건너뛴다 — 요약에 반영됨
      }
      done++
      onProgress?.(done, selected.length)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, selected.length) }, worker))

  files.sort((a, b) => a.path.localeCompare(b.path))
  return { files, branch, skippedCount, truncated: !!tree.truncated }
}

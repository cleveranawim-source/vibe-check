// GitHub 공개 저장소를 브라우저에서 직접 불러온다.
// api.github.com(저장소 정보·파일 목록)과 raw.githubusercontent.com(파일 내용) 모두
// CORS를 허용하므로 별도 서버 없이 동작한다. 비공개 저장소는 불가.
import { isApplicationSourcePath, isScannablePath, MAX_FILE_SIZE } from './scanner.js'

const MAX_FILES = 200
const MAX_TOTAL_BYTES = 8 * 1024 * 1024
const CONCURRENCY = 8
const FETCH_TIMEOUT_MS = 12_000
const MAX_GITHUB_JSON_BYTES = 12 * 1024 * 1024
const COMMIT_SHA = /^[0-9a-f]{40}$/i
const REGULAR_BLOB_MODES = new Set(['100644', '100755'])
// 점검하지 않아도 되는 비실행 미디어만 예외로 둔다. archive·WASM·JAR·native binary처럼
// 코드를 숨길 수 있는 파일은 확장자를 알아도 unsupported로 처리해 인증을 막는다.
const KNOWN_BINARY_ASSET = /\.(?:png|jpe?g|gif|webp|avif|ico|bmp|tiff?|woff2?|ttf|otf|eot|mp3|wav|ogg|m4a|mp4|webm|mov|avi)$/i
const KNOWN_BINARY_FILENAME = /^(?:\.DS_Store|Thumbs\.db|\.gitkeep)$/i

function isKnownBinaryAsset(path) {
  const name = path.split('/').pop()
  return KNOWN_BINARY_ASSET.test(name) || KNOWN_BINARY_FILENAME.test(name)
}

function isLfsPointer(text) {
  return /^version https:\/\/git-lfs\.github\.com\/spec\/v1\r?\n(?:ext-[^\r\n]+\r?\n)*oid sha256:[0-9a-f]{64}\r?\nsize \d+/i.test(text)
}

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

async function fetchTextWithTimeout(url, options = {}, maximumBytes = Infinity) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    const declaredSize = Number(response.headers.get('content-length'))
    if (Number.isFinite(declaredSize) && declaredSize > maximumBytes) throw new Error('response_too_large')
    const text = await response.text()
    if (new TextEncoder().encode(text).byteLength > maximumBytes) throw new Error('response_too_large')
    return { response, text }
  } finally {
    clearTimeout(timeout)
  }
}

async function ghJson(url) {
  let res
  let body
  try {
    const fetched = await fetchTextWithTimeout(
      url,
      { headers: { Accept: 'application/vnd.github+json' } },
      MAX_GITHUB_JSON_BYTES,
    )
    res = fetched.response
    body = fetched.text
  } catch (error) {
    if (error?.message === 'response_too_large') {
      throw new Error('GitHub 저장소 목록이 너무 커서 안전하게 검사할 수 없어요.')
    }
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
  try {
    return JSON.parse(body)
  } catch {
    throw new Error('GitHub 응답 형식을 읽지 못했어요.')
  }
}

/**
 * returns { files: [{path, name, size, text}], branch, skippedCount, truncated }
 */
export async function fetchRepoFiles({ owner, repo, branch, commitSha: requestedCommitSha, onProgress }) {
  const info = await ghJson(`https://api.github.com/repos/${owner}/${repo}`)
  const canonicalOwner = info.owner?.login || owner
  const canonicalRepo = info.name || repo
  const repositoryId = String(info.id || '')
  const canonicalUrl = info.html_url || `https://github.com/${canonicalOwner}/${canonicalRepo}`
  if (!branch) branch = info.default_branch

  let commitSha
  if (requestedCommitSha) {
    if (!COMMIT_SHA.test(requestedCommitSha)) throw new Error('40자리 Git commit SHA가 필요합니다.')
    const commitInfo = await ghJson(
      `https://api.github.com/repos/${canonicalOwner}/${canonicalRepo}/git/commits/${requestedCommitSha.toLowerCase()}`
    )
    commitSha = commitInfo.sha || ''
  } else {
    const branchInfo = await ghJson(
      `https://api.github.com/repos/${canonicalOwner}/${canonicalRepo}/branches/${encodeURIComponent(branch)}`
    )
    commitSha = branchInfo.commit?.sha || ''
  }
  if (!COMMIT_SHA.test(commitSha)) throw new Error('GitHub commit SHA를 확인하지 못했어요.')

  // 이후 조회는 브랜치명이 아니라 커밋 SHA 기준 — "이 심사는 커밋 X에 대한 것"이 실제로 성립하려면
  // 로드 도중 새 커밋이 푸시되거나 raw CDN 캐시가 낡은 파일을 주는 경우를 배제해야 한다.
  const ref = commitSha

  const tree = await ghJson(`https://api.github.com/repos/${canonicalOwner}/${canonicalRepo}/git/trees/${ref}?recursive=1`)

  const blobs = (tree.tree || []).filter((e) => e.type === 'blob')
  const submoduleCount = (tree.tree || []).filter((e) => e.type === 'commit').length
  const regularBlobs = blobs.filter((e) => REGULAR_BLOB_MODES.has(e.mode))
  const scannable = regularBlobs.filter((e) => isScannablePath(e.path))
  const nonRegularBlobCount = blobs.length - regularBlobs.length
  const unsupportedBlobCount = regularBlobs.filter(
    (e) => !isScannablePath(e.path) && !isKnownBinaryAsset(e.path),
  ).length
  const candidates = scannable.filter((e) => (e.size ?? 0) <= MAX_FILE_SIZE)

  const selected = []
  let total = 0
  for (const e of candidates) {
    if (selected.length >= MAX_FILES || total + (e.size ?? 0) > MAX_TOTAL_BYTES) break
    selected.push(e)
    total += e.size ?? 0
  }
  const skippedCount = blobs.length - selected.length
  const omittedScannableCount = scannable.length - selected.length
  const coverageComplete = (
    !tree.truncated
    && omittedScannableCount === 0
    && submoduleCount === 0
    && nonRegularBlobCount === 0
    && unsupportedBlobCount === 0
  )

  const queue = [...selected]
  const files = []
  let lfsPointerCount = 0
  let done = 0
  const worker = async () => {
    while (queue.length > 0) {
      const e = queue.shift()
      try {
        const encodedPath = e.path
          .split('/')
          .map((segment) => encodeURIComponent(segment))
          .join('/')
        const fetched = await fetchTextWithTimeout(
          `https://raw.githubusercontent.com/${encodeURIComponent(canonicalOwner)}/${encodeURIComponent(canonicalRepo)}/${commitSha}/${encodedPath}`,
          {},
          MAX_FILE_SIZE,
        )
        const res = fetched.response
        if (res.ok) {
          const text = fetched.text
          if (isLfsPointer(text)) {
            lfsPointerCount += 1
          } else {
            files.push({ path: e.path, name: e.path.split('/').pop(), size: text.length, text })
          }
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
  return {
    files,
    branch,
    commitSha,
    skippedCount,
    omittedScannableCount,
    submoduleCount,
    nonRegularBlobCount,
    unsupportedBlobCount,
    lfsPointerCount,
    coverageComplete: coverageComplete && lfsPointerCount === 0 && files.length === selected.length,
    hasApplicationSource: files.some((file) => isApplicationSourcePath(file.path)),
    truncated: !!tree.truncated,
    repositoryId,
    canonicalUrl,
    owner: canonicalOwner,
    repo: canonicalRepo,
  }
}

import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchRepoFiles } from '../src/lib/github.js'

const SHA = 'a'.repeat(40)

const json = (value) => new Response(JSON.stringify(value), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
})

afterEach(() => vi.unstubAllGlobals())

describe('GitHub exact commit loader', () => {
  it('기본 브랜치가 움직여도 요청한 SHA의 tree와 raw 파일만 읽는다', async () => {
    const fetchMock = vi.fn(async (url) => {
      const target = String(url)
      if (target === 'https://api.github.com/repos/example/app') {
        return json({ id: 123, name: 'app', owner: { login: 'example' }, html_url: 'https://github.com/example/app', default_branch: 'main' })
      }
      if (target.endsWith(`/git/commits/${SHA}`)) return json({ sha: SHA })
      if (target.endsWith(`/git/trees/${SHA}?recursive=1`)) {
        return json({ truncated: false, tree: [{ type: 'blob', mode: '100644', path: 'src/app.js', size: 18 }] })
      }
      if (target === `https://raw.githubusercontent.com/example/app/${SHA}/src/app.js`) {
        return new Response('export const app=1', { status: 200 })
      }
      throw new Error(`unexpected URL: ${target}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchRepoFiles({ owner: 'example', repo: 'app', branch: null, commitSha: SHA })

    expect(result).toMatchObject({
      repositoryId: '123',
      commitSha: SHA,
      coverageComplete: true,
      hasApplicationSource: true,
    })
    expect(fetchMock.mock.calls.map(([url]) => String(url)).some((url) => url.includes('/branches/'))).toBe(false)
  })

  it('파일명의 URL 예약 문자를 경로 일부로 인코딩한다', async () => {
    const encodedRawUrl = `https://raw.githubusercontent.com/example/app/${SHA}/src/placeholder%3Fpayload.js`
    const fetchMock = vi.fn(async (url) => {
      const target = String(url)
      if (target === 'https://api.github.com/repos/example/app') {
        return json({ id: 123, name: 'app', owner: { login: 'example' }, html_url: 'https://github.com/example/app', default_branch: 'main' })
      }
      if (target.endsWith(`/git/commits/${SHA}`)) return json({ sha: SHA })
      if (target.endsWith(`/git/trees/${SHA}?recursive=1`)) {
        return json({ truncated: false, tree: [{ type: 'blob', mode: '100644', path: 'src/placeholder?payload.js', size: 18 }] })
      }
      if (target === encodedRawUrl) return new Response('eval(userInput)', { status: 200 })
      throw new Error(`unexpected URL: ${target}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchRepoFiles({ owner: 'example', repo: 'app', commitSha: SHA })

    expect(result.files[0].path).toBe('src/placeholder?payload.js')
    expect(fetchMock).toHaveBeenCalledWith(encodedRawUrl, expect.any(Object))
  })

  it('Git submodule이 있으면 완전 검사로 표시하지 않는다', async () => {
    const fetchMock = vi.fn(async (url) => {
      const target = String(url)
      if (target === 'https://api.github.com/repos/example/app') {
        return json({ id: 123, name: 'app', owner: { login: 'example' }, html_url: 'https://github.com/example/app', default_branch: 'main' })
      }
      if (target.endsWith(`/git/commits/${SHA}`)) return json({ sha: SHA })
      if (target.endsWith(`/git/trees/${SHA}?recursive=1`)) {
        return json({
          truncated: false,
          tree: [
            { type: 'blob', mode: '100644', path: 'src/app.js', size: 18 },
            { type: 'commit', path: 'vendor/external', sha: 'b'.repeat(40) },
          ],
        })
      }
      if (target === `https://raw.githubusercontent.com/example/app/${SHA}/src/app.js`) {
        return new Response('export const app=1', { status: 200 })
      }
      throw new Error(`unexpected URL: ${target}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchRepoFiles({ owner: 'example', repo: 'app', commitSha: SHA })

    expect(result).toMatchObject({ coverageComplete: false, submoduleCount: 1 })
  })

  it('미지원 코드와 빌드 산출물이 있으면 완전 검사로 표시하지 않는다', async () => {
    const fetchMock = vi.fn(async (url) => {
      const target = String(url)
      if (target === 'https://api.github.com/repos/example/app') {
        return json({ id: 123, name: 'app', owner: { login: 'example' }, html_url: 'https://github.com/example/app', default_branch: 'main' })
      }
      if (target.endsWith(`/git/commits/${SHA}`)) return json({ sha: SHA })
      if (target.endsWith(`/git/trees/${SHA}?recursive=1`)) {
        return json({
          truncated: false,
          tree: [
            { type: 'blob', mode: '100644', path: 'index.html', size: 18 },
            { type: 'blob', mode: '100644', path: 'dist/app.js', size: 18 },
            { type: 'blob', mode: '100644', path: 'src/backdoor.nim', size: 18 },
            { type: 'blob', mode: '100644', path: 'dist/payload.wasm', size: 18 },
            { type: 'blob', mode: '100644', path: 'server/backdoor.jar', size: 18 },
            { type: 'blob', mode: '100644', path: 'public/logo.png', size: 18 },
          ],
        })
      }
      if (target === `https://raw.githubusercontent.com/example/app/${SHA}/index.html`) {
        return new Response('<main>safe</main>', { status: 200 })
      }
      throw new Error(`unexpected URL: ${target}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchRepoFiles({ owner: 'example', repo: 'app', commitSha: SHA })

    expect(result).toMatchObject({
      coverageComplete: false,
      unsupportedBlobCount: 4,
      hasApplicationSource: true,
    })
  })

  it('Git LFS pointer와 symlink를 실제 소스 파일로 인정하지 않는다', async () => {
    const lfsPointer = `version https://git-lfs.github.com/spec/v1\noid sha256:${'d'.repeat(64)}\nsize 12345\n`
    const fetchMock = vi.fn(async (url) => {
      const target = String(url)
      if (target === 'https://api.github.com/repos/example/app') {
        return json({ id: 123, name: 'app', owner: { login: 'example' }, html_url: 'https://github.com/example/app', default_branch: 'main' })
      }
      if (target.endsWith(`/git/commits/${SHA}`)) return json({ sha: SHA })
      if (target.endsWith(`/git/trees/${SHA}?recursive=1`)) {
        return json({
          truncated: false,
          tree: [
            { type: 'blob', mode: '100644', path: 'src/app.js', size: lfsPointer.length },
            { type: 'blob', mode: '120000', path: 'src/linked.js', size: 15 },
          ],
        })
      }
      if (target === `https://raw.githubusercontent.com/example/app/${SHA}/src/app.js`) {
        return new Response(lfsPointer, { status: 200 })
      }
      throw new Error(`unexpected URL: ${target}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchRepoFiles({ owner: 'example', repo: 'app', commitSha: SHA })

    expect(result).toMatchObject({
      coverageComplete: false,
      hasApplicationSource: false,
      lfsPointerCount: 1,
      nonRegularBlobCount: 1,
    })
    expect(result.files).toHaveLength(0)
  })
})

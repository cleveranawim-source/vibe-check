import { describe, it, expect } from 'vitest'
import { readLocalFolder } from '../src/lib/localFolder.js'

// <input webkitdirectory>의 File을 흉내 낸다 — readLocalFolder가 쓰는 속성만
const fake = (relPath, content) => ({
  name: relPath.split('/').pop(),
  size: content.length,
  webkitRelativePath: relPath,
  text: async () => content,
})

describe('readLocalFolder', () => {
  it('공통 최상위 폴더를 걷어내고 스캔 가능 파일만 남긴다', async () => {
    const r = await readLocalFolder([
      fake('myapp/index.html', '<html></html>'),
      fake('myapp/src/app.js', 'const a = 1'),
      fake('myapp/node_modules/lib.js', 'skip'),
      fake('myapp/logo.png', 'binary'),
    ])
    expect(r.folderName).toBe('myapp')
    expect(r.files.map((f) => f.path)).toEqual(['index.html', 'src/app.js'])
    expect(r.skippedCount).toBe(2)
  })

  it('콘텐츠 지문은 내용에 결정적 — 같으면 같고 다르면 다르다', async () => {
    const a = await readLocalFolder([fake('app/x.js', 'let v = 1')])
    const b = await readLocalFolder([fake('app/x.js', 'let v = 1')])
    const c = await readLocalFolder([fake('app/x.js', 'let v = 2')])
    expect(a.contentSha).toMatch(/^[0-9a-f]{64}$/)
    expect(b.contentSha).toBe(a.contentSha)
    expect(c.contentSha).not.toBe(a.contentSha)
  })

  it('검사 가능한 파일이 없으면 오류', async () => {
    await expect(readLocalFolder([fake('app/logo.png', 'x')])).rejects.toThrow()
  })
})

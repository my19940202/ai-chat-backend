import { NextResponse } from 'next/server'
import { getR2Bucket } from '@/lib/r2'

/**
 * R2 文件代理读取
 * GET /api/r2/{key} → 从 R2 读取并返回文件内容
 */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  try {
    const { key } = await params
    const objectKey = Array.isArray(key) ? key.join('/') : key

    const bucket = await getR2Bucket()
    const object = await bucket.get(objectKey)

    if (!object) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 })
    }

    const headers = new Headers()
    headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream')
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    headers.set('ETag', object.httpEtag)

    return new Response(object.body, { headers })
  } catch (err) {
    console.error('R2 read error:', err)
    return NextResponse.json({ error: '读取失败' }, { status: 500 })
  }
}

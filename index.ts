#!/usr/bin/env bun

const PORT = 8000

const urls: Record<string, string> = {
  // getcolo worker
  colo: 'https://getcolo.jldec.me/colo',
  // shared tunnel
  geo: 'https://geo.jldec.me/colo',
  // region-specific tunnels
  'us-east-1': 'https://us-east-1.jldec.me/colo',
  'us-west-1': 'https://us-west-1.jldec.me/colo',
  dublin: 'https://dublin.jldec.me/colo',
  singapore: 'https://singapore.jldec.me/colo',
  tokyo: 'https://tokyo.jldec.me/colo'
}

type Colo = Record<string, string | number>

/**
 * Pings url to get colo info
 */
async function getColo(urlName: string) {
  const url = urls[urlName]
  if (!url) throw new Error(`Unknown urlName: ${urlName}`)
  const start = Date.now()
  const resp = await fetch(url)
  const colo: Colo = resp.ok ? ((await resp.json()) as Colo) : { status: resp.status }
  colo[urlName] = url
  colo[urlName + 'FetchTime'] = Date.now() - start
  return colo
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    console.log(req.method, url.toString())

    try {
      if (url.pathname === '/') return new Response(`Hello from ${url.origin}`)
      for (const [key, value] of Object.entries(urls)) {
        if (url.pathname === `/${key}`) return Response.json(await getColo(key))
      }
      return new Response('Not found', { status: 404 })
    } catch (e: any) {
      console.error(`Bun error on ${url}`, e)
      return new Response(`Bun error: ${e.message}`, { status: 502 })
    }
  }
})

console.log(`Bun running on :${PORT}`)

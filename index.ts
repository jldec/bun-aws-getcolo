#!/usr/bin/env bun

const PORT = 8000
type Colo = Record<string, string | number>

/**
 * GET colo JSON  with timing from `https://${name}.jldec.me/getcolo`
 * @param name - subdomain of jldec.me to query
 */
async function getColo(name: string): Promise<Response> {
  // Check for valid DNS hostname (RFC 1123, no dots, 1-63 chars, alphanum or hyphen, not start/end with hyphen)
  if (!/^(?!-)[A-Za-z0-9-]{1,63}(?<!-)$/.test(name)) {
    console.error(`400 Invalid DNS hostname: ${name}`)
    return new Response(`Invalid DNS hostname: ${name}`, { status: 400 })
  }
  const url = `https://${name}.jldec.me/getcolo`
  const start = Date.now()
  const resp = await fetch(url)
  if (!resp.ok) {
    console.error(`${resp.status} ${resp.statusText} error fetching ${url}`)
    return new Response(`${resp.statusText} error fetching ${url}`, { status: resp.status })
  }
  const colo: Colo = await resp.json() as Colo
  colo[name] = url
  colo[name + 'FetchTime'] = Date.now() - start
  return Response.json(colo)
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    const pathname = url.pathname
    console.log(req.method, pathname)
    try {
      if (pathname === '/') return new Response(`Hello from ${url.origin}`)
      return await getColo(pathname.slice(1))
    } catch (e: any) {
      console.error(`502 Internal error fetching ${req.url}`, e)
      return new Response(`Internal error fetching ${req.url}: ${e.message}`, { status: 502 })
    }
  }
})

console.log(`Bun running on :${PORT}`)

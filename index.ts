#!/usr/bin/env bun

const PORT = 8000

Bun.serve({
  port: PORT,
  async fetch(req) {
    console.log(req.method, req.url)
    const url = new URL(req.url)
    const pathname = url.pathname
    const coloName = pathname.slice(1)
    try {
      if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 })
      if (pathname === '/') return new Response(`Hello from ${url.origin}`)
      // Check if valid DNS hostname: RFC 1123, no dots, 1-63 chars, alphanum or hyphen, not start/end with hyphen
      // This also catches requests for favicon etc.
      if (!/^(?!-)[A-Za-z0-9-]{1,63}(?<!-)$/.test(coloName)) throw new Error(`Invalid colo hostname ${coloName}`)
      return await getColo(coloName, url.search)
    } catch (e) {
      console.log(`400 ${e}`)
      return new Response(`${e}`, { status: 400 })
    }
  }
})

type Colo = Record<string, string | number>

console.log(`Bun running on http://localhost:${PORT}`)
/**
 * GET colo JSON  with timing from `https://${coloName}.jldec.me/getcolo`
 * Possibilities for coloName include:
 * - getcolo.jldec.me: closest worker to this server
 * - geo.jldec.me: server resolved by shared tunnel endpoint
 * - <instance-name>.jldec.me: server in a specific city
 *
 * @param coloName - subdomain of jldec.me to query
 */
async function getColo(coloName: string, search: string = ''): Promise<Response> {
  const url = `https://${coloName}.jldec.me/getcolo${search}`
  const start = Date.now()
  let resp: Response | undefined
  try {
    resp = await fetch(url)
  } catch (e) {
    throw new Error(`${url}: ${e}`)
  }
  if (!resp.ok) throw new Error(`Status ${resp.status} fetching ${url}`)
  let colo: Colo
  try {
    colo = (await resp.json()) as Colo
  } catch (e) {
    throw new Error(`Error parsing JSON from ${url}: ${e}`)
  }
  colo[coloName] = url
  colo[coloName + 'FetchTime'] = Date.now() - start
  return Response.json(colo)
}

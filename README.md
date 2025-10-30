# bun-aws-getcolo
<img width="2260" height="1116" alt="Screenshot 2025-10-30 at 19 17 29" src="https://github.com/user-attachments/assets/6dba61b2-4d59-4720-87f1-a61f7babe6d1" />

This repo provides aws configuration and a bun script deployed to several EC2 t4g.nano instances in different regions. (see [aws-ec2.md](aws-ec2.md))

The goal was to test whether HTTP requests to a shared cloudflare tunnel will automatically select the closest origin. Wording in the [documentation](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/tunnel-useful-terms/#replica) suggests that there may be different strategies for how the "replica" is selected.

> there is no guarantee about which replica will be chosen

Experiments confirm that in some environments the choice of origin varies (randomly?) while in others it appears to pin requests to the "local" origin.

## How it works
This experiment depends on Cloudflare workers anycast routing. A [getcolo](https://github.com/jldec/getcolo) worker deployed to https://getcolo.jldec.me/ simply returns the colo name (and other region info) from the datacenter where it is running.

The bun script running on each of the EC2 instances calls getcolo, either directly, or via one of the other regional instances, returning colo details and timing info.

Each instance is also running 2 cloudflared tunnels

1. cloudflared.service - region-specific tunnel at `https://<region>.jldec.me`
2. cloudflared-geo.service - shared tunnel at `https://geo.jldec.me`

The following regions are currently deployed:
- us-east-1
- us-west-1
- dublin
- singapore
- tokyo

## Examples

https://dublin.jldec.me/getcolo - reliably shows the colo details for the dublin region
```json
{
  "colo": "DUB",
  "city": "Dublin",
  "region": "Leinster",
  "country": "IE",
  "continent": "EU",
  "getcolo": "https://getcolo.jldec.me/getcolo",
  "getcoloFetchTime": 6
}
```

https://dublin.jldec.me/geo - however geo targeting is not predictable
```json
{
  "colo": "NRT",
  "city": "Tokyo",
  "region": "Tokyo",
  "country": "JP",
  "continent": "AS",
  "getcolo": "https://getcolo.jldec.me/getcolo",
  "getcoloFetchTime": 12,
  "geo": "https://geo.jldec.me/getcolo",
  "geoFetchTime": 273
}
```

https://tokyo.jldec.me/geo - geo targeting behaves predictably (sometimes)
```json
{
  "colo": "NRT",
  "city": "Tokyo",
  "region": "Tokyo",
  "country": "JP",
  "continent": "AS",
  "getcolo": "https://getcolo.jldec.me/getcolo",
  "getcoloFetchTime": 8,
  "geo": "https://geo.jldec.me/getcolo",
  "geoFetchTime": 56
}
```

## Bun development
See https://bun.sh/ to install locally. Then install dependencies for this repo with
```bash
bun install
```

To run with watch:
```bash
bun run dev
```

## AWS deployments
This experiment uses t4g.nano ARM64 EC2 instances which can be deployed very cheaply.
The scripts and commands used are documented in [aws-ec2.md](aws-ec2.md).

#### improvements
- Use IPv6 instead of public IP addresses which are as expensive to run as the compute.
- Simply removing the public IPv4 addresses breaks the tunnels because it requires a NAT gatway service (not installed by default, and as expensive as the public IPs)

#### References
- https://grok.com/share/bGVnYWN5_513887d6-f932-4154-ab33-248f40127ef5
- https://grok.com/share/bGVnYWN5_2172f841-64f2-4458-a310-123a5a3633f1
- https://grok.com/share/bGVnYWN5_2adbfd96-89c8-4573-a06c-eb20ee773c92
- https://grok.com/share/bGVnYWN5_688a7794-99a9-4bbf-8708-66f57d8f68c2


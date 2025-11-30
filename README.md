# bun-aws-getcolo
This repo provides aws configuration and a bun script deployed to several EC2 t4g.nano instances across  different regions. (see [aws-ec2.md](aws-ec2.md))

The goal was to test whether HTTP requests to a shared cloudflare tunnel will automatically select the closest origin. Wording in the [documentation](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/tunnel-useful-terms/#replica) suggests that there may be different strategies for how the "replica" is selected.

> there is no guarantee about which replica will be chosen

Experiments confirm that in some environments the choice of origin varies (randomly?) while in others it appears to pin requests to the "local" origin.

## How it works
This experiment depends on Cloudflare workers anycast routing to call a worker in the closest colo. A [getcolo](https://github.com/jldec/getcolo) worker deployed to https://getcolo.jldec.me/ simply returns the colo name (and other region info) from the datacenter where it is running.

Each instance is running 2 cloudflared tunnels, making the instance reachable in 2 ways:

1. Instance-specific tunnel at `https://<instance-name>.jldec.me`
2. Shared tunnel at `https://aws-shared.jldec.me`

Requests to an instance-specific endpoint trigger the bun script on that instance. The URL path determines whether the script calls getcolo directly, or via another instance tunnel, or via the shared tunnel.

- `https://<instance-name-1>.jldec.me/getcolo` - calls getcolo directly
- `https://<instance-name-1>.jldec.me/<instance-name-2>` - calls getcolo on `<instance-name-2>`
- `https://<instance-name-1>.jldec.me/aws-shared` - calls getcolo via the shared tunnel

## Examples

https://aws-euwest-1c.jldec.me/getcolo - reliably shows the colo details for the dublin region
```json
{
  "colo": "DUB",
  "city": "Dublin",
  "region": "Leinster",
  "country": "IE",
  "continent": "EU",
  "getcolo": "https://getcolo.jldec.me/getcolo",
  "getcoloFetchTime": 5
}
```

https://aws-euwest-1c.jldec.me/aws-shared - shared targeting is not predictable
```json
{
  "colo": "IAD",
  "city": "Ashburn",
  "region": "Virginia",
  "country": "US",
  "continent": "NA",
  "getcolo": "https://getcolo.jldec.me/getcolo",
  "getcoloFetchTime": 7,
  "aws-shared": "https://aws-shared.jldec.me/getcolo",
  "aws-sharedFetchTime": 104
}
```

https://aws-useast-1b.jldec.me/aws-shared - In other locations shared targeting seems more predictable (sometimes) but this could be illusory.
```json
{
  "colo": "IAD",
  "city": "Ashburn",
  "region": "Virginia",
  "country": "US",
  "continent": "NA",
  "getcolo": "https://getcolo.jldec.me/getcolo",
  "getcoloFetchTime": 9,
  "aws-shared": "https://aws-shared.jldec.me/getcolo",
  "aws-sharedFetchTime": 20
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

## AWS cost control
To keep costs low, this experiment uses type t4g.nano ARM64 VMs running Linux. Inbound HTTP requests and SSH admin connections are routed through a Cloudflare tunnel. Since the cloudflared daemon can be configured to use outbound ipv6 connections, no public ipv4 address or NAT is required, further reducing costs.

## Network complexity
Configuring an ipv6-only instance through the AWS console requires knowledge of VPCs, route tables, subnets, security groups, network interfaces, internet gateways, and egress-only gateways. Details can be found in [aws-ec2.md](aws-ec2.md). Clearly, more automation is required for repeatable deployments, especially since each region is configured separately.

Additional complexity comes from the need to install packages like bun which is distributed via an ipv4-only source (github.com). My first attempt simply avoids this by launching instances with a public IP, and then removing it after service installation. Using a prebuilt AMI or provisioning outbound ipv4 NAT services would also work.

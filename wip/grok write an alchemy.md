grok write an alchemy.run script to manage the following EC2 instance
this server will host a cloudflare tunnel for inbound HTTP requests served by bun
it will start with both ipv4 and ipv6, but the ipv4 address will be disabled after installation.
make the region, architecture, instance type, and public key configurable
(for initial testing we'll use the Dublin eu region, arm64, t4g.nano, and ~/.ssh/jldec-aws.pub for the key)
try to use spot instances with persistence and Stop (not terminate) interruption 
use the default VPC and default subnets (one per az), but make sure that each subnet has an IPv6 /64 CIDR, (and obviously that those CIDRs don't overlap.)
create an egress only internet gateway in the VPC and route outbound IPv6 to it
on launch, enable auto-assigned pubic ipv4 and ipv6 addresses
install cloudflared (yum script to be provided) and bun (curl/shell script to be provided) and configure both with systemd units
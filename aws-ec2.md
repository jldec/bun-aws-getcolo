# AWS Console
Instructions to deploy EC2 instances in different regions with ipv6 for Cloudflare tunnels.

The steps below are repeated for each region. Select a region in the [AWS EC2 console](https://console.aws.amazon.com/ec2/home). If necessary, import your public key under `Key Pairs`

### VPC
- Open the default VPC in the [VPC console](https://console.aws.amazon.com/vpcconsole/). Look for subnets in the resource map. Typically there is already a subnet configured for each availability zone.
- Use 'Edit CIDR' to add an Amazon-provided ipv6 CIDR block ('/56') on the default VPC.
- Now add different ipv6 '/64' CIDR blocks with the VPC CIDR block to each subnet. The action to 'Edit IP6 CIDRs' should appear in the dropdown for each subnet, once the VPC ipv6 CIDR has been added.
- Create an egress-only internet gateway for the VPC (unless it already exists) and then an ipv6 `::/0` route to the VPC default route table, pointing to the egress-only internet gateway.

Sharing the same subnets for both ipv4 and ipv6, makes it easy to start with an ipv4 setup e.g. to install bun from github releases (which doesn't work over ipv6), and subsequently disable the public ipv4 address to save costs.

### Launch the new EC2 instance
- Select architecture `64 bit (Arm)` with default Amazon Linux AMI.
- Select instance type `t4g.nano` (graviton, 1/2 GB RAM).
- Select the keypair as configured earlier.
- Edit network settings to select a subnet and auto-assign public ipv4 and ipv6 addresses.
- Create a new security group with ssh inbound ipv4 access enabled.
- Under advanced details select the 'Spot instances' purchasing option, with 'Persistent' request type, and 'Stop' interruption behavior.

### Configure a new ssh host
Example from .ssh/config
```sh
Host useast-2
    HostName ec2-3-145-49-221.us-east-2.compute.amazonaws.com
    User ec2-user
    IdentityFile ~/.ssh/jldec-aws-eu.pem
```

### Test ssh
```sh
ssh useast-2
```

### Push xterm-ghostty terminfo
If you use ghostty, configure terminfo on the host

```sh
infocmp -x xterm-ghostty | ssh useast-2 -- tic -x -
```

### Create new tunnel
Create a new instance-specific tunnel in the Cloudflare dashboard. The steps below are copied from the instructions for the 'Red Hat' OS environment in the dashboard

```sh
# install cloudflared
curl -fsSl https://pkg.cloudflare.com/cloudflared.repo | sudo tee /etc/yum.repos.d/cloudflared.repo
sudo yum update -y
sudo yum install -y cloudflared
```

```sh
# each tunnel has a unique secret token
sudo cloudflared service install <token>
```

### Update the tunnel service to use ipv6
Fix the `<token>` below using region-specific tunnel token from cloudflare dashboard.

```sh
sudo tee /etc/systemd/system/cloudflared.service > /dev/null <<'EOF'
[Unit]
Description=cloudflared
After=network-online.target
Wants=network-online.target

[Service]
TimeoutStartSec=15
Type=notify
ExecStart=/usr/bin/cloudflared --no-autoupdate tunnel --edge-ip-version 6 run --token <token>
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl restart cloudflared.service
sudo journalctl -u cloudflared.service -f
```

### Add a domain name for the tunnel
Add a published application route mapping the new hostname to http://localhost:8000

### install 2nd shared tunnel (geo-routed?)
Add a new `cloudflared-geo` sysmtemd service unit for the 2nd tunnel in `/etc/systemd/system/`.
Fix the `<token>` below using geo tunnel token from cloudflare dashboard.

```sh
sudo tee /etc/systemd/system/cloudflared-geo.service > /dev/null <<'EOF'
[Unit]
Description=cloudflared geo-routed
After=network-online.target
Wants=network-online.target

[Service]
TimeoutStartSec=0
Type=notify
ExecStart=/usr/bin/cloudflared --no-autoupdate tunnel --edge-ip-version 6 run --token <token>
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

# reload systemd
sudo systemctl daemon-reload

# enable on boot
sudo systemctl enable cloudflared-geo.service

# start now
sudo systemctl start cloudflared-geo.service

# tail logs
sudo journalctl -u cloudflared-geo.service -f

# to remove
sudo systemctl stop cloudflared-geo.service
sudo systemctl disable cloudflared-geo.service
sudo rm /etc/systemd/system/cloudflared-geo.service
sudo systemctl daemon-reload
```

### install bun
NOTE: This only works with outbound ipv4 since bun is installed from github.com.

```sh
curl -fsSL https://bun.sh/install | bash
source /home/ec2-user/.bash_profile

# directory for bun server code - index.ts
sudo mkdir -p /opt/bun
sudo chown ec2-user:ec2-user /opt/bun
cd /opt/bun
```

```sh
# install as service after copying index.ts
scp index.ts useast-2:/opt/bun/index.ts
ssh useast-2 "chmod +x /opt/bun/index.ts"
```

```sh
sudo tee /etc/systemd/system/bun.service > /dev/null <<'EOF'
[Unit]
Description=Bun HTTP server
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/bun
ExecStart=/home/ec2-user/.bun/bin/bun run index.ts
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
sudo systemctl daemon-reload

# Enable on boot
sudo systemctl enable bun.service

# Start now
sudo systemctl start bun.service

# Check status
sudo systemctl status bun.service

# View logs
sudo journalctl -u bun.service -f

# Restart service
sudo systemctl restart bun.service
```

### Test the service
Your browser should now show something like `Hello from http://tokyo-1.jldec.me`.

### Turn off ipv4
Look for the toggle to turn off 'Auto-assign public IP' in the 'Manage IP addresses' action.
Make a note of the ipv6 address for the instance.

### Add ipv6 CIDR route for the tunnel
Add the ipv6 address from above to the tunnel CIDR routes. The `/128` will be added automatically.

### Add ipv6 CIDR route to the WARP profile
Add the same address as a CIDR range to your WARP profile's split tunnel config and save the profile.
This will make the ipv6 address reachable from devices running WARP.

## add ipv6 Host to .ssh/config
Finally replace the ipv4 hostname in your .ssh/config file with the ipv6 address, and make sure ssh works.
# aws-ec2
Manual instructions for deploying aws instances in different regions.

### in AWS console
1. Select region
2. Launch instance, enter dns-able name e.g. 'dublin' or 'us-east-1'
3. Select architecture `64 bit (Arm)` with default Amazon Linux AMI 
4. Select instance type `t4g.nano` (graviton, 1/2 GB RAM)
5. Save new ssh keypair to `~/.ssh` and `chmod 400`
6. 

### env vars for ssh
Run the whole script below from this repo directory to update index.ts on all hosts.  
After restarting hosts will have a new IP, so update the respective EC2_HOST below.
```sh

## us-east-1e
export EC2_USER=ec2-user
export EC2_HOST=ec2-3-83-125-166.compute-1.amazonaws.com
export EC2_KEY=~/.ssh/jldec-aws.pem

scp -i $EC2_KEY index.ts $EC2_USER@$EC2_HOST:/opt/bun/index.ts
ssh -i $EC2_KEY $EC2_USER@$EC2_HOST "sudo systemctl restart bun.service"

## us-west-1
export EC2_USER=ec2-user
export EC2_HOST=ec2-52-53-124-255.us-west-1.compute.amazonaws.com
export EC2_KEY=~/.ssh/jldec-aws-uswest.pem

scp -i $EC2_KEY index.ts $EC2_USER@$EC2_HOST:/opt/bun/index.ts
ssh -i $EC2_KEY $EC2_USER@$EC2_HOST "sudo systemctl restart bun.service"

## dublin
export EC2_USER=ec2-user
export EC2_HOST=ec2-52-18-170-250.eu-west-1.compute.amazonaws.com
export EC2_KEY=~/.ssh/jldec-aws-eu.pem

scp -i $EC2_KEY index.ts $EC2_USER@$EC2_HOST:/opt/bun/index.ts
ssh -i $EC2_KEY $EC2_USER@$EC2_HOST "sudo systemctl restart bun.service"

## singapore
export EC2_USER=ec2-user
export EC2_HOST=ec2-13-212-153-95.ap-southeast-1.compute.amazonaws.com
export EC2_KEY=~/.ssh/jldec-aws-singapore.pem

scp -i $EC2_KEY index.ts $EC2_USER@$EC2_HOST:/opt/bun/index.ts
ssh -i $EC2_KEY $EC2_USER@$EC2_HOST "sudo systemctl restart bun.service"

## tokyo
export EC2_USER=ec2-user
export EC2_HOST=ec2-35-77-79-39.ap-northeast-1.compute.amazonaws.com
export EC2_KEY=~/.ssh/jldec-aws-tokyo.pem

scp -i $EC2_KEY index.ts $EC2_USER@$EC2_HOST:/opt/bun/index.ts
ssh -i $EC2_KEY $EC2_USER@$EC2_HOST "sudo systemctl restart bun.service"
```

### ssh
```sh
ssh -i $EC2_KEY $EC2_USER@$EC2_HOST
```

### ghostty
https://grok.com/share/bGVnYWN5_9973b0e0-a223-40a8-b316-05a8c63fc3ee

```sh
# fix terminfo
infocmp -x xterm-ghostty | ssh -i $EC2_KEY $EC2_USER@$EC2_HOST -- tic -x -
```

### list services
```sh
sudo systemctl list-units --type=service --state=running
```

### cloudflare tunnels
https://one.dash.cloudflare.com/a0b19134b3f8f7aaae377202538aafe3/networks/tunnels  
https://grok.com/share/bGVnYWN5_96d9723a-2ed0-4601-b368-6c260af083c7

### install cloudflared service
```sh
# install cloudflared on aws linux (dnf ~= yum)
curl -fsSL https://pkg.cloudflare.com/cloudflared-ascii.repo | sudo tee /etc/yum.repos.d/cloudflared.repo
sudo dnf check-update
sudo dnf install -y cloudflared

# now install the tunnel using the region-specific token from the cloudflare dashboard
# sudo cloudflared service install <token...>

# to tail logs
sudo journalctl -u cloudflared.service -f

# to remove
sudo systemctl stop cloudflared.service
sudo systemctl disable cloudflared.service
sudo cloudflared service uninstall
sudo systemctl daemon-reload
```

### install 2nd shared tunnel (geo-routed?)
Add a new `cloudflared-geo` sysmtemd service unit in `/etc/systemd/system/`.
No need for update chron since that's alread installed.
> [!NOTE]
> fix tunnel run `<token>` below using geo tunnel token from cloudflare dashboard
```sh
sudo tee /etc/systemd/system/cloudflared-geo.service > /dev/null <<'EOF'
[Unit]
Description=cloudflared geo-routed
After=network-online.target
Wants=network-online.target

[Service]
TimeoutStartSec=0
Type=notify
ExecStart=/usr/bin/cloudflared --no-autoupdate tunnel run --token <token...>
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
https://grok.com/c/1f58ae3b-5e22-405b-a038-8d1d9d207c3a

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
scp -i $EC2_KEY index.ts $EC2_USER@$EC2_HOST:/opt/bun/index.ts
ssh -i $EC2_KEY $EC2_USER@$EC2_HOST "chmod +x /opt/bun/index.ts"
```

```sh
# restart service whenever index is updated
ssh -i $EC2_KEY $EC2_USER@$EC2_HOST "sudo systemctl restart bun.service"
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

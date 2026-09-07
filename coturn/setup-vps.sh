#!/usr/bin/env bash
# DropLink Coturn VPS Automated Setup Script
# Target OS: Ubuntu 22.04 LTS / 24.04 LTS

set -e

DOMAIN="turn.yourdomain.com"
SECRET=$(openssl rand -hex 32)

echo "=========================================="
echo " DropLink Coturn Setup & Deployment "
echo "=========================================="
echo "Generated Shared Secret: ${SECRET}"
echo "Save this secret for your backend .env: WEBRTC_TURN_SECRET=${SECRET}"
echo "=========================================="

# 1. Update & Install Coturn & Certbot
sudo apt-get update
sudo apt-get install -y coturn certbot

# 2. Stop service before config
sudo systemctl stop coturn || true

# 3. Configure firewall (UFW)
echo "Configuring UFW Firewall rules..."
sudo ufw allow 3478/udp
sudo ufw allow 3478/tcp
sudo ufw allow 5349/tcp
sudo ufw allow 49152:65535/udp
sudo ufw allow 80/tcp  # required for Let's Encrypt certbot validation
sudo ufw allow 443/tcp

# 4. Backup original config
if [ -f /etc/turnserver.conf ]; then
    sudo mv /etc/turnserver.conf /etc/turnserver.conf.bak
fi

# 5. Enable coturn daemon in /etc/default/coturn
sudo sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn

# 6. Copy configuration
sudo cp ./turnserver.conf /etc/turnserver.conf
sudo sed -i "s/static-auth-secret=.*/static-auth-secret=${SECRET}/" /etc/turnserver.conf
sudo sed -i "s/realm=.*/realm=${DOMAIN}/" /etc/turnserver.conf
sudo sed -i "s/server-name=.*/server-name=${DOMAIN}/" /etc/turnserver.conf

# 7. Start and enable Coturn service
sudo systemctl daemon-reload
sudo systemctl start coturn
sudo systemctl enable coturn

echo "=========================================="
echo "Coturn installation completed successfully!"
echo "Check status with: sudo systemctl status coturn"
echo "Check logs with: sudo tail -f /var/log/turnserver/turnserver.log"
echo "=========================================="

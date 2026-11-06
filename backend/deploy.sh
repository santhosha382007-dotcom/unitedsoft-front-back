#!/bin/bash
# ====================================================================
#   UniStaff Management - Automated 24/7 Cloud VPS Deployment Script
#   Compatible with: Ubuntu 20.04 / 22.04 / 24.04 & Debian 11 / 12
# ====================================================================

set -e

echo "=========================================================="
echo "    Deploying UniStaff Management Backend on Cloud VPS     "
echo "=========================================================="

# 1. Update system packages
echo "[1/6] Updating system packages..."
sudo apt-get update -y && sudo apt-get upgrade -y

# 2. Install Node.js 22 LTS (if not installed)
if ! command -v node &> /dev/null; then
    echo "[2/6] Installing Node.js 22 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "[2/6] Node.js is already installed ($(node -v))."
fi

# 3. Install PM2 process manager globally
echo "[3/6] Installing PM2 process manager..."
sudo npm install -g pm2

# 4. Install backend dependencies
echo "[4/6] Installing backend dependencies..."
cd "$(dirname "$0")"
npm install --omit=dev

# Ensure data directory exists
mkdir -p data

# 5. Start / Restart backend with PM2
echo "[5/6] Starting UniStaff Backend with PM2..."
pm2 delete unistaff-backend 2>/dev/null || true
pm2 start src/server.js --name "unistaff-backend" --time
pm2 save

# Setup PM2 to startup automatically on server reboot
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME 2>/dev/null || true

# 6. Configure Firewall
echo "[6/6] Allowing port 5000 through UFW firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 5000/tcp comment "UniStaff API"
    sudo ufw reload 2>/dev/null || true
fi

# Fetch Public IP
PUBLIC_IP=$(curl -s https://api.ipify.org || hostname -I | awk '{print $1}')

echo ""
echo "=========================================================="
echo "       🎉 UNISTAFF BACKEND IS LIVE 24/7 ON YOUR VPS!       "
echo "=========================================================="
echo ""
echo "  Permanent API Endpoint: http://${PUBLIC_IP}:5000/api"
echo "  Health Check Status:   http://${PUBLIC_IP}:5000/api/health"
echo ""
echo "  Commands to monitor:"
echo "    pm2 status          - Check server running status"
echo "    pm2 logs            - View live server logs"
echo "    pm2 restart unistaff-backend - Restart server"
echo "=========================================================="

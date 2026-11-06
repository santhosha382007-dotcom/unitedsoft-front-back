import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('====================================================');
console.log('       UNISTAFF MANAGEMENT - CLOUD NETWORK          ');
console.log('   Global Access from Anywhere on Any Network       ');
console.log('====================================================\n');

const cloudflaredPath = path.join(__dirname, 'cloudflared.exe');

if (!fs.existsSync(cloudflaredPath)) {
  console.error(`[Error] cloudflared.exe not found at ${cloudflaredPath}`);
  process.exit(1);
}

let activeProcess = null;
let isShuttingDown = false;
let currentLiveUrl = null;

// Optional remote sync URL (e.g. free Firebase Realtime Database or custom endpoint)
const configFilePath = path.join(__dirname, 'cloud-config.json');
let syncEndpoint = null;
if (fs.existsSync(configFilePath)) {
  try {
    const cfg = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
    if (cfg.syncEndpoint) syncEndpoint = cfg.syncEndpoint;
  } catch {}
}

async function syncToRemoteCloud(url) {
  if (!syncEndpoint) return;
  try {
    console.log(`[Auto-Sync] Publishing live URL to remote config: ${syncEndpoint}...`);
    const res = await fetch(syncEndpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, updatedAt: new Date().toISOString() })
    });
    if (res.ok) {
      console.log('[Auto-Sync] Successfully synchronized URL to cloud config!');
    }
  } catch (err) {
    console.log('[Auto-Sync] Remote sync ping notice:', err.message);
  }
}

function startTunnel() {
  if (isShuttingDown) return;

  console.log('[Connecting] Launching Persistent Cloudflare Tunnel to port 5000...');

  // Launch cloudflared with resilient edge connection
  activeProcess = spawn(cloudflaredPath, ['tunnel', '--url', 'http://localhost:5000'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let cloudUrlFound = false;

  function handleData(data) {
    const text = data.toString();
    // Match customer trycloudflare URL, excluding internal api.trycloudflare.com
    const match = text.match(/https:\/\/(?!api\.)[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match && !cloudUrlFound) {
      cloudUrlFound = true;
      const cloudUrl = match[0];
      currentLiveUrl = cloudUrl;

      // 1. Save to cloud-url.txt
      const urlFilePath = path.join(__dirname, 'cloud-url.txt');
      fs.writeFileSync(urlFilePath, cloudUrl, 'utf8');

      // 2. Keep mobile/src/api/client.ts updated with the live Cloud URL
      const clientFilePath = path.join(__dirname, 'mobile', 'src', 'api', 'client.ts');
      if (fs.existsSync(clientFilePath)) {
        try {
          let clientCode = fs.readFileSync(clientFilePath, 'utf8');
          clientCode = clientCode.replace(
            /export const CLOUD_API_URL = 'https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com\/api';/,
            `export const CLOUD_API_URL = '${cloudUrl}/api';`
          );
          fs.writeFileSync(clientFilePath, clientCode, 'utf8');
        } catch (err) {}
      }

      // 3. Sync to remote cloud config if configured
      syncToRemoteCloud(cloudUrl);

      console.log('\n====================================================');
      console.log('  SUCCESS! YOUR SYSTEM IS NOW LIVE ON THE CLOUD!     ');
      console.log('====================================================');
      console.log(`\n  Public Cloud URL:     ${cloudUrl}`);
      console.log(`  API Endpoint:         ${cloudUrl}/api`);
      console.log(`  Health Status:        ${cloudUrl}/api/health\n`);
      console.log('  -> Anyone on ANY network (4G/5G/Wi-Fi/Remote) can');
      console.log('     now access UniStaff Management!');
      console.log(`  -> URL saved to: ${urlFilePath}\n`);
      console.log('  [Persistence Active] Tunnel process is protected.');
      console.log('  Keep this window open to maintain 24/7 cloud access.\n');
      console.log('====================================================\n');
    }
  }

  activeProcess.stdout.on('data', handleData);
  activeProcess.stderr.on('data', handleData);

  activeProcess.on('close', (code) => {
    if (!isShuttingDown) {
      console.log(`[Notice] Tunnel connection closed (code ${code}). Reconnecting in 3 seconds...`);
      setTimeout(startTunnel, 3000);
    }
  });

  activeProcess.on('error', (err) => {
    console.error('[Tunnel Error]', err);
    if (!isShuttingDown) {
      setTimeout(startTunnel, 3000);
    }
  });
}

process.on('SIGINT', () => {
  isShuttingDown = true;
  if (activeProcess) activeProcess.kill();
  process.exit();
});

process.on('SIGTERM', () => {
  isShuttingDown = true;
  if (activeProcess) activeProcess.kill();
  process.exit();
});

startTunnel();

import http from 'http';
import { initDatabase, db } from '../src/db.js';
import { app } from '../src/server.js';

let server;
const PORT = 5099;

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- RUNNING WEB ROUTES & ROLE VERIFICATION TESTS ---');
  initDatabase();
  await new Promise((resolve) => {
    server = app.listen(PORT, '127.0.0.1', resolve);
  });

  try {
    // Test 1: Web entrance page
    const homeRes = await request('GET', '/', { Accept: 'text/html' });
    if (homeRes.statusCode === 200 && homeRes.body.includes('UnitedSoft Technologies')) {
      console.log('✓ GET / successfully serves unified Web Login portal');
    } else {
      throw new Error(`GET / failed: ${homeRes.statusCode}`);
    }

    // Test 2: Admin web page
    const adminRes = await request('GET', '/admin');
    if (adminRes.statusCode === 200 && adminRes.body.includes('Admin Control Center')) {
      console.log('✓ GET /admin successfully serves Admin Web Control Center');
    } else {
      throw new Error(`GET /admin failed: ${adminRes.statusCode}`);
    }

    // Test 3: HR web page with attendance system
    const hrRes = await request('GET', '/hr');
    if (
      hrRes.statusCode === 200 &&
      hrRes.body.includes('HR Portal & Attendance') &&
      hrRes.body.includes('Punch Attendance') &&
      hrRes.body.includes('Company Attendance')
    ) {
      console.log('✓ GET /hr successfully serves HR Portal with integrated Attendance System');
    } else {
      throw new Error(`GET /hr failed: ${hrRes.statusCode}`);
    }

    // Test 4: API health check
    const healthRes = await request('GET', '/api/health');
    if (healthRes.statusCode === 200 && healthRes.body.includes('OK')) {
      console.log('✓ GET /api/health returned 200 OK');
    } else {
      throw new Error(`GET /api/health failed: ${healthRes.statusCode}`);
    }

    // Test 5: Login API works identically for both Admin and HR
    const adminLoginRes = await request('POST', '/api/auth/login', {}, {
      loginId: 'admin@unitedsoft.com',
      password: 'admin123'
    });
    const adminData = JSON.parse(adminLoginRes.body);
    if (adminLoginRes.statusCode === 200 && adminData.user && adminData.token) {
      console.log(`✓ Admin API login successful: ${adminData.user.full_name} (${adminData.user.role})`);
    } else {
      throw new Error(`Admin API login failed: ${adminLoginRes.body}`);
    }

    const hrLoginRes = await request('POST', '/api/auth/login', {}, {
      loginId: 'hr@unitedsoft.com',
      password: 'hr123'
    });
    const hrData = JSON.parse(hrLoginRes.body);
    if (hrLoginRes.statusCode === 200 && hrData.user && hrData.token) {
      console.log(`✓ HR API login successful: ${hrData.user.full_name} (${hrData.user.role})`);
    } else {
      throw new Error(`HR API login failed: ${hrLoginRes.body}`);
    }

    console.log('==================================================');
    console.log('ALL WEB & ROLE API TESTS PASSED SUCCESSFULLY! ✓');
    console.log('==================================================');
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('Test Error Occurred:', err);
    if (server) server.close();
    process.exit(1);
  }
}

runTests();

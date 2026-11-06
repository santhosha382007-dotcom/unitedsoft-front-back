// e:/UnitedSoft Attendance system/backend/tests/adminController.test.js

/**
 * Jest + Supertest integration tests for the admin controller (create staff).
 * Uses mongodb-memory-server to spin up an in‑memory MongoDB instance, so the
 * tests run isolated from your real database.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app'); // assumes app.js exports the Express app
const User = require('../models/User');
const bcrypt = require('bcrypt');

let mongoServer;
let adminToken;

/** Helper: generate a JWT for a given user */
function generateJwt(user) {
  const jwt = require('jsonwebtoken');
  const secret = process.env.JWT_SECRET || 'change-me-please';
  return jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: '4h' });
}

beforeAll(async () => {
  // Start in‑memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  // Create an admin user to obtain a token
  const adminPassword = await bcrypt.hash('AdminPass@123', 12);
  const admin = await User.create({
    email: 'admin@example.com',
    passwordHash: adminPassword,
    role: 'admin',
    firstLogin: false
  });
  adminToken = generateJwt(admin);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  // Clean collections after each test
  await User.deleteMany({ email: { $ne: 'admin@example.com' } });
});

describe('POST /api/admin/staff', () => {
  it('should create a staff user and send a reset token', async () => {
    const res = await request(app)
      .post('/api/admin/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'newstaff@example.com' })
      .expect(201);

    expect(res.body.message).toBe('Staff created & reset link sent');

    // Verify staff record in DB
    const staff = await User.findOne({ email: 'newstaff@example.com' });
    expect(staff).not.toBeNull();
    expect(staff.role).toBe('staff');
    expect(staff.firstLogin).toBe(true);
    // passwordHash should exist and not equal the plain sample password
    expect(staff.passwordHash).toBeDefined();
    const match = await bcrypt.compare('Password@123', staff.passwordHash);
    expect(match).toBe(true);
    // resetToken should be stored (temporary field used in controller)
    expect(staff.resetToken).toBeDefined();
  });

  it('should reject requests from non‑admin users', async () => {
    // create a normal staff user
    const staffPwd = await bcrypt.hash('Password@123', 12);
    const staff = await User.create({
      email: 'staff@example.com',
      passwordHash: staffPwd,
      role: 'staff',
      firstLogin: true
    });
    const staffToken = generateJwt(staff);

    await request(app)
      .post('/api/admin/staff')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ email: 'another@example.com' })
      .expect(403);
  });

  it('should return 400 when email is missing', async () => {
    await request(app)
      .post('/api/admin/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(400);
  });
});

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'staff'], default: 'staff' },
  firstLogin: { type: Boolean, default: true }, // true until they change password
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);

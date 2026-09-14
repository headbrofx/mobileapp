'use strict';

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Demo/test data for Phase 0 — a client and a staff/nurse account so the
// auth flow (login as each role) can be exercised without the full
// registration screens yet.
module.exports = {
  async up(queryInterface) {
    const passwordHash = await bcrypt.hash('Password123!', 12);
    const now = new Date();

    await queryInterface.bulkInsert('users', [
      {
        id: uuidv4(),
        name: 'Test Client',
        phone: '0700000001',
        email: 'client@afyanyumbani.test',
        password_hash: passwordHash,
        role: 'CLIENT',
        status: 'ACTIVE',
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: 'Test Nurse',
        phone: '0700000002',
        email: 'nurse@afyanyumbani.test',
        password_hash: passwordHash,
        role: 'STAFF',
        status: 'ACTIVE',
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: 'Test Admin',
        phone: '0700000003',
        email: 'admin@afyanyumbani.test',
        password_hash: passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', {
      email: ['client@afyanyumbani.test', 'nurse@afyanyumbani.test', 'admin@afyanyumbani.test'],
    });
  },
};

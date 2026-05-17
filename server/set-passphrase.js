#!/usr/bin/env node
/**
 * Set the terminal passphrase.
 * Usage: node server/set-passphrase.js
 *
 * Hashes the passphrase with scrypt so even reading the file reveals nothing.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const PASSPHRASE_FILE = path.join(__dirname, '..', 'data', '.terminal-passphrase');

function hashPassphrase(passphrase) {
  const salt = crypto.randomBytes(32);
  const hash = crypto.scryptSync(passphrase, salt, 64);
  return salt.toString('hex') + ':' + hash.toString('hex');
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

process.stdout.write('\n  Mission Control — Set Terminal Passphrase\n\n');

rl.question('  Enter new passphrase (min 8 chars): ', (pass1) => {
  if (pass1.length < 8) {
    console.error('\n  Too short. Minimum 8 characters.\n');
    process.exit(1);
  }

  rl.question('  Confirm passphrase: ', (pass2) => {
    if (pass1 !== pass2) {
      console.error('\n  Passphrases do not match.\n');
      process.exit(1);
    }

    const hashed = hashPassphrase(pass1);
    const dataDir = path.join(__dirname, '..', 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(PASSPHRASE_FILE, hashed, { mode: 0o600 });

    console.log('\n  Passphrase set. You can now access /pachamama from any device.');
    console.log('  File: ' + PASSPHRASE_FILE);
    console.log('  (contains only a salted hash — unreadable)\n');

    rl.close();
  });
});

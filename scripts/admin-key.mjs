// The admin's key hash: what lets the admin's username be made, and only
// with the admin's password (worker/api.ts, ADMIN_KEY_HASH).
//
// It's the sign-in key the browser makes from that username and password
// (src/lib/keys.ts: PBKDF2-SHA256, 600,000 rounds, then HKDF), hashed with
// SHA-256. The password itself is kept nowhere.
//
//   node scripts/admin-key.mjs <username>
//
// asks for the password (or reads it from stdin) and prints the hash. Then:
//
//   npx wrangler secret put ADMIN_USERNAME     (the username)
//   npx wrangler secret put ADMIN_KEY_HASH     (the hash)

import { createHash, webcrypto as crypto } from 'node:crypto';
import { stdin, stdout, stderr, argv, exit } from 'node:process';

const username = (argv[2] ?? '').trim();
if (!/^[A-Za-z0-9_-]{3,30}$/.test(username)) {
    stderr.write('Usage: node scripts/admin-key.mjs <username>\n');
    exit(1);
}

async function readPassword() {
    if (!stdin.isTTY) {
        let text = '';
        for await (const chunk of stdin) text += chunk;
        return text.replace(/\r?\n$/, '');
    }
    // Typed: not shown on screen.
    stderr.write('Password: ');
    stdin.setRawMode(true);
    let text = '';
    for await (const chunk of stdin) {
        for (const ch of chunk.toString('utf8')) {
            if (ch === '\r' || ch === '\n') {
                stdin.setRawMode(false);
                stderr.write('\n');
                return text;
            }
            if (ch === '\u0003') exit(130);
            if (ch === '\u007f') text = text.slice(0, -1);
            else text += ch;
        }
    }
    return text;
}

const password = await readPassword();
if (password.length < 8) {
    stderr.write('A password is at least 8 characters.\n');
    exit(1);
}

const enc = new TextEncoder();
const pw = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(`oyama-journal/v1/${username.toLowerCase()}`), iterations: 600_000 },
    pw,
    256,
);
const base = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveBits']);
const auth = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode('oyama-journal/v1/password/auth') }, base, 256),
);
stdout.write(createHash('sha256').update(auth).digest('base64url') + '\n');

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64, options);
  return ['scrypt1', salt, key.toString('hex')].join('$');
}
export async function verifyPassword(password, hash) {
  const valid = /^scrypt1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(hash || '');
  const [, salt, key] = valid ? hash.split('$') : ['', '0'.repeat(32), '0'.repeat(128)];
  const result = await derive(password, salt, 64, options);
  return timingSafeEqual(result, Buffer.from(key, 'hex')) && valid;
}

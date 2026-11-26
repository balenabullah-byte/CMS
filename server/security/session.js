import { randomBytes, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
const lifetime = 8 * 3600 * 1000;
const baseOptions = { httpOnly: true, sameSite: 'strict', path: '/api' };
function cookieOptions(req) {
  const secure = process.env.COOKIE_SECURE != null
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production' && Boolean(req?.secure || req?.headers?.['x-forwarded-proto'] === 'https');
  return { ...baseOptions, secure };
}
function filename(token) {
  return join(process.env.SESSION_DIR, createHash('sha256').update(token).digest('hex'));
}
function cookie(req) {
  return /(?:^|;\s*)campus_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
}
export async function logout(req, res) {
  const token = cookie(req);
  if (token) await rm(filename(token), { force: true });
  res.clearCookie('campus_session', cookieOptions(req));
}
export async function login(req, res, user) {
  await logout(req, res);
  const token = randomBytes(32).toString('hex');
  await mkdir(process.env.SESSION_DIR, { recursive: true, mode: 0o700 });
  await writeFile(filename(token), JSON.stringify({ id: user.id, expires: Date.now() + lifetime,
    version: createHash('sha256').update(user.password_hash).digest('hex') }), { mode: 0o600, flag: 'wx' });
  res.cookie('campus_session', token, { ...cookieOptions(req), maxAge: lifetime });
}
export async function session(req) {
  const token = cookie(req);
  if (!token) return;
  try {
    const data = JSON.parse(await readFile(filename(token), 'utf8'));
    if (data.expires > Date.now()) return data;
    await rm(filename(token), { force: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

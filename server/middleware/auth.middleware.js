import { createHash } from 'node:crypto';
import { session } from '../security/session.js';
import users from '../module/user.module.js';
import membership from '../module/user-role.module.js';
import { fail } from './error.middleware.js';
export default async function authenticate(req, res, next) {
  const data = await session(req);
  if (!data) fail(401, 'Login required');
  const account = await users.credentials({ id: data.id });
  if (!account?.is_active || createHash('sha256').update(account.password_hash).digest('hex') !== data.version) fail(401, 'Login required');
  delete account.password_hash;
  const roles = await membership.codes(account.id);
  const portal = req.get('X-Campus-Role');
  if (portal && !roles.includes(portal)) fail(403, 'Portal access denied');
  req.user = { ...account, roles: portal ? [portal] : roles };
  next();
}

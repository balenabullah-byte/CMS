import { fail } from './error.middleware.js';
export default function allow(...roles) {
  return (req, res, next) => {
    if (!roles.some(role => req.user.roles.includes(role))) fail(403, 'Insufficient permissions');
    next();
  };
}

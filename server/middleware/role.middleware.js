import { fail } from './error.middleware.js';
export default function allow(...roles) {
  return (req, res, next) => {
    // authenticate narrows verified portal requests to one role. Never combine
    // several memberships on a role-protected endpoint.
    if (req.user.roles.length > 1) fail(403, 'Select a portal using X-Campus-Role');
    if (!roles.some(role => req.user.roles.includes(role))) fail(403, 'Insufficient permissions');
    next();
  };
}

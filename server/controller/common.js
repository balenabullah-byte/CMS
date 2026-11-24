import { fail } from '../middleware/error.middleware.js';
export function found(value) {
  if (!value) fail(404, 'Record not found');
  return value;
}
export function state(request, allowed) {
  if (!allowed.includes(request.status)) fail(409, `Request is ${request.status}. Allowed starting states: ${allowed.join(', ')}.`);
}

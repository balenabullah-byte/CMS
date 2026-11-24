import J from 'joi';
export { J };
export const id = J.number().integer().positive();
export const str = max => J.string().trim().max(max);
export const email = str(254).email({ tlds: { allow: false } }).lowercase();
export const password = J.string().min(12).max(256);
export const page = J.object({ limit: id.max(100).default(50), offset: J.number().integer().min(0).default(0) });

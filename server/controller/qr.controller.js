import db from '../connection.js';
import qr from '../module/qr.module.js';
import {fail} from '../middleware/error.middleware.js';

function origin() {
  if (!process.env.CMS_PUBLIC_BASE_URL?.trim())
    fail(503,'Set CMS_PUBLIC_BASE_URL in server/.env, then restart the backend API.');
  let url;
  try { url = new URL(process.env.CMS_PUBLIC_BASE_URL); } catch {}
  const production = process.env.NODE_ENV === 'production';
  const privateHost = url && /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(url.hostname);
  if (!url || url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && privateHost && !production)) ||
    (production && (privateHost || !url.hostname.includes('.') || url.hostname.endsWith('.localhost') || /^[\d.]+$/.test(url.hostname))))
    fail(503,production
      ? 'CMS_PUBLIC_BASE_URL must be a public HTTPS application origin. Check server/.env and restart the API.'
      : 'CMS_PUBLIC_BASE_URL must be an HTTPS origin or a localhost or private IPv4 HTTP origin, without credentials, path, query or fragment. Restart the API after editing server/.env.');
  return url.origin;
}
function handle(fn) {
  return async (req,res,next) => {
    try { res.json({data:await fn(req.input,req.user)}); } catch(error) {next(error);}
  };
}
class QrController {
  generate=handle(async ({params,body},user)=>{
    const base=origin();
    const row=await db.transaction(t=>qr.generate(t,user.id,params.type,params.id,body.replace_id));
    return {id:row.id,resource:row.resource,url:base+'/scan/'+row.token,development:process.env.NODE_ENV!=='production'};
  });
  history=handle(({params})=>qr.history(params.type,params.id));
  revoke=handle(({params},user)=>db.transaction(t=>qr.revoke(t,user.id,params.id)));
  resolve=handle(({params})=>db.transaction(t=>qr.resolve(t,params.token)));
  analytics=handle(()=>qr.analytics());
}
export default new QrController();

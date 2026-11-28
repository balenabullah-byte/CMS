import db from '../connection.js';
import assets from '../module/asset.module.js';
import validation from '../validation/asset.validation.js';
import { verifyPassword } from '../security/password.js';

// Code, category, equipment, manufacturer, illustrative model, quantity.
const catalog = [
  ['PRJ', 'Projectors', 'Classroom projector', 'Epson', 'PowerLite E20', 3],
  ['PC', 'Computers', 'Desktop computer', 'Dell', 'OptiPlex 7010', 4],
  ['LAP', 'Computers', 'Laptop', 'HP', 'ProBook 450', 2],
  ['AC', 'HVAC', 'Air conditioner', 'LG', 'Dual Inverter', 3],
  ['SW', 'Network equipment', 'Network switch', 'Cisco', 'Catalyst 1000', 2],
  ['AP', 'Network equipment', 'Wireless access point', 'TP-Link', 'Omada EAP610', 2],
  ['MIC', 'Laboratory equipment', 'Laboratory microscope', 'Olympus', 'CX23', 2],
  ['DSK', 'Furniture', 'Classroom desk', 'Generic', 'Single classroom desk', 2],
];
const categoryCodes = ['PROJECTORS','COMPUTERS','HVAC','NETWORK','LAB','FURNITURE'];
const categoryNames = [...new Set(catalog.map(row => row[1]))];
const validate = (schema, body) => schema.body.validateAsync(body);
const warrantyOffsets = [365, 18, -40, null];
function warranty(index) {
  const days = warrantyOffsets[index % warrantyOffsets.length];
  return days === null ? null : new Date(Date.now() + days * 86400000).toISOString().slice(0,10);
}

async function seed(trx) {
  const [[target]] = await trx.raw('SELECT DATABASE() AS name');
  if (target.name !== process.env.DB_NAME) throw Error('Connected database does not match the confirmed name.');
  // Serialize seed runs before checking fixture identities, including runs by different admins.
  const role = await trx('roles').where({code:'admin'}).forUpdate().first('id');
  const admin = await trx('users as u').join('user_roles as ur','ur.user_id','u.id')
    .where({'u.email':process.env.CMS_DEV_ADMIN_EMAIL,'u.is_active':1,'ur.role_id':role.id})
    .forShare().first('u.id','u.password_hash');
  if (!admin || !await verifyPassword(process.env.CMS_DEV_ADMIN_PASSWORD,admin.password_hash))
    throw Error('Active development administrator credentials required.');
  const locations = await trx('buildings as b').leftJoin('rooms as r',function(){
    this.on('r.building_id','b.id').andOnVal('r.is_active',1);
  }).where('b.is_active',1).orderBy(['b.code','r.room_code'])
    .select('b.id as building_id','r.id as room_id');
  if (!locations.length) throw Error('At least one active building is required.');
  const rooms = locations.filter(row => row.room_id);
  const counts = {categoriesCreated:0,categoriesReused:0,created:0,reused:0,skipped:0};
  const categories = new Map();
  for (const [index,name] of categoryNames.entries()) {
    const code = categoryCodes[index];
    let row = await trx('asset_categories').where({name}).orWhere({code}).orderBy('is_active','desc').first();
    if (!row) {
      row = await assets.saveCategory(trx,admin.id,null,await validate(validation.categoryCreate,{code,name}));
      counts.categoriesCreated++;
    } else counts.categoriesReused++;
    categories.set(name,row);
  }
  let index = 0;
  for (const [prefix,category,equipment,manufacturer,model,quantity] of catalog) {
    for (let n = 1; n <= quantity; n++, index++) {
      const name = 'TEST '+equipment+' '+String(n).padStart(2,'0');
      const serial_number = 'CMS-TEST-'+prefix+'-'+String(n).padStart(3,'0');
      const existing = await trx('assets').where({serial_number}).select('name','manufacturer');
      if (existing.length) {
        if (existing.length===1 && existing[0].name===name && existing[0].manufacturer===manufacturer) counts.reused++;
        else counts.skipped++;
        continue;
      }
      const cat = categories.get(category);
      if (!cat.is_active) { counts.skipped++; continue; }
      const candidates = rooms.length && !['SW','AP'].includes(prefix) ? rooms : locations;
      const fields = await validate(validation.create,{
        ...candidates[index % candidates.length],name,manufacturer,model,serial_number,
        asset_category_id:cat.id,warranty_expires_at:warranty(index),
        description:'Development fixture. Equipment identity and warranty information are fictional.',
      });
      const asset = await assets.create(trx,admin.id,fields);
      if (index === 19) {
        const reason = await validate(validation.retire,{reason:'Development fixture: desk withdrawn from use.'});
        await assets.change(trx,admin.id,asset.id,'retired',reason);
      } else if (index >= 14) {
        const status = await validate(validation.status,{operational_status:index < 17 ? 'under_maintenance' : 'out_of_service'});
        await assets.change(trx,admin.id,asset.id,'status_changed',status);
      }
      counts.created++;
    }
  }
  return counts;
}

try {
  const database = process.env.DB_NAME || '';
  const disposable = process.env.NODE_ENV === 'test' && /^campus_test_[a-f0-9]{24}$/.test(database);
  if (process.env.NODE_ENV === 'production' || !process.argv.includes('--development') ||
      !process.argv.includes('--confirm='+database) || (database !== 'cms_maintenance' && !disposable) ||
      !['127.0.0.1','localhost','::1'].includes(process.env.DB_HOST))
    throw Error('Use --development --confirm=cms_maintenance with a local development database.');
  if (!process.env.CMS_DEV_ADMIN_EMAIL || !process.env.CMS_DEV_ADMIN_PASSWORD)
    throw Error('Set CMS_DEV_ADMIN_EMAIL and CMS_DEV_ADMIN_PASSWORD in the private development environment.');
  console.log(await db.transaction(seed,{isolationLevel:'read committed'}));
} catch (error) {
  console.error(error.sql || error.isJoi ? 'Seed validation or database operation failed. Transaction rolled back.' : error.message);
  process.exitCode=1;
} finally {
  await db.destroy();
}

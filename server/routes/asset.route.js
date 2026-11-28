import { Router } from 'express';
import auth from '../middleware/auth.middleware.js';
import allow from '../middleware/role.middleware.js';
import validate from '../middleware/validate.middleware.js';
import v from '../validation/asset.validation.js';
import c from '../controller/asset.controller.js';

const r = Router(),
  admin = allow('admin'),
  staff = allow('admin', 'coordinator');
r.get('/asset-categories', auth, staff, validate(v.categories), c.categories);
r.post('/asset-categories', auth, admin, validate(v.categoryCreate), c.createCategory);
r.patch('/asset-categories/:id', auth, admin, validate(v.categoryEdit), c.editCategory);
r.get('/asset-lookup', auth, allow('campus_member'), validate(v.lookup), c.lookup);
r.get('/analytics/assets', auth, admin, validate(v.analytics), c.analytics);
r.get('/assets', auth, staff, validate(v.directory), c.list);
r.post('/assets', auth, admin, validate(v.create), c.create);
r.get('/assets/:id', auth, staff, validate(v.detail), c.detail);
r.patch('/assets/:id', auth, admin, validate(v.edit), c.change('edited'));
r.patch('/assets/:id/status', auth, admin, validate(v.status), c.change('status_changed'));
r.post('/assets/:id/transfer', auth, admin, validate(v.transfer), c.change('transferred'));
r.post('/assets/:id/retire', auth, admin, validate(v.retire), c.change('retired'));
r.get('/assets/:id/history', auth, staff, validate(v.history), c.history);
r.get('/assets/:id/locations', auth, staff, validate(v.history), c.locations);
r.get(
  '/maintenance-requests/:id/equipment',
  auth,
  allow('coordinator', 'campus_member', 'technician'),
  validate(v.history),
  c.requestEquipment
);
export default r;

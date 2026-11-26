import { Router } from 'express';
import controller from '../controller/reporting.controller.js';
import authenticate from '../middleware/auth.middleware.js';
import allow from '../middleware/role.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { accountFilters, analyticsFilters, causeFilters, workloadFilters, workPage } from '../validation/reporting.validation.js';
const router = Router();
for (const [name,kind,role,query] of [
  ['operations','operations','coordinator',analyticsFilters],['causes','causes','coordinator',causeFilters],
  ['workload','workload','coordinator',workloadFilters],['accounts','accounts','admin',accountFilters],
  ['infrastructure','infrastructure','admin',analyticsFilters],['trends','operations','admin',analyticsFilters],
]) {
  for(const suffix of ['','/export']) router.get('/analytics/'+name+suffix,authenticate,allow(role),validate({query}),controller.analytics(kind));
}
router.get('/work-records/export',authenticate,allow('coordinator'),validate({query:workPage}),controller.historyExport);
export default router;

import express from 'express';
import knex from './connection.js';
import { pathToFileURL } from 'node:url';
import errorHandler from './middleware/error.middleware.js';
import { limit } from './middleware/rate.middleware.js';
import buildingRoutes from './routes/building.route.js';
import roomRoutes from './routes/room.route.js';
import categoryRoutes from './routes/category.route.js';
import userRoutes from './routes/user.route.js';
import roleRoutes from './routes/role.route.js';
import authRoutes from './routes/auth.route.js';
import skillRoutes from './routes/skill.route.js';
import maintenanceRoutes from './routes/maintenance.route.js';
import assignmentRoutes from './routes/assignment.route.js';
import reportingRoutes from './routes/reporting.route.js';
export const app = express();
app.disable('x-powered-by');
app.use('/api', limit(1000, 'api'), (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (req.headers['sec-fetch-site'] === 'cross-site' && !['GET','HEAD','OPTIONS'].includes(req.method)) return res.status(403).json({ error: 'Cross-site write denied' });
  next();
}, express.json({ limit: '64kb' }));
app.get('/api/health', (req, res) => res.json({ data: { status: 'ok' } }));
app.use('/api', reportingRoutes, buildingRoutes, roomRoutes, categoryRoutes, userRoutes, roleRoutes, authRoutes, skillRoutes, maintenanceRoutes, assignmentRoutes);
app.use((req, res) => res.status(404).json({ error: 'Endpoint not found' }));
app.use(errorHandler);
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.DB_USER || !process.env.SESSION_DIR) throw new Error('Configure DB_USER and SESSION_DIR in server/.env');
  const port = Number(process.env.PORT || 3000);
  await knex.raw('SELECT 1');
  app.listen(port, '127.0.0.1', () => console.log('Campus API listening on port', port));
}

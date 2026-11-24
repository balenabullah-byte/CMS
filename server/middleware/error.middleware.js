export function fail(status, message) { throw Object.assign(new Error(message), { apiStatus: status }); }
export default function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.apiStatus) return res.status(error.apiStatus).json({ error: error.message });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  if (['charset.unsupported', 'encoding.unsupported'].includes(error.type)) return res.status(415).json({ error: 'Unsupported request encoding' });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Body too large' });
  if ([1062,1451,1452,1644,4025,1213,1205].includes(error.errno)) return res.status(409).json({ error: 'Operation conflicts with the current record or database constraints' });
  console.error('API failure', error.code || error.name);
  res.status(500).json({ error: 'Internal server error' });
}

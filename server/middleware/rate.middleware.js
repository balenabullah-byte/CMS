const windows = new Map();
const interval = 15 * 60 * 1000;
setInterval(() => {
  for (const [key, item] of windows) if (item.end <= Date.now()) windows.delete(key);
}, interval).unref();
export function limit(max, group) {
  return (req, res, next) => {
    const key = group + ':' + req.ip;
    let item = windows.get(key);
    if (!item || item.end <= Date.now()) {
      item = { count: 0, end: Date.now() + interval };
      windows.set(key, item);
    }
    if (++item.count > max) return res.status(429).json({ error: 'Too many requests' });
    next();
  };
}

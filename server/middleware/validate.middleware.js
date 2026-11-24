import J from 'joi';
const empty = J.object({});
export default function validate(schemas) {
  return (req, res, next) => {
    req.input = {};
    for (const key of ['params','query','body']) {
      const { value, error } = (schemas[key] || empty).validate(req[key] ?? {});
      if (error) return res.status(400).json({ error: 'Invalid ' + key + ': ' + error.details[0].message });
      req.input[key] = value;
    }
    next();
  };
}

export function validate(schema) {
  return (req, res, next) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      });
      req.validated = parsed;
      next();
    } catch (err) {
      if (err.errors) {
        const errorMessages = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({ error: errorMessages, details: err.errors });
      }
      return res.status(400).json({ error: 'Invalid request payload.' });
    }
  };
}

export default validate;

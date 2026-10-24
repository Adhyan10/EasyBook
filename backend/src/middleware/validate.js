export const validate = (schemas) => (req, _res, next) => {
  try {
    req.valid = {
      body: schemas.body ? schemas.body.parse(req.body) : undefined,
      query: schemas.query ? schemas.query.parse(req.query) : undefined,
      params: schemas.params ? schemas.params.parse(req.params) : undefined,
    };
    next();
  } catch (err) {
    next(err);
  }
};

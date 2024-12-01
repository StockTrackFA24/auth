export const requireAcceptsJson = (req, res, next) => {
  if (!req.accepts('json')) {
    res.status(400);
    res.end();
    return;
  }

  return next();
};

export const jsonError = (err, req, res, next) => {
  const statusCode = err.status || 500;

  let message;
  if (err.type === "entity.parse.failed") {
    message = "Malformed JSON";
  } else {
    message = err.message;
  }

  if (err.status === 400 && !message) {
    message = "Invalid usage";
  }

  res.status(statusCode).json({'error': true, 'status': statusCode, 'message': message});
  return next();
};

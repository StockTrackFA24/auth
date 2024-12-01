import express from 'express';
import logger from 'morgan';

import usersRouter from './routes/users.mjs';

const app = express();

app.use(logger('dev'));
app.use(express.json({ type: '*/*' }));

app.use('/users', usersRouter);

app.use((err, req, res, next) => {
  const statusCode = err.status || 500;

  let message;
  if (err.type === "entity.parse.failed") {
    message = "Malformed JSON";
  } else {
    message = err.message;
  }

  res.status(statusCode).json({'error': true, 'status': statusCode, 'message': message});
  return next();
});

export default app;

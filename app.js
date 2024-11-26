var express = require('express');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

app.use(logger('dev'));
app.use(express.json({ type: '*/*' }));

app.use('/', indexRouter);
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

module.exports = app;

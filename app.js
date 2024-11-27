var express = require('express');
var logger = require('morgan');

const { MongoClient } = require('mongodb');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

/* set up mongodb */
const mongo = new MongoClient(process.env.MONGODB_URI);

const db = mongo.db();
const users = db.collection('users');
const roles = db.collection('roles');

(async () => {
  await mongo.connect();
  console.log("yay! mongodb is connected");

  await users.createIndexes([
    {
      key: { username: 1 },
      unique: true
    }
  ]);

  await roles.createIndexes([
    {
      key: { name: 1 },
      unique: true
    }
  ]);

  console.log("mongodb indices created.");
})().catch((e) => {
  console.dir(e);
  process.exit(2);
});

var app = express();

app.use(logger('dev'));
app.use(express.json({ type: '*/*' }));

app.use((req, res, next) => {
  req.collections = { users: users, roles: roles };
  return next();
});

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

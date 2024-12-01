import { PASSWORD_SECRET } from '../loadenv.mjs';
import { requireAcceptsJson } from "../common.mjs";
import { users } from "../mongodb.mjs";

import express from 'express';
export const usersRouter = express.Router();

import { ObjectId } from 'mongodb';
import argon2 from 'argon2';

usersRouter.use(requireAcceptsJson);

usersRouter.post("/password", async (req, res, next) => {
  if (typeof req.body.uid !== 'string' || typeof req.body.password !== 'string') {
    return next({status: 400});
  }

  let uid;
  try {
    uid = ObjectId.createFromBase64(req.body.uid);
  } catch (e) {
    return next({status: 400});
  }

  if (!req.body.password) {
    return next({status: 400, message: 'Cannot set an empty password'});
  }

  if (req.body.password.length > 2048) {
    return next({status: 400, message: 'Password is too long'});
  }

  let hash;
  try {
    hash = await argon2.hash(req.body.password, { secret: PASSWORD_SECRET });
  } catch (e) {
    console.dir(e);
    return next({status: 500, message: 'Internal error'});
  }

  const update = {
    $set: { password: hash }
  };

  if (!req.query.notime) {
    update.$set.passwordChanged = new Date();
  }

  const result = await users.updateOne({ _id: uid }, update);

  if (!result.acknowledged) {
    return next({status: 503, message: 'Write not acknowledged'});
  }

  if (result.matchedCount < 1) {
    return next({status: 404, message: 'No such user is known'});
  }

  res.status(204);
  res.end();
});

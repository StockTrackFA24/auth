import { PASSWORD_SECRET } from '../loadenv.mjs';

import express from 'express';
import argon2 from 'argon2';
const router = express.Router();

import { Long, Binary, ObjectId } from 'mongodb';
import { users, refreshTokens } from '../mongodb.mjs';
import { requireAcceptsJson } from "../common.mjs";
import JWT_KEY from "../jwt.mjs";

import { SignJWT } from "jose";
import * as crypto from 'crypto';

/* user sample
 * {
 *   "_id": ObjectId,
 *   "name": {
 *     "first": String || null,
 *     "middle": String || null,
 *     "last": String || null,
 *   }
 *   "displayName": String || null, -- Frontend note: This should contain the user's full, preferred name.
 *                                     Prefer using it over constructing their full name from the "name" object.
 *   "password": String,
 *   "passwordChanged": DateTime,
 *   "lastLogin": DateTime,
 *   "username": String, -- Frontend note: This will have the following restrictions imposed by the auth service:
 *                                         - must start with a lowercase letter
 *                                         - may contain 2 through 31 additional lowercase letters, numbers, underscores (_), or full stops (.).
 *                                         You are recommended to normalize (i.e. case-correct) usernames before passing them to the auth service.
 *   "loginDisabled": String || null, -- null indicates the user is allowed to log in, or the reason the user is forbidden to log in if present.
 *   "adminNotes": String || null,
 *
 *   "tokenRevoke": DateTime || null, -- Tokens from before this time are rejected as invalid by the backend.
 *   "roles": [ObjectId] -- Use MongoDB addToSet to add roles here.
 * }
 *
 * role sample
 * {
 *   "_id": ObjectId,
 *   "name": String, -- Frontend note: The auth service expects this to match the following regular expression: /^[a-z][a-z0-9_\-]+$/.
 *   "displayName": String || null, -- Frontend note: Fall back to "name" for frontend display purposes if this is absent.
 *   "description": String || null,
 *   "permissions": Int64,
 *
 *   "inherit": [ObjectId] -- This role inherits the permissions from this role.
 * }
 *
 */

const VALID_USERNAME_PATTERN = /^[a-z][a-z0-9_.]{2,31}$/;
const VALID_REFRESH_TOKEN_PATTERN = /^urn:refresh:stocktrack:([a-zA-Z0-9+\/]{0,200}={0,3})$/

async function authUser(user, res, next) {
  if (typeof user.loginDisabled === 'string') {
    if (user.loginDisabled) {
      // XSS WARNING FOR FRONTEND!!!!! Do not just put this string on the page! Make sure to sanitize it first!!
      return next({status: 403, message: "Your account is disabled: " + user.loginDisabled});
    } else {
      return next({status: 403, message: "Your account is disabled."});
    }
  }

  const perms = await users.aggregate([
    {
      $match: { _id: user._id }
    },
    {
      $graphLookup: {
        from: process.env.COLLECTION_ROLES,
        startWith: '$roles',
        connectFromField: 'inherit',
        connectToField: '_id',
        as: 'allRoles'
      }
    },
    {
      $project: {
        permissions: {
          $ifNull: [
            {
              $reduce: {
                input: '$allRoles',
                initialValue: {$ifNull: ['$permissions', Long.UZERO]},
                in: {
                  $bitOr: ['$$value', {$convert: { input: '$$this.permissions', to: 'long', onNull: Long.UZERO } }]
                }
              }
            },
            Long.UZERO
          ]
        },
        _id: 0
      }
    }
  ], { promoteLongs: false }).next();

  if (!perms || !(perms.permissions instanceof Long)) {
    console.dir(perms);
    return next({status: 500, message: "Internal error"});
  }

  const jwt = await new SignJWT({
    uid: user._id.toString('base64'),
    p: Buffer.from(new Uint8Array(perms.permissions.toBytesBE())).toString('base64')
  })
    .setProtectedHeader({alg: process.env.JWT_ALG})
    .setIssuedAt()
    .setIssuer('urn:stocktrack')
    .setAudience('urn:stocktrack:be')
    .setExpirationTime('1h')
    .sign(JWT_KEY);

  const refreshToken = crypto.randomBytes(128);
  await refreshTokens.insertOne({
    _id: new Binary(new Uint8Array(refreshToken), 8),
    user: user._id,
    issue: new Date()
  });

  await users.updateOne({_id: user._id}, {$set: {lastLogin: new Date()}});

  res.status(200).send({
    uid: user._id.toString('base64'),
    token: jwt,
    refresh: 'urn:refresh:stocktrack:' + refreshToken.toString('base64')
  });
}

router.use(requireAcceptsJson);

/* GET users listing. */
router.post('/login', async (req, res, next) => {
  // validation...

  if (typeof req.body.username !== 'string') {
    return next({status: 400, message: 'Missing username'});
  }

  if (!VALID_USERNAME_PATTERN.test(req.body.username)) {
    return next({status: 400, message: 'Invalid username'});
  }

  if (typeof req.body.password !== 'string' || !req.body.password) {
    return next({status: 400, message: 'Missing password'});
  }

  // ... look up user by username ...

  const GENERIC_AUTH_ERROR = {status: 403, message: 'Invalid username/password'};
  const doSleep = (ms) => (new Promise((resolve, _) => setTimeout(resolve, ms)));
  const user = await users.findOne({username: {$eq: req.body.username}});

  // ... try to make sure you can't use this endpoint as an oracle for whether a username exists by fuzzing the timings a bit ...
  await doSleep(Math.random() * 250);

  if (!user || !user.password) {
    await doSleep(100);
    return next(GENERIC_AUTH_ERROR);
  }

  // make sure the password is valid

  try {
    if (!await argon2.verify(user.password, req.body.password, { secret: PASSWORD_SECRET })) {
      return next(GENERIC_AUTH_ERROR);
    }
  } catch (e) {
    console.dir(e);
    return next({status: 500, message: "Internal error"});
  }

  return await authUser(user, res, next);
});

router.post('/refresh', async (req, res, next) => {
  // validation ...

  if (typeof req.body.refreshToken !== 'string') {
    return next({status: 400, message: 'Missing refreshToken'});
  }

  const refreshTokenMatch = VALID_REFRESH_TOKEN_PATTERN.exec(req.body.refreshToken);
  if (!refreshTokenMatch) {
    return next({status: 400, message: 'Invalid refreshToken'});
  }

  let refreshToken;
  try {
    refreshToken = Binary.createFromBase64(refreshTokenMatch[1], 8)
  } catch (e) {
    return next({status: 400, message: 'Invalid refreshToken'});
  }

  if (typeof req.body.uid !== 'string') {
    return next({status: 400, message: 'Missing uid'});
  }

  let uid;
  try {
    uid = ObjectId.createFromBase64(req.body.uid);
  } catch (e) {
    return next({status: 400, message: 'Invalid uid'});
  }

  const theRefresh = await refreshTokens.findOneAndDelete({ _id: refreshToken, user: uid, issue: { $lt: new Date(Date.now() - 120000) } });
  if (!theRefresh) {
    return next({status: 403, message: 'Invalid credential'});
  }

  const user = await users.findOne({ _id: uid });
  if (!user) {
    return next({status: 404, message: 'No such user is known'});
  }

  return await authUser(user, res, next);
});

export default router;

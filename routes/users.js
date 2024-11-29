var express = require('express');
const argon2 = require('argon2');
var router = express.Router();

const { Long } = require('mongodb');

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
 *   "inherit": [ObjectId], -- This role inherits the permissions from this role.
 *   "weight": Int32
 * }
 *
 */

const VALID_USERNAME_PATTERN = /^[a-z][a-z0-9_.]{2,31}$/
const PASSWORD_SECRET = Buffer.from(process.env.PASSWORD_SECRET);

/* GET users listing. */
router.post('/login', async (req, res, next) => {
  if (!req.accepts('json')) {
    res.status(400);
    res.end();
    return;
  }

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
  const user = await req.collections.users.findOne({username: {$eq: req.body.username}});

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

  // make sure they are actually allowed to log in
  /* (the rationale behind doing this *after* the server has spent resources on password validation is that I don't want
   *  randos to be able to check if a user is forbidden from logging in without actually getting the password correct) */

  if (typeof user.loginDisabled === 'string') {
    if (user.loginDisabled) {
      // XSS WARNING FOR FRONTEND!!!!! Do not just put this string on the page! Make sure to sanitize it first!!
      return next({status: 403, message: "Your account is disabled: " + user.loginDisabled});
    } else {
      return next({status: 403, message: "Your account is disabled."});
    }
  }

  const perms = await req.collections.users.aggregate([
    {
      $match: { _id: user._id }
    },
    {
      $graphLookup: {
        from: 'roles',
        startWith: '$roles',
        connectFromField: 'inherit',
        connectToField: '_id',
        as: 'allRoles'
      }
    },
    {
      $project: {
        permissions: {
          $convert: {
            input: {
              $reduce: {
                input: '$allRoles',
                initialValue: {$ifNull: ['$permissions', Long.UZERO]},
                in: {
                  $bitOr: ['$$value', {$ifNull: ['$$this.permissions', Long.UZERO]}]
                }
              }
            },
            to: 'long',
            onNull: Long.UZERO
          }
        },
        _id: 0
      }
    }
  ], { promoteLongs: false }).next();

  if (!perms || !(perms.permissions instanceof Long)) {
    console.dir(perms);
    return next({status: 500, message: "Internal error resolving permissions. Please contact an administrator."});
  }

  console.log(perms);

  return next({status: 501, message: "not implemented"});
});

module.exports = router;

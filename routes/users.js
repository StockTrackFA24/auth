var express = require('express');
var router = express.Router();

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
 *   "username": String, -- Frontend note: This will have the following restrictions imposed by the auth service:
 *                                         - must start with a lowercase letter
 *                                         - may contain 2 through 31 additional lowercase letters, numbers, underscores (_), or full stops (.).
 *   "loginDisabled": String || null, -- null indicates the user is allowed to log in, or the reason the user is forbidden to log in if present.
 *   "adminNotes": String || null,
 *
 *   "roleIds": [ObjectId] -- Use MongoDB addToSet to add roles here.
 * }
 *
 * role sample
 * {
 *   "_id": ObjectId,
 *   "name": String, -- Frontend note: The auth service expects this to match the following regular expression: /^[a-z][a-z0-9_\-]+$/.
 *   "displayName": String || null, -- Frontend note: Fall back to "name" for frontend display purposes if this is absent.
 *   "description": String || null,
 *   "addPermissions": Int64,
 *   "subPermissions": Int64, -- Denied permissions take precedence over allowed permissions.
 *
 *   "inherit": [ObjectId] -- This role inherits the permissions from this role.
 * }
 *
 */

const VALID_USERNAME_PATTERN = /^[a-z][a-z0-9_.]{2,31}$/

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


});

module.exports = router;

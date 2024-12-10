import './loadenv.mjs';
import { MongoClient, Long } from "mongodb";
import 'argon2';
import argon2 from "argon2";
import {PASSWORD_SECRET} from "./loadenv.mjs";

const client = new MongoClient(process.env.MONGODB_URI);

export const db = client.db();
export const users = db.collection(process.env.COLLECTION_USERS || 'users');
export const roles = db.collection(process.env.COLLECTION_ROLES || 'roles');
export const refreshTokens = db.collection(process.env.COLLECTION_REFRESH_TOKENS || 'refreshTokens');

try {
  await client.connect();
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

  await refreshTokens.createIndexes([
    {
      key: { issue: 1 },
      expireAfterSeconds: 86400 // 1 day
    }
  ]);

  console.log("mongodb indices created.");

  // check if any users exist
  const user = await users.find().limit(1).next();
  if (!user) {
    console.log("Creating first user (and associated role)");

    const role = await roles.findOneAndUpdate({name: 'admin'}, {
      $set: {
        name: 'admin',
        permissions: Long.MAX_UNSIGNED_VALUE,
      },
      $setOnInsert: {
        displayName: 'Administrator',
        description: 'Built-in administrator role'
      }
    }, { upsert: true, returnDocument: 'after' });

    const pwHash = await argon2.hash(process.env.ADMIN_PASSWORD || 'hunter2', { secret: PASSWORD_SECRET });
    await users.replaceOne({ username: 'admin' }, {
      name: {
        first: 'John',
        middle: 'T',
        last: 'Administrator'
      },
      //displayName: 'Administrator',
      username: 'admin',
      roles: [ role._id ],
      adminNotes: 'Built-in administrator account.',

      tokenInvalidTime: new Date(),

      password: pwHash,
      passwordChanged: new Date()
    }, { upsert: true });

    console.log("Created default admin user and role.");
  }
} catch (e) {
  console.dir(e);
  process.exit(2);
}

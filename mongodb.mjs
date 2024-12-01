import './loadenv.mjs';
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);

export const db = client.db();
export const users = db.collection('users');
export const roles = db.collection('roles');
export const refreshTokens = db.collection('refreshTokens');

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
} catch (e) {
  console.dir(e);
  process.exit(2);
}

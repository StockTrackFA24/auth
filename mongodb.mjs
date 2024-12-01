import './loadenv.mjs';
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);

const db = client.db();
const users = db.collection('users');
const roles = db.collection('roles');

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

  console.log("mongodb indices created.");
} catch (e) {
  console.dir(e);
  process.exit(2);
}

export default { db: db, users: users, roles: roles };

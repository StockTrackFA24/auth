import dotenv from 'dotenv';
dotenv.config();

export const PASSWORD_SECRET = Buffer.from(process.env.PASSWORD_SECRET);

import express from 'express';
import logger from 'morgan';

import { usersRouter } from "./internalroutes/users.mjs";
import { jsonError } from "./common.mjs";

const app = express();

app.use(logger('dev'));
app.use(express.json({ type: '*/*' }));

app.use('/users', usersRouter);

app.use(jsonError);

export default app;

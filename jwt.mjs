import './loadenv.mjs';
import * as jose from 'jose';

const JWT_KEY = await jose.importPKCS8(process.env.JWT_KEY, process.env.JWT_ALG);

export default JWT_KEY;

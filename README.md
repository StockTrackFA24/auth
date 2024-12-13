# Authentication Service
The Authentication Service (affectionately referred to as `auth`) is responsible for issuing signed <abbr title="JSON Web Token">JWT</abbr>s to users, which they may present to the backend to prove their identity and permissions.

The Authentication Service presents two HTTP APIs. The external API exposes endpoints for logging in with a username and password, or refreshing an existing JWT using a refresh token. The internal API exposes an endpoint for setting the password of a user, since only `auth` holds the "pepper" (a secret value that is added to the hash derivation function for passwords).

`auth` uses argon2id for generating hashes for passwords.

## Setup
First, the user must install the dependencies for the software (use the package manager of your choice):
```shell
$ npm i
# or
$ pnpm i
```

Then, the user must fill in their `.env` with appropriate values (or specify environment variables manually).
Expected variables are present in `.env.example`.

You must generate a keypair, and share that public key with `backend`. Details about algorithms and key sizes can be found on this Jose issue page: https://github.com/panva/jose/issues/210. A sample `openssl` command is provided in `.env.example` for your convenience.

The port numbers for the internal and external API servers are configurable through the environment as well. Please ensure that they do not conflict with `backend` and `frontend`, if applicable, since the ports they use are hardcoded to `4000` and `3000`, respectfully.

Finally, you must run the program. With your working directory in the root of the project, execute:
```shell
$ node bin/www
```

Make sure that `backend` and `frontend` are aware of the URLs for the internal and external APIs, respectively.

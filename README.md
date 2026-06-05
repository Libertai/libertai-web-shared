# libertai-web-shared

Shared frontend code for LibertAI web apps (`libertai-console`, `libertai-chat`).
Consumed **as source via a git submodule + Vite alias** — not built or published, so
edits are picked up live by the consuming app's bundler (HMR works).

## Contents

- `inference-sdk/` — the generated inference API SDK (`@hey-api`). Regenerate with
  `npm run gen:sdk` against a running backend.
- `auth/` — `useAccountStore` (zustand), `LoginPanel`, the shadcn primitives it needs,
  and `initLibertaiAuth()`.

Auth is **cookie-based**: the backend sets an httpOnly session cookie on `*.libertai.io`,
so signing in on one app signs you in on the others. Login state is derived from
`GET /auth/me` (no tokens in `localStorage`).

## Using it in an app

1. Add the submodule (path is up to the app; example uses `src/shared`):

   ```sh
   git submodule add git@github.com:Libertai/libertai-web-shared.git src/shared
   ```

2. Alias the `@libertai/*` scope in `vite.config.ts` and `tsconfig.json`:

   ```ts
   // vite.config.ts
   resolve: { alias: {
     "@libertai/auth": path.resolve(__dirname, "src/shared/auth"),
     "@libertai/inference-sdk": path.resolve(__dirname, "src/shared/inference-sdk"),
   }}
   ```
   ```jsonc
   // tsconfig.json
   "paths": {
     "@libertai/auth": ["src/shared/auth"],
     "@libertai/inference-sdk": ["src/shared/inference-sdk"]
   }
   ```

3. Let Tailwind scan the shared source so classes aren't purged:
   add `src/shared/**/*.{ts,tsx}` to `content`.

4. Initialize once at startup, passing the app's env:

   ```ts
   import { initLibertaiAuth } from "@libertai/auth";
   initLibertaiAuth({
     apiBaseUrl: env.LTAI_INFERENCE_API_URL, // or "/api" behind the dev proxy
     thirdwebClientId: env.THIRDWEB_CLIENT_ID,
     solanaRpc: env.SOLANA_RPC,
     ltaiBaseAddress: env.LTAI_BASE_ADDRESS,
     ltaiSolanaAddress: env.LTAI_SOLANA_ADDRESS,
   });
   ```

5. CI must check out submodules: `actions/checkout@v4` with `submodules: recursive`.

## Updating

Edit here, commit + push, then in each app bump the pointer:
`git submodule update --remote src/shared && git add src/shared && git commit`.

# BlinkLane production deployment

## Supabase

1. Create a Supabase project.
2. Open **SQL Editor** and run [`supabase/schema.sql`](./supabase/schema.sql).
3. Copy the project URL and service-role key into Render as `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY`. The service-role key must only exist on the
   backend.

## Render

1. Create a new Web Service from this folder, or use [`render.yaml`](./render.yaml).
2. Set `MERCHANT_WALLET_ADDRESS` to the configured merchant public key.
3. Confirm the generated service URL is `https://blinklane-api.onrender.com`, or
   update `config.js`, `manifest.json`, and `ALLOWED_ORIGINS` to the URL Render
   assigns.
4. Deploy with `npm ci` and `npm start`.
5. Confirm `https://<service>/health` returns `{"status":"ok","database":"supabase"}`.

Load the project folder as an unpacked extension in Chrome after the backend is
live. The extension has no database credentials; it only calls the public API.

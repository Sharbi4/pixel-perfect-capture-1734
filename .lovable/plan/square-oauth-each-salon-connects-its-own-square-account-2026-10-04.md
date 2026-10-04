# Square OAuth: each salon connects its own Square account

## What the owner sees
- On the Salon Agent page, a new "Square" card next to Google Calendar: **Connect Square**, status (Connected as <business name>, location picker), **Import from Square**, **Disconnect**.
- After connecting, owners/managers can:
  - Import the Square services menu. It goes through the existing review screen (new / price changes / removals) and nothing changes until they approve.
  - Import team members as staff.
  - Switch booking to Square, so the agent checks Square availability and books, reschedules and cancels real Square appointments.
- Staff can see the status but can't connect or disconnect.

## What you paste into Square (Developer dashboard > OAuth > Production)
- **Redirect URL:** `https://salonagentai.com/api/public/square-oauth/callback`
- The saved Application ID and secret are used. Nothing else is needed.

## Technical details
- New table `salon_square_connections`: service-role only, no browser grants. It stores the merchant ID, the chosen location ID, the access and refresh tokens (encrypted with the existing connection-key crypto), expiry and scopes.
- Scopes: `MERCHANT_PROFILE_READ ITEMS_READ APPOINTMENTS_READ APPOINTMENTS_WRITE APPOINTMENTS_BUSINESS_SETTINGS_READ APPOINTMENTS_ALL_READ APPOINTMENTS_ALL_WRITE EMPLOYEES_READ CUSTOMERS_READ CUSTOMERS_WRITE`.
- `src/lib/square-oauth.functions.ts`: `startSquareConnect` checks that the user is an owner or manager, creates a signed, expiring `state` (salon + user + nonce) and returns the authorize URL. It also has `getSquareStatus`, `disconnectSquare` (revokes the token), `setSquareLocation`, `importSquareCatalog` (returns a menu-diff proposal) and `importSquareTeam`.
- `src/routes/api/public/square-oauth/callback.ts`: verifies the signed state, exchanges the code with `PUBLIC_APP_ORIGIN`, stores the encrypted tokens, then redirects to `/dashboard/agent?square=connected`.
- `src/lib/square-client.server.ts`: refreshes tokens automatically before they expire and handles Square API errors.
- `src/lib/square-adapter.server.ts`: a booking adapter for search-availability, create, update and cancel booking. It is mirrored into `appointments` with `provider_event_id`. `adapterFor` dispatches to it when `booking_provider = 'square'`. Requires catalog variation IDs to be mapped on services (`services.square_variation_id`, set on import).
- `AGENTS.md` gets a rule for Square credential isolation.

## Not included
- Recurring billing through Square (separate).
- A live end-to-end test needs your Square account to approve the connection.

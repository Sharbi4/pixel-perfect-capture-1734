<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Product & pricing structure
- Brand is Salon Pro Agent (LLC). Pricing tiers (Essential, Pro, Premier) live in src/lib/pricing.ts. Public CTAs: /get-started → /checkout → /complete-account → authenticated /setup. Never allocate a paid provider resource from the anonymous preview. Use supplied brand assets, not typed recreations.
- Salon setup data lives in `salons` (one per owner) and `services` with owner-scoped RLS; the wizard writes via the browser client. Why: simple per-owner CRUD, no admin path.
- AI menu import and launch run in src/lib/setup.functions.ts (auth-required); voice previews stream from /api/voice-preview with a bearer check. Why: keep the AI key server-side, block anonymous credit spend.
- Owners write only whitelisted salon columns (EDITABLE_SALON_FIELDS column grants); provider IDs, status and owner_id are written by server code via admin client after an RLS ownership read. Why: owners must not forge provider or live state.
- Setup progress is read from `phone_setups` (sanitized codes → copy in src/lib/phone-status.ts); voice/forwarding/texting states change only on real verification or submission. Why: never claim unverified progress.
- Provider callback URLs use the PUBLIC_APP_ORIGIN secret, never the request host; incoming calls require the URL secret and a To number matching the salon. Why: untrusted host headers, cross-salon routing.
- No DELETE/TRUNCATE on salons for customers; phone_jobs blocks salon deletion (ON DELETE RESTRICT); customer reads use explicit column lists (`has_receptionist` is the safe flag); server code reads private fields via ownedSalonPrivate in src/lib/jobs.server.ts. Why: delete/recreate must not bypass paid-resource idempotency; provider IDs never reach customers.
- Location access goes through `salon_members` (owner/manager/staff; owner row auto-added by trigger) and the `is_salon_member` RLS check; the dashboard keeps the active location client-side. Why: one model for multi-location and staff access.
- Call/text history is copied from providers into `calls`/`messages` (member-readable, server-write) by `syncActivity` on page open/refresh. Why: real activity without exposing provider IDs or unsigned webhooks.
- The MCP server lives in src/lib/mcp (read-only tools, OAuth via the backend auth server, queries run as the signed-in user through RLS); /auth honors a same-origin `next` for consent. Why: AI assistants see only what the user can see.
- Call follow-up state (resolved_at, follow_up_at) is member-writable via column grants; notes live in call_notes; recordings stream through /api/call-recording after an RLS read. Why: staff triage without touching provider data.
- Incoming texts arrive at /api/public/incoming-sms (URL secret + To must match the salon); the agent replies via src/lib/texting.server.ts only while sms_threads.ai_enabled is on; a staff send (sendText) switches the thread to human takeover. Why: one clear owner per conversation.
- One salon location = one dedicated voice agent; agent tools and text replies book only through `adapterFor` in src/lib/booking-adapters.server.ts, with the salon resolved from the verified per-salon tool key, never agent input. Why: tenant isolation, no invented availability.
- External calendar booking (Google via src/lib/gcal-adapter.server.ts, Square via src/lib/square-adapter.server.ts) runs through `adapterFor` when `salons.booking_provider` is 'google'/'square'; each salon's encrypted credential lives in `salon_calendar_connections` (service-role only, no client grants), read/written only by server functions after a salon_members owner/manager check. Google OAuth uses the App User Connector flow via /oauth/google_calendar/return; Square OAuth is a direct redirect via /api/public/square-oauth/callback with an HMAC-signed state re-verified against salon_members, tokens refreshed server-side. Why: credentials never reach the browser and stay isolated per salon.
- Setup changes bump `salons.config_version` via triggers and mark `agent_sync_status`; `syncSalonAgent` updates the existing agent, never creates one. Why: agents stay current without duplicate paid agents.
- Agent settings, knowledge and services are written only by owner/manager server functions (agent-settings/catalog .functions.ts) that re-sync the agent; menu uploads only propose a diff (src/lib/menu-diff.ts) applied after approval, removals archive. Why: no raw prompt edits, no silent menu overwrites.

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
- The brand and single plan are Salon Pro Agent (formerly NailDesk Pro). Plan details live in `src/lib/pricing.ts`; the marketing sections render from it. Do not reintroduce a base/add-on split or a second pricing card. Use the supplied assets in `public/brand` through `src/components/brand/Brand.tsx`: dark wordmark on dark backgrounds, light wordmark on light backgrounds, white or black for monochrome, standalone mark for agent identity. Do not recreate the logo with CSS or typed text.

- Salon setup data lives in `salons` (one per owner) and `services` tables with owner-scoped RLS; the wizard writes via the browser client. Why: simple per-owner CRUD with no admin path.
- AI menu import and launch run in `src/lib/setup.functions.ts` (auth-required); voice previews stream from `/api/voice-preview` with a bearer check. Why: keep the AI key server-side and block anonymous credit spend.
- Phone agent/number provisioning is a stub inside `launchSalon` until a voice-phone provider is connected. Why: no provider account yet.
- Provider create/purchase calls (voice agent, phone number) run only through `phone_jobs` (begin_phone_job / set_phone_job_target / transition_phone_job, service role only) with logic in src/lib/provisioning.ts. Why: atomic one-active-job lock, durable idempotency, and unclear outcomes become `uncertain` and are only reconciled read-only, never auto-retried.
- Owners write only whitelisted salon profile columns (column-level grants; see EDITABLE_SALON_FIELDS); provider IDs, status and owner_id are written by server code via the admin client after an RLS ownership read. Why: owners must not forge provider or live state.
- Owners read setup progress from `phone_setups` (sanitized codes, mapped to copy in src/lib/phone-status.ts); voice/forwarding/texting states change only on real verification or submission. Why: never claim unverified progress.
- Provider callback URLs use the PUBLIC_APP_ORIGIN secret, never the request host; incoming calls require the URL secret and a To number matching the salon. Why: untrusted host headers and cross-salon routing.
- Customers have no DELETE/TRUNCATE on salons, and phone_jobs blocks salon deletion (ON DELETE RESTRICT); customer reads use explicit column lists (provider IDs are not granted; `has_receptionist` is the safe flag), and server code reads private fields via ownedSalonPrivate in src/lib/jobs.server.ts. Why: delete/recreate must not bypass paid-resource idempotency, and provider IDs must never reach customers.
- begin_phone_job locks the salon row and refuses a new job once a job succeeded or the salon holds a provider id; reconcile never treats absence from a provider list as proof, and results are reported done only when the transition returns true. Why: eventual consistency and lost locks must not cause a second paid create.
- Location access goes through `salon_members` (owner/manager/staff; owner row auto-added by trigger) and the `is_salon_member` RLS check; the dashboard lists locations from it and keeps the active one client-side. Why: one model for multi-location and per-location staff access.

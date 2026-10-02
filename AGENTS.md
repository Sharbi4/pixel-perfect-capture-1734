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
- The site sells exactly one plan, NailDesk Pro, whose details live in the `plan` object in `src/lib/pricing.ts`; the marketing sections render from it. Do not reintroduce a base/add-on split or a second pricing card — NailDesk Pro is the product, not an upgrade.

- Salon setup data lives in `salons` (one per owner) and `services` tables with owner-scoped RLS; the wizard writes via the browser client. Why: simple per-owner CRUD with no admin path.
- AI menu import and launch run in `src/lib/setup.functions.ts` (auth-required); voice previews stream from `/api/voice-preview` with a bearer check. Why: keep the AI key server-side and block anonymous credit spend.
- Phone agent/number provisioning is a stub inside `launchSalon` until a voice-phone provider is connected. Why: no provider account yet.
- Each salon gets its own voice agent, created/updated server-side by launchSalon (src/lib/agent.server.ts); its id is stored on salons.agent_id. Why: provisioning must be automatic and the voice key must stay server-side.

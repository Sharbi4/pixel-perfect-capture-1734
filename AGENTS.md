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


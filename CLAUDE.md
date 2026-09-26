# CLAUDE.md

Personal portfolio site for Mustafa Hasnain. Astro, static output, deployed to Cloudflare Pages
(free tier only — no feature may require a paid plan).

Plan, phase order, and open decisions: `docs/ROADMAP.md`. Read it before starting anything
larger than a small fix.

## Commands

```
npm run dev       # dev server
npm run build     # static build to dist/
npm run preview   # serve the built output
```

## Stack

- Astro, `output: 'static'`. No SSR, no adapter. Cloudflare Pages serves `dist/` as plain files.
- Plain CSS is the styling system: tokens in `src/styles/global.css`, scoped `<style>` per component.
- Tailwind v4 is present with Preflight disabled, and exists only to support the Cult UI button in
  `src/components/ui/`. It is not the styling system for page code.
- React is a build-time dependency for that one button. Nothing hydrates. See ROADMAP phase 0 —
  removing this is planned.

## House rules

- Spacing and colour come from the tokens in `src/styles/global.css` (`--space-*`, `--color-*`,
  `--accent-rgb`). No one-off rem or hex values in page styles.
- Component styles live in that component's scoped `<style>`. `global.css` is only for primitives
  two or more pages share.
- Never add a `client:*` directive unless the component genuinely has to run in the browser.
  Astro ships zero JS by default; that is the reason it was chosen.
- Don't add a dependency without stating what it costs and what it replaces.
- Comments explain why a decision was made, not what the code does. The comments in
  `src/components/Nav.astro` are the standard to match.
- Issuer badges (CompTIA and similar) are shown unaltered — no recolouring, cropping, or
  distortion — and only for a certification actually earned.
- Never list a certification, skill, project, or metric that isn't real.

## Prose

Mustafa writes the prose that represents his own work: README, project write-ups, page copy.
Claude writes code and config. When a task needs user-facing prose, draft it in chat for him to
rewrite rather than committing it.

## Git

- Announce before committing. Never commit silently.
- Commit messages: imperative, sentence case, no prefix, no emoji. Match the existing log
  ("Add Network+ badge, reorder certifications, and tighten nav").
- No AI or Claude co-authorship lines in commits or PR descriptions.
- `dist/` and `.astro/` are generated. Never commit them.

## Done means

Before calling a change finished:

1. `npm run build` passes.
2. Once phase 0 lands: `npm run check` passes too.
3. Looked at in both themes.
4. Looked at at 375px, 768px, and 1280px.
5. Reachable by keyboard, focus is visible, and no new focusable element that does nothing.

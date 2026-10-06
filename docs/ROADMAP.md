# Roadmap

Working plan for the site. This file is the source of truth for what gets built, in what order,
and why. Update it when a decision changes — a stale plan is worse than none.

Last reviewed: 2026-09-29

---

## The goal, stated honestly

Two audiences, and they want different things.

**Recruiters and hiring managers** arrive because they were sent the link. They are not searching
for it. There will be few of them, they will skim for under a minute, and the only thing that
matters is whether the site makes the case quickly and looks like it was built by someone
competent. Optimising for this audience is about conversion, not traffic.

**IT learners** — people studying for Network+ or CCNA — are the only audience that would ever
*seek the site out*. They will never search for a person's name. They search for problems and for
tools. The only way to reach them is to host something useful to a stranger who does not know or
care who built it.

A portfolio alone has a traffic ceiling of roughly "people I send the link to." That is a
legitimate goal, but it is not the goal that was stated. The trainer and the small tools are what
lift that ceiling, and they double as the strongest available proof of skill for the first
audience. Both audiences end up served by the same work, in sequence.

**Order:** fix the recruiter-facing fundamentals first — they are cheap and currently broken —
then spend the remaining time on the trainer and the tools.

---

## Decisions

Recorded so they don't get relitigated, and dated so it's clear when they were made.

- **2026-09-26 — Sequenced, not either/or.** Phases 0 and 1 make the site correct and
  recruiter-ready. Everything after that is traffic work.
- **2026-09-26 — The simulator is a guided lesson trainer, not a device emulator.** Scripted labs,
  a fake CLI prompt, validated commands, progress and hints. Not a stateful IOS implementation
  with routing tables and multi-device topologies. Rationale: the emulator version is months of
  work with a high chance of being abandoned at 60% done, and it isn't actually what learners
  want — they want guided practice with feedback. This version ships in stages, each of which is
  useful on its own.
- **2026-09-26 — Minimal writing.** No blog, no posting cadence. Traffic comes from the trainer
  and the tools.
  *Cost of this decision, recorded deliberately:* the AD lab and Pi monitor walkthroughs already
  exist as YouTube videos, and video does not rank in search the way text does. Converting those
  two into written pages is the cheapest search surface available, and it is being skipped. If
  traffic has not moved after the tools ship, this is the first decision to reopen. See phase 5.
- **2026-09-08 — Astro over 11ty**, separate routes rather than single-page scroll, one gold
  accent, light/dark toggle.
- **Resolved 2026-09-29** — the stack had drifted to include Tailwind and React for one Cult UI
  button. Both are removed; see phase 0, item 1.
- **2026-09-29 — Production domain is `mustafahasnain.com`.** Registered at Hostinger, set in
  `astro.config.mjs`. Cloudflare Pages isn't connected yet — see phase 0, item 8, and
  `docs/DEPLOY.md`.
- **2026-09-29 — No job title or "applying for" framing appears anywhere on the site right now.**
  Home projects only. This drops phase 1, item 2 (the hero "what I'm applying for" line) and
  narrows phase 0, item 11's JSON-LD to name, education, and `sameAs` — no `jobTitle` field.
  Revisit when there's a specific role to name.
- **2026-09-29 — No dedicated contact page.** The existing nav icons (GitHub, LinkedIn, YouTube,
  email) are the contact point. This satisfies phase 1, item 4 as originally scoped; no new work
  needed there. Keeps the earlier 2026-09-08 decision to drop the standalone Contact page intact.
- **2026-09-29 — Resume is a small download button in the nav, not a page section.** Wired to
  `public/Mustafa-Hasnain-Resume.pdf`; the file itself is added separately whenever it's ready.
- **2026-09-26 — Projects page is the current priority**, and its detail pattern is an
  expand-in-place card, not a dedicated page per project. Superseded phase 1 item 3, which had
  called for separate project routes.
  *Cost of this decision, recorded deliberately:* a dedicated page per project would have been an
  indexable, shareable URL — some search surface. Dropping it gives that up. Judged cheap: project
  detail was never the traffic plan (the trainer and small tools are, per the goal statement
  above) — it was always about the recruiter reading it, and a recruiter is better served by not
  leaving the page they're already skimming.
- **2026-09-26 — Skill filter matches ANY selected tag, not ALL.** Selecting "Active Directory" and
  "Docker" shows projects with either. Chosen over strict AND-matching because the project count is
  small; AND-matching risks a recruiter selecting two real skills and seeing zero results, which
  reads as broken rather than as a legitimate empty state.

---

## Constraints

- Hosting is Cloudflare Pages, free tier. Nothing may require a paid plan.
- Domain is registered at Hostinger, DNS pointed at Cloudflare.
- Static output only. No server runtime, no database, no paid third-party service.
- The repo has to read as Mustafa's own work, not a generated scaffold. Prose in his voice is his
  to write.

---

## Current state — 2026-09-29

Four static pages (home, projects, qualifications, 404), ~110KB built, zero JS bundle. Phases 0,
1, and 2 are complete: no React/Tailwind, real SEO metadata and a share image, a sitemap and
robots.txt, self-hosted fonts, JSON-LD, CI on push/PR, Lighthouse 100 across all four categories on
every page, and projects/certifications/skills all live in Astro content collections. Project
cards expand in place with a skill filter.

Still missing: Cloudflare Pages isn't connected (settings are written down in `docs/DEPLOY.md`),
the resume PDF file itself, project photos, and the two projects' expanded "what broke" story
prose (placeholders are in the content files, marked for Mustafa to write). Everything past this
point is phase 3, the CLI trainer.

---

## Phase 0 — Foundations

None of this is visible on the page. All of it is load-bearing for everything after it.
Estimated: one focused session.

1. **Done — 2026-09-29.** Ported `TextureButton` to `src/components/Button.astro` (plain CSS) and
   `react-icons` to `src/components/Icon.astro` (inline SVG). Removed `@astrojs/react`,
   `@tailwindcss/vite`, `tailwindcss`, `react`, `react-dom`, `react-icons`,
   `class-variance-authority`, `clsx`, `tailwind-merge`, and their `@types` packages — nine
   dependencies gone. `npm run build` emits no JS bundle; build output dropped from 365KB to
   109KB.

2. **Done — 2026-09-29.** `site` is `https://mustafahasnain.com` in `astro.config.mjs`.

3. **Done — 2026-09-29.** `@astrojs/sitemap` added; `public/robots.txt` points at
   `/sitemap-index.xml`.

4. **Done — 2026-09-29.** `Layout.astro` takes a required `description` and optional `image` prop,
   plus a canonical `<link>`. Every page passes a real description.

5. **Done — 2026-09-29.** Open Graph and Twitter card tags added. Share image at
   `public/og-image.png`, composited from the existing headshot and the site's own hero copy —
   built as a one-off `sharp` script, not a committed dependency or pipeline. Not yet verified in
   LinkedIn's Post Inspector (needs the live domain).

6. **Done — 2026-09-29.** `@astrojs/check` and `typescript` installed; `npm run check` passes
   with 0 errors.

7. **Done — 2026-09-29.** `.github/workflows/ci.yml` runs `npm ci`, `npm run check`, and
   `npm run build` on push to `main` and on pull requests. Not yet verified against a deliberately
   broken commit.

8. **Done — 2026-09-29.** Not connected yet — build settings, environment variables, and the
   domain steps are written down in `docs/DEPLOY.md` for when it is.

9. **Done — 2026-09-29.** `viewport` is now `width=device-width, initial-scale=1`.

10. **Done — 2026-09-29.** `src/pages/404.astro` matches the site's style, with a button back home.

11. **Done — 2026-09-29.** JSON-LD `Person` schema on the home page: name, `alumniOf` (UT Dallas),
    and `sameAs` links to GitHub, LinkedIn, and YouTube. No `jobTitle` — see the no-job-title
    decision above.

12. **Done — 2026-09-29.** "Coming Soon" is now a plain `<span>` (no longer a focusable no-op
    button). The theme toggle has `aria-pressed` and swaps an inline moon/sun SVG instead of an
    emoji glyph.

13. **Done — 2026-09-29.** Fonts self-hosted from `public/fonts/`: Inter and JetBrains Mono are
    each a single variable-weight woff2 (Google serves one file per family regardless of which
    static weights are requested), so no Google Fonts request remains.

---

## Phase 1 — Recruiter-ready

Everything a hiring manager needs inside their first 45 seconds.
Estimated: one to two sessions.

1. **Done — 2026-09-29.** Small "Resume" download button in the nav, next to the social icons (see
   the resume decision above — not a page section). Wired to
   `public/Mustafa-Hasnain-Resume.pdf`; the file itself is still pending.

2. **Dropped — 2026-09-29.** No job title or "applying for" line anywhere on the site right now.
   See the decision above.

3. **Done — 2026-09-29.** Each project card is a native `<details>`/`<summary>` element — the whole
   card is the clickable unit, keyboard-accessible for free, no client-side script needed for the
   expand itself. A skill filter sits above the list: chips built from the union of every project's
   tags, ANY-match (see decision above), the one small hand-written script on this page. Both
   projects have an `images: []` slot and a Markdown body ready for the deeper "what broke" story —
   both are empty placeholders right now (see Open questions: photos, and the story prose is
   Mustafa's to write per `CLAUDE.md`).

4. **Dropped — 2026-09-29, satisfied by existing icons.** See the no-contact-page decision above.

5. **Done — 2026-09-29.** All four pages score 100 on performance, accessibility, best practices,
   and SEO (measured against the production build with Lighthouse CLI). One fix needed: the
   "Walkthrough" links' touch target was a few px short of the accessible minimum.

---

## Phase 2 — Content architecture

**Done — 2026-09-29.** Projects, certifications, and skills all moved to Astro content collections
(`src/content.config.ts`):

- **Projects** — `src/content/projects/*.md`, glob-loaded. Frontmatter carries the existing fields
  plus `images` (empty for now); the Markdown body is the expanded-card story, currently a comment
  placeholder for Mustafa to write.
- **Certifications** and **skills** — `file()`-loaded JSON, object-keyed with an explicit `order`
  field (the loader sorts by key alphabetically otherwise, which silently reordered the
  certifications list — caught by checking the rendered page, not by the type check).

A new project is now one Markdown file; certifications/skills are one JSON entry each. Education
and coursework on the qualifications page stayed as plain arrays — not in scope, and there's
nowhere else they'd be reused.

---

## Phase 3 — The CLI trainer

The centrepiece, and the only thing on this list that strangers will come looking for.
Estimated: several sessions, staged.

The constraint that matters: **content is harder than code here.** The terminal component is a few
days of work. Twenty well-designed lessons with good validation and good hints is the real work,
and it is what determines whether anyone comes back. Build the smallest shippable version first
and expand only if it gets used.

**Stage 1 — terminal component.** A fake prompt that takes typed input, keeps history, supports
up-arrow recall and tab completion, and prints canned output. No lesson logic yet. Has to be
keyboard-accessible and usable on a phone.

**Stage 2 — one complete lesson, end to end.** Pick the single most-searched topic: initial switch
configuration, or VLAN creation. Define a lesson as data — steps, accepted commands (matchers
tolerant of valid abbreviations), expected output, hint text, success condition. Prove the format
works on one lesson before writing twenty.

**Stage 3 — lesson set and progress.** Six to ten lessons covering the Network+ CLI surface.
Progress in `localStorage`; no accounts, no backend. Each lesson gets its own URL, so individual
lessons are searchable and linkable — this is what makes the trainer a traffic source rather than
a toy.

**Stage 4 — polish.** Reset, "show me the answer," a per-lesson command reference, and a landing
page that explains what this is to somebody arriving cold from a search result.

Notes:

- This is the one place a `client:` directive is warranted. Keep it to a single island so the rest
  of the site stays zero-JS.
- Be honest in the copy about what it is. Calling it an emulator when it is a guided trainer costs
  more credibility than it gains.
- Command matching must accept valid abbreviations. A trainer that rejects `int gi0/1` teaches the
  wrong thing and gets abandoned in the first minute.

---

## Phase 4 — Small tools

Cheap, individually searchable, and each one is a separate entry point into the site. Build these
after the trainer has a stage live, not before.

- Subnet calculator — CIDR in; network, broadcast, usable range and mask out.
- VLSM practice generator — random problems with checkable answers.
- Ports and protocols quiz — the Network+ memorisation set.

Each gets its own route, description, and share image. Together they turn the site from one
destination into several.

---

## Phase 5 — Measure, then decide

Nothing above is worth continuing blind.

1. **Add privacy-respecting analytics.** Cloudflare Web Analytics is free, needs no cookie banner,
   and is already part of the hosting.
2. **Verify in Google Search Console** and submit the sitemap. Watch which queries actually
   surface the site.
3. **Review 60 days after the trainer is live.** Two questions: are strangers arriving, and do
   they finish a lesson?

If traffic has not moved, the decision to skip writing is the first thing to reopen — converting
the two existing lab videos into written walkthroughs remains the cheapest available experiment.

---

## Non-goals

Recorded so they don't get picked up by accident.

- No blog or posting cadence. Decided 2026-09-26.
- No CMS. Content collections and Markdown are enough.
- No accounts, no login, no backend. Progress lives in `localStorage`.
- No paid services of any kind.
- No animation or visual effect that doesn't survive `prefers-reduced-motion`.
- No third-party contact form. An email link is enough.

---

## Open questions

- The resume PDF itself — the button is wired to `public/Mustafa-Hasnain-Resume.pdf`, file pending.
- SMS InfoComm (current GPU repair job) stays off the site text by default — revisit if that
  changes.
- Which CLI topic is lesson one?
- Project photos exist locally but the exact folder wasn't given — needed to fill the `images`
  field in `src/content/projects/*.md` and drop the files under `src/assets/projects/`.
- The two projects' expanded-story prose (the "what broke" section) — placeholders are in the
  content files now; this is Mustafa's to write per `CLAUDE.md`, drafted in chat first if wanted.
- Cloudflare Pages project isn't created yet — settings are in `docs/DEPLOY.md` for when it is.

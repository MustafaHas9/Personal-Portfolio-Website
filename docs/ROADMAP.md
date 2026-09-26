# Roadmap

Working plan for the site. This file is the source of truth for what gets built, in what order,
and why. Update it when a decision changes — a stale plan is worse than none.

Last reviewed: 2026-09-26

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
- **Drifted, needs resolving:** the stack was agreed as plain CSS with no Tailwind. Tailwind and
  React arrived later, with the Cult UI button. See phase 0, item 1.
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

## Current state — 2026-09-26

Three static pages (home, projects, qualifications), 365KB built, 1.1s build. The design tokens
and theming are real and well executed. The content is specific and credible, and every claim has
a GitHub repo or a video behind it.

What is missing is nearly everything that happens *outside* the page: no metadata, no
crawlability, no link previews, no error page, no automated checks, no defined deployment, no
measurement.

---

## Phase 0 — Foundations

None of this is visible on the page. All of it is load-bearing for everything after it.
Estimated: one focused session.

1. **Remove React and the Tailwind layer, or justify keeping them.**
   The build emits `dist/_astro/client.*.js` at roughly 221KB, referenced by zero pages. React is
   pulled in only to render two static buttons at build time. Either port `TextureButton` to an
   Astro component with plain CSS — restoring the agreed stack — or write down why the cost is
   worth paying. Recommendation: port it. The button's appearance can be reproduced in CSS in well
   under an hour, and it removes five dependencies and the whole Tailwind bridge layer.
   *Done when:* `npm run build` emits no JS bundle and the pages are visually unchanged.

2. **Set `site` in `astro.config.mjs`** to the production URL.
   *Done when:* canonical URLs and a sitemap become possible. Blocks items 3 and 4.

3. **Add `@astrojs/sitemap` and a `public/robots.txt`** pointing at the sitemap.

4. **Add typed SEO props to `Layout.astro`:** a required `description`, an optional `image`, and a
   canonical link. Every page passes a real description. None exists today.

5. **Add Open Graph and Twitter card tags, and a share image.**
   Highest-value single item in this phase. The link currently previews as a blank grey box on
   LinkedIn, which is the main place it will ever be pasted.
   *Done when:* the URL renders a correct card in LinkedIn's Post Inspector.

6. **Install `@astrojs/check` and add `astro check` as `npm run check`.**

7. **Add a GitHub Actions workflow** running `npm ci`, `npm run check`, and `npm run build` on
   push and pull request.
   *Done when:* a deliberately broken commit fails CI.

8. **Define the deploy.** Cloudflare Pages build settings committed or written down, so shipping
   is reproducible rather than remembered.

9. **Fix `viewport`** to `width=device-width, initial-scale=1`.

10. **Add `src/pages/404.astro`** in the site's own style, with a route back to the home page.

11. **Add JSON-LD `Person` schema** to the home page: name, job title, education, and `sameAs`
    links to GitHub, LinkedIn, and YouTube.

12. **Fix the two accessibility defects.** The "Coming Soon" nav element is a focusable
    `<button aria-disabled="true">` that does nothing — make it a `<span>`. The theme toggle needs
    `aria-pressed`, and should use an SVG rather than an emoji glyph, which renders inconsistently
    across operating systems.

13. **Self-host the fonts** to remove the render-blocking third-party request on first paint.

---

## Phase 1 — Recruiter-ready

Everything a hiring manager needs inside their first 45 seconds.
Estimated: one to two sessions.

1. **Put the resume back.** It was removed pending an update and never returned. A portfolio a
   recruiter cannot get a resume from has a hole in it. PDF in `public/`, linked from the home
   page and the qualifications page.

2. **Answer "what is he applying for" above the fold.** The opening line is good and specific, but
   the role being sought only appears in the third paragraph — below the fold on a phone. State it
   in the hero.

3. **Expand each project card in place, with photos and a skill filter.** One paragraph per
   project is not enough for someone deciding whether to interview, but a separate page per
   project isn't the fix here — see the decision above. Instead:

   - The whole card is one clickable unit (not just a "read more" link inside it) that expands to
     show a few photos and the deeper story: the problem, the architecture, what broke and how it
     was diagnosed, what it would take to run in production. The "what broke" part is what
     separates someone who built a lab from someone who followed a tutorial — it's the single most
     valuable content on the site for the recruiter audience, expanded pattern or not.
   - Build the expand with a native `<details>`/`<summary>` element, styled to look like the
     existing card, not hand-rolled JS. It gets keyboard support, `aria-expanded` semantics, and a
     working closed/open state for free, and needs zero client-side script.
   - A skill filter sits above the card list: clickable chips built from the union of every
     project's tags. Selecting one or more filters the visible cards to ANY match (see decision
     above). This is genuine client-side interactivity — page content changing after load with no
     navigation — so it's the one exception to zero-JS on this page. Keep it a small hand-written
     script (show/hide via a `hidden` attribute or a class), not a framework island; a filter this
     simple doesn't justify reintroducing React after phase 0 removes it.
   - Photos exist already and are ready to bring in. Store them under `src/assets/projects/` and
     render through Astro's `<Image>` component, matching how the headshot and cert badge are
     already handled — optimized output, not raw files served as-is.

   Depends on phase 2 for the data shape (each project needs an `images` list and a longer body
   alongside the existing fields, not just a title/description/tags).

4. **Add a real contact destination.** Email is a nav icon today. It should be a deliberate
   landing point with a clear call to action.

5. **Run Lighthouse and fix anything below 95** across performance, accessibility, best practices,
   and SEO. Three static pages should score near 100 on all four.

---

## Phase 2 — Content architecture

An enabler, not a feature. Do it immediately before phase 1, item 3.
Estimated: half a session.

Projects, certifications, and skills are hardcoded as JavaScript arrays inside `.astro` files
([projects.astro](../src/pages/projects.astro), [qualifications.astro](../src/pages/qualifications.astro)).
Adding a project means editing markup, which is precisely the friction that stops content from
being added.

Move them to Astro content collections with a Zod schema, so entries become data files, adding one
cannot break the layout, and a missing required field fails the build instead of rendering blank.
The project schema needs to carry more than the current fields — an `images` list and a longer
body for the expanded card (see phase 1, item 3), not just title/description/tags.

*Done when:* a new project can be added by creating one Markdown file and touching no component.

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

- Which production URL goes in `site`? Needed before phase 0, item 2.
- Is the resume ready to go back up, and is the SMS InfoComm role still deliberately kept out of
  the site text?
- Which CLI topic is lesson one?
- Where do the project photos live right now, so they can be moved into `src/assets/projects/`
  when phase 1 item 3 is built?

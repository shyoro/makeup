# Design — Hebrew Makeup Artist Site

**Date:** 2026-09-13
**Status:** Approved
**Repo:** `makeup` (public, personal GitHub account `shyoro`)

---

## 1. Purpose and success criteria

A single-page, endless-scroll marketing site for a makeup artist, in Hebrew only
(RTL). Its job is to convert a visitor arriving from Instagram on a phone into a
booked appointment.

Success means:

- A visitor on a phone can see her work, understand what she offers, and book —
  without leaving the page.
- She can edit prices, portfolio images, FAQ answers, and section order herself,
  without a developer.
- Total running cost is zero. Every service stays on its free tier.
- Hebrew renders correctly: no Latin fallback glyphs, correct punctuation
  direction, mixed LTR runs (phone numbers, prices) intact.

Out of scope for MVP: video, a database, a blog, multiple routes, English.

## 2. Hard constraints

These are non-negotiable and every later decision defers to them.

1. **Free tier only.** No service that requires payment. No paid fonts. No paid
   plans, no trials that convert to paid. The one cost the client bears is
   Stripe's per-transaction fee on deposits, which is a fee on money she
   receives, not a subscription.
2. **Mobile is the primary design target.** Desktop is the secondary case. CSS
   is mobile-first; the mobile composition is designed first and scaled up. QA
   gates on mobile before desktop.
3. **Hebrew only, RTL.** `lang="he"`, `dir="rtl"`, logical CSS properties
   exclusively.
4. **The repo is public and permanent.** See §4.
5. **The site has no server.** Astro output is `static`. Anything the site knows
   is public.

## 3. Stack

| Layer | Choice | Free tier |
|---|---|---|
| Site | Astro 7, TypeScript strict, `output: 'static'` | OSS |
| Styling | Tailwind, RTL, semantic-token layer | OSS |
| Content + media | Sanity | Free plan |
| Hosting + API | Cloudflare Workers with static assets | 100k req/day |
| Preview gate | Cloudflare Access | 50 users, indefinite |
| Rate limiting | Workers rate-limit binding | no extra charge |
| Booking | Cal.com inline embed | free plan, incl. Stripe payments |
| Email | Resend | free tier |
| FAQ bot | Google Gemini Flash | free tier |
| WhatsApp | `wa.me` deep link | n/a |

### 3.1 Why not OpenAI

The original plan specified OpenAI for the FAQ bot. OpenAI has no free tier, so
it violates constraint 1. Evaluated alternatives:

- **Cloudflare Workers AI** — 10,000 neurons/day free, no API key, native
  binding. Rejected: roughly 15–25 generations/day on a capable model, and
  Hebrew quality on the small open models is poor enough to damage a brand
  positioned as luxury.
- **Google Gemini Flash free tier** — chosen. Materially better Hebrew, free,
  key held as a Worker secret.
- **No bot, static FAQ only** — rejected as the sole answer, but adopted as the
  fallback (below).

### 3.2 Bot design — graceful degradation

One `botKnowledge` Sanity document serves two consumers:

1. The chat widget, answering via Gemini Flash through `POST /api/chat`.
2. A static Hebrew FAQ accordion, rendered at build time from the same document.

When the Gemini free quota is exhausted or the API errors, the chat widget
surfaces the FAQ accordion rather than an error state. The visitor always gets
real answers. This also means the bot can be removed or swapped post-launch with
no schema migration and no content loss.

**System prompt rules:** answer only from the provided knowledge; say "I don't
know" otherwise; always respond in Hebrew; hand off to booking with a link;
never quote availability; never invent a price.

**Statelessness:** conversation history arrives in the request. No KV, no D1.
`botKnowledge` is fetched from Sanity and cached in the Worker, not fetched per
message.

## 4. Public-repo rules

The repo is public from the first commit. Anything committed is permanent —
forks and caches survive deletion. Three hard rules, enforced mechanically:

1. **The client's email address never enters the repo.** Not as a `CONTACT_TO`
   default, not in `.env.example`, not in `CLAUDE.md`, not in docs, not in a
   commit message. This overrides the original plan's `CONTACT_TO` default.
   The Worker **fails loudly** on unset `CONTACT_TO` — a 500 and a log line,
   never a fallback recipient.
2. **No client photography in the repo, ever.** `web/public/` holds only fonts,
   favicon, and placeholder images we own. Every client image lives in Sanity.
   Her photographer's licensing does not cover a world-readable git repo.
3. **A pre-commit hook greps for leak patterns** — the client's email, `sk-`,
   `re_`, Sanity tokens, `AIza` (Google API keys). This is the only
   control that actually stops a late-night mistake.

Safe to commit: Sanity `projectId` and `dataset` (public by design for CDN
reads), the Cal.com event URL, the WhatsApp number *only* if she consents to it
being public — it is already public on the rendered site, but the repo makes it
scrapable in bulk. Default: keep it in Sanity, not the repo.

Additionally: **never render an email address in page HTML.** No `mailto:`
fallback, no plain-text address. The contact form is the only path to her inbox.

### 4.1 Secrets handling

| Where | Mechanism |
|---|---|
| Local dev | `.env`, gitignored |
| Committed template | `.env.example`, empty values + comments only |
| Production | `wrangler secret put` |
| Non-secret operational config | Worker environment variables |

## 5. Configuration — what changes where, and by whom

Every value below changes without touching component code. If a value isn't
here, add it here rather than inlining it.

| Value | Lives in | Changed by | How |
|---|---|---|---|
| `SITE_URL` | `web/src/config.ts` | Dev | one edit + rebuild |
| Active theme | `web/src/styles/theme-*.css` | Dev | swap the default import |
| `noindex` flag | `web/src/config.ts` | Dev | one edit + rebuild |
| `CONTACT_TO` | Worker env var | Dev | dashboard or wrangler, no redeploy |
| `MAIL_FROM` | Worker env var | Dev | same |
| Gemini model | Worker env var | Dev | same |
| `GEMINI_API_KEY` | Worker **secret** | Dev | `wrangler secret put` |
| Phone, WhatsApp, socials | Sanity `siteSettings` | **Client** | Studio, live |
| Cal.com event URL | Sanity `siteSettings` | **Client** | Studio, live |
| FAQ answers, prices | Sanity `botKnowledge` | **Client** | Studio, live |
| Section order and presence | Sanity `page.sections[]` | **Client** | Studio, live |

**The split that matters:** anything the client should self-serve lives in
Sanity. Anything operational — recipients, senders, keys, models — lives in
Worker config, never in Sanity. Sourcing the form recipient from a CMS she can
edit would mean a compromised Studio could silently redirect her leads.

`SITE_URL` is defined in exactly one place. Canonical tags, OG image URLs,
sitemap, JSON-LD, and the Worker's CORS allowlist all derive from it. No
hardcoded absolute origins anywhere.

## 6. Design system — token indirection

The visual direction is undecided by the client, so the deliverable is the
*contract*, not the final look. Two layers:

- **Primitives** — raw palette scale, font files, spacing ramp.
- **Semantic tokens** — roles: `--color-surface`, `--color-ink`,
  `--color-accent`, `--font-display`, `--radius-card`, `--space-section`.

**No component ever references a primitive, a hex value, a font-family name, or
a magic spacing number.** Components consume semantic tokens only. A whole
visual direction is therefore one token file, and changing direction touches
zero components. If a needed role has no token, add the token — never inline the
value.

Three genuinely distinct directions ship as alternate token files, each run
independently through the `frontend-design` genericness check. One is marked
default and ships if the client doesn't decide. A theme switcher is active in
**preview builds only**, so she can compare live on her own photos.

### 6.1 Typography — free faces only

Display candidates, all free and self-hostable: **Frank Ruhl Libre**, **Heebo**,
**Noto Serif Hebrew**. UI and body: **Assistant**. The type scale must hold for
all three display faces, since Hebrew faces differ in x-height and the face may
change at Gate A.

Frank Ruhl Libre + Assistant is the default Hebrew pairing and is everywhere.
Because no budget exists for a distinctive licensed face, distinctiveness must
come from **layout, scale, contrast, and color** — per `frontend-design`'s
anti-default guidance — not from the typeface. This is a deliberate trade, not
an oversight.

Fonts are self-hosted, `font-display: swap`, subset to Hebrew unicode ranges.

### 6.2 Locked in Wave 1 — expensive to change later

**Aspect ratios.** Changing these after she uploads a library means re-cropping
every image. Sanity hotspot/crop means one upload serves all ratios, so this is
cheaper than it sounds, but it must be decided before she uploads.

| Slot | Ratio |
|---|---|
| Hero | 16:9 |
| Portfolio portrait | 4:5 |
| About / editorial | 3:2 |
| Testimonial avatar | 1:1 |

**Breakpoints.** Mobile-first, three tiers, locked in Wave 1 and used by every
agent and by QA. Base styles are unprefixed and target the narrowest case.

| Tier | Width | Role |
|---|---|---|
| Base | 0–767px | primary target; design here first |
| `md` | 768–1279px | tablet / small laptop |
| `lg` | 1280px+ | desktop |

QA screenshots at 390px, 820px, and 1440px.

**The media contract.** See §7. Schema migration is expensive; lock it.

## 7. Media contract

A polymorphic Sanity `media` object, future-proofed for video without building
video in MVP:

```
media {
  kind: 'image' | 'video'
  alt: string          // required
  caption?: string
  aspectRatio: string
  // video only:
  provider?: string
  playbackId?: string  // a string, NEVER an asset upload
  poster?: image       // required when kind === 'video'
}
```

A single `<Media>` component switches on `kind`. The image branch is
implemented. The video branch is **stubbed but its contract is fixed** — muted,
`playsinline`, `loop`, and reduced-motion resolves to the poster.

**Agents use `<Media>`, never a raw `<img>`.** Every consumer supplies an
explicit `aspect-ratio` from CSS, never from the asset — this is what makes
CLS ≈ 0.

The image pipeline: Sanity URL builder, responsive `srcset`, AVIF/WebP, LQIP
placeholders, hotspot-aware cropping.

**Done when:** a 6 MB portrait upload renders correctly cropped in a 16:9 slot
at all three breakpoints, with a network payload under ~200 KB.

## 8. Content model

- **`page.sections[]`** — an ordered array of section objects, not fixed
  singleton documents. Section *types* are ours to design (hero, portfolio,
  services, pricing, testimonials, about, contact). Their **order, presence, and
  repetition are hers.** Reordering the scroll, dropping a section, or adding a
  second gallery is a content edit, not a code change.
- **`siteSettings`** singleton — phone, WhatsApp number, socials, Cal.com event
  URL.
- **`botKnowledge`** — services, prices, travel policy, FAQ. Read by both the
  chat endpoint and the static FAQ accordion.
- Studio config: hotspot/crop enabled on all images, **Hebrew field titles and
  descriptions**, upload size warnings.
- Typed GROQ queries with generated types, exported for `sections-agent`.

Real content never blocks code. We seed placeholder Hebrew content into Sanity;
swapping it for her real copy is data entry she does in Studio, in parallel with
the build.

## 9. API surface

Two endpoints on the Worker. Both rate-limited per IP via the rate-limit
binding, which is a loose filter rather than strict abuse prevention — adequate
here, and worth stating plainly so nobody mistakes it for a security control.

**`POST /api/chat`** — Gemini Flash, key from a Worker secret. Cached
`botKnowledge` injected into the system prompt. Stateless.

**`POST /api/contact`** — Resend. Honeypot plus rate limit.

- Recipient from the `CONTACT_TO` env var, parsed as a **comma-separated list**
  so adding an assistant later needs no code change.
- `replyTo` = the visitor's submitted email. `from` = `MAIL_FROM`.
- **Fails loudly to the visitor** if Resend errors. A silent failure means she
  loses a booking and never learns of it.

### 9.1 Consequences of deferring the domain

MVP ships on the free `*.workers.dev` subdomain. Three knock-on effects:

- Resend without a verified domain can only send **to** the address the account
  was registered with. So the Resend account must be registered as the client's
  own address, or the contact form silently fails its first real test.
- That address is the recipient, not the sender. You cannot send *from* a
  `gmail.com` address. Until the domain lands, `from` is Resend's dev sender.
- Expect spam-folder problems during testing — a dev sender to Gmail is exactly
  the pattern filters distrust. Have her mark the first one as not-spam. Phase 7
  resolves it.
- **Ship with `noindex`.** Do not let Google index the `workers.dev` URL, or
  you build SEO equity on a URL you are about to abandon.

## 10. SEO

Head component, Hebrew meta and OG, JSON-LD `LocalBusiness`/`BeautySalon`,
sitemap, robots, canonical. Every absolute URL derives from `SITE_URL`.
`noindex` on by default behind a single config flag, flipped in Phase 7.
`LocalBusiness` address and phone fields wired but empty pending client input.

One page means one URL. The route-expansion path for future service pages is
documented, not built.

## 11. Orchestration

Waves run as specified. Each parallel agent is one `Agent` call with
`isolation: "worktree"` — its own worktree, its own branch, its own disjoint
slice of the ownership table. A wave's agents launch in a single message so they
run concurrently.

At each wave boundary, branches merge into `main`. Ownership is disjoint by
construction, so there is nothing to resolve. The **wave gate** is
`tsc --noEmit` + `npm run build` + axe passing.

**Correction to the original plan:** `CLAUDE.md` and `.claude/skills/brand-he/`
cannot be produced by a Wave 2 agent, because all four Wave 2 agents read them.
They are written and frozen in **Wave 1**. This makes Wave 1 larger than
originally scoped and is the right trade.

### 11.1 File ownership (hard boundary)

```
CLAUDE.md                          → Wave 1 (then frozen)
.claude/skills/brand-he/           → Wave 1 (then frozen)
web/src/styles/                    → design-system-agent
web/src/components/primitives/     → design-system-agent
web/src/components/media/          → media-agent
web/src/lib/media/                 → media-agent
web/src/components/sections/       → sections-agent
web/src/components/integrations/   → integrations-agent
web/src/lib/sanity/                → sanity-agent
web/src/lib/seo/                   → seo-agent
studio/                            → sanity-agent
worker/                            → worker-agent
tests/                             → qa-agent
web/src/pages/index.astro          → assembly-agent ONLY (Wave 4)
wrangler.toml / deploy config      → deploy-agent
```

Agents in the same wave must never share a file.

### 11.2 Waves

- **Wave 1 (sequential)** — repo init, Astro 7 + TS strict + Tailwind, RTL root
  layout, Hebrew font loading, directory skeleton with placeholder files,
  `.env.example`, `.gitignore`, pre-commit leak hook, Prettier/ESLint, empty
  `worker/` and `studio/` scaffolds, plus `CLAUDE.md`, the `brand-he` skill, and
  the locked breakpoints and aspect ratios.
  *Done when:* `npm run build` succeeds on an empty page rendering RTL Hebrew
  lorem in the real typefaces, on mobile and desktop.
- **Wave 2 (4 parallel)** — `design-system-agent` ‖ `sanity-agent` ‖
  `worker-agent` ‖ `seo-agent`.
- **Wave 3a (sequential)** — `media-agent`. Blocks sections.
- **Wave 3b (2 parallel)** — `sections-agent` ‖ `integrations-agent`.
- **Wave 4 (sequential)** — `assembly-agent`, sole owner of `index.astro`.
  Renders by mapping over `page.sections[]` through a section-type registry. No
  hardcoded sequence. Unknown section type renders nothing and warns, never
  crashes. Verifies no CSS specificity collisions between sections. Adds no new
  components and no new tokens.
- **Gate A** — design decision. Non-blocking; Wave 5 is theme-agnostic and runs
  in parallel with it.
- **Wave 5 (2 parallel)** — `qa-agent` ‖ `deploy-agent`.
- **Wave 6 (sequential)** — `docs-agent`.
- **Phase 7 (deferred)** — domain cutover and local discovery.

### 11.3 Agent guardrails

Agents may navigate, read, screenshot, and verify. Agents **stop and hand back
to Shai** for: creating accounts, signing in, entering any password or key,
entering payment details, accepting terms, changing account settings, adding DNS
records, granting OAuth scopes, and clicking publish/submit/delete on anything
irreversible. Correct behaviour is to surface the exact values needed, then
wait.

## 12. Definition of done (every agent)

Typechecks. Builds. Passes axe. Mobile
renders correctly before desktop is considered. No raw hex, no font-family
names, no magic spacing numbers in any component. No `localStorage` or
`sessionStorage`. No raw `<img>`. No hardcoded absolute URLs.

## 13. QA gates

- RTL visual checks at all three breakpoints — screenshot and actually look.
  **Mobile first.**
- Lighthouse: LCP and CLS. The aspect-ratio work should make CLS ≈ 0.
- axe, keyboard focus order in RTL.
- Hebrew rendering: no Latin fallback glyphs, correct punctuation direction,
  mixed LTR runs (phone numbers, prices) not mangled.
- Chat endpoint: rate limit fires, refuses off-knowledge questions, stays in
  Hebrew, and degrades to the FAQ accordion when the quota is exhausted.
- Cal.com embed on real mobile Safari and Chrome.
- **Theme-swap check:** render under all three token files. Contrast ratios pass
  in each. No component reveals a hardcoded color or font.

## 14. Deployment

Cloudflare Workers with static assets — verify current guidance first; Pages may
be the deprecated path. Sanity webhook triggers rebuild on publish. Preview
environment sits behind **Cloudflare Access**, not an obscure URL. Secrets via
`wrangler secret`; confirm nothing sensitive is in the repo or in plaintext
vars. DNS records are surfaced for Shai to add — the agent does not add them.

## 15. Handoff

1. **Client guide in Hebrew** — adding a portfolio image, setting the crop
   hotspot, editing prices, editing FAQ answers. With screenshots. Explains the
   publish-then-wait-a-few-minutes rebuild, or she will think it is broken.
2. Developer README and architecture notes.
3. **Ownership transfer checklist** — every account in her name, her own API
   keys with her own caps, Shai downgraded to collaborator.
4. Privacy notice naming Google and Resend as processors. **Verify against
   Israel's amended Privacy Protection Law**; do not assume GDPR boilerplate
   covers it.

## 16. Open items — need the client, not an agent

None of these block Waves 1–3a.

- **Service model** → Cal.com event types: studio vs travel, durations, travel
  fees, deposit amount, lead time, cancellation policy. Blocks
  `integrations-agent` only in that it needs one real event URL to embed —
  mitigated by creating a throwaway Cal.com event now and swapping the URL at
  handoff, since it is a Sanity field.
- **Photo rights** — photographer copyright and credits. Blocks launch, not
  build.
- **Real content** — service descriptions, prices, bio, testimonials. Data
  entry, never a code blocker.
- **Design direction** — resolves at Gate A. A default ships if she does not
  decide by the deadline.
- **Domain** — resolves in Phase 7.
- Logo, brand colors, existing assets.

### Decision deadline

Flexibility is paid for in the token layer, which is cheap, and in re-presenting
options, which is not. Set a date, and set a default direction that ships if the
date passes. "Still thinking" has no natural end.

## 17. Dependency graph

```
Wave 1: scaffold + CLAUDE.md + brand-he + locked ratios/breakpoints
  └─ Wave 2: design-system ‖ sanity ‖ worker ‖ seo
       └─ Wave 3a: media
            └─ Wave 3b: sections ‖ integrations
                 └─ Wave 4: assembly
                      ├─ Gate A: design decision (non-blocking)
                      └─ Wave 5: qa ‖ deploy
                           └─ Wave 6: docs
                                └─ Phase 7: domain cutover + GBP (deferred)
```

Critical path: scaffold → sanity → media → sections → assembly. Everything else
has slack. Both open client decisions sit off the critical path by design.

## 18. Prerequisites

**Done:** `frontend-design`, `webapp-testing`, and `theme-factory` skills
installed. `gh` authenticated as `shyoro`. Repo name fixed as `makeup`.

**Needed before Wave 2 — Shai:**

- `npx sanity login` (one-time browser OAuth).
- Sanity project and `production` dataset. Note the `projectId`.

## 18.1 Tooling: first-party CLIs, not MCP

The Sanity and Cloudflare MCP servers are unavailable in this environment.
Neither was load-bearing. The schema is TypeScript in `studio/` and was always
hand-written, so "schema ops via MCP" was never a real dependency. Everything
else is covered by the first-party CLIs, which the project needs anyway.

| Need | Mechanism |
|---|---|
| Sanity project, dataset | `npx sanity init`, `npx sanity dataset create` |
| Sanity CORS origins | `npx sanity cors add` |
| Seed placeholder content | `npx sanity documents create` |
| Generated GROQ types | `npx sanity typegen generate` |
| Schema extract / deploy | `npx sanity schemas` |
| Worker deploy | `wrangler deploy` |
| Worker secrets | `wrangler secret put` |
| Bindings, incl. rate limiting | declared in `wrangler.toml` |
| Worker observability | `wrangler tail` |
| Current library docs | WebFetch / WebSearch against official docs |

`typegen` and `schemas` are confirmed in Sanity's CLI reference. `dataset`,
`cors`, and `documents` are verified against `npx sanity --help` in Wave 1
rather than assumed.

**Two one-time browser OAuth logins are human-only steps:**
`npx sanity login` and `npx wrangler login`. Agents never sign in.

**Browser control is verification-only.** Agents may navigate the Sanity and
Cloudflare dashboards to confirm that a dataset exists, a CORS origin is set, or
a secret is present. Agents never create accounts, change account settings, add
DNS records, accept terms, or grant OAuth scopes. This restates §11.3 and is not
relaxed by the absence of MCP.

**Permission prompts.** Read-only `wrangler` and `sanity` invocations are
allowlisted in `.claude/settings.json` during Wave 1 so that wave execution is
not interrupted by dozens of prompts. Mutating commands — `deploy`,
`secret put`, `dataset create`, `documents create` — stay prompted
deliberately.

**Needed before Wave 3b — Shai:**

- Cloudflare account (no domain), then `npx wrangler login`.
- Google AI Studio API key for Gemini, free tier.
- Cal.com free account: Google Calendar connected, timezone `Asia/Jerusalem`,
  week starts Sunday. At least one event type for dev.
- Resend account registered as the client's own email address.

All accounts created in the client's name where possible, with Shai as
collaborator. Retrofitting ownership later is painful.

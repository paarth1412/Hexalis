# HEXALIS — hexalis.in

The HEXALIS website. Static HTML, no framework, no build dependencies beyond
Python 3 (which macOS already has). It deploys anywhere that can serve files.

    hexalis/
      content.py          ← all copy lives here. This is the file you edit.
      build.py            ← generates the HTML from content.py
      assets/
        css/site.css      ← the whole design system, hand-written
        js/site.js        ← ~460 lines, no dependencies
        img/favicon.svg
      index.html          ← generated
      pillars.html        ← the six, with the interactive hexagon
      model.html          ← why one partner, not six vendors
      (practice.html)     ← offline for now; page_practice() kept in build.py
      approach.html       ← engagement models, principles, FAQ
      careers.html        ← open positions (roles live in content.py ROLES)
      about.html  contact.html  404.html
      technology.html …   ← one page per pillar (six of them)
      sitemap.xml  robots.txt
      netlify.toml  _headers  .htaccess   ← host config

## Editing the site

Almost everything visitors read lives in `content.py`: the six pillars, their
vision/mission/goals/workstreams, the client scenarios, the engagement models,
the FAQs and the contact details.

1. Edit `content.py`
2. Run the build
3. Upload the changed `.html` files

```bash
python3 build.py
```

If you edit an `.html` file directly, the next build overwrites it. Change
`content.py` (for words) or `build.py` (for structure) instead.

## Previewing locally

```bash
python3 -m http.server 4321 --directory hexalis
```

Then open http://localhost:4321. Use a server rather than opening the files
directly — the pages use root-relative links (`/about.html`), which only
resolve correctly when served.

## Deploying

The output is a plain folder of static files. Upload the whole `hexalis/`
folder to the web root of hexalis.in.

- **Netlify** — see the walkthrough below. `netlify.toml` is already here, so
  there is nothing to configure in the UI.
- **cPanel / shared hosting** — upload the contents into `public_html/`.
- **Vercel** — import the repo, framework preset "Other", no build command.
- **GitHub Pages** — push the folder contents to the repo root or `/docs`.
- **Cloudflare Pages** — no build command, output directory `hexalis`.

### Netlify, step by step

The site is pre-built. `build.py` runs on your machine, Netlify only serves the
files — there is no build command and nothing to install.

**Deploy (no git needed):**

1. Run `python3 build.py`. It regenerates the HTML *and* assembles `dist/`.
2. Sign in at app.netlify.com and open the hexalis site.
3. Go to *Deploys* and drag the **`dist` folder** onto the drop zone.
4. It is live in under a minute.

**Always deploy `dist/`, never the project folder.** Dragging the project
folder uploads `build.py`, `content.py` and this README along with the site,
which makes them downloadable at hexalis.in/build.py and friends. `dist/`
contains only the 14 pages, the assets, `sitemap.xml`, `robots.txt`, `_headers`
and `netlify.toml` — 21 files, about 286 KB.

**Ongoing updates (recommended):** connect a git repo instead, so a `git push`
publishes. In *Add new site → Import an existing project*, pick the repo and
set the publish directory to `hexalis/dist` (commit `dist/` so Netlify has
nothing to build).

**Pointing hexalis.in at it:** *Domain management → Add a domain*, enter
`hexalis.in`, and Netlify will show you the exact DNS records to create at your
registrar. Use the values it displays rather than any written down elsewhere —
they change occasionally. Either delegate the nameservers to Netlify DNS
(simplest) or add the A and CNAME records at your current registrar. HTTPS is
issued automatically once DNS resolves; allow up to a few hours.

Netlify serves `404.html` automatically, and may show pages at extensionless
URLs (`/about` rather than `/about.html`). Both forms work. The `.htaccess`
file is for Apache hosts and is ignored by Netlify — harmless to leave in.

Point the `404.html` file at your host's not-found handler (Netlify, Vercel,
Cloudflare and GitHub Pages all pick it up automatically).

Two cache-header files ship with the site and are picked up automatically:
`_headers` (Netlify, Cloudflare Pages) and `.htaccess` (Apache, cPanel). They
cache `/assets/*` for a year and make HTML revalidate on every request, so a
redeploy is visible immediately instead of after someone clears their cache.
CSS and JS URLs carry a content hash (`site.css?v=e64413af`) which the build
regenerates whenever the file changes — nobody ever gets a half-updated site.
The `.htaccess` also enables clean URLs, so `/about` serves `about.html`.

## The contact form

There is no backend. The brief form on `/contact.html` composes a properly
formatted email in the visitor's own mail app and sends it to the address in
`content.py` (`SITE["email"]`). Nothing is stored on the site, and the page
says so.

Once you are on Netlify, the cheapest upgrade to real submissions is Netlify
Forms: in `build.py`, add `name="brief" netlify netlify-honeypot="bot-field"`
to the `<form>` tag and a hidden `<input name="bot-field">` inside it, then
delete the `contact()` function from `site.js` so the browser submits normally.
Entries then appear under *Forms* in the Netlify dashboard, with email
notifications. Formspree works the same way via the `action` attribute.

## WhatsApp

The contact page has a WhatsApp button that opens a chat with HEXALIS with a
message already typed. The number and the message live in `content.py`
(`SITE["whatsapp"]`, `SITE["whatsapp_message"]`). The number must be digits
only with the country code — `919690573335`, not `+91 96905 73335` — because
that is the format `wa.me` links require. `whatsapp_display` is only the
human-readable version shown on the button.

## In Practice (offline)

Removed from the nav, the build and the sitemap for now. `netlify.toml`
redirects `/practice` and `/practice.html` to `/model` with a temporary 302, so
old links still land somewhere sensible. The page code and its scenarios are
untouched in `build.py` and `content.py`; to bring it back, re-add it to
`NAVIGATION` and to the pages dict in `main()`, and delete the two redirects.

## Careers page

Open positions live in `ROLES` in `content.py`, taken from the hiring pack
(`HEXALIS_Hiring_JDs_4_Roles_V1.1.pdf`, which actually carries seven roles).

Each role shows only its title, the facts and a one-line `summary` until the
visitor presses **Know more**; the full brief is collapsed behind the same
accordion the FAQ uses, so there is no second implementation to maintain.
**Inquire now** opens the visitor's mail app to `SITE["careers_email"]` with the
role already in the subject line — nothing is stored on the site.

- **To remove a role:** delete its block from `ROLES` and rebuild.
- **To add one:** copy the shape of an existing block. `responsibilities`
  accepts either a plain string or a `("heading", [sub-bullets])` tuple.
- **To change the inbox or the message:** `SITE["careers_email"]` and
  `careers_mailto()` in `build.py`.

## The typeface — read this before launch

The site asks for **Aptos Light** first and falls back to **Inter**.

Aptos is Microsoft's font, bundled with Microsoft 365. Anyone with Office
installed — which is most corporate desktops, and your own Mac — sees the real
Aptos. Everyone else (most phones, most Macs without Office) gets Inter, the
closest free neo-grotesque. The two are similar enough that nothing reflows,
but they are not identical.

To make it Aptos for *every* visitor you have to self-host the font files, and
that needs a licence that permits web embedding. The copies inside
`/Applications/Microsoft Word.app/Contents/Resources/DFonts/` are licensed for
use with Office, **not** for redistribution from a web server — do not simply
copy them into `assets/`. Either buy a webfont licence for Aptos, or accept the
Inter fallback, or pick a free face and make it the single font.

Once you have licensed files, drop the `.woff2` into `assets/fonts/`, add an
`@font-face` block at the top of `site.css`, and the existing stack picks it up
with no other change.

## The logo

`build.py` holds the mark as a single traced SVG path (`LOGO_PATH`), taken
directly off the alpha channel of the supplied artwork. It is two interlocking
pieces, drawn with `fill="currentColor"` — so it renders in the brand cyan on
the dark sections and in ink on the light bands. That covers both the teal and
the black version you were given without shipping two files.

To swap in different artwork, retrace it and replace `LOGO_VIEWBOX` and
`LOGO_PATH`. The favicon is generated from the same path, so it follows along.

## Design notes

- **Type** — Times New Roman, and nothing else. One family doing every job:
  size, weight, tracking, case and italic carry all the hierarchy. Small
  wide-tracked capitals are the workhorse label style; italic is reserved for
  taglines and accents. There is no webfont request, so text paints instantly.
- **Colour** — near-black obsidian (`#03080a`) with a deep teal ground, the
  brand cyan (`#4fe4f2`) as the single accent, and a warm sand (`#e8c294`) used
  sparingly on numerals and section marks so the palette is not purely cold.
  One light "paper" band per page (`#f3f0e9`) breaks the dark run and makes the
  argument sections read as print. A fine grain sits over everything.
- **Structure** — deliberately multi-page. Each page is about two screens; the
  argument is split across `model` → `approach` rather than
  stacked into one endless scroll.
- **Motion** — a wipe between pages, word-by-word heading reveals, staggered
  section entrances, self-drawing hairlines, counting statistics, a slow hero
  parallax, and a pointer-reactive hexagonal lattice behind every page header.
  All of it respects `prefers-reduced-motion`, and the lattice stops drawing
  once it scrolls out of view.
- **No JavaScript** — the full page still renders and reads. The hidden state
  for animations is only ever added by a class, never by default, so a blocked
  or failed script can't leave a blank page. There is also a rescue pass that
  reveals anything in the viewport if the observer stays silent.
- **Accessibility** — skip link, visible focus rings, keyboard-navigable pillar
  wheel and scenario tabs, real `aria-selected` / `aria-expanded` state.

## Content source

All pillar copy is taken from the HEXALIS strategy document: six pillars,
46 workstreams, and the enterprise vision, mission and strategic goals.
Nothing on the site claims clients, case studies, testimonials or metrics that
do not exist yet — those sections are deliberately absent until they are real.

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
      make_icons.py       ← regenerates favicons from assets/brand/ (rarely needed)

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

## The typeface

The whole site is set in **"Hexalis Sans"**, an alias defined at the top of
`assets/css/site.css`. Today it points at **TeX Gyre Heros** — a free,
openly licensed clone of Helvetica (GUST Font License, a copy sits in
`assets/fonts/`). It was chosen because Aon, the reference site, uses
**Helvetica Now**, a paid Monotype font that Aon licenses for itself; its files
cannot be copied, and TeX Gyre Heros was the closest match side by side.

**To switch to real Helvetica Now later:** buy a web licence (Monotype /
MyFonts), put the `.woff2` files in `assets/fonts/`, and change the two `src:`
URLs in the `@font-face` blocks at the top of `site.css`. Nothing else changes.
If you have Adobe Creative Cloud, *Neue Haas Grotesk* on Adobe Fonts is the
original Helvetica redrawn and is included in the subscription — another route.

## The logo and favicons

`build.py` holds the mark as a traced SVG path (`LOGO_PATH`), split into its
two interlocking pieces so they can be animated separately: they assemble on
load, lean apart under the pointer, and sit pulled apart on The Model page.
The colour is `#03abb4`, sampled from the supplied artwork.

Every browser and search icon is cut from the original artwork in
`assets/brand/hexalis-mark-teal.png` by `make_icons.py`:
`favicon.ico` (16/32/48), `assets/img/favicon-*.png` (16–192),
`apple-touch-icon.png` (white ground, for iOS), the Android icons in
`site.webmanifest`, and a matching `favicon.svg`. To regenerate after a logo
change:

```bash
python3 -m pip install --user pillow && python3 make_icons.py && python3 build.py
```

`assets/brand/` is source artwork only; the build keeps it out of `dist/`.

## Design notes

- **Reference** — modelled on the experience of aon.com: big bold Helvetica
  headlines, generous white space, a scroll-pinned story on the homepage, an
  "I want to…" panel in the hero, section headings with giant pale watermark
  words behind them, card grids, and a "Start here" call to action card.
- **Colour** — white ground, navy-charcoal ink `#1f2433` (never pure black),
  the HEXALIS blue `#4fe4f2` unchanged for buttons, fills and highlights, and
  `#00727c` — the same hue, darker — only where small text needs to be
  readable on white. Pale teal-tinted bands `#f3f9fa` separate sections.
- **No AI tells** — no letterspaced uppercase labels, no numbered "01 —"
  rules, no grain, no grid lines, no ticker, no italic accent words. Eyebrows
  are one short sentence-case line led by a small solid hexagon.
- **Fun, specific to HEXALIS** — the logo is two pieces that become one, so
  that is the interaction: the big marks assemble, react to the pointer, and
  the page-change wipe assembles the logo too. The homepage walks through the
  six pillars as you scroll, with a progress track under each name. The
  honeycomb in the page heroes still glows around the pointer.
- **Motion** — everything respects `prefers-reduced-motion`. Without
  JavaScript every page is complete; the pinned story becomes stacked cards.

## Content source

All pillar copy is taken from the HEXALIS strategy document: six pillars,
46 workstreams, and the enterprise vision, mission and strategic goals.
Nothing on the site claims clients, case studies, testimonials or metrics that
do not exist yet — those sections are deliberately absent until they are real.

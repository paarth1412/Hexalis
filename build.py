#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HEXALIS static site builder.

    python3 build.py

Reads content.py, writes plain .html files next to this script.
No node_modules, no framework, no lock file — the output is a folder of
static files that will run on any host.

The site is deliberately MULTI-PAGE. Each page is roughly two screens deep;
the argument is split across pages rather than stacked into one long scroll.
"""
import hashlib
import html
import math
import os
import shutil
import zipfile
from datetime import date

from urllib.parse import quote
from content import ROLES, SITE, ICONS, PILLARS, ENTERPRISE, SCENARIOS, MODES, PROCESS, CONTRAST, FAQS

HERE = os.path.dirname(os.path.abspath(__file__))
BY_SLUG = {p["slug"]: p for p in PILLARS}
YEAR = date.today().year
BUILT = date.today().isoformat()
N_STREAMS = sum(len(p["streams"]) for p in PILLARS)


def asset(path):
    """Append a short content hash so a redeploy never serves a stale stylesheet."""
    full = os.path.join(HERE, path.lstrip("/"))
    try:
        with open(full, "rb") as f:
            h = hashlib.sha1(f.read()).hexdigest()[:8]
        return f"{path}?v={h}"
    except OSError:
        return path


def e(s):
    return html.escape(str(s), quote=True)


def icon(name, cls=""):
    return (
        f'<svg viewBox="0 0 48 48" class="{cls}" fill="none" stroke="currentColor" '
        f'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        f'{ICONS[name]}</svg>'
    )


# WhatsApp glyph in the site's line-icon style (48u grid, stroke only).
WHATSAPP_ICON = ('<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.8" '
                 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                 '<path d="M24 7.5a16.5 16.5 0 0 0-14.3 24.7L7.5 40.5l8.5-2.2A16.5 16.5 0 1 0 24 7.5z"/>'
                 '<path d="M18.6 15.8c-.5 0-1.3.2-1.9 1-.7.8-1.6 2.1-1 4.3.7 2.5 2.6 5.6 6.2 7.9 3.4 2.2 5 2.3 6.1 2 '
                 '1.2-.3 2.4-1.5 2.6-2.5.2-.8.1-1.3-.4-1.6l-3-1.5c-.5-.2-.9-.1-1.2.3l-1.1 1.4c-.3.3-.6.4-1 .2'
                 '-.9-.4-2.2-1-3.5-2.3-1.1-1.1-1.8-2.3-2.1-2.9-.2-.4-.1-.7.2-1l.9-1c.3-.3.3-.7.2-1.1l-1.3-3'
                 'c-.2-.5-.5-.6-.8-.6z"/></svg>')

ARROW = ('<svg class="arw" width="15" height="10" viewBox="0 0 15 10" fill="none" aria-hidden="true">'
         '<path d="M10 1l4 4-4 4M14 5H0" stroke="currentColor" stroke-width="1.2"/></svg>')

# The HEXALIS mark, traced from the supplied artwork (HEXALIS-Tl-Cl.png /
# HEXALIS-Bk-Cl.png) straight off its alpha channel. Two interlocking pieces
# form the H. It inherits `currentColor`, so it renders in the brand cyan on the
# dark sections and in ink on the light "paper" bands — both supplied options,
# without shipping two files.
LOGO_VIEWBOX = "0 0 91.77 100.0"
LOGO_PATH = ("M48.01 0L50.32 0.19L52.64 0.83L61.05 5.37L61.05 43.57L32.56 43.57L32.47 27.29L19.24 34.6L19.24 86.22L19.06 86.22L8.51 80.2L5.27 77.98L2.5 75.02L1.39 73.27L0.46 71.14L0 68.83L0.09 33.67L0.28 31.54L0.83 29.32L2.78 25.81L4.07 24.33L6.48 22.39L42.18 1.67L44.68 0.56ZM72.25 14.34L82.33 20.35L86.68 23.31L88.34 24.98L89.64 26.73L91.21 30.25L91.67 33.02L91.77 57.82L91.67 68.73L90.93 72.25L89.82 74.47L88.9 75.76L86.22 78.26L50.97 98.61L49.21 99.44L46.25 100L44.5 99.91L42.37 99.35L32.47 93.8L32.47 57.08L61.05 56.98L61.05 73.17L72.16 66.98Z")

MARK = (f'<svg class="brand__mark" viewBox="{LOGO_VIEWBOX}" aria-hidden="true">'
        f'<path d="{LOGO_PATH}" fill="currentColor"/></svg>')

CANVAS = '<canvas class="js-lattice hero__canvas" aria-hidden="true"></canvas>'

# Every page in the site, in nav order. (file, nav label, nav key)
NAVIGATION = [
    ("about.html", "About", "about"),
    ("pillars.html", "Pillars", "pillars"),
    ("model.html", "The Model", "model"),
    ("approach.html", "Approach", "approach"),
    ("careers.html", "Careers", "careers"),
    ("contact.html", "Contact", "contact"),
]


# ---------------------------------------------------------------------------
# Hexagon wheel — geometry computed at build time so the SVG ships static.
# ---------------------------------------------------------------------------
def hexwheel():
    C, R, r_in, GAP = 280.0, 246.0, 96.0, 1.15
    BLOCK_R = 0.60          # where each wedge's icon+label+index block sits
    LABEL_FS = 13.0         # must match .wheel__seg .txt in site.css
    EM_PER_CHAR = 1.02      # measured for the uppercase label style, worst case
    ICO_S = 0.92            # icon scale; the art is drawn on a 48u grid
    ICO_HALF = 24 * ICO_S

    def pt(rad, deg):
        a = math.radians(deg)
        return (C + rad * math.cos(a), C + rad * math.sin(a))

    def half_width(y):
        """Half-width of the hexagon at a given y.

        The wedge labels are horizontal but four of the six wedges run on a
        diagonal, so a long name can push past the hexagon's edge. This is the
        hard limit each label has to live inside."""
        dy = abs(y - C)
        return min(math.sqrt(3) / 2 * R, math.sqrt(3) * (R - dy))

    segs = []
    for i, p in enumerate(PILLARS):
        a0 = -120 + 60 * i + GAP
        a1 = -60 + 60 * i - GAP
        mid = -90 + 60 * i
        o0, o1 = pt(R, a0), pt(R, a1)
        i0, i1 = pt(r_in, a0), pt(r_in, a1)
        d = (f"M{i0[0]:.1f} {i0[1]:.1f} L{o0[0]:.1f} {o0[1]:.1f} "
             f"L{o1[0]:.1f} {o1[1]:.1f} L{i1[0]:.1f} {i1[1]:.1f} Z")
        # Icon, name and index are stacked vertically on the wedge's mid-line,
        # icon always on the inner side. Laying them out along the radius
        # instead puts the horizontal label straight through the icon on the
        # four diagonal wedges.
        cx, cy = pt(R * BLOCK_R, mid)
        upper = math.sin(math.radians(mid)) < 0
        if upper:
            iy = cy + 16; ly = cy - 22; ny = ly - 18
        else:
            iy = cy - 16; ly = cy + 26; ny = ly + 18
        ix = lx = nx = cx

        # Guards: a renamed pillar must not push its label outside the hexagon
        # or back into its own icon. Fail the build instead of shipping it.
        est = len(p["name"]) * LABEL_FS * EM_PER_CHAR
        room = min(lx - (C - half_width(ly)), (C + half_width(ly)) - lx)
        if est > 2 * room:
            raise SystemExit(
                f'hexwheel: "{p["name"]}" needs ~{est:.0f}u but only {2 * room:.0f}u '
                f'fits inside the hexagon. Shorten the name or lower LABEL_FS.')
        gap = (ly - LABEL_FS * 0.78) - (iy + ICO_HALF) if not upper \
            else (iy - ICO_HALF) - (ly + LABEL_FS * 0.28)
        if gap < 6:
            raise SystemExit(
                f'hexwheel: "{p["name"]}" label sits {gap:.0f}u from its icon; '
                f'needs 6u. Adjust the stack offsets or ICO_S.')

        s = ICO_S
        segs.append(f'''
      <g class="wheel__seg" role="tab" aria-selected="false" tabindex="-1"
         aria-controls="wp-{p['slug']}" id="wt-{p['slug']}">
        <title>{e(p['name'])} — {e(p['tagline'])}</title>
        <path class="fill" d="{d}"/>
        <g class="ico" transform="translate({ix - 24 * s:.1f} {iy - 24 * s:.1f}) scale({s})">{ICONS[p['icon']]}</g>
        <text class="txt" x="{lx:.1f}" y="{ly:.1f}">{e(p['name'].upper())}</text>
        <text class="num" x="{nx:.1f}" y="{ny:.1f}">{p['num']}</text>
      </g>''')

    return f'''<div class="wheel">
  <svg viewBox="0 0 560 560" role="tablist" aria-label="The six HEXALIS pillars">
    <g class="wheel__spin">
      <circle class="wheel__ring" cx="280" cy="280" r="268"/>
      <circle class="wheel__ring" cx="280" cy="280" r="276" stroke-dasharray="2 10"/>
    </g>{''.join(segs)}
    <g class="wheel__hub">
      <circle cx="280" cy="280" r="88"/>
      <circle cx="280" cy="280" r="80" fill="none" stroke="rgba(126,200,208,.1)"/>
      <text class="h1" x="280" y="274">HEXALIS</text>
      <text class="h2" x="280" y="296">Six pillars</text>
      <text class="h2" x="280" y="310">One partner</text>
    </g>
  </svg>
</div>'''


def wheel_panels():
    out = []
    for i, p in enumerate(PILLARS):
        chips = "".join(f'<span class="chip">{e(s[0])}</span>' for s in p["streams"][:6])
        out.append(f'''
      <div class="wpanel__body{' is-active' if i == 0 else ''}" id="wp-{p['slug']}" role="tabpanel"
           aria-labelledby="wt-{p['slug']}">
        <div class="wpanel__num">Pillar {p['num']}</div>
        <h3>{e(p['name'])}</h3>
        <div class="tag">{e(p['tagline'])}</div>
        <p>{e(p['purpose'])}</p>
        <div class="chips">{chips}</div>
        <a class="tlink" href="/{p['slug']}.html">Explore {e(p['name'].lower())} {ARROW}</a>
      </div>''')
    return "".join(out)


# ---------------------------------------------------------------------------
# Shared chrome
# ---------------------------------------------------------------------------
def head(title, desc, path, extra=""):
    canonical = SITE["url"] + ("/" if path == "index.html" else "/" + path)
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{canonical}">
<meta name="theme-color" content="#03080a">
<meta property="og:type" content="website">
<meta property="og:site_name" content="HEXALIS">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{canonical}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{asset("/assets/css/site.css")}">
<script>/* enables the reveal styles, plus a failsafe that shows the page even if site.js never loads */
document.documentElement.className+=" js is-entering";setTimeout(function(){{document.documentElement.classList.remove("is-entering")}},900);</script>
{extra}</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="progress" aria-hidden="true"></div>
'''


def nav(current=""):
    mega_items = "".join(f'''
      <a class="mega__item" href="/{p['slug']}.html">
        <div class="n">{p['num']}</div>
        <h4>{e(p['name'])}</h4>
        <p>{e(p['tagline'])}</p>
      </a>''' for p in PILLARS)

    links = "".join(
        f'<a class="nav__link{" is-current" if current == key else ""}" href="/{f}"'
        + (' data-mega-trigger aria-expanded="false" aria-controls="mega"' if key == "pillars" else "")
        + f'>{e(label)}</a>'
        for f, label, key in NAVIGATION)

    drawer_items = "".join(
        f'<a href="/{p["slug"]}.html"><span class="n">{p["num"]}</span>{e(p["name"])}</a>' for p in PILLARS)
    drawer_pages = "".join(f'<a href="/{f}">{e(label)}</a>' for f, label, key in NAVIGATION if key != "pillars")

    return f'''<header class="nav">
  <div class="shell shell--wide nav__in">
    <a class="brand" href="/" aria-label="HEXALIS — home">{MARK}<span class="brand__type">HEXALIS</span></a>
    <nav class="nav__links" aria-label="Primary">{links}</nav>
    <a class="nav__cta" href="/contact.html">Start a conversation</a>
    <button class="burger" aria-label="Menu" aria-expanded="false" aria-controls="drawer">
      <span></span><span></span><span></span>
    </button>
  </div>
</header>
<div class="mega" id="mega">
  <div class="shell shell--wide">
    <div class="mega__grid">{mega_items}</div>
    <div class="mega__foot">
      <span class="label label--mute">Six pillars · {N_STREAMS} workstreams · one accountable team</span>
      <a class="tlink" href="/pillars.html">All six, side by side {ARROW}</a>
    </div>
  </div>
</div>
<div class="drawer" id="drawer">
  {drawer_items}{drawer_pages}
</div>
'''


def footer():
    pill_links = "".join(f'<li><a href="/{p["slug"]}.html">{e(p["name"])}</a></li>' for p in PILLARS)
    co_links = "".join(f'<li><a href="/{f}">{e(label)}</a></li>' for f, label, key in NAVIGATION if key != "pillars")
    social = f'<li><a href="{SITE["instagram"]}" rel="me noopener" target="_blank">Instagram</a></li>' \
             f'<li><a href="{SITE["threads"]}" rel="me noopener" target="_blank">Threads</a></li>'
    return f'''<footer class="foot">
  <div class="shell shell--wide">
    <div class="foot__top">
      <div>
        <div class="foot__mark">{MARK.replace('class="brand__mark"', '')}<span class="brand__type">HEXALIS</span></div>
        <p class="body-mute" style="max-width:32ch">{e(SITE['tagline'])}</p>
        <a class="cta__mail" style="display:inline-block;margin-top:16px;font-size:1.1rem" href="mailto:{SITE['email']}">{SITE['email']}</a>
      </div>
      <div><h5>Pillars</h5><ul>{pill_links}</ul></div>
      <div><h5>Company</h5><ul>{co_links}</ul></div>
      <div><h5>Elsewhere</h5><ul>{social}</ul></div>
    </div>
    <div class="foot__bar">
      <span>© {YEAR} HEXALIS. All rights reserved.</span>
      <span>{SITE['domain']}</span>
    </div>
  </div>
</footer>
<script src="{asset("/assets/js/site.js")}" defer></script>
</body>
</html>'''


# ---------------------------------------------------------------------------
# Reusable sections
# ---------------------------------------------------------------------------
def inner_hero(kicker, title, tagline, lede="", crumb="", ico="", kick="", extra_class=""):
    crumbs = ""
    if crumb:
        crumbs = (f'<div class="crumbs" style="margin-bottom:26px"><a href="/">HEXALIS</a>'
                  f'<span>/</span>{crumb}</div>')
    right = f'<div class="phero__ico" aria-hidden="true">{icon(ico)}</div>' if ico else ""
    kick_html = f'<div class="phero__kick">{e(kick)}</div>' if kick else ""
    lede_html = f'<p class="lede phero__purpose">{lede}</p>' if lede else ""
    return f'''<section class="phero {extra_class}">
    <canvas class="js-lattice phero__canvas" aria-hidden="true"></canvas>
    <div class="shell shell--wide">
      {crumbs}
      <div class="phero__in">
        <div>
          <div class="phero__num">{e(kicker)}</div>
          <h1 data-words>{title}</h1>
          <p class="phero__tag">{e(tagline)}</p>
          {kick_html}
        </div>
        {right}
      </div>
      {lede_html}
    </div>
  </section>'''


def sec_strip():
    cells = "".join(f'''
      <a href="/{p['slug']}.html">
        <div class="n">{p['num']}</div>
        <div class="ic">{icon(p['icon'])}</div>
        <h3>{e(p['name'])}</h3>
        <p>{e(p['tagline'])}</p>
      </a>''' for p in PILLARS)
    return f'<div class="strip" data-rise>{cells}</div>'


def sec_prows():
    return '<div class="plist">' + "".join(f'''
    <a class="prow" href="/{p['slug']}.html" data-rise data-d="{min(i, 5)}">
      <div class="prow__n">{p['num']}</div>
      <div class="prow__name">
        <h3>{e(p['name'])}</h3>
        <span class="kicker">{e(p['outcome'])}</span>
      </div>
      <p class="prow__desc">{e(p['core'])}</p>
      <span class="prow__go" aria-hidden="true">{ARROW}</span>
    </a>''' for i, p in enumerate(PILLARS)) + '</div>'


def sec_doors(items):
    cells = "".join(f'''
      <a class="door" href="/{href}" data-rise data-d="{i}">
        <div>
          <div class="k">{e(k)}</div>
          <h3>{e(t)}</h3>
          <p>{e(b)}</p>
        </div>
        <span class="go">{e(cta)} {ARROW}</span>
      </a>''' for i, (href, k, t, b, cta) in enumerate(items))
    return f'<div class="doors">{cells}</div>'


def sec_ticker():
    items = "".join(f"<span>{e(s[0])}</span>" for p in PILLARS for s in p["streams"])
    return f'<div class="ticker" aria-hidden="true"><div class="ticker__in">{items}{items}</div></div>'


def sec_modes():
    return '<div class="modes">' + "".join(f'''
      <article class="mode" data-rise data-d="{min(i, 3)}">
        <div class="mode__k">{e(k)}</div>
        <div><h4>{e(name)}</h4><p>{e(body)}</p></div>
      </article>''' for i, (name, k, body) in enumerate(MODES)) + '</div>'


def sec_steps():
    return '<div class="steps">' + "".join(f'''
      <article class="step" data-rise data-d="{min(i, 3)}">
        <h4>{e(t)}</h4><p>{e(b)}</p>
      </article>''' for i, (t, b) in enumerate(PROCESS)) + '</div>'


def sec_scenarios():
    tabs = "".join(f'''<button class="scn__tab" data-scn-tab="{s['id']}" role="tab"
        aria-selected="{'true' if i == 0 else 'false'}" tabindex="{'0' if i == 0 else '-1'}">{e(s['label'])}</button>'''
                   for i, s in enumerate(SCENARIOS))
    panels = ""
    for i, s in enumerate(SCENARIOS):
        moves = "".join(f'''
        <article class="move">
          <div class="move__top">
            <span class="move__ico">{icon(BY_SLUG[slug]['icon'])}</span>
            <span class="move__pil">{e(BY_SLUG[slug]['num'])} · {e(BY_SLUG[slug]['name'])}</span>
          </div>
          <h4>{e(t)}</h4>
          <p>{e(d)}</p>
        </article>''' for slug, t, d in s["moves"])
        panels += f'''
      <div class="scn__panel{' is-active' if i == 0 else ''}" data-scn-panel="{s['id']}" role="tabpanel">
        <p class="lede scn__summary">{e(s['summary'])}</p>
        <div class="moves">{moves}</div>
      </div>'''
    return f'<div class="scn__tabs" role="tablist" aria-label="Client situations" data-rise>{tabs}</div>{panels}'


def cta_band(title="Bring us the part of the business that is not working.",
             body="One conversation, no deck. If HEXALIS is not the right answer, we will tell you that too."):
    return f'''<section class="cta pad">
  <div class="shell shell--wide cta__in">
    <div>
      <div class="label-rule"><span class="label">Start here</span></div>
      <h2 class="t-xl" data-words>{e(title)}</h2>
      <p class="lede" data-rise data-d="1" style="max-width:46ch;margin-top:22px">{e(body)}</p>
      <div style="margin-top:34px" data-rise data-d="2">
        <a class="btn" href="/contact.html"><span>Start a conversation</span>{ARROW}</a>
      </div>
    </div>
    <div class="cta__meta" data-rise data-d="2">
      <div>
        <div class="label label--mute">Write to us</div>
        <a class="cta__mail" href="mailto:{SITE['email']}">{SITE['email']}</a>
      </div>
      <div>
        <div class="label label--mute">Follow</div>
        <p style="margin-top:8px"><a class="tlink" href="{SITE['instagram']}" target="_blank" rel="noopener">Instagram {ARROW}</a></p>
      </div>
    </div>
  </div>
</section>'''


# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------
def page_index():
    schema = '''<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Organization","name":"HEXALIS","url":"https://hexalis.in",
"slogan":"Empowering Business. Enabling Possibilities.","email":"ContactUs@hexalis.in",
"description":"A six-pillar enterprise delivering technology, strategy, growth, engagement, workplace and commerce solutions from one accountable team.",
"sameAs":["https://www.instagram.com/hexalis.in","https://www.threads.com/@hexalis.in"]}
</script>
'''
    doors = sec_doors([
        ("pillars.html", "The six", "What we do",
         "Technology, Strategy, Growth, Engagement, Workplace and Commerce — six capabilities, each able to stand on its own.",
         "See the six"),
        ("model.html", "The model", "Why one partner",
         "Six vendors, six briefs, six versions of your brand — or one relationship that owns the whole. The argument for doing it this way.",
         "Read the argument"),
        ("approach.html", "How we work", "How we engage",
         "Advisory, project, embedded or managed. Four commercial shapes, four stages, and the principles we hold to.",
         "Read the approach"),
    ])

    return head(
        "HEXALIS — One partner. Every side of your business.",
        SITE["description"], "index.html", schema
    ) + nav() + f'''
<main id="main">

  <section class="hero">
    {CANVAS}
    <div class="shell shell--wide hero__in" data-par="0.1">
      <div class="hero__eyebrow"><span class="label">{e(SITE['tagline'])}</span></div>
      <h1 class="t-hero">
        <span class="ln reveal-line"><span>One partner.</span></span>
        <span class="ln reveal-line"><span>Every <span class="accent">side</span> of</span></span>
        <span class="ln reveal-line"><span>your business.</span></span>
      </h1>
      <p class="lede hero__lede" data-rise data-d="3">
        HEXALIS is a six-pillar enterprise. Technology, strategy, brand growth, experiences,
        workplace and commerce — arriving from one accountable team, not six vendors who have
        never met each other.
      </p>
      <div class="hero__foot">
        <div class="hero__stats" data-rise data-d="4">
          <div class="stat"><span class="n" data-count="6">06</span><span class="k">Pillars</span></div>
          <div class="stat"><span class="n" data-count="{N_STREAMS}">{N_STREAMS}</span><span class="k">Workstreams</span></div>
          <div class="stat"><span class="n" data-count="1">01</span><span class="k">Point of accountability</span></div>
        </div>
        <div class="scrollcue" aria-hidden="true"><i></i>Begin</div>
      </div>
    </div>
  </section>

  {sec_ticker()}

  <section class="pad">
    <div class="gridlines" aria-hidden="true"></div>
    <div class="shell shell--wide above">
      <div class="label-rule"><span class="label">The six pillars</span><span class="num">{N_STREAMS} workstreams</span></div>
      <div class="grid g-12" style="align-items:end;margin-bottom:clamp(28px,4vw,48px)">
        <div class="span-7"><h2 class="t-xl" data-words>Six sides of one business.</h2></div>
        <div class="span-5"><p class="lede" data-rise data-d="1">
          Each stands on its own. Together they cover the whole surface of what a modern
          organization has to buy.</p></div>
      </div>
      {sec_strip()}
      <div style="margin-top:clamp(30px,4vw,44px)" data-rise data-d="1">
        <a class="tlink" href="/pillars.html">All six, side by side {ARROW}</a>
      </div>
    </div>
  </section>

  <section class="pad-b">
    <div class="shell shell--wide">
      <div class="label-rule"><span class="label">Where to go next</span></div>
      {doors}
    </div>
  </section>

  {cta_band()}
</main>
''' + footer()


def page_pillars():
    return head("The six pillars of HEXALIS",
                "Technology, Strategy, Growth, Engagement, Workplace and Commerce — the six HEXALIS pillars and the "
                f"{N_STREAMS} workstreams inside them.",
                "pillars.html") + nav("pillars") + f'''
<main id="main">
  {inner_hero("The Six Pillars", "Hexalis.<br>Six sides of one business.", "Hex — six. A shape that only holds because every side does its part.",
              lede="Each pillar has its own leadership, standards and economics. They share one client relationship, one standard of delivery and one point of accountability. Take the wheel a segment at a time.",
              crumb='<span style="color:var(--cyan)">Pillars</span>')}

  <section class="pad">
    <div class="gridlines" aria-hidden="true"></div>
    <div class="shell shell--wide above">
      <div class="wheel-wrap" data-rise>
        {hexwheel()}
        <div class="wpanel">{wheel_panels()}</div>
      </div>
    </div>
  </section>

  <section class="pad-b">
    <div class="shell shell--wide">
      <div class="label-rule"><span class="label">One at a time</span></div>
      {sec_prows()}
    </div>
  </section>

  {cta_band("Not sure which pillar you need?",
            "Most people are not. Describe the problem and we will tell you which of the six actually applies — and which do not.")}
</main>
''' + footer()


def page_model():
    fragmented = "".join(f'<li><i>{n + 1:02d}</i>{e(x)}</li>' for n, x in enumerate(CONTRAST["fragmented"]))
    integrated = "".join(f'<li><i>{n + 1:02d}</i>{e(x)}</li>' for n, x in enumerate(CONTRAST["integrated"]))

    return head("The model — why one partner, not six vendors",
                "Most companies buy capability in fragments. HEXALIS is built as one relationship with six capabilities: the argument, the vision and the mission behind the model.",
                "model.html") + nav("model") + f'''
<main id="main">
  {inner_hero("The Model", "Most companies buy capability in fragments.", "Six suppliers. Six briefs. Six versions of your brand.",
              lede="It is not that any one of them is bad. It is that nobody owns the whole — and the gaps between vendors are exactly where budgets, timelines and brand consistency go to die.",
              crumb='<span style="color:var(--cyan)">The Model</span>')}

  <section class="paper pad">
    <div class="shell shell--wide">
      <div class="label-rule"><span class="label">The comparison</span></div>
      <div class="compare" data-rise>
        <div class="compare__col">
          <span class="label label--mute">The usual way</span>
          <h3>Six vendors, one headache</h3>
          <ul>{fragmented}</ul>
        </div>
        <div class="compare__col compare__col--us">
          <span class="label">The HEXALIS way</span>
          <h3>One relationship, six capabilities</h3>
          <ul>{integrated}</ul>
        </div>
      </div>
      <p class="pull" style="margin-top:clamp(44px,7vw,88px)" data-words>
        We are not a holding company with six logos.
        <span class="accent">We are one team with six disciplines.</span>
      </p>
    </div>
  </section>

  <section class="pad">
    <div class="shell shell--wide">
      <div class="vm">
        <div class="vm__item" data-rise>
          <div class="label-rule"><span class="label">Vision</span></div>
          <p>{e(ENTERPRISE['vision'])}</p>
        </div>
        <div class="vm__item" data-rise data-d="1">
          <div class="label-rule"><span class="label">Mission</span></div>
          <p>{e(ENTERPRISE['mission'])}</p>
        </div>
      </div>
      <div style="margin-top:clamp(38px,5vw,64px);display:flex;gap:32px;flex-wrap:wrap" data-rise data-d="2">
        <a class="tlink" href="/pillars.html">See the six pillars {ARROW}</a>
        <a class="tlink" href="/about.html">The strategic goals behind it {ARROW}</a>
      </div>
    </div>
  </section>

  {cta_band()}
</main>
''' + footer()


# In Practice is offline for now: removed from the nav, the build and the
# sitemap, and old links redirect to /model (see netlify.toml). The page and its
# scenarios are kept intact — to bring it back, re-add it to NAVIGATION and to
# the pages dict in main().
def page_practice():
    return head("In practice — one brief, six pillars",
                "What an integrated HEXALIS engagement looks like for a company entering a new market, an enterprise annual cycle, a funded scale-up and a founder-led business.",
                "practice.html") + nav("practice") + f'''
<main id="main">
  {inner_hero("In Practice", "One brief. Six pillars.", "What it looks like when a client uses all of it.",
              lede="Nobody buys six pillars on day one. But when the second, third and fourth need appear — and they always do — you are not starting a procurement cycle from zero. Pick a situation.",
              crumb='<span style="color:var(--cyan)">In Practice</span>')}

  <section class="pad">
    <div class="shell shell--wide">
      {sec_scenarios()}
    </div>
  </section>

  <section class="pad-b">
    <div class="shell shell--wide">
      <div class="label-rule"><span class="label label--sand">However it starts</span></div>
      <div class="grid g-12" style="margin-bottom:clamp(24px,3vw,38px)">
        <div class="span-7"><h2 class="t-lg" data-words>Every engagement moves the same way.</h2></div>
      </div>
      {sec_steps()}
    </div>
  </section>

  {cta_band("Tell us the shape of your year.",
            "Bring the calendar, the budget lines and the thing that went wrong last time. We will map it against the six.")}
</main>
''' + footer()


def page_approach():
    faqs = "".join(f'''
      <div class="acc__item">
        <h3><button class="acc__btn" aria-expanded="false" aria-controls="faq-{i}">
          <span>{e(q)}</span><span class="pm" aria-hidden="true"></span>
        </button></h3>
        <div class="acc__panel" id="faq-{i}"><p>{e(a)}</p></div>
      </div>''' for i, (q, a) in enumerate(FAQS))

    principles = [
        ("Accountability is not shared", "One relationship owner across every pillar you use. When something goes wrong there is no round of emails establishing whose problem it is."),
        ("Strategy that survives contact", "We connect recommendation to execution. If we propose it, we are prepared to be in the room when it is built."),
        ("Asset-light where it should be", "We own the client, concept, project and quality bar. Production infrastructure, manufacturing and fulfilment come from a vetted partner ecosystem."),
        ("Evidence before capital", "Particularly in commerce: validate demand at small cost, then commit. Spend on evidence, not on optimism."),
        ("Built for the second year", "Retainers, managed services and embedded talent are not upsells. They are the point — the relationship should be worth more in year three than in year one."),
        ("We will say no", "Six pillars is a capability, not a quota. If a pillar does not apply to your problem, we will leave it out of the proposal."),
    ]
    prin = "".join(f'''
      <article class="goal" data-rise data-d="{min(i, 3)}">
        <div class="g-n">P{i + 1}</div><h4>{e(t)}</h4><p>{e(b)}</p>
      </article>''' for i, (t, b) in enumerate(principles))

    return head("Approach — how a HEXALIS engagement works",
                "Four ways to engage HEXALIS, the principles behind an integrated six-pillar model, and the questions people ask first.",
                "approach.html") + nav("approach") + f'''
<main id="main">
  {inner_hero("How We Work", "Six pillars.<br>One way of working.", "Structure is the product.",
              lede="An integrated model is easy to claim and hard to run. This is the machinery underneath it: how engagements are shaped, and what we hold ourselves to when four pillars are working on the same account at once.",
              crumb='<span style="color:var(--cyan)">Approach</span>')}

  <section class="pad">
    <div class="shell shell--wide">
      <div class="label-rule"><span class="label">Engagement models</span><span class="num">Four shapes</span></div>
      <div class="grid g-12" style="align-items:end;margin-bottom:clamp(26px,3.6vw,44px)">
        <div class="span-7"><h2 class="t-xl" data-words>Four ways to work with us.</h2></div>
        <div class="span-5"><p class="lede" data-rise data-d="1">
          The commercial shape follows the problem, not the other way around.</p></div>
      </div>
      {sec_modes()}
    </div>
  </section>

  <section class="paper pad">
    <div class="shell shell--wide">
      <div class="label-rule"><span class="label">Principles</span></div>
      <div class="grid g-12" style="margin-bottom:clamp(26px,3.6vw,42px)">
        <div class="span-7"><h2 class="t-xl" data-words>What we hold ourselves to.</h2></div>
      </div>
      <div class="goals">{prin}</div>
    </div>
  </section>

  <section class="pad">
    <div class="shell shell--wide">
      <div class="grid g-12" style="align-items:start">
        <div class="span-4">
          <div class="label-rule"><span class="label">Questions</span></div>
          <h2 class="t-lg" data-words>The things people ask first.</h2>
        </div>
        <div class="span-8">
          <div class="acc">{faqs}</div>
        </div>
      </div>
    </div>
  </section>

  {cta_band("Thirty minutes, no deck.",
            "Tell us what is actually in the way. We will tell you whether HEXALIS is the right answer.")}
</main>
''' + footer()


def page_about():
    goals = "".join(f'''
      <article class="goal" data-rise data-d="{min(i, 3)}">
        <div class="g-n">{i + 1:02d}</div><h4>{e(t)}</h4><p>{e(b)}</p>
      </article>''' for i, (t, b) in enumerate(ENTERPRISE["goals"]))

    return head("About HEXALIS — the six-pillar enterprise",
                "The name, the vision, the mission and the strategic goals behind HEXALIS: a six-pillar enterprise built to serve every side of a business from one accountable team.",
                "about.html") + nav("about") + f'''
<main id="main">
  {inner_hero("The Enterprise", "Built as six.<br>Sold as one.", SITE['tagline'],
              lede="HEXALIS exists because the way businesses buy capability has not kept up with the way businesses actually work. A brand problem is usually a strategy problem. A hiring problem is usually a technology problem. The launch, the platform, the campaign and the kit on the new joiner's desk are one story — but they are almost always bought from six different people.",
              crumb='<span style="color:var(--cyan)">About</span>')}

  <section class="paper pad">
    <div class="shell shell--wide">
      <div class="label-rule"><span class="label">The name</span></div>
      <div class="grid g-12" style="align-items:start">
        <div class="span-6">
          <h2 class="t-xl" data-words>Hex — six. And a shape that only holds because every side does its part.</h2>
        </div>
        <div class="span-6" data-rise data-d="1">
          <p class="lede">
            The hexagon is the most efficient shape in nature for covering an area completely,
            with no wasted space and no weak side. That is the organizing idea of this business.
          </p>
          <p class="lede" style="margin-top:18px">
            Six pillars, each strong enough to stand alone, arranged so that together they cover
            the whole surface of what a modern organization needs — from the boardroom decision
            down to the delegate kit at the conference.
          </p>
        </div>
      </div>
    </div>
  </section>

  <section class="pad">
    <div class="shell shell--wide">
      <div class="vm">
        <div class="vm__item" data-rise>
          <div class="label-rule"><span class="label">Vision</span></div>
          <p>{e(ENTERPRISE['vision'])}</p>
        </div>
        <div class="vm__item" data-rise data-d="1">
          <div class="label-rule"><span class="label">Mission</span></div>
          <p>{e(ENTERPRISE['mission'])}</p>
        </div>
      </div>
    </div>
  </section>

  <section class="pad-b">
    <div class="shell shell--wide">
      <div class="label-rule"><span class="label">Strategic goals</span><span class="num">Enterprise level</span></div>
      <div class="grid g-12" style="margin-bottom:clamp(24px,3.4vw,42px)">
        <div class="span-7"><h2 class="t-xl" data-words>What we are building towards.</h2></div>
      </div>
      <div class="goals">{goals}</div>
    </div>
  </section>

  {cta_band()}
</main>
''' + footer()


def page_pillar(p, prev_p, next_p):
    streams = "".join(f'''
      <div class="srow" data-rise>
        <div class="n">{i + 1:02d}</div>
        <h4>{e(name)}</h4>
        <p>{e(ex)}</p>
      </div>''' for i, (name, ex) in enumerate(p["streams"]))

    goals = "".join(f'''
      <article class="goal" data-rise data-d="{min(i, 3)}">
        <div class="g-n">G{i + 1}</div>
        <p style="color:var(--text);font-size:1.04rem">{e(g)}</p>
      </article>''' for i, g in enumerate(p["goals"]))

    rungs = '<span class="sep">→</span>'.join(f'<span class="rung">{e(r)}</span>' for r in p["ladder"])

    crumb = (f'<a href="/pillars.html">Pillars</a><span>/</span>'
             f'<span style="color:var(--cyan)">{e(p["name"])}</span>')

    return head(
        f"{p['name']} — {p['tagline']} | HEXALIS",
        p["core"], f"{p['slug']}.html"
    ) + nav("pillars") + f'''
<main id="main">
  {inner_hero(f"Pillar {p['num']} — {p['outcome']}", e(p['name'].upper()), p['tagline'],
              lede=e(p['purpose']), crumb=crumb, ico=p['icon'], kick=p['kicker'])}

  <section class="pad">
    <div class="shell shell--wide">
      <div class="vm">
        <div class="vm__item" data-rise>
          <div class="label-rule"><span class="label">Vision</span></div>
          <p>{e(p['vision'])}</p>
        </div>
        <div class="vm__item" data-rise data-d="1">
          <div class="label-rule"><span class="label">Mission</span></div>
          <p>{e(p['mission'])}</p>
        </div>
      </div>
      <div style="margin-top:clamp(40px,5.6vw,72px)">
        <div class="label-rule"><span class="label">Strategic goals</span></div>
        <div class="goals">{goals}</div>
      </div>
    </div>
  </section>

  <section class="pad" style="background:var(--ink-2);border-block:1px solid var(--line)">
    <div class="gridlines" aria-hidden="true"></div>
    <div class="shell shell--wide above">
      <div class="label-rule"><span class="label">Workstreams</span><span class="num">{len(p['streams'])} in this pillar</span></div>
      <div class="grid g-12" style="margin-bottom:clamp(22px,3vw,38px)">
        <div class="span-7"><h2 class="t-lg" data-words>{e(p['pull'])}</h2></div>
      </div>
      <div class="streams">{streams}</div>
    </div>
  </section>

  <section class="pad">
    <div class="shell shell--wide">
      <div class="grid g-12" style="align-items:start">
        <div class="span-5">
          <div class="label-rule"><span class="label label--sand">{e(p['ladder_title'])}</span></div>
          <div class="ladder" data-rise>{rungs}</div>
        </div>
        <div class="span-7">
          <p class="lede" data-rise data-d="1" style="max-width:54ch">{e(p['ladder_note'])}</p>
        </div>
      </div>
    </div>
  </section>

  <section class="pad-b">
    <div class="shell shell--wide">
      <div class="label-rule"><span class="label">Continue</span></div>
      <div class="pnext">
        <a href="/{prev_p['slug']}.html">
          <div class="k">← Pillar {prev_p['num']}</div>
          <h4>{e(prev_p['name'])}</h4>
          <p class="body-mute it" style="margin-top:10px;font-size:.96rem">{e(prev_p['tagline'])}</p>
        </a>
        <a href="/{next_p['slug']}.html" class="r">
          <div class="k">Pillar {next_p['num']} →</div>
          <h4>{e(next_p['name'])}</h4>
          <p class="body-mute it" style="margin-top:10px;font-size:.96rem">{e(next_p['tagline'])}</p>
        </a>
      </div>
    </div>
  </section>

  {cta_band(f"Need {p['name'].lower()} — and probably more than that?",
            "Tell us the problem in plain language. We will tell you which pillars actually apply, and which do not.")}
</main>
''' + footer()


def page_contact():
    wa_link = f"https://wa.me/{SITE['whatsapp']}?text={quote(SITE['whatsapp_message'], safe='')}"
    picks = "".join(f'''<label class="pick"><input type="checkbox" name="pillar" value="{e(p['name'])}">
      <span>{e(p['name'])}</span></label>''' for p in PILLARS)

    return head("Contact HEXALIS",
                "Start a conversation with HEXALIS. Tell us the business problem and we will tell you which of the six pillars actually applies.",
                "contact.html") + nav("contact") + f'''
<main id="main">
  {inner_hero("Start a Conversation", "Tell us what is<br>in the way.", "Thirty minutes. No deck.",
              crumb='<span style="color:var(--cyan)">Contact</span>')}

  <section class="pad">
    <div class="shell shell--wide">
      <div class="grid g-12" style="align-items:start">
        <div class="span-7">
          <div class="label-rule"><span class="label">Project brief</span></div>
          <form class="form" id="brief" data-to="{SITE['email']}" novalidate>
            <div class="grid g-2" style="gap:22px">
              <div class="field"><label for="f-name">Your name</label><input id="f-name" name="name" required autocomplete="name"></div>
              <div class="field"><label for="f-company">Company</label><input id="f-company" name="company" autocomplete="organization"></div>
            </div>
            <div class="grid g-2" style="gap:22px">
              <div class="field"><label for="f-email">Email</label><input id="f-email" name="email" type="email" required autocomplete="email"></div>
              <div class="field"><label for="f-phone">Phone (optional)</label><input id="f-phone" name="phone" type="tel" autocomplete="tel"></div>
            </div>
            <div class="field">
              <label>Which pillars might apply?</label>
              <div class="picks">{picks}</div>
            </div>
            <div class="field">
              <label for="f-timeline">Timeline</label>
              <select id="f-timeline" name="timeline">
                <option value="">Select one</option>
                <option>Urgent — this month</option>
                <option>This quarter</option>
                <option>Next two quarters</option>
                <option>Exploring for now</option>
              </select>
            </div>
            <div class="field">
              <label for="f-message">What are you trying to solve?</label>
              <textarea id="f-message" name="message" required placeholder="The business problem, what has already been tried, and what success would look like."></textarea>
            </div>
            <div>
              <button class="btn" type="submit"><span>Send the brief</span>{ARROW}</button>
              <p class="body-mute" id="brief-note" hidden style="margin-top:16px;font-size:.92rem">
                Your email app should now be open with the brief filled in. If it did not open,
                write to <a class="tlink" href="mailto:{SITE['email']}">{SITE['email']}</a> directly.
              </p>
              <p class="body-mute" style="margin-top:16px;font-size:.88rem">
                This form opens your own email app with the details filled in — nothing is stored on this site.
              </p>
            </div>
          </form>
        </div>

        <div class="span-5">
          <div class="label-rule"><span class="label">Direct</span></div>
          <a class="cta__mail" href="mailto:{SITE['email']}">{SITE['email']}</a>
          <p class="body-dim" style="margin-top:20px;max-width:36ch">
            Whichever pillar you think you need, this is the address. It reaches the same people.
          </p>

          <div style="margin-top:34px">
            <a class="wa__btn" href="{e(wa_link)}" target="_blank" rel="noopener"
               aria-label="Chat with HEXALIS on WhatsApp">
              {WHATSAPP_ICON}
              <span><span class="wa__k">WhatsApp</span><span class="wa__n">{e(SITE['whatsapp_display'])}</span></span>
              {ARROW}
            </a>
            <p class="body-mute" style="margin-top:12px;font-size:.9rem;max-width:36ch">
              Opens a chat with a short message already written — just press send.
            </p>
          </div>

          <div style="margin-top:44px">
            <div class="label-rule"><span class="label">Elsewhere</span></div>
            <p style="margin-bottom:16px"><a class="tlink" href="{SITE['instagram']}" target="_blank" rel="noopener">Instagram — @hexalis.in {ARROW}</a></p>
            <p><a class="tlink" href="{SITE['threads']}" target="_blank" rel="noopener">Threads — @hexalis.in {ARROW}</a></p>
          </div>

          <div style="margin-top:44px">
            <div class="label-rule"><span class="label">Good first messages</span></div>
            <ul class="stack-sm body-dim it" style="font-size:1.02rem">
              <li>“We have a strategy deck nobody has executed.”</li>
              <li>“We are opening in India in nine months.”</li>
              <li>“Our gifting runs late every single year.”</li>
              <li>“We need four engineers and we cannot hire fast enough.”</li>
              <li>“Marketing spends, and nobody can tell me what it returned.”</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </section>
</main>
''' + footer()


def careers_mailto(role_title=""):
    """An inquiry that arrives already labelled, so nothing has to be chased."""
    if role_title:
        subject = f"Inquiry \u2014 {role_title}"
        body = (f"Hi HEXALIS,\n\nI would like to inquire about the {role_title} position "
                f"listed on hexalis.in.\n\nName:\nCurrent location:\nExperience:\n"
                f"Notice period:\nPortfolio / LinkedIn:\n\n(Please attach your CV.)\n")
    else:
        subject = "Inquiry \u2014 careers at HEXALIS"
        body = ("Hi HEXALIS,\n\nI would like to inquire about opportunities at HEXALIS.\n\n"
                "Name:\nRole of interest:\nCurrent location:\nExperience:\n"
                "Portfolio / LinkedIn:\n\n(Please attach your CV.)\n")
    return (f"mailto:{SITE['careers_email']}?subject={quote(subject, safe='')}"
            f"&body={quote(body, safe='')}")


def inquire_btn(role_title="", ghost=False):
    cls = "btn btn--ghost" if ghost else "btn"
    return (f'<a class="{cls}" href="{e(careers_mailto(role_title))}">'
            f'<span>Inquire now</span>{ARROW}</a>')


def page_careers():
    roles = ""
    for i, r in enumerate(ROLES):
        meta = [r["type"], r["experience"], r["work_model"], r["location"]]
        if r["extra"]:
            meta.append(r["extra"])
        chips = "".join(f'<span>{e(m)}</span>' for m in meta)

        resp = ""
        for item in r["responsibilities"]:
            if isinstance(item, tuple):
                subs = "".join(f'<li>{e(x)}</li>' for x in item[1])
                resp += f'<li>{e(item[0])}<ul class="role__sub">{subs}</ul></li>'
            else:
                resp += f'<li>{e(item)}</li>'

        note = (f'<p class="role__note">{e(r["note"])}</p>') if r["note"] else ""
        tags = "".join(f'<span class="chip">{e(t)}</span>' for t in r["preferred"])

        roles += f'''
      <article class="role" id="{r['slug']}">
        <div class="role__head">
          <div>
            <div class="role__n">{i + 1:02d}</div>
            <h3>{e(r['title'])}</h3>
          </div>
        </div>
        <div class="role__meta">{chips}</div>
        <p class="role__sum">{e(r['summary'])}</p>
        <div class="role__actions">
          <button class="acc__btn role__more" aria-expanded="false" aria-controls="role-{r['slug']}">
            <span class="is-closed">Know more</span><span class="is-open">Hide details</span>
            <span class="pm" aria-hidden="true"></span>
          </button>
          {inquire_btn(r['title'])}
        </div>
        <div class="acc__panel role__detail" id="role-{r['slug']}">
          <div class="role__detail-in">
            <h4>The role</h4>
            {"".join(f"<p>{e(x)}</p>" for x in r["role"])}
            <h4>Key responsibilities</h4>
            <ul>{resp}</ul>
            <h4>Candidate profile</h4>
            <ul>{"".join(f"<li>{e(x)}</li>" for x in r["profile"])}</ul>
            {note}
            <h4>Preferred experience</h4>
            <p class="body-mute">{e(r["preferred_intro"])}</p>
            <div class="chips">{tags}</div>
            <div class="role__foot">{inquire_btn(r['title'])}</div>
          </div>
        </div>
      </article>'''

    return head("Careers at HEXALIS — open positions",
                f"{len(ROLES)} open positions at HEXALIS in Gurugram, across business development, events, "
                f"digital marketing, creative and the Founder's Office.",
                "careers.html") + nav("careers") + f'''
<main id="main">
  {inner_hero("Careers", "Six pillars.<br>One team building them.",
              "Open positions at HEXALIS.",
              lede="HEXALIS is early enough that the person doing the work shapes how it gets done. These are the roles we are hiring for right now, all based in Gurugram. Open a role to read the full brief, or write to us directly.",
              crumb='<span style="color:var(--cyan)">Careers</span>')}

  <section class="pad">
    <div class="shell shell--wide">
      <div class="label-rule"><span class="label">Open positions</span><span class="num">{len(ROLES)} roles</span></div>
      <div class="grid g-12" style="align-items:end;margin-bottom:clamp(26px,3.6vw,44px)">
        <div class="span-7"><h2 class="t-lg" data-words>Every role here works across more than one pillar.</h2></div>
        <div class="span-5" style="justify-self:start">
          <p class="body-dim" style="margin-bottom:20px;max-width:40ch">Not sure which role fits? Write to us and say what you do.</p>
          {inquire_btn(ghost=True)}
        </div>
      </div>
      <div class="roles">{roles}</div>
    </div>
  </section>

  <section class="cta pad">
    <div class="shell shell--wide cta__in">
      <div>
        <div class="label-rule"><span class="label">Apply</span></div>
        <h2 class="t-xl" data-words>Tell us what you would want to own.</h2>
        <p class="lede" data-rise data-d="1" style="max-width:48ch;margin-top:22px">
          Send a CV, a portfolio, or just a note about the work you want to do. Every inquiry reaches the same inbox.
        </p>
        <div style="margin-top:34px" data-rise data-d="2">{inquire_btn()}</div>
      </div>
      <div class="cta__meta" data-rise data-d="2">
        <div>
          <div class="label label--mute">Careers inbox</div>
          <a class="cta__mail" href="mailto:{SITE['careers_email']}">{SITE['careers_email']}</a>
        </div>
        <div>
          <div class="label label--mute">Location</div>
          <p style="font-size:.98rem">Gurugram, Haryana</p>
        </div>
      </div>
    </div>
  </section>
</main>
''' + footer()


def page_404():
    return head("Page not found — HEXALIS", "That page does not exist.", "404.html") + nav() + f'''
<main id="main">
  <section class="phero" style="min-height:74vh;display:flex;align-items:center">
    <canvas class="js-lattice phero__canvas" aria-hidden="true"></canvas>
    <div class="shell shell--wide">
      <div class="phero__num">Error 404</div>
      <h1 style="font-size:clamp(2.6rem,7.6vw,5.6rem);margin:18px 0" data-words>This side of the hexagon is missing.</h1>
      <p class="lede" style="max-width:46ch">The page you were after is not here. The other six are.</p>
      <div style="margin-top:34px"><a class="btn" href="/"><span>Back to HEXALIS</span>{ARROW}</a></div>
    </div>
  </section>
</main>
''' + footer()


# ---------------------------------------------------------------------------
# Extras
# ---------------------------------------------------------------------------
def favicon():
    """The mark on the site's own ground, so the tab icon matches the header."""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">'
            f'<rect width="120" height="120" rx="16" fill="#03080a"/>'
            f'<g transform="translate(23.1 10) scale(0.8)">'
            f'<path d="{LOGO_PATH}" fill="#4fe4f2"/></g></svg>')


def sitemap(pages):
    urls = "".join(
        f'  <url><loc>{SITE["url"]}{"/" if p == "index.html" else "/" + p}</loc>'
        f'<lastmod>{BUILT}</lastmod>'
        f'<priority>{"1.0" if p == "index.html" else "0.8"}</priority></url>\n'
        for p in pages if p != "404.html")
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '</urlset>\n')


def main():
    pages = {
        "index.html": page_index(),
        "pillars.html": page_pillars(),
        "model.html": page_model(),
        "approach.html": page_approach(),
        "about.html": page_about(),
        "contact.html": page_contact(),
        "careers.html": page_careers(),
        "404.html": page_404(),
    }
    for i, p in enumerate(PILLARS):
        prev_p = PILLARS[(i - 1) % len(PILLARS)]
        next_p = PILLARS[(i + 1) % len(PILLARS)]
        pages[f"{p['slug']}.html"] = page_pillar(p, prev_p, next_p)

    for name, markup in pages.items():
        with open(os.path.join(HERE, name), "w", encoding="utf-8") as f:
            f.write(markup)

    with open(os.path.join(HERE, "assets/img/favicon.svg"), "w", encoding="utf-8") as f:
        f.write(favicon())
    with open(os.path.join(HERE, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write(sitemap(list(pages)))
    with open(os.path.join(HERE, "robots.txt"), "w", encoding="utf-8") as f:
        f.write(f"User-agent: *\nAllow: /\n\nSitemap: {SITE['url']}/sitemap.xml\n")

    # ---- assemble dist/: exactly what should be public, and nothing else ----
    # Dragging the project folder into Netlify uploads the source with it, which
    # is how build.py and content.py ended up readable at hexalis.in. This is the
    # folder to deploy.
    dist = os.path.join(HERE, "dist")
    shutil.rmtree(dist, ignore_errors=True)
    os.makedirs(dist)

    shutil.copytree(os.path.join(HERE, "assets"), os.path.join(dist, "assets"),
                    ignore=shutil.ignore_patterns("__pycache__", ".DS_Store"))
    for name in list(pages) + ["sitemap.xml", "robots.txt", "_headers", "netlify.toml"]:
        src = os.path.join(HERE, name)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(dist, name))

    # A zip of the same thing. Netlify's manual deploy accepts either a folder
    # drop or a zip, and a single file is far easier to hand to a file picker.
    # Files sit at the root of the archive, not nested under dist/.
    zip_path = os.path.join(HERE, "hexalis-site.zip")
    if os.path.exists(zip_path):
        os.remove(zip_path)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for dp, _, fs in os.walk(dist):
            for f in fs:
                full = os.path.join(dp, f)
                z.write(full, os.path.relpath(full, dist))

    n_files = sum(len(f) for _, _, f in os.walk(dist))
    size = sum(os.path.getsize(os.path.join(dp, f))
               for dp, _, fs in os.walk(dist) for f in fs)

    total = sum(len(v) for v in pages.values())
    print(f"built {len(pages)} pages  ·  {total // 1024} KB html  ·  {N_STREAMS} workstreams")
    for n in sorted(pages):
        print("   ", n)
    print(f"\ndist/            {n_files} files, {size // 1024} KB   (folder to deploy)")
    print(f"hexalis-site.zip  {os.path.getsize(zip_path) // 1024} KB   (same thing, for upload)")


if __name__ == "__main__":
    main()

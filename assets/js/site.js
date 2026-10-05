/* ==========================================================================
   HEXALIS — site.js
   No dependencies. Every page works with JavaScript switched off; this file
   only adds motion on top of markup that is already complete.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* --------------------------------------------------- page enter / leave -- */
  /* A short wipe between pages. It is what makes a multi-page site feel like
     one piece rather than six separate documents. */
  function transitions() {
    var curtain = document.createElement("div");
    curtain.className = "curtain";
    curtain.setAttribute("aria-hidden", "true");
    /* The mark is cloned from the header rather than drawn here, so the
       loading screen can never fall out of step with the real logo again
       (a hardcoded copy is exactly how the old outline mark survived). */
    var headerMark = $(".brand__mark");
    if (headerMark) {
      var mark = headerMark.cloneNode(true);
      mark.setAttribute("class", "curtain__mark");
      curtain.appendChild(mark);
    }
    document.body.appendChild(curtain);

    var enter = function () {
      root.classList.remove("is-leaving");
      root.classList.remove("is-entering");
    };
    requestAnimationFrame(enter);
    window.addEventListener("pageshow", function (e) { if (e.persisted) enter(); });

    if (reduced) return;

    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest ? e.target.closest("a") : null;
      if (!a) return;

      var href = a.getAttribute("href");
      if (!href || a.target === "_blank" || a.hasAttribute("download")) return;
      if (/^(mailto:|tel:|#)/.test(href)) return;
      if (a.origin !== window.location.origin) return;
      if (a.pathname === window.location.pathname && a.hash) return;   // in-page anchor

      e.preventDefault();
      root.classList.add("is-leaving");
      setTimeout(function () { window.location.href = a.href; }, 380);
      /* if the navigation is blocked or cancelled, put the page back */
      setTimeout(function () { root.classList.remove("is-leaving"); }, 3000);
    });
  }

  /* ---------------------------------------------------------------- nav -- */
  function nav() {
    var bar = $(".nav");
    if (!bar) return;

    var last = 0;
    var tick = function () {
      var y = window.pageYOffset;
      bar.classList.toggle("is-stuck", y > 24);
      /* the bar steps out of the way going down and returns going up */
      bar.classList.toggle("is-hidden", y > 420 && y > last && !$(".mega.is-open"));
      last = y;
    };
    tick();
    window.addEventListener("scroll", tick, { passive: true });

    var trigger = $("[data-mega-trigger]");
    var mega = $("#mega");
    if (trigger && mega) {
      var open = false, timer;
      var set = function (v) {
        open = v;
        mega.classList.toggle("is-open", v);
        trigger.setAttribute("aria-expanded", v ? "true" : "false");
      };
      if (window.matchMedia("(hover: hover) and (min-width: 981px)").matches) {
        var show = function () { clearTimeout(timer); set(true); };
        var hide = function () { timer = setTimeout(function () { set(false); }, 180); };
        trigger.addEventListener("mouseenter", show);
        trigger.addEventListener("mouseleave", hide);
        mega.addEventListener("mouseenter", show);
        mega.addEventListener("mouseleave", hide);
      }
      trigger.addEventListener("click", function (e) { e.preventDefault(); set(!open); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && open) { set(false); trigger.focus(); } });
      document.addEventListener("click", function (e) {
        if (open && !mega.contains(e.target) && !trigger.contains(e.target)) set(false);
      });
    }

    var burger = $(".burger"), drawer = $("#drawer");
    if (burger && drawer) {
      burger.addEventListener("click", function () {
        var v = !drawer.classList.contains("is-open");
        drawer.classList.toggle("is-open", v);
        burger.classList.toggle("is-open", v);
        burger.setAttribute("aria-expanded", v ? "true" : "false");
        document.body.style.overflow = v ? "hidden" : "";
        if (v) $$("a", drawer).forEach(function (a, i) { a.style.animationDelay = (i * 45) + "ms"; });
      });
    }
  }

  /* ------------------------------------------------------ word splitting -- */
  /* Headings marked data-words get one wrapper per word so they can rise in
     sequence. Done in JS so the markup stays plain text for crawlers, and it
     walks the tree rather than reading textContent so that <br> line breaks
     and inline accent spans survive intact. */
  function words() {
    if (reduced) return;

    function makeWord(text, i) {
      var w = document.createElement("span");
      w.className = "w";
      w.style.setProperty("--i", i);
      var inner = document.createElement("i");
      inner.textContent = text;
      w.appendChild(inner);
      return w;
    }

    function walk(el, counter) {
      Array.prototype.slice.call(el.childNodes).forEach(function (node) {
        if (node.nodeType === 3) {
          if (!node.textContent.trim()) return;
          var frag = document.createDocumentFragment();
          node.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(" "));
            else frag.appendChild(makeWord(part, counter.i++));
          });
          node.parentNode.replaceChild(frag, node);
        } else if (node.nodeType === 1 && node.nodeName !== "BR") {
          walk(node, counter);
        }
      });
    }

    $$("[data-words]").forEach(function (el) { walk(el, { i: 0 }); });
  }

  /* ------------------------------------------------------------- reveal -- */
  function reveal() {
    var items = $$("[data-rise], .reveal-line, [data-words], .label-rule");
    if (!items.length) return;
    if (reduced || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    items.forEach(function (el) { io.observe(el); });

    /* Safety net. An observer in a document that has never painted (a
       background tab, some privacy modes) reports nothing, which would leave
       visible content stuck in its hidden state. Anything actually inside the
       viewport after two seconds gets shown regardless; everything below the
       fold still waits for the scroll. */
    var rescue = function () {
      items.forEach(function (el) {
        if (el.classList.contains("is-in")) return;
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) {
          el.classList.add("is-in");
          io.unobserve(el);
        }
      });
    };
    setTimeout(rescue, 2000);
    window.addEventListener("focus", rescue);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) setTimeout(rescue, 400);
    });
  }

  /* ----------------------------------------------------------- counters -- */
  function counters() {
    var els = $$("[data-count]");
    if (!els.length) return;
    if (reduced || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        var el = en.target;
        var end = parseInt(el.getAttribute("data-count"), 10);
        var pad = el.textContent.trim().length;
        var t0 = null, dur = 1100;
        var step = function (t) {
          if (!t0) t0 = t;
          var p = Math.min((t - t0) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = String(Math.round(end * eased)).padStart(pad, "0");
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ----------------------------------------------------------- parallax -- */
  function parallax() {
    var els = $$("[data-par]");
    if (!els.length || reduced) return;
    var ticking = false;
    var run = function () {
      var y = window.pageYOffset;
      els.forEach(function (el) {
        var rate = parseFloat(el.getAttribute("data-par")) || 0.12;
        el.style.transform = "translate3d(0," + (y * rate).toFixed(1) + "px,0)";
      });
      ticking = false;
    };
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(run); }
    }, { passive: true });
  }

  /* ------------------------------------------------------- hex lattice -- */
  /* A triangular mesh that drifts slowly and lights up around the pointer.
     Runs behind the hero on every page. */
  function lattice(cv) {
    var ctx = cv.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var pts = [], edges = [], w = 0, h = 0, t = 0, raf = null;
    var mouse = { x: -9999, y: -9999, on: false };

    function build() {
      var r = cv.getBoundingClientRect();
      w = r.width; h = r.height;
      if (!w || !h) return;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      /* A true honeycomb. Each cell is a pointy-top hexagon of circumradius R,
         so centres sit sqrt(3)*R apart horizontally and 1.5*R apart vertically,
         with every other row shifted half a step. Corners are shared between
         neighbouring cells and each wall is stored once, which is what keeps
         the walls a single clean weight instead of doubling up. */
      var R = w < 700 ? 26 : 34;
      var hStep = 1.7320508 * R;
      var vStep = 1.5 * R;

      pts = []; edges = [];
      var vseen = {}, eseen = {}, k;

      var cosA = [], sinA = [];
      for (k = 0; k < 6; k++) {
        var ang = (-90 + 60 * k) * Math.PI / 180;
        cosA.push(Math.cos(ang)); sinA.push(Math.sin(ang));
      }

      function vertex(x, y) {
        var key = Math.round(x * 2) + ":" + Math.round(y * 2);
        var p = vseen[key];
        if (!p) {
          p = { x: x, y: y, ox: x, oy: y, ph: Math.random() * 6.283, a: 0, id: pts.length };
          vseen[key] = p; pts.push(p);
        }
        return p;
      }

      function wall(a, b) {
        var key = a.id < b.id ? a.id + ":" + b.id : b.id + ":" + a.id;
        if (eseen[key]) return;
        eseen[key] = 1; edges.push([a, b]);
      }

      for (var row = -1, cy = -vStep; cy < h + vStep * 2; row++, cy += vStep) {
        var off = (row & 1) ? hStep / 2 : 0;
        for (var cx = -hStep + off; cx < w + hStep; cx += hStep) {
          var corner = [];
          for (k = 0; k < 6; k++) corner.push(vertex(cx + R * cosA[k], cy + R * sinA[k]));
          for (k = 0; k < 6; k++) wall(corner[k], corner[(k + 1) % 6]);
        }
      }
    }

    function frame() {
      t += 0.005;
      ctx.clearRect(0, 0, w, h);

      var i, p, dx, dy, d2, near, R = 210, R2 = R * R;

      for (i = 0; i < pts.length; i++) {
        p = pts[i];
        p.x = p.ox + Math.sin(t + p.ph) * 3.4;
        p.y = p.oy + Math.cos(t * 0.8 + p.ph) * 3.4;
        near = 0;
        if (mouse.on) {
          dx = p.x - mouse.x; dy = p.y - mouse.y; d2 = dx * dx + dy * dy;
          if (d2 < R2) {
            near = 1 - Math.sqrt(d2) / R;
            near *= near;
            p.x += dx * near * 0.22;
            p.y += dy * near * 0.22;
          }
        }
        p.a += (near - p.a) * 0.1;
      }

      ctx.lineWidth = 1;
      for (i = 0; i < edges.length; i++) {
        var a = edges[i][0], b = edges[i][1];
        var glow = a.a > b.a ? a.a : b.a;
        ctx.strokeStyle = "rgba(3,171,180," + (0.075 + glow * 0.5).toFixed(3) + ")";
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }

      for (i = 0; i < pts.length; i++) {
        p = pts[i];
        if (p.a < 0.03) continue;
        ctx.fillStyle = "rgba(0,114,124," + (p.a * 0.75).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(p.x, p.y, 1 + p.a * 2.4, 0, 6.2832); ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    }

    build();
    frame();

    var host = cv.parentNode;
    host.addEventListener("pointermove", function (e) {
      var r = cv.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true;
    });
    host.addEventListener("pointerleave", function () { mouse.on = false; });

    var rt;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(build, 220); });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { if (!raf) frame(); }
        else if (raf) { cancelAnimationFrame(raf); raf = null; }
      }, { threshold: 0 }).observe(cv);
    }
  }

  function lattices() {
    if (reduced) return;
    $$(".js-lattice").forEach(lattice);
  }

  /* ---------------------------------------------------------- hexwheel -- */
  function wheel() {
    var wrap = $(".wheel-wrap");
    if (!wrap) return;
    var segs = $$(".wheel__seg", wrap);
    var panels = $$(".wpanel__body", wrap);
    if (!segs.length) return;

    var idx = 0, auto = null;

    function show(i, userDriven) {
      idx = i;
      segs.forEach(function (s, k) {
        s.classList.toggle("is-active", k === i);
        s.setAttribute("aria-selected", k === i ? "true" : "false");
        s.setAttribute("tabindex", k === i ? "0" : "-1");
      });
      panels.forEach(function (p, k) { p.classList.toggle("is-active", k === i); });
      if (userDriven && auto) { clearInterval(auto); auto = null; }
    }

    segs.forEach(function (s, i) {
      s.addEventListener("mouseenter", function () { show(i, true); });
      s.addEventListener("focus", function () { show(i, true); });
      s.addEventListener("click", function () { show(i, true); });
      s.addEventListener("keydown", function (e) {
        var n = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (i + 1) % segs.length;
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (i - 1 + segs.length) % segs.length;
        if (e.key === "Enter" || e.key === " ") {
          var link = $("#wp-" + s.id.replace("wt-", "") + " a");
          if (link) { e.preventDefault(); link.click(); return; }
        }
        if (n !== null) { e.preventDefault(); show(n, true); segs[n].focus(); }
      });
    });

    show(0);

    if (!reduced && "IntersectionObserver" in window) {
      new IntersectionObserver(function (en) {
        if (en[0].isIntersecting && auto === null && idx === 0) {
          auto = setInterval(function () { show((idx + 1) % segs.length); }, 4200);
        } else if (!en[0].isIntersecting && auto) { clearInterval(auto); auto = null; }
      }, { threshold: 0.4 }).observe(wrap);
    }
  }

  /* -------------------------------------------------------- the six -- */
  /* Desktop: the section pins and scroll position picks the pillar on stage,
     with a progress track under each name (after Aon's homepage). Phones,
     short screens and reduced motion get the plain stacked cards. */
  function story() {
    var sec = $(".story");
    if (!sec || reduced) return;
    var slides = $$(".story__slide", sec), tabs = $$(".story__nav button", sec);
    var n = slides.length, idx = -1, live = false;
    var mq = window.matchMedia("(min-width: 981px) and (min-height: 640px)");

    function update() {
      if (!live) return;
      var total = sec.offsetHeight - window.innerHeight;
      var p = Math.min(Math.max(-sec.getBoundingClientRect().top / total, 0), 0.9999);
      var f = p * n, i = Math.floor(f);
      if (i !== idx) {
        idx = i;
        slides.forEach(function (s, k) { s.classList.toggle("is-active", k === i); });
        tabs.forEach(function (b, k) { b.classList.toggle("is-active", k === i); });
      }
      tabs.forEach(function (b, k) {
        b.firstChild.style.width = (Math.min(Math.max(f - k, 0), 1) * 100) + "%";
      });
    }
    function setLive(on) {
      live = on;
      sec.classList.toggle("story--live", on);
      sec.style.setProperty("--story-h", (100 + (n - 1) * 72) + "vh");
      idx = -1;
      if (on) update();
      else slides.forEach(function (s) { s.classList.remove("is-active"); });
    }
    tabs.forEach(function (b, k) {
      b.addEventListener("click", function () {
        var total = sec.offsetHeight - window.innerHeight;
        var top = sec.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({ top: top + total * ((k + 0.08) / n), behavior: "smooth" });
      });
    });
    setLive(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", function (e) { setLive(e.matches); });
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(function () { update(); ticking = false; }); }
    }, { passive: true });
    window.addEventListener("resize", update);
  }

  /* ---------------------------------------------------------- scenarios -- */
  function scenarios() {
    var tabs = $$("[data-scn-tab]");
    if (!tabs.length) return;
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var id = tab.getAttribute("data-scn-tab");
        tabs.forEach(function (t) {
          var on = t === tab;
          t.setAttribute("aria-selected", on ? "true" : "false");
          t.setAttribute("tabindex", on ? "0" : "-1");
        });
        $$("[data-scn-panel]").forEach(function (p) {
          p.classList.toggle("is-active", p.getAttribute("data-scn-panel") === id);
        });
      });
      tab.addEventListener("keydown", function (e) {
        var i = tabs.indexOf(tab), n = null;
        if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
        if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
        if (n !== null) { e.preventDefault(); tabs[n].focus(); tabs[n].click(); }
      });
    });
  }

  /* ---------------------------------------------------------- accordion -- */
  function accordion() {
    $$(".acc__btn").forEach(function (btn) {
      var panel = document.getElementById(btn.getAttribute("aria-controls"));
      if (!panel) return;
      btn.addEventListener("click", function () {
        var open = btn.getAttribute("aria-expanded") === "true";
        if (open) {
          panel.style.height = panel.scrollHeight + "px";
          requestAnimationFrame(function () { panel.style.height = "0px"; });
        } else {
          panel.style.height = panel.scrollHeight + "px";
          panel.addEventListener("transitionend", function once() {
            panel.style.height = "auto";
            panel.removeEventListener("transitionend", once);
          });
        }
        btn.setAttribute("aria-expanded", open ? "false" : "true");
      });
    });
  }

  /* ------------------------------------------------------- contact form -- */
  /* Static hosting, no backend: compose a well-formed email rather than
     pretend to submit somewhere. */
  function contact() {
    var form = $("#brief");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = function (n) { var el = form.elements[n]; return el ? el.value.trim() : ""; };
      var picks = $$("input[name=pillar]:checked", form).map(function (i) { return i.value; });
      var subject = "New enquiry — " + (f("company") || "HEXALIS website");
      var body =
        "Name: " + f("name") + "\n" +
        "Company: " + f("company") + "\n" +
        "Email: " + f("email") + "\n" +
        "Phone: " + (f("phone") || "—") + "\n" +
        "Pillars of interest: " + (picks.length ? picks.join(", ") : "Not sure yet") + "\n" +
        "Timeline: " + (f("timeline") || "—") + "\n\n" +
        "What we are trying to solve:\n" + f("message") + "\n\n" +
        "— Sent from hexalis.in";
      window.location.href = "mailto:" + form.dataset.to +
        "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
      var note = $("#brief-note");
      if (note) note.hidden = false;
    });
  }

  /* ---------------------------------------------------------------- go -- */
  function init() {
    transitions(); nav(); words(); reveal(); counters();
    parallax(); lattices(); wheel(); scenarios(); accordion(); contact();
    story();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  /* .js is already set by the inline <head> script; this is a guard for the
     case where that script was stripped by a proxy. */
  root.classList.add("js");
})();

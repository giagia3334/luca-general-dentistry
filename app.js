(function () {
  /* ---- config: the only values to touch when the page goes live ---- */
  const CONFIG = {
    // The form goes live with ONE switch. false = draft: nothing is sent, the card says so and offers the phone number.
    // Turn it on only after at least one of the Zaps below is published, or visitors would see "sent" for nothing.
    FORM_LIVE: false,
    FORM_ENDPOINTS: [
      "https://hooks.zapier.com/hooks/catch/20831475/4546aym/", // Zap "Luca - General Dentistry LP Leads to GHL pipeline"
      "https://hooks.zapier.com/hooks/catch/20831475/4546jwm/", // Zap "Luca - General Dentistry LP Leads to Monday (PPC Ads)"
    ],
    FORM_CONTENT_TYPE: "text/plain", // Zapier hooks read the JSON body and need no CORS preflight this way
    FORM_TIMEOUT_MS: 12000,
    DRAFT: true, // labels every dataLayer event and payload as a test; set to false at launch
    SOURCE: "Google Ads - General Dentistry",
    PHONE_TEL: "+13854122543",
    PHONE_TEXT: "(385) 412-2543",
  };
  const root = document.documentElement,
    $ = (s) => document.querySelector(s),
    $$ = (s) => [...document.querySelectorAll(s)];
  const reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const hasIO = "IntersectionObserver" in window;
  let motion = !reduce;
  const onMotion = []; // features that react to the Motion switch

  /* every feature runs on its own: one failure can never stop the rest of the page */
  function safe(name, fn) {
    try {
      fn();
    } catch (e) {
      if (window.console) console.error("[luca] " + name, e);
    }
  }

  /* scroll the page itself. scrollIntoView also scrolls any ancestor with overflow:hidden (the dark end section),
     which pushed its heading out of sight on phones. */
  function goTo(el, where) {
    const r = el.getBoundingClientRect();
    let y;
    if (where === "center") y = r.top + scrollY - (innerHeight - r.height) / 2;
    else if (where === "nearest") {
      if (r.top >= 12 && r.bottom <= innerHeight - 12) return;
      y = r.bottom > innerHeight - 12 ? r.bottom + scrollY - innerHeight + 24 : r.top + scrollY - 24;
    } else y = r.top + scrollY - Math.max(16, Math.min(90, innerHeight * 0.08));
    try {
      scrollTo({ top: Math.max(0, y), behavior: where === "center" && motion ? "smooth" : "auto" });
    } catch (e) {
      scrollTo(0, Math.max(0, y));
    }
  }

  /* ---- analytics: harmless without GTM (it only fills an array). Never put name or phone in here. ---- */
  function track(event, data) {
    try {
      const dl = (window.dataLayer = window.dataLayer || []);
      dl.push(Object.assign({ event: event, lp_source: CONFIG.SOURCE, lp_draft: CONFIG.DRAFT }, data || {}));
    } catch (e) {}
  }

  /* ---- attribution: read once from the URL, keep for the tab session ---- */
  const ATTR_KEYS = [
    "gclid",
    "gbraid",
    "wbraid",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
  ];
  function getAttribution() {
    let saved = {},
      fresh = {},
      found = false;
    try {
      saved = JSON.parse(sessionStorage.getItem("luca_lp_attr") || "{}") || {};
    } catch (e) {}
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) saved = {};
    try {
      const q = new URLSearchParams(location.search);
      ATTR_KEYS.forEach((k) => {
        const v = (q.get(k) || "").trim().slice(0, 256);
        if (v) {
          fresh[k] = v;
          found = true;
        }
      });
    } catch (e) {}
    const a = found ? fresh : saved; // a new ad click replaces the stored set as a whole, so ids never mix
    if (!a.landing_page) {
      try {
        a.landing_page = String(location.pathname || "/").slice(0, 256);
      } catch (e) {
        a.landing_page = "";
      }
    }
    try {
      sessionStorage.setItem("luca_lp_attr", JSON.stringify(a));
    } catch (e) {}
    return a;
  }

  /* ---- reveal on scroll ---- */
  let io = null;
  function arm() {
    if (!hasIO) {
      $$(".rvs,.hero").forEach((e) => e.classList.add("on"));
      return;
    }
    if (!io)
      io = new IntersectionObserver(
        (es) =>
          es.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("on");
              io.unobserve(e.target);
            }
          }),
        { threshold: 0.18, rootMargin: "0px 0px -6% 0px" },
      );
    $$(".rvs").forEach((el) => {
      if (el.getBoundingClientRect().bottom < 0)
        el.classList.add("on"); // already scrolled past (reload, deep link)
      else io.observe(el);
    });
  }

  /* ---- hero: light intro, rotating city, spotlight, photo options while in draft ---- */
  const cities = ["Bountiful", "Woods Cross", "North Salt Lake", "Centerville"];
  let ci = 0,
    cityT = null,
    heroSeen = true,
    litT = 0;
  function playHero() {
    const h = $(".hero");
    h.classList.remove("on", "lit");
    void h.offsetWidth;
    setTimeout(() => h.classList.add("on"), 40);
    clearTimeout(litT);
    litT = setTimeout(() => h.classList.add("lit"), 4600); // safety: the light always ends in its resting state
  }
  function initHero() {
    /* the ad can name the town: ?city=north-salt-lake, or the keyword in utm_term / kw. Whitelist only. */
    let q = null;
    try {
      q = new URLSearchParams(location.search);
      const raw =
        " " +
        [q.get("city"), q.get("kw"), q.get("utm_term")]
          .join(" ")
          .toLowerCase()
          .replace(/[^a-z]+/g, " ") +
        " ";
      if (raw.indexOf(" west bountiful ") < 0) {
        const hit = ["North Salt Lake", "Woods Cross", "Centerville", "Bountiful"].find(
          (c) => raw.indexOf(" " + c.toLowerCase() + " ") >= 0,
        );
        if (hit) {
          ci = cities.indexOf(hit);
          $(".hero .cw").textContent = hit;
        }
      }
    } catch (e) {}
    if (hasIO) new IntersectionObserver((es) => (heroSeen = es[es.length - 1].isIntersecting)).observe($(".hero"));
    const h = $(".h2x");
    /* the light travels once on its own (the phrase rides inside it), then rests; after that the mouse can move it */
    h.addEventListener("animationend", (e) => {
      if (e.animationName === "heroLight") h.classList.add("lit");
    });
    let raf = 0;
    h.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" || !motion || raf || !h.classList.contains("lit")) return; // phones keep the designed light
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = h.getBoundingClientRect();
        h.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
        h.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
      });
    });
  }
  function nextCity() {
    if (!motion || !heroSeen || document.hidden) return;
    const line = $(".hero .cl"); // word, underline and full stop fade together, so nothing jumps while visible
    ci = (ci + 1) % cities.length;
    line.classList.add("sw");
    setTimeout(() => {
      line.querySelector(".cw").textContent = cities[ci];
      line.classList.remove("sw");
    }, 260);
  }

  /* ---- proof strip count-up ---- */
  function initCounters() {
    if (!hasIO) return;
    new IntersectionObserver(
      (es, o) =>
        es.forEach((e) => {
          if (!e.isIntersecting) return;
          o.disconnect();
          if (!motion) return;
          $$("[data-count]").forEach((el) => {
            const to = +el.dataset.count,
              dec = +(el.dataset.dec || 0),
              t0 = performance.now();
            (function f(t) {
              const p = Math.max(0, Math.min(1, (t - t0) / 700));
              el.textContent = (to * (1 - Math.pow(1 - p, 4))).toFixed(dec);
              if (p < 1) requestAnimationFrame(f);
            })(t0);
          });
        }),
      { threshold: 0.6 },
    ).observe($("#strip"));
  }

  /* ---- film: loops while seen; "Watch the story" plays the longer film in place, with sound ---- */
  function initFilm() {
    const fv = $("#filmVid"),
      btn = $("#playStory2"),
      lite = !!(navigator.connection && navigator.connection.saveData);
    /* phones get a lighter cut of the loop (about half the size), so it starts sooner on mobile data */
    const FILM = window.matchMedia && matchMedia("(max-width: 700px)").matches ? "media/luca-film-m.mp4" : "media/luca-film.mp4";
    let story = false,
      seen = false,
      blocked = false; // the browser refused autoplay (iOS Low Power Mode, data saver): the next touch starts it
    const tryPlay = () => {
      fv.muted = true;
      const p = fv.play();
      if (p && p.then)
        p.then(
          () => (blocked = false),
          () => (blocked = true),
        );
    };
    const loop = () => {
      if (story) return;
      if (seen && motion && !lite) tryPlay();
      else fv.pause();
    };
    /* start downloading one screen before the film scrolls in, so it is ready to play on arrival */
    if (hasIO && !lite)
      new IntersectionObserver(
        (es, o) => {
          if (!es.some((e) => e.isIntersecting)) return;
          o.disconnect();
          if (story || fv.readyState > 0 || !fv.paused) return;
          fv.preload = "auto";
          fv.load();
        },
        { rootMargin: "120% 0px" },
      ).observe(fv);
    fv.addEventListener("canplay", () => !story && seen && fv.paused && loop());
    ["touchend", "click"].forEach((ev) =>
      document.addEventListener(ev, () => blocked && !story && loop(), { passive: true }),
    );
    document.addEventListener("visibilitychange", () => !document.hidden && loop());
    fv.addEventListener("click", () => !story && fv.paused && tryPlay()); // a tap on the film always starts it
    if (hasIO)
      new IntersectionObserver(
        (es) =>
          es.forEach((e) => {
            seen = e.isIntersecting;
            if (story && !seen) fv.pause();
            loop();
          }),
        { threshold: 0.2 },
      ).observe(fv);
    onMotion.push(loop);
    function endStory() {
      if (!story) return;
      story = false;
      fv.controls = false;
      fv.src = FILM;
      fv.loop = true;
      fv.muted = true;
      btn.hidden = false;
      loop();
    }
    btn.addEventListener("click", () => {
      story = true;
      fv.pause();
      fv.loop = false;
      fv.src = "media/luca-story.mp4";
      fv.muted = false;
      fv.controls = true;
      btn.hidden = true;
      fv.play().catch(() => {});
      goTo(fv, "center");
      track("story_play");
    });
    fv.addEventListener("ended", () => story && endStory());
    fv.addEventListener("error", () => story && endStory());
  }

  /* ---- gallery: centre photo sharp, neighbours dimmed, swipe or mouse drag ---- */
  let gGo = () => {},
    gc = 1;
  function initGallery() {
    const gal = $("#gal"),
      gi = [...gal.children];
    if (hasIO) {
      const gio = new IntersectionObserver(
        (es) =>
          es.forEach((e) => {
            if (e.isIntersecting) {
              gc = gi.indexOf(e.target);
              gi.forEach((b, i) => b.classList.toggle("c", i === gc));
            }
          }),
        { root: gal, rootMargin: "0px -49.5% 0px -49.5%", threshold: 0 },
      );
      gi.forEach((b) => gio.observe(b));
      /* lazy images inside a sideways scroller load only when they enter it: load all of them once the gallery is near */
      new IntersectionObserver(
        (es, o) => {
          if (!es.some((e) => e.isIntersecting)) return;
          o.disconnect();
          gal.querySelectorAll("img").forEach((im) => (im.loading = "eager"));
        },
        { rootMargin: "100% 0px" },
      ).observe(gal);
    }
    gGo = (i, smooth) => {
      const b = gi[Math.max(0, Math.min(gi.length - 1, i))];
      gal.scrollTo({
        left: b.offsetLeft - (gal.clientWidth - b.offsetWidth) / 2,
        behavior: smooth ? "smooth" : "auto",
      });
    };
    dragScroll(gal, gi, (i) => gGo(i, true));
    gal.addEventListener("click", (e) => {
      if (gal.dataset.moved) return;
      const b = e.target.closest("button");
      if (b && !b.classList.contains("c")) gGo(gi.indexOf(b), true);
    });
    gal.addEventListener("dragstart", (e) => e.preventDefault());
    gGo(1, false);
  }

  /* mouse drag for a sideways scroller (touch already scrolls natively); settles on the nearest item */
  function dragScroll(box, items, settle) {
    let down = false,
      moved = false,
      x0 = 0,
      s0 = 0,
      t = 0;
    const done = () => {
      clearTimeout(t);
      if (!down) box.classList.remove("drag");
    };
    function end() {
      if (!down) return;
      down = false;
      if (!moved) return done();
      const mid = box.scrollLeft + box.clientWidth / 2;
      let best = 0,
        bd = 1e9;
      items.forEach((b, i) => {
        const d = Math.abs(b.offsetLeft + b.offsetWidth / 2 - mid);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      settle(best);
      clearTimeout(t);
      t = setTimeout(done, 600); // snapping comes back only after the glide
      setTimeout(() => delete box.dataset.moved, 0);
    }
    box.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      down = true;
      moved = false;
      x0 = e.clientX;
      s0 = box.scrollLeft;
    });
    addEventListener("pointermove", (e) => {
      if (!down) return;
      if (!(e.buttons & 1)) return end();
      const d = e.clientX - x0;
      if (!moved && Math.abs(d) < 6) return;
      moved = true;
      box.dataset.moved = "1";
      box.classList.add("drag");
      box.scrollLeft = s0 - d;
    });
    addEventListener("pointerup", end);
    addEventListener("pointercancel", end);
    box.addEventListener("scrollend", done);
  }

  /* ---- reviews: one card per swipe, dots, one small nudge that gives way to the visitor ---- */
  function initReviews() {
    const rv = $("#rv"),
      rcs = [...rv.children],
      dots = $("#dots");
    dots.innerHTML = rcs.map(() => "<i></i>").join("");
    const dl = [...dots.children];
    const setDot = () => {
      const max = rv.scrollWidth - rv.clientWidth,
        i = max > 0 ? Math.round((rv.scrollLeft / max) * (rcs.length - 1)) : 0;
      dl.forEach((d, k) => d.classList.toggle("on", k === i));
    };
    setDot();
    rv.addEventListener("scroll", setDot, { passive: true });
    dragScroll(rv, rcs, (i) => {
      const c = rcs[i];
      rv.scrollTo({ left: c.offsetLeft - (rv.clientWidth - c.offsetWidth) / 2, behavior: "smooth" });
    });
    let run = false,
      raf = 0;
    const stop = () => {
      if (!run) return;
      run = false;
      cancelAnimationFrame(raf);
      rv.style.scrollSnapType = "";
    };
    ["pointerdown", "touchstart"].forEach((t) => rv.addEventListener(t, stop, { passive: true }));
    rv.addEventListener("wheel", (e) => Math.abs(e.deltaX) > Math.abs(e.deltaY) && stop(), { passive: true });
    if (!hasIO) return;
    new IntersectionObserver(
      (es, o) =>
        es.forEach((e) => {
          if (!e.isIntersecting) return;
          o.disconnect();
          if (!motion || rv.scrollLeft > 2) return;
          run = true;
          rv.style.scrollSnapType = "none";
          const t0 = performance.now();
          (function f(t) {
            if (!run) return;
            const p = Math.min(1, (t - t0) / 700);
            rv.scrollLeft = Math.sin(p * Math.PI) * 70;
            if (p < 1) raf = requestAnimationFrame(f);
            else {
              run = false;
              rv.scrollLeft = 0;
              rv.style.scrollSnapType = "";
            }
          })(t0);
        }),
      { threshold: 0.7 },
    ).observe(rv);
  }

  /* ---- Instagram: one frame where the numbers and the button form out of fine dots as you scroll, then the dots
     gather into five gold stars that sit on top of the reviews section as it rises.
     The numbers live in the HTML; without JS, with motion off or on any failure the section shows them as text. ---- */
  let buildPSafe = () => {},
    drawInsta = () => {};
  function initInsta() {
    const insta = $("#insta"),
      cv = $("#pc"),
      ctx = cv.getContext("2d"),
      plab = $("#plab"),
      prate = $("#prate"),
      ibtn = $("#ibtn");
    if (!ctx) return;
    const STATS = [...plab.querySelectorAll("b")].map((b) => b.textContent.trim());
    const INK = "#141417",
      PINK = "#fb0199",
      GOLD = "#ffb800";
    let P = [],
      PW = 0,
      PH = 0,
      dpr = 1,
      dot = 1.5,
      seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; // same layout on every rebuild
    /* the shapes are drawn K times larger and read every `step` pixels: the grid is step / K css pixels (1.5 on phones) */
    function sample(draw, step, K) {
      const off = document.createElement("canvas"),
        w = PW * K,
        hh = PH * K;
      off.width = w;
      off.height = hh;
      const o = off.getContext("2d", { willReadFrequently: true });
      o.scale(K, K);
      o.textAlign = "center";
      o.textBaseline = "middle";
      draw(o);
      const d = o.getImageData(0, 0, w, hh).data,
        out = [];
      for (let y = 0; y < hh; y += step)
        for (let x = 0; x < w; x += step) {
          const k = (y * w + x) * 4;
          if (d[k + 3] > 128) out.push({ x: x / K, y: y / K, c: d[k] < 120 ? INK : d[k + 1] > 170 ? "#fff" : PINK });
        }
      return out;
    }
    function star(o, cx, cy, R) {
      o.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5,
          r = i % 2 ? R * 0.46 : R;
        o[i ? "lineTo" : "moveTo"](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      o.closePath();
      o.fill();
    }
    function buildP() {
      seed = 7;
      dpr = Math.min(3, devicePixelRatio || 1);
      PW = cv.clientWidth;
      PH = cv.clientHeight;
      if (!PW || !PH) {
        P = [];
        return;
      }
      cv.width = Math.round(PW * dpr);
      cv.height = Math.round(PH * dpr);
      const col = PW < 700,
        K = col ? 2 : 1,
        step = col ? 3 : 2, // grid of 1.5 css px on phones and 2 on wide screens: small pixels, so the numbers read crisp
        F = " Urbanist, Arial, sans-serif";
      dot = col ? 1.2 : 1.65;
      const fs = col ? Math.min(PW * 0.25, PH * 0.115) : Math.min(PW * 0.11, PH * 0.26);
      const pos = col
        ? [
            [PW / 2, PH * 0.24],
            [PW / 2, PH * 0.41],
            [PW / 2, PH * 0.58],
          ]
        : [
            [PW * 0.17, PH * 0.42],
            [PW * 0.5, PH * 0.42],
            [PW * 0.83, PH * 0.42],
          ];
      const bp = col ? [PW / 2, PH * 0.77] : [PW / 2, PH * 0.74];
      ibtn.style.left = bp[0] + "px";
      ibtn.style.top = bp[1] + "px";
      const r = ibtn.getBoundingClientRect(),
        c = cv.getBoundingClientRect(),
        bx = r.left - c.left,
        by = r.top - c.top,
        cs = getComputedStyle(ibtn);
      const A = sample((o) => {
        o.font = "900 " + fs + "px" + F;
        STATS.forEach((t, i) => {
          o.fillStyle = i === 1 ? PINK : INK;
          o.fillText(t, pos[i][0], pos[i][1]);
        });
        o.fillStyle = PINK;
        const rad = r.height / 2;
        o.beginPath();
        o.moveTo(bx + rad, by);
        o.arcTo(bx + r.width, by, bx + r.width, by + r.height, rad);
        o.arcTo(bx + r.width, by + r.height, bx, by + r.height, rad);
        o.arcTo(bx, by + r.height, bx, by, rad);
        o.arcTo(bx, by, bx + r.width, by, rad);
        o.fill();
        o.fillStyle = "#fff";
        o.font = "800 " + cs.fontSize + F;
        try {
          o.letterSpacing = cs.letterSpacing;
        } catch (e) {}
        o.fillText(ibtn.textContent.trim().toUpperCase(), bx + r.width / 2, by + r.height / 2 + 1);
      }, step, K);
      [...plab.children].forEach((el, i) => {
        el.style.left = pos[i][0] + "px";
        el.style.top = pos[i][1] + fs * 0.54 + "px";
      });
      /* five stars, in the part of the frame that stays visible above the rising reviews section */
      const R = col ? Math.min(PW * 0.064, 27) : Math.min(PW * 0.03, 44),
        sy = PH * (col ? 0.3 : 0.235),
        gap = R * 2.55;
      if (prate) prate.style.top = sy + R * 1.7 + "px"; // the rating line sits right under the stars
      const S = sample((o) => {
        o.fillStyle = GOLD;
        for (let i = 0; i < 5; i++) star(o, PW / 2 + (i - 2) * gap, sy, R);
      }, step, K).sort((a, b) => a.x - b.x || a.y - b.y);
      const far = Math.max(PW, PH);
      P = A.map((q) => {
        const a = rnd() * Math.PI * 2,
          rr = far * (0.5 + rnd() * 0.6),
          sx = PW / 2 + Math.cos(a) * rr,
          sy0 = PH / 2 + Math.sin(a) * rr,
          dx = q.x - sx,
          dy = q.y - sy0,
          len = Math.hypot(dx, dy) || 1;
        return {
          tx: q.x,
          ty: q.y,
          sx: sx,
          sy: sy0,
          nx: -dy / len, // normal of the flight line: gives each dot a soft arc on the way in
          ny: dx / len,
          w: (rnd() - 0.5) * far * 0.22,
          ex: q.x + (rnd() - 0.5) * PW * 0.9,
          ey: q.y - PH * (0.3 + rnd() * 0.9),
          /* the frame builds in reading order: top to bottom on phones, left to right on wide screens */
          d: 0.2 * (col ? q.y / PH : q.x / PW) + rnd() * 0.16,
          d2: rnd() * 0.3,
          c: q.c,
          g: 0,
          gx: 0,
          gy: 0,
        };
      });
      /* an even share of the dots becomes the stars; ordered left to right so they glide instead of crossing */
      if (S.length && P.length > S.length) {
        const k = P.length / S.length,
          chosen = [];
        for (let i = 0; i < S.length; i++) chosen.push(P[Math.floor(i * k)]);
        chosen.sort((a, b) => a.tx - b.tx || a.ty - b.ty);
        chosen.forEach((q, i) => {
          q.g = 1;
          q.gx = S[i].x;
          q.gy = S[i].y;
        });
      }
      P.sort((a, b) => (a.c === "#fff") - (b.c === "#fff")); // white button letters are drawn last, on top of the pink
      drawP();
    }
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
      cl = (v, a, b) => Math.min(1, Math.max(0, (v - a) / (b - a)));
    function drawP() {
      if (!P.length) return;
      const r = insta.getBoundingClientRect(),
        lead = innerHeight * 0.75,
        span = r.height - innerHeight + lead;
      const p = Math.min(1, Math.max(0, (lead - r.top) / span));
      insta.style.setProperty("--lab", (cl(p, 0.28, 0.36) - cl(p, 0.66, 0.72)).toFixed(3));
      const bo = cl(p, 0.33, 0.38) - cl(p, 0.66, 0.7);
      insta.style.setProperty("--btn", bo.toFixed(3));
      insta.classList.toggle("btnon", bo > 0.9);
      insta.style.setProperty("--rate", cl(p, 0.84, 0.95).toFixed(3)); // "4.9 from 479 Google reviews" arrives as the stars settle
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, PW, PH);
      const a = cl(p, 0, 0.36),
        b = cl(p, 0.68, 0.95);
      if (a <= 0) return;
      let lastC = "",
        lastA = -1;
      for (let i = 0; i < P.length; i++) {
        const q = P[i],
          ta = ease(cl(a, q.d, 1));
        if (ta <= 0) continue;
        let x,
          y,
          s = dot,
          al = 1,
          c = q.c;
        if (b <= 0) {
          if (ta < 1) {
            const k = Math.sin(ta * Math.PI) * q.w;
            x = q.sx + (q.tx - q.sx) * ta + q.nx * k;
            y = q.sy + (q.ty - q.sy) * ta + q.ny * k;
            s = dot * (1 + (1 - ta) * 3.1); // big soft dots while they fly, shrinking into fine pixels as they land
            al = Math.min(1, ta * 1.5);
            if (ta < 0.82 && c !== "#fff") c = PINK; // everything travels in brand pink and settles into its own colour
          } else {
            x = q.tx;
            y = q.ty;
          }
        } else {
          const tb = ease(cl(b, q.d2, 1));
          if (q.g) {
            const k = Math.sin(tb * Math.PI) * q.w * 0.35;
            x = q.tx + (q.gx - q.tx) * tb + q.nx * k;
            y = q.ty + (q.gy - q.ty) * tb + q.ny * k;
            s = dot * (1 + Math.sin(tb * Math.PI) * 0.7);
            if (tb > 0.35) c = GOLD;
          } else {
            x = q.tx + (q.ex - q.tx) * tb;
            y = q.ty + (q.ey - q.ty) * tb;
            s = dot * (1 + tb * 2.2);
            al = 1 - tb;
          }
        }
        al = Math.round(al * 5) / 5;
        if (al <= 0) continue;
        if (al !== lastA) {
          ctx.globalAlpha = al;
          lastA = al;
        }
        if (c !== lastC) {
          ctx.fillStyle = c;
          lastC = c;
        }
        ctx.fillRect(x, y, s, s);
      }
      ctx.globalAlpha = 1;
    }
    buildPSafe = () => {
      if (!motion) return;
      insta.classList.remove("static");
      try {
        buildP();
      } catch (e) {
        P = [];
      }
      if (!P.length) insta.classList.add("static");
    };
    drawInsta = () => {
      if (!motion || !P.length) return;
      const r = insta.getBoundingClientRect();
      if (r.top < innerHeight * 1.2 && r.bottom > 0) drawP();
    };
    let lastW = innerWidth,
      lastH = innerHeight,
      rz = 0;
    addEventListener("resize", () => {
      clearTimeout(rz);
      rz = setTimeout(() => {
        const wChanged = innerWidth !== lastW,
          bigH = Math.abs(innerHeight - lastH) > 150; // ignore the phone address bar showing or hiding
        if (!wChanged && !bigH) return;
        lastW = innerWidth;
        lastH = innerHeight;
        buildPSafe();
        gGo(gc, false);
      }, 200);
    });
    onMotion.push(() => {
      if (!motion) {
        insta.classList.add("static");
        return;
      }
      const fr = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      let fontsIn = false;
      fr.then(() => (fontsIn = true));
      Promise.race([fr, new Promise((r) => setTimeout(r, 1500))]).then(() =>
        setTimeout(() => {
          buildPSafe();
          if (!fontsIn) fr.then(buildPSafe);
        }, 60),
      );
    });
  }

  /* ---- scroll loop ---- */
  function initScroll() {
    let tick = false;
    addEventListener(
      "scroll",
      () => {
        if (tick) return;
        tick = true;
        requestAnimationFrame(() => {
          tick = false;
          drawInsta();
        });
      },
      { passive: true },
    );
  }

  /* ---- "Open now" on the map: office hours in Utah time (Mon-Thu 8am-5pm, Fri 8am-2pm) ---- */
  function initOpenNow() {
    const el = $("#mnow"),
      txt = $("#mnow-t");
    if (!el || !txt || !window.Intl) return;
    const check = () => {
      let open = false,
        label = "";
      try {
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Denver",
          weekday: "short",
          hour: "numeric",
          minute: "numeric",
          hour12: false,
        }).formatToParts(new Date());
        const get = (t) => (parts.find((x) => x.type === t) || {}).value,
          day = get("weekday"),
          mins = (+get("hour") % 24) * 60 + +get("minute"),
          close = { Mon: 1020, Tue: 1020, Wed: 1020, Thu: 1020, Fri: 840 }[day];
        open = !!close && mins >= 480 && mins < close;
        label = open ? "Open now" : "Closed now"; // short on purpose: the hours sit right under the map
      } catch (e) {}
      if (!label) return void (el.hidden = true);
      txt.textContent = label;
      el.classList.toggle("closed", !open);
      el.hidden = false;
      /* the same status above "Ready when you are."; when closed it says what happens with a request */
      const f = $("#fnow"),
        ft = $("#fnow-t");
      if (f && ft) {
        ft.textContent = open ? "Open now" : "Closed now · we call you back when we open";
        f.classList.toggle("closed", !open);
        f.hidden = false;
      }
    };
    check();
    setInterval(check, 60000);
  }

  /* ---- privacy policy popup ---- */
  function initPrivacy() {
    const pp = $("#pp");
    const open = (e) => {
      e.preventDefault();
      if (pp.showModal) pp.showModal();
      else pp.setAttribute("open", "");
      track("privacy_open");
    };
    $$("#ppOpen,[data-pp]").forEach((b) => b.addEventListener("click", open));
    $("#ppClose").addEventListener("click", () => (pp.close ? pp.close() : pp.removeAttribute("open")));
    pp.addEventListener("click", (e) => {
      if (e.target === pp) pp.close();
    });
  }

  /* ---- lead form ---- */
  function normPhone(raw) {
    let d = String(raw || "").replace(/\D/g, "");
    if (d.length === 11 && d[0] === "1") d = d.slice(1);
    if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(d) || /^(\d)\1{9}$/.test(d)) return null;
    return { e164: "+1" + d, pretty: "(" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6) };
  }
  function checkName(raw) {
    const v = String(raw || "")
      .replace(/\s+/g, " ")
      .trim();
    if (v.length < 2 || v.length > 80) return null;
    if (!/\p{L}/u.test(v) || /\d{3,}|https?:|www\.|@/i.test(v)) return null;
    return v;
  }
  function initLead() {
    const form = $("#lead");
    const f = {
      name: $("#f-name"),
      phone: $("#f-phone"),
      hp: $("#f-hp"),
      btn: $("#lead-send"),
      msg: $("#lead-msg"),
      done: $("#lead-done"),
    };
    const ERR = { name: "Please enter your name.", phone: "Please enter a 10-digit phone number, area code first." };
    const t0 = Date.now(),
      btnText = f.btn.textContent;
    let busy = false,
      started = false;
    const attr = getAttribution();
    ATTR_KEYS.concat(["landing_page", "source"]).forEach((k) => {
      const i = document.createElement("input");
      i.type = "hidden";
      i.name = k;
      i.value = k === "source" ? CONFIG.SOURCE : attr[k] || "";
      form.appendChild(i);
    });
    const service = () => {
      const r = form.querySelector('input[name="service"]:checked');
      return r ? r.value : "Not specified";
    };
    function setErr(key, text) {
      const input = f[key],
        p = $("#f-" + key + "-err");
      input.setAttribute("aria-invalid", text ? "true" : "false");
      input.parentElement.classList.toggle("bad", !!text);
      p.textContent = text || "";
      p.hidden = !text;
    }
    function validate() {
      const name = checkName(f.name.value),
        phone = normPhone(f.phone.value),
        bad = [];
      setErr("name", name ? "" : ERR.name);
      setErr("phone", phone ? "" : ERR.phone);
      if (!name) bad.push("name");
      if (!phone) bad.push("phone");
      return { ok: !bad.length, bad: bad, name: name, phone: phone };
    }
    function say(kind) {
      const m = f.msg;
      m.textContent = "";
      m.hidden = !kind;
      m.classList.toggle("bad", kind === "fail");
      if (!kind) return;
      const a = document.createElement("a");
      a.className = "tel";
      a.href = "tel:" + CONFIG.PHONE_TEL;
      a.dataset.call = "form_" + kind;
      a.textContent = CONFIG.PHONE_TEXT;
      m.append(
        kind === "draft"
          ? "This draft form is not connected yet, so nothing was sent. Please call "
          : "We could not send your request. Please try again or call ",
        a,
        ".",
      );
      goTo(m, "nearest");
    }
    function setBusy(on) {
      busy = on;
      f.btn.disabled = on;
      f.btn.setAttribute("aria-busy", on ? "true" : "false");
      f.btn.textContent = on ? "Sending…" : btnText;
      f.name.readOnly = f.phone.readOnly = on;
    }
    function showDone(v) {
      [...form.children].forEach((el) => {
        if (el !== f.done) el.hidden = true;
      });
      f.done.querySelector("[data-fn]").textContent = v.name.split(" ")[0];
      f.done.querySelector("[data-ph]").textContent = v.phone.pretty;
      f.done.hidden = false;
      f.done.focus({ preventScroll: true });
      goTo(f.done, "nearest");
    }
    function send() {
      if (busy) return;
      say("");
      const v = validate();
      if (!v.ok) {
        form.dataset.state = "invalid";
        f[v.bad[0]].focus();
        track("form_error", { error_type: "validation", error_fields: v.bad.join(",") });
        return;
      }
      f.phone.value = v.phone.pretty;
      const svc = service();
      if (f.hp.value || Date.now() - t0 < 1500) {
        form.dataset.state = "error";
        say("fail");
        track("form_error", { error_type: "spam_check" });
        return;
      }
      if (!CONFIG.FORM_LIVE || !CONFIG.FORM_ENDPOINTS.length) {
        form.dataset.state = "draft";
        say("draft");
        track("form_draft_submit", { service: svc });
        return;
      }
      const payload = { name: v.name, phone: v.phone.e164, phone_display: v.phone.pretty, service: svc };
      form.querySelectorAll('input[type="hidden"]').forEach((i) => (payload[i.name] = i.value));
      payload.submitted_at = new Date().toISOString();
      payload.seconds_on_page = Math.round((Date.now() - t0) / 1000);
      payload.test = CONFIG.DRAFT;
      form.dataset.state = "sending";
      setBusy(true);
      const ctl = "AbortController" in window ? new AbortController() : null,
        timer = setTimeout(() => ctl && ctl.abort(), CONFIG.FORM_TIMEOUT_MS);
      /* the same request goes to every hook; it counts as sent when at least one of them accepts it */
      Promise.all(
        CONFIG.FORM_ENDPOINTS.map((url) =>
          fetch(url, {
            method: "POST",
            mode: "cors",
            credentials: "omit",
            headers: { "Content-Type": CONFIG.FORM_CONTENT_TYPE },
            body: JSON.stringify(payload),
            signal: ctl ? ctl.signal : undefined,
          }).then(
            (res) => (res.ok ? null : new Error("http_" + res.status)),
            (err) => err || new Error("network"),
          ),
        ),
      )
        .then((results) => {
          const failed = results.filter(Boolean);
          if (failed.length === results.length) throw failed[0];
          if (failed.length) track("form_error", { error_type: "partial_send" });
        })
        .then(
          () => {
            clearTimeout(timer);
            busy = false;
            form.dataset.state = "done";
            track("form_submit", { service: svc });
            showDone(v);
          },
          (err) => {
            clearTimeout(timer);
            setBusy(false);
            form.dataset.state = "error";
            say("fail");
            const m = (err && err.message) || "";
            track("form_error", {
              error_type: err && err.name === "AbortError" ? "timeout" : m.indexOf("http_") === 0 ? m : "network",
            });
          },
        );
    }
    f.btn.addEventListener("click", send);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      send();
    });
    form.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.isComposing || (e.target !== f.name && e.target !== f.phone)) return;
      e.preventDefault();
      if (e.target === f.name && !f.phone.value.trim()) f.phone.focus();
      else send();
    });
    const start = () => {
      if (started) return;
      started = true;
      track("form_start", { form_id: "lead" });
    };
    form.addEventListener("focusin", start);
    form.addEventListener("change", (e) => {
      start();
      if (e.target.name === "service") track("form_service_select", { service: e.target.value });
    });
    form.addEventListener("input", (e) => {
      const k = e.target === f.name ? "name" : e.target === f.phone ? "phone" : "";
      if (!k || e.target.getAttribute("aria-invalid") !== "true") return;
      setErr(k, (k === "name" ? checkName(f.name.value) : normPhone(f.phone.value)) ? "" : ERR[k]);
    });
    f.phone.addEventListener("blur", () => {
      const p = normPhone(f.phone.value);
      if (p) f.phone.value = p.pretty;
      else if (f.phone.value.trim()) setErr("phone", ERR.phone);
    });
  }

  /* ---- clicks: call/CTA events, in-page links (also inside the srcdoc review frame), chips set from a button ---- */
  function initClicks() {
    document.addEventListener(
      "click",
      (e) => {
        const t = e.target.closest ? e.target.closest('a[href^="tel:"],[data-ev]') : null;
        if (!t) return;
        if (t.matches('a[href^="tel:"]')) track("call_click", { location: t.dataset.call || "unlabelled" });
        else track(t.dataset.ev, { location: t.dataset.loc || "" });
      },
      true,
    );
    document.addEventListener("click", (e) => {
      const a = e.target.closest ? e.target.closest('a[href^="#"]') : null,
        el = a && a.getAttribute("href").length > 1 && document.getElementById(a.getAttribute("href").slice(1));
      if (!el || el.tagName === "DIALOG") return;
      e.preventDefault();
      const chip = a.dataset.chip && $('#lead input[name="service"][value="' + a.dataset.chip + '"]');
      if (chip) {
        chip.closest("label").hidden = false;
        chip.checked = true;
      }
      const target = el.id === "form" ? $("#lead") || el : el;
      $$(".end,.hero").forEach((x) => (x.scrollTop = 0));
      goTo(target);
    });
  }

  /* ---- floating buttons: shown once the hero buttons have scrolled away (phones); the calendar steps aside at the form ---- */
  function initFab() {
    const fab = $(".fab");
    fab.classList.add("js");
    if (!hasIO) return fab.classList.add("on");
    const hero = $(".hero .cta"),
      lead = $("#lead");
    let heroIn = true;
    new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.target === hero) {
            heroIn = e.isIntersecting;
            fab.classList.toggle("athero", heroIn);
          } else fab.classList.toggle("atform", e.isIntersecting);
          fab.classList.add("on");
        }),
      { threshold: 0.15 },
    ).observe(hero);
    new IntersectionObserver((es) => es.forEach((e) => fab.classList.toggle("atform", e.isIntersecting)), {
      threshold: 0.15,
    }).observe(lead);
  }

  /* ---- motion switch (device setting, or the review shell's Motion button) ---- */
  function setMotion(on) {
    motion = on && !reduce;
    try {
      root.classList.toggle("m", motion);
      if (motion) {
        arm();
        playHero();
        if (!cityT) cityT = setInterval(nextCity, 2800);
      } else {
        clearInterval(cityT);
        cityT = null;
        $$(".rvs,.hero").forEach((e) => e.classList.add("on"));
      }
    } catch (e) {
      root.classList.remove("m"); // never leave content hidden
      if (window.console) console.error("[luca] motion", e);
    }
    onMotion.forEach((fn) => safe("motion hook", fn));
  }

  /* controlled from the review shell: motion only, and only from the parent frame */
  addEventListener("message", (e) => {
    const d = e.data;
    if (!d || typeof d !== "object" || typeof d.motion !== "boolean") return;
    if (window.parent === window || e.source !== window.parent) return;
    setMotion(d.motion);
  });

  safe("clicks", initClicks);
  safe("lead", initLead);
  safe("privacy", initPrivacy);
  safe("open now", initOpenNow);
  safe("hero", initHero);
  safe("counters", initCounters);
  safe("film", initFilm);
  safe("gallery", initGallery);
  safe("reviews", initReviews);
  safe("insta", initInsta);
  safe("scroll", initScroll);
  safe("fab", initFab);
  setMotion(motion);
  try {
    parent.postMessage({ ready: true }, "*");
  } catch (e) {}
})();

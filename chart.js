/* Coin / index vs 200W / 3Y / 2Y SMA — weekly close line, Relative / Price toggle.
   Local preview only. Chosen with ?coin=btc|ltc|doge|totales|total2es|total3es|others
   (default btc). Coins use a cached TradingView weekly series plus one live
   Binance *USDT fetch (no key), falling back to the cached close. Market-cap
   indexes have no live feed: the last weekly close drives the top line, metric
   and dot. On-page mobile: CSS width + DPR backing store. Share PNG is always
   the 1200×675 desktop card. Live-dot radius equals the line width (CSS/layout
   px, then multiplied only by DPR). */
(function () {
  "use strict";
  const FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,Inter,sans-serif';
  const BG = "#12161c", GRID = "#272d36", AX = "#b0b6bf";
  const BUYC = "#2e8bff", GREY = "#c9ced6", LINE = "#6b7583", INK = "#f2f1ec";
  const SMA_C = "#8a919c";
  const SHARE_W = 1200, SHARE_H = 675, SHARE_D = 2;
  const DESKTOP_ST = {
    Pd: 56, Rgt: 4,
    tt: 36, ty: 82, wm: 20, wmc: "#8a919c",
    fs: 17.5, T: 108, B: 478, yr: 26,
    lg: 19.5, ly: 545, ny: 572, ml: 16, mlc: "#a7adb6", mv: 30,
    mly: 26, mvy: 62,
    lw: 3, smaw: 1.75, yearStep: 1,
  };
  const DAY = 864e5, PADW = 43, MOBILE_MAX = 720;
  const BN = "https://data-api.binance.vision/api/v3/ticker/price?symbol=";
  const COIN_DEFS = {
    btc: { id: "btc", name: "BTC", data: "data/btc-weekly.json", kind: "coin", unit: "Price",
           liveUrl: BN + "BTCUSDT", liveSrc: "Binance BTCUSDT" },
    ltc: { id: "ltc", name: "LTC", data: "data/ltc-weekly.json", kind: "coin", unit: "Price",
           liveUrl: BN + "LTCUSDT", liveSrc: "Binance LTCUSDT" },
    doge: { id: "doge", name: "DOGE", data: "data/doge-weekly.json", kind: "coin", unit: "Price",
            liveUrl: BN + "DOGEUSDT", liveSrc: "Binance DOGEUSDT" },
    totales: { id: "totales", name: "TOTALES", data: "data/totales-weekly.json", kind: "cap", unit: "Cap" },
    total2es: { id: "total2es", name: "TOTAL2ES", data: "data/total2es-weekly.json", kind: "cap", unit: "Cap" },
    total3es: { id: "total3es", name: "TOTAL3ES", data: "data/total3es-weekly.json", kind: "cap", unit: "Cap" },
    others: { id: "others", name: "OTHERS", data: "data/others-weekly.json", kind: "cap", unit: "Cap" },
  };
  const Q = new URLSearchParams(location.search);
  const COIN = COIN_DEFS[(Q.get("coin") || "btc").toLowerCase()] || COIN_DEFS.btc;
  const LIVE_URL = COIN.liveUrl || "";
  const LIVE_SRC = COIN.liveSrc || "";
  const SHARE = Q.get("share") === "1" || Q.get("cache") === "1";
  const START = Q.get("mode") === "price" ? "price" : "relative";
  const SHARE_CARD = (Q.get("card") || "").toLowerCase();

  function cardDefs(name, unit) {
    const slug = name.toLowerCase();
    const u = (unit || "Price").toLowerCase();
    return [
      {
        id: "200w", n: 200, smaLabel: "200W SMA", short: "200W",
        titleRel: name + " vs 200W SMA", titlePrice: name + " " + u + " vs 200W SMA",
        ariaRel: name + " versus 200-week SMA, weekly",
        ariaPrice: name + " " + u + " versus 200-week SMA, weekly",
        file: slug + "-200w-weekly",
      },
      {
        id: "3y", n: 156, smaLabel: "3Y SMA", short: "3Y",
        titleRel: name + " vs 3Y SMA", titlePrice: name + " " + u + " vs 3Y SMA",
        ariaRel: name + " versus 3-year SMA, weekly",
        ariaPrice: name + " " + u + " versus 3-year SMA, weekly",
        file: slug + "-3y-weekly",
      },
      {
        id: "2y", n: 104, smaLabel: "2Y SMA", short: "2Y",
        titleRel: name + " vs 2Y SMA", titlePrice: name + " " + u + " vs 2Y SMA",
        ariaRel: name + " versus 2-year SMA, weekly",
        ariaPrice: name + " " + u + " versus 2-year SMA, weekly",
        file: slug + "-2y-weekly",
      },
    ];
  }
  const CARD_DEFS = cardDefs(COIN.name, COIN.unit);
  const AVG_ORDER = ["2y", "3y", "200w"];

  function px(v) { return "$" + Math.round(v).toLocaleString("en-US"); }
  function dec(v, d) {
    return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function fv(v) {
    const a = Math.abs(v);
    if (a >= 1e12) return "$" + dec(v / 1e12, 2) + "T";
    if (a >= 1e9) return "$" + dec(v / 1e9, 2) + "B";
    if (a >= 1e6) return "$" + dec(v / 1e6, 2) + "M";
    if (a >= 1000) return px(v);
    if (a >= 1) return "$" + dec(v, 2);
    if (a >= 0.1) return "$" + v.toFixed(3);
    if (a >= 0.01) return "$" + v.toFixed(4);
    if (a >= 0.001) return "$" + v.toFixed(5);
    if (a >= 0.0001) return "$" + v.toFixed(6);
    if (a === 0) return "$0";
    return "$" + v.toFixed(8);
  }
  function rTick(v) { return String(+v.toPrecision(3)) + "x"; }
  function slimTick(x, suffix) {
    const s = Math.abs(x) >= 10 ? String(Math.round(x)) : String(+x.toPrecision(2));
    return "$" + s + suffix;
  }
  function usdTick(v) {
    const a = Math.abs(v);
    if (a >= 1e12) return slimTick(v / 1e12, "T");
    if (a >= 1e9) return slimTick(v / 1e9, "B");
    if (a >= 1e6) return slimTick(v / 1e6, "M");
    if (a >= 1000) return "$" + (v / 1000).toLocaleString("en-US", { maximumFractionDigits: 0 }) + "k";
    if (a >= 1) return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 0 });
    return "$" + String(+v.toPrecision(2));
  }
  function fmtDay(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    if (!m) return iso || "";
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return String(+m[3]) + " " + months[+m[2] - 1] + " " + m[1];
  }
  // Weekly bar end (Sunday) = Monday start + 6 days.
  function fmtBarEnd(iso) {
    const t0 = ms(iso);
    if (!isFinite(t0)) return fmtDay(iso);
    const d = new Date(t0 + 6 * DAY);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return d.getUTCDate() + " " + months[d.getUTCMonth()] + " " + d.getUTCFullYear();
  }
  function ms(s) { return Date.parse(s + "T00:00:00Z"); }
  function parseSnapshot(pass, source) {
    const s = (pass || "") + " " + (source || "");
    const m = /(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?\s*(CET|CEST|UTC)?/.exec(s);
    if (!m) return null;
    const tz = m[4] === "CEST" ? "+02:00" : (m[4] === "UTC" ? "Z" : "+01:00");
    const iso = m[1] + "T" + m[2] + ":" + (m[3] || "00") + (tz === "Z" ? "Z" : tz);
    const d = new Date(iso);
    return isFinite(d.getTime()) ? d : null;
  }
  // For no-live series: drop a trailing week if it is still in progress
  // at the data snapshot (bar start + 7 days > snapshot time).
  function dropInProgressWeeks(W, snapshot) {
    if (!snapshot || !W || !W.length) return W || [];
    const out = W.slice();
    const snap = snapshot.getTime();
    while (out.length) {
      const start = ms(out[out.length - 1][0]);
      if (!(start > 0) || start + 7 * DAY > snap) out.pop();
      else break;
    }
    return out;
  }
  function pad2(n) { return String(n).padStart(2, "0"); }
  function fmtHM(d) { return pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }
  function fmtCached(pass) {
    const m = /(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/.exec(pass || "");
    if (!m) return pass || "cached close";
    const d = new Date(m[1] + "T" + m[2] + ":00+01:00");
    const mon = d.toLocaleString(undefined, { month: "short" });
    return d.getDate() + " " + mon + " " + d.getFullYear() + ", " + fmtHM(d);
  }

  function smaArr(closes, n) {
    const sm = new Array(closes.length).fill(null);
    let su = 0;
    for (let i = 0; i < closes.length; i++) {
      su += closes[i];
      if (i >= n) su -= closes[i - n];
      if (i >= n - 1) sm[i] = su / n;
    }
    return sm;
  }

  function fetchLive() {
    const ac = new AbortController();
    const t = setTimeout(function () { ac.abort(); }, 5000);
    return fetch(LIVE_URL, { signal: ac.signal, cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("http " + r.status);
        return r.json();
      })
      .then(function (j) {
        const p = +j.price;
        if (!(p > 0) || !isFinite(p)) throw new Error("bad price");
        return { price: p, source: LIVE_SRC, url: LIVE_URL, at: Date.now() };
      })
      .finally(function () { clearTimeout(t); });
  }

  function desktopLayout() {
    return Object.assign({
      W: SHARE_W, H: SHARE_H, dpr: SHARE_D, mobile: false,
    }, DESKTOP_ST);
  }

  function mobileLayout(cssW, mode) {
    const W = Math.max(280, Math.round(cssW));
    const isPrice = mode === "price";
    const Pd = 14, Rgt = 8;
    const tt = 18, ty = 28, wm = 12, fs = 11;
    const T = 44, plotH = Math.max(190, Math.round(W * 0.56));
    const B = T + plotH, yr = 17, lg = 13;
    const ly1 = B + yr + 14;
    const ly2 = isPrice ? ly1 + 17 : ly1;
    const ny = ly2 + 12;
    const H = ny + 50;
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    return {
      W: W, H: H, dpr: dpr, mobile: true,
      Pd: Pd, Rgt: Rgt,
      tt: tt, ty: ty, wm: wm, wmc: "#8a919c",
      fs: fs, T: T, B: B, yr: yr,
      lg: lg, ly: ly2, ly1: ly1, ny: ny,
      ml: 10, mlc: "#a7adb6", mv: 17, mly: 18, mvy: 38,
      lw: 2.25, smaw: 1.5, yearStep: 2,
    };
  }

  function sizeCanvas(canvas, layout) {
    const dpr = layout.dpr;
    canvas.width = Math.round(layout.W * dpr);
    canvas.height = Math.round(layout.H * dpr);
    if (layout.mobile) {
      canvas.style.width = layout.W + "px";
      canvas.style.height = layout.H + "px";
    } else {
      canvas.style.width = "100%";
      canvas.style.height = "auto";
    }
    const x = canvas.getContext("2d");
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    return x;
  }

  // First week to show: the latest of each MA's first valid week (the longest
  // MA's start). SMAs still use the full history; only display/counts start here.
  function showStartIndex(closes, defs) {
    let fShow = 0, any = false;
    defs.forEach(function (def) {
      const sm = smaArr(closes, def.n);
      const f = sm.findIndex(function (s) { return s != null; });
      if (f >= 0) {
        if (!any || f > fShow) fShow = f;
        any = true;
      }
    });
    return fShow;
  }

  function applyCard(jw, live, def, fShow) {
    const W = jw.W.map(function (b) { return b.slice(); });
    const cachedClose = W.length ? +W[W.length - 1][4] : null;
    const liveOn = !!(live && live.price > 0);
    const lastPx = liveOn ? live.price : cachedClose;
    if (W.length) W[W.length - 1][4] = lastPx;
    const cl = W.map(function (b) { return +b[4]; });
    const sm = smaArr(cl, def.n);
    const fOwn = sm.findIndex(function (s) { return s != null; });
    if (fOwn < 0) {
      return {
        id: def.id, n: def.n, smaLabel: def.smaLabel, short: def.short,
        insufficient: true, weeks: W.length, need: def.n,
        source: jw.source || "", pass: jw.pass || "",
        liveOn: liveOn, live: live || null,
        cachedClose: cachedClose, lastPx: lastPx, lastSma: null,
        start: null, lastWeek: W.length ? W[W.length - 1][0] : null,
        closedN: 0, closedBelow: 0, liveBelow: false,
        plottedN: 0, plottedBelow: 0,
      };
    }
    const f = Math.max(fOwn, fShow != null ? fShow : fOwn);
    // Coins keep an open last bar (live) and exclude it from counts.
    // No-live series have already dropped any in-progress week, so the
    // last bar is complete and is included in the at/below counts.
    const countThroughLast = !COIN.liveUrl;
    const countEnd = countThroughLast ? W.length : W.length - 1;
    let closedN = 0, closedBelow = 0;
    for (let i = f; i < countEnd; i++) {
      closedN++;
      if (cl[i] <= sm[i]) closedBelow++;
    }
    const liveBelow = lastPx <= sm[sm.length - 1];
    return {
      id: def.id, n: def.n, smaLabel: def.smaLabel, short: def.short,
      W: W, cl: cl, sm: sm, f: f,
      source: jw.source || "",
      pass: jw.pass || "",
      liveOn: liveOn,
      live: live || null,
      cachedClose: cachedClose,
      lastPx: lastPx,
      lastSma: sm[sm.length - 1],
      start: W[f][0],
      lastWeek: W[W.length - 1][0],
      lastCloseEnd: W.length ? fmtBarEnd(W[W.length - 1][0]) : null,
      closedN: closedN,
      closedBelow: closedBelow,
      liveBelow: liveBelow,
      plottedN: W.length - f,
      plottedBelow: countThroughLast ? closedBelow : closedBelow + (liveBelow ? 1 : 0),
    };
  }

  function drawSplitPrice(x, pts, lw) {
    function cross(a, b) {
      const da = Math.log(a.p) - Math.log(a.s);
      const db = Math.log(b.p) - Math.log(b.s);
      const t = da / (da - db);
      return { x: a.x + t * (b.x - a.x), yp: a.yp + t * (b.yp - a.yp) };
    }
    function seg(a, b, col) {
      x.beginPath();
      x.moveTo(a.x, a.yp);
      x.lineTo(b.x, b.yp);
      x.strokeStyle = col;
      x.lineWidth = lw;
      x.stroke();
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const aLo = a.p <= a.s, bLo = b.p <= b.s;
      if (aLo === bLo) seg(a, b, aLo ? BUYC : GREY);
      else {
        const c = cross(a, b);
        seg(a, c, aLo ? BUYC : GREY);
        seg(c, b, bLo ? BUYC : GREY);
      }
    }
  }

  function drawInto(x, mode, ST, DATA, def) {
    const Wd = ST.W, H = ST.H, Pd = ST.Pd, Rgt = ST.Rgt;
    x.fillStyle = BG;
    x.fillRect(0, 0, Wd, H);
    x.textBaseline = "alphabetic";
    const F = function (w, z) { x.font = w + " " + z + "px " + FONT; };
    const Tx = function (s, X, Y, col, al) {
      x.fillStyle = col; x.textAlign = al || "left"; x.fillText(s, X, Y);
    };

    const isPrice = mode === "price";
    const title = isPrice ? def.titlePrice : def.titleRel;
    F(600, ST.tt);
    const titleW = x.measureText(title).width;
    F(500, ST.wm);
    const wmW = x.measureText("@_CryptoSurf").width;
    const wmX = Wd - Pd - Rgt;
    if (Pd + titleW + 8 > wmX - wmW) {
      ST = Object.assign({}, ST, { tt: Math.max(16, ST.tt - 1) });
    }
    F(600, ST.tt); Tx(title, Pd, ST.ty, INK);
    F(500, ST.wm); Tx("@_CryptoSurf", wmX, ST.ty, ST.wmc, "right");

    const W = DATA.W, cl = DATA.cl, sm = DATA.sm, f = DATA.f;
    const tStart = ms(W[f][0]);
    const tEnd = ms(W[W.length - 1][0]) + (1 + PADW) * 7 * DAY;

    let lo = Infinity, hi = -Infinity;
    if (isPrice) {
      for (let i = f; i < W.length; i++) {
        lo = Math.min(lo, cl[i], sm[i]);
        hi = Math.max(hi, cl[i], sm[i]);
      }
    } else {
      for (let i = f; i < W.length; i++) {
        const r = cl[i] / sm[i];
        lo = Math.min(lo, r); hi = Math.max(hi, r);
      }
    }
    const HR = 1.15, top = hi * HR, bot = lo / HR;
    const relTicks = [0.0625, 0.125, 0.25, 0.5, 1, 2, 4, 8, 16, 32, 64, 128];
    const usdTicks = (function () {
      const out = [];
      [1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 0.1, 1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13].forEach(function (base) {
        out.push(base, base * 2, base * 5);
      });
      return out;
    })();
    let ticks = (isPrice ? usdTicks : relTicks).filter(function (v) { return v >= bot && v <= top; });
    if (ST.mobile) {
      if (isPrice) {
        const keep = { 0.0001: 1, 0.001: 1, 0.01: 1, 0.1: 1, 1: 1, 10: 1, 20: 1, 100: 1, 1000: 1, 10000: 1, 100000: 1, 1e6: 1, 1e9: 1, 1e10: 1, 1e11: 1, 1e12: 1, 1e13: 1 };
        ticks = ticks.filter(function (v) { return keep[v]; });
      } else {
        const keep = { 1: 1, 4: 1, 16: 1 };
        ticks = ticks.filter(function (v) { return keep[v]; });
      }
    }
    const tickLab = isPrice ? usdTick : rTick;

    F(400, ST.fs);
    const labW = Math.max.apply(null,
      ["$100k", "$2.2T", "$200B", "$0.0001", "16x", "32x"].concat(ticks.map(tickLab)).map(function (q) { return x.measureText(q).width; })
    );
    const L = Math.round(Pd + (ST.mobile ? 8 : 12) + labW);
    const Rx = Wd - Pd - Rgt;
    const T = ST.T, B = ST.B;
    const l1 = Math.log10(top), l0 = Math.log10(bot);
    const Yr = function (v) { return T + ((l1 - Math.log10(v)) / (l1 - l0)) * (B - T); };
    const X = function (t) { return L + ((t - tStart) / (tEnd - tStart)) * (Rx - L); };

    ticks.forEach(function (v) {
      const ref = !isPrice && v === 1;
      const y = ref ? Math.round(Yr(1)) : Math.round(Yr(v));
      if (ref) { x.fillStyle = LINE; x.fillRect(L, y - 1, Rx - L, 2); }
      else { x.fillStyle = GRID; x.fillRect(L, y, Rx - L, 1); }
      F(400, ST.fs);
      Tx(tickLab(v), L - 6, y + ST.fs * 0.35, ref ? GREY : AX, "right");
    });

    F(400, ST.fs);
    const y0 = new Date(tStart).getUTCFullYear();
    const y1 = new Date(tEnd).getUTCFullYear();
    const step = ST.yearStep || 1;
    let yy0 = y0;
    if (step > 1 && yy0 % 2) yy0 += 1;
    for (let yy = yy0; yy <= y1; yy += step) {
      const tw = x.measureText(String(yy)).width;
      let xx = X(Date.UTC(yy, 0, 1));
      // Nudge a first year that sits against the left axis, but only if the
      // year tick itself is in (or just left of) the plot and the nudged
      // label won't collide with the next year (e.g. skip 2012 on 2Y mobile
      // where 2014 is the next even year).
      if (xx >= L - 8 && xx - tw / 2 < L + 2 && xx + tw / 2 < Rx) {
        const nudged = L + tw / 2 + (ST.mobile ? 3 : 4);
        const nextX = X(Date.UTC(yy + step, 0, 1));
        if (nudged + tw / 2 + 2 <= nextX - tw / 2) {
          xx = nudged;
        }
      }
      if (xx - tw / 2 >= L && xx + tw / 2 <= Rx) {
        Tx(String(yy), xx, B + ST.yr, AX, "center");
      }
    }

    const pts = [];
    for (let i = f; i < W.length; i++) {
      const t = ms(W[i][0]);
      pts.push({
        x: X(t),
        p: cl[i],
        s: sm[i],
        r: cl[i] / sm[i],
        yp: Yr(isPrice ? cl[i] : cl[i] / sm[i]),
        ys: Yr(isPrice ? sm[i] : 1),
      });
    }

    x.lineJoin = "round";
    x.lineCap = "round";

    if (isPrice) {
      x.beginPath();
      pts.forEach(function (q, k) { k ? x.lineTo(q.x, q.ys) : x.moveTo(q.x, q.ys); });
      x.strokeStyle = SMA_C;
      x.lineWidth = ST.smaw;
      x.stroke();
      drawSplitPrice(x, pts, ST.lw);
    } else {
      const Y1 = Math.round(Yr(1));
      const line = function () {
        x.beginPath();
        pts.forEach(function (q, k) { k ? x.lineTo(q.x, q.yp) : x.moveTo(q.x, q.yp); });
        x.stroke();
      };
      x.lineWidth = ST.lw;
      x.save(); x.beginPath(); x.rect(0, 0, Wd, Y1); x.clip(); x.strokeStyle = GREY; line(); x.restore();
      x.save(); x.beginPath(); x.rect(0, Y1, Wd, H - Y1); x.clip(); x.strokeStyle = BUYC; line(); x.restore();
    }

    const last = pts[pts.length - 1];
    // Dot matches the line at the last point: blue at or below the SMA / 1×.
    // Size in CSS/layout px only (then multiplied by DPR). Radius = line width
    // (diameter 2× the line). Same ratio on desktop, mobile, and share PNGs.
    const below = last.p <= last.s;
    const dotR = ST.lw;
    const dotStroke = ST.mobile ? 0.8 : 1;
    x.fillStyle = below ? BUYC : GREY;
    x.strokeStyle = BG;
    x.lineWidth = dotStroke;
    x.beginPath();
    x.arc(last.x, last.yp, dotR, 0, Math.PI * 2);
    x.fill();
    x.stroke();
    last.dotR = dotR;
    last.dotStroke = dotStroke;
    last.lw = ST.lw;

    F(600, ST.lg);
    const unit = COIN.unit || "Price";
    const acc = unit + " \u2264 " + def.smaLabel + " \u27f6 ";
    const zone = "DCA ZONE";
    if (ST.mobile && isPrice) {
      const lyKey = ST.ly1;
      x.strokeStyle = SMA_C;
      x.lineWidth = ST.smaw;
      x.lineCap = "butt";
      x.beginPath();
      x.moveTo(Pd, lyKey - 4);
      x.lineTo(Pd + 18, lyKey - 4);
      x.stroke();
      x.lineCap = "round";
      Tx(def.smaLabel, Pd + 24, lyKey, INK);
      Tx(acc, Pd, ST.ly, INK);
      Tx(zone, Pd + x.measureText(acc).width, ST.ly, BUYC);
    } else {
      let lx = Pd;
      if (isPrice) {
        x.strokeStyle = SMA_C;
        x.lineWidth = ST.smaw;
        x.lineCap = "butt";
        x.beginPath();
        x.moveTo(lx, ST.ly - 5);
        x.lineTo(lx + 22, ST.ly - 5);
        x.stroke();
        x.lineCap = "round";
        Tx(def.smaLabel, lx + 28, ST.ly, INK);
        lx += 28 + x.measureText(def.smaLabel).width + 22;
      }
      Tx(acc, lx, ST.ly, INK);
      Tx(zone, lx + x.measureText(acc).width, ST.ly, BUYC);
    }

    x.fillStyle = "#2c333d";
    x.fillRect(Pd, ST.ny, Wd - 2 * Pd, 1);

    const price = DATA.lastPx, smaV = DATA.lastSma, mult = price / smaV;
    const unitUp = unit.toUpperCase();
    const nums = [
      [unitUp, fv(price), INK],
      [def.smaLabel, fv(smaV), INK],
      [unitUp + " / " + def.smaLabel, mult.toFixed(2) + "x", mult <= 1 ? BUYC : INK],
    ];
    const cw = (Wd - 2 * Pd) / 3;
    nums.forEach(function (q, jj) {
      F(400, ST.ml); Tx(q[0], Pd + jj * cw, ST.ny + ST.mly, ST.mlc);
      F(800, ST.mv); Tx(q[1], Pd + jj * cw, ST.ny + ST.mvy, q[2]);
    });

    return {
      L: L, Rx: Rx, T: T, B: B, top: top, bot: bot, ticks: ticks,
      last: last, price: price, sma: smaV, mult: mult,
      layout: ST.mobile ? "mobile" : "desktop", W: Wd, H: H,
      start: DATA.start, n: DATA.n, smaLabel: def.smaLabel,
      closedBelow: DATA.closedBelow, closedN: DATA.closedN,
      plottedBelow: DATA.plottedBelow, plottedN: DATA.plottedN,
      liveBelow: DATA.liveBelow,
    };
  }

  const cards = {};
  let SHARED = null;

  function attachCard(def, DATA) {
    const root = document.querySelector('.card[data-card="' + def.id + '"]');
    if (!root) throw new Error("missing card " + def.id);
    const canvas = root.querySelector("canvas");
    const stage = root.querySelector(".stage");
    const group = root.querySelector(".toggle");
    const shareBtn = root.querySelector(".share");
    let MODE = START;
    let lastCssW = 0;

    if (DATA.insufficient) {
      root.classList.add("is-short");
      if (stage && !stage.querySelector(".short-msg")) {
        const msg = document.createElement("p");
        msg.className = "short-msg";
        msg.textContent = cardSentence(DATA);
        stage.appendChild(msg);
      }
      return {
        id: def.id, root: root,
        setMode: function () { return { insufficient: true }; },
        getMode: function () { return MODE; },
        onResize: function () {},
        exportPng: function () { return null; },
        shareInfo: function () { return { insufficient: true }; },
      };
    }

    function displayLayout(mode) {
      if (SHARE) return desktopLayout();
      const cssW = stage && stage.clientWidth ? stage.clientWidth : (window.innerWidth || SHARE_W);
      if (cssW < MOBILE_MAX) return mobileLayout(cssW, mode);
      return desktopLayout();
    }

    function draw(mode) {
      const layout = displayLayout(mode);
      const x = sizeCanvas(canvas, layout);
      lastCssW = layout.mobile ? layout.W : (stage && stage.clientWidth) || layout.W;
      const meta = drawInto(x, mode, layout, DATA, def);
      canvas.setAttribute(
        "aria-label",
        (mode === "price" ? def.ariaPrice : def.ariaRel) +
          ". Price " + fv(DATA.lastPx) + ", " + def.smaLabel + " " + fv(DATA.lastSma) +
          ", " + (DATA.lastPx / DATA.lastSma).toFixed(2) + " times."
      );
      return meta;
    }

    function setMode(mode, opts) {
      MODE = mode === "price" ? "price" : "relative";
      group.querySelectorAll("[data-mode]").forEach(function (b) {
        b.setAttribute("aria-checked", b.getAttribute("data-mode") === MODE ? "true" : "false");
      });
      const meta = draw(MODE);
      if (opts && opts.focus) {
        const el = group.querySelector('.toggle [data-mode="' + MODE + '"], [data-mode="' + MODE + '"]');
        if (el) el.focus();
      }
      return meta;
    }

    function renderShareCanvas(mode) {
      const layout = desktopLayout();
      const off = document.createElement("canvas");
      off.width = SHARE_W * SHARE_D;
      off.height = SHARE_H * SHARE_D;
      const x = off.getContext("2d");
      x.scale(SHARE_D, SHARE_D);
      drawInto(x, mode, layout, DATA, def);
      const out = document.createElement("canvas");
      out.width = SHARE_W;
      out.height = SHARE_H;
      const c = out.getContext("2d");
      c.imageSmoothingEnabled = true;
      c.drawImage(off, 0, 0, SHARE_W, SHARE_H);
      return out;
    }

    function downloadPng() {
      const out = renderShareCanvas(MODE);
      const a = document.createElement("a");
      a.href = out.toDataURL("image/png");
      a.download = def.file + "-" + MODE + ".png";
      a.click();
    }

    group.addEventListener("click", function (e) {
      const b = e.target.closest("[data-mode]");
      if (!b) return;
      setMode(b.getAttribute("data-mode"));
    });
    group.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "ArrowUp" && e.key !== "ArrowDown" && e.key !== "Home" && e.key !== "End") return;
      e.preventDefault();
      if (e.key === "Home") return setMode("relative", { focus: true });
      if (e.key === "End") return setMode("price", { focus: true });
      setMode(MODE === "relative" ? "price" : "relative", { focus: true });
    });
    shareBtn.addEventListener("click", downloadPng);

    function onResize() {
      if (SHARE) return;
      const w = stage ? stage.clientWidth : 0;
      if (Math.abs(w - lastCssW) < 1) return;
      draw(MODE);
    }

    setMode(MODE);

    return {
      id: def.id,
      def: def,
      data: DATA,
      root: root,
      canvas: canvas,
      getMode: function () { return MODE; },
      setMode: setMode,
      draw: draw,
      onResize: onResize,
      exportPng: function (mode) { return renderShareCanvas(mode || MODE).toDataURL("image/png"); },
      shareInfo: function (mode) {
        const m = mode || MODE;
        const layout = desktopLayout();
        const off = document.createElement("canvas");
        off.width = 8; off.height = 8;
        const meta = drawInto(off.getContext("2d"), m, layout, DATA, def);
        const last = meta.last || {};
        return {
          id: def.id, mode: m, price: meta.price, sma: meta.sma, mult: meta.mult,
          L: meta.L, Rx: meta.Rx, T: meta.T, B: meta.B, W: meta.W, H: meta.H,
          top: meta.top, bot: meta.bot, ticks: meta.ticks,
          start: meta.start, n: meta.n, smaLabel: def.smaLabel,
          closedBelow: meta.closedBelow, closedN: meta.closedN,
          plottedBelow: meta.plottedBelow, plottedN: meta.plottedN,
          liveBelow: meta.liveBelow,
          last: {
            x: last.x, yp: last.yp, p: last.p, s: last.s, r: last.r,
            below: last.p <= last.s, dotR: last.dotR, dotStroke: last.dotStroke, lw: last.lw
          }
        };
      },
    };
  }

  function joinAnd(items) {
    if (!items.length) return "";
    if (items.length === 1) return items[0];
    if (items.length === 2) return items[0] + " and " + items[1];
    return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
  }
  function availableLabels(cards) {
    const byId = {};
    (cards || []).forEach(function (d) { byId[d.id] = d; });
    return AVG_ORDER.filter(function (id) { return byId[id] && !byId[id].insufficient; })
      .map(function (id) { return byId[id].short; });
  }
  function topLineText(n, t, list) {
    const name = COIN.name;
    if (t <= 0) return name + " does not have enough history for these averages yet.";
    if (n <= 0) return name + " is above all " + t + " key averages: " + list + ".";
    if (n < t) return name + " is below " + n + " of " + t + " key averages: " + list + ".";
    return name + " is below all " + t + " key averages: " + list + ".";
  }
  function topLineHtml(n, t, list) {
    if (t <= 0) return COIN.name + " does not have enough history for these averages yet.";
    const nEl = n >= 1
      ? '<span class="n nowrap">' + (n === t ? "all " + t : String(n)) + "</span>"
      : '<span class="n n-above nowrap">all ' + t + "</span>";
    const name = '<span class="nowrap">' + COIN.name + "</span>";
    const av = '<span class="nowrap">' + list + ".</span>";
    if (n <= 0) return name + " is above " + nEl + " key averages: " + av;
    if (n < t) return name + " is below " + nEl + " of " + t + " key averages: " + av;
    return name + " is below " + nEl + " key averages: " + av;
  }
  function cardSentence(d) {
    if (d.insufficient) {
      return "Not enough history yet for the " + d.smaLabel +
        " — it needs " + d.need + " weekly closes (" + COIN.name + " has " + d.weeks + ").";
    }
    return COIN.name + " has closed at or below its " + d.smaLabel + " in " +
      d.closedBelow + " of " + d.closedN + " weeks.";
  }
  function cardSentenceHtml(d) {
    if (d.insufficient) return cardSentence(d);
    return COIN.name + " has closed at or below its " + d.smaLabel +
      " in <span class=\"count nowrap\">" + d.closedBelow + " of " + d.closedN + " weeks.</span>";
  }

  function setNote() {
    const el = document.getElementById("note");
    if (!el || !SHARED) return;
    const live = SHARED.live;
    const first = SHARED.cards[0];
    if (first.liveOn) {
      const d = new Date(live.at);
      el.textContent = "Live price · updated " + fmtHM(d);
      el.title = LIVE_SRC + " · " + d.toLocaleString();
    } else if (!COIN.liveUrl) {
      el.textContent = "Updated weekly · last close " + fmtBarEnd(first.lastWeek);
      el.title = first.source || "weekly close";
    } else {
      el.textContent = "Cached close · " + fmtCached(first.pass);
      el.title = first.source || "cached";
    }
  }

  function setPageCopy() {
    if (!SHARED) return;
    setNote();
    const usable = SHARED.cards.filter(function (d) { return !d.insufficient; });
    const below = usable.filter(function (d) { return d.liveBelow; });
    const n = below.length, t = usable.length;
    const list = joinAnd(availableLabels(SHARED.cards));
    const line = topLineText(n, t, list);
    const h = document.getElementById("topline");
    if (h) {
      h.innerHTML = topLineHtml(n, t, list);
      h.setAttribute("data-n", String(n));
      h.setAttribute("data-t", String(t));
    }
    const sentences = {};
    SHARED.cards.forEach(function (d) {
      const text = cardSentence(d);
      sentences[d.id] = text;
      const el = document.querySelector('.card-sentence[data-sentence="' + d.id + '"]');
      if (el) el.innerHTML = cardSentenceHtml(d);
    });
    window.__PAGE = {
      coin: COIN.id,
      name: COIN.name,
      n: n,
      t: t,
      list: list,
      line: line,
      below: below.map(function (d) { return d.id; }),
      sentences: sentences,
      price: SHARED.cards[0].lastPx,
      lastWeek: SHARED.cards[0].lastWeek,
      lastCloseEnd: SHARED.cards[0].lastCloseEnd,
    };
  }

  function initChrome() {
    document.title = COIN.name + " · SurfDCA";
    document.querySelectorAll(".coins a[data-coin]").forEach(function (a) {
      const on = a.getAttribute("data-coin") === COIN.id;
      a.classList.toggle("is-current", on);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    const sel = document.querySelector(".coins-select");
    if (sel) {
      sel.value = COIN.id;
      if (!sel._bound) {
        sel._bound = true;
        sel.addEventListener("change", function () {
          const id = sel.value;
          location.href = id === "btc" ? "index.html" : "index.html?coin=" + encodeURIComponent(id);
        });
      }
    }
    const lede = document.getElementById("lede");
    if (lede) {
      lede.innerHTML = "The more of these averages " + COIN.name +
        " is at or below, the better the <span class=\"nowrap\">long-term</span> value for DCA.";
    }
  }

  function boot() {
    initChrome();
    if (SHARE) {
      document.body.classList.add("share-only");
      if (SHARE_CARD) {
        const el = document.querySelector('.card[data-card="' + SHARE_CARD + '"]');
        if (el) el.classList.add("share-target");
        else document.querySelector(".card").classList.add("share-target");
      } else {
        const el = document.querySelector(".card");
        if (el) el.classList.add("share-target");
      }
    }
    return fetch(COIN.data)
      .then(function (r) { return r.json(); })
      .then(function (jw) {
        var liveP;
        if (SHARE || !COIN.liveUrl) {
          liveP = Promise.resolve(null);
        } else {
          liveP = fetchLive().catch(function () { return null; });
        }
        return liveP.then(function (live) {
          if (!COIN.liveUrl) {
            const snap = parseSnapshot(jw.pass, jw.source);
            jw = Object.assign({}, jw, { W: dropInProgressWeeks(jw.W || [], snap) });
          }
          const cl0 = (jw.W || []).map(function (b) { return +b[4]; });
          const fShow = showStartIndex(cl0, CARD_DEFS);
          const built = CARD_DEFS.map(function (def) { return applyCard(jw, live, def, fShow); });
          SHARED = { live: live, cards: built, source: jw.source, pass: jw.pass };
          built.forEach(function (DATA, i) {
            const inst = attachCard(CARD_DEFS[i], DATA);
            cards[inst.id] = inst;
          });
          setPageCopy();
          let rt = 0;
          const kick = function () {
            clearTimeout(rt);
            rt = setTimeout(function () {
              Object.keys(cards).forEach(function (id) { cards[id].onResize(); });
            }, 80);
          };
          window.addEventListener("resize", kick);
          window.addEventListener("orientationchange", function () { setTimeout(kick, 160); });
          if (window.ResizeObserver) {
            Object.keys(cards).forEach(function (id) {
              new ResizeObserver(kick).observe(cards[id].root.querySelector(".stage"));
            });
          }
          window.__LIVE = {
            ok: !!(live && live.price > 0),
            source: live && live.price > 0 ? live.source
              : (COIN.liveUrl ? "cached" : "weekly close"),
            url: live && live.url ? live.url : null,
            price: built[0].lastPx,
            cachedClose: built[0].cachedClose,
            pass: built[0].pass,
            sourceWeekly: built[0].source,
            lastWeek: built[0].lastWeek,
            at: live && live.at,
            coin: COIN.id,
          };
          window.__CARDS = built.map(function (d) {
            return {
              id: d.id, n: d.n, smaLabel: d.smaLabel, start: d.start, lastWeek: d.lastWeek,
              price: d.lastPx, sma: d.lastSma,
              mult: d.lastSma ? d.lastPx / d.lastSma : null,
              closedBelow: d.closedBelow, closedN: d.closedN,
              plottedBelow: d.plottedBelow, plottedN: d.plottedN,
              liveBelow: d.liveBelow,
              insufficient: !!d.insufficient,
              weeks: d.weeks, need: d.need,
            };
          });
          window.__READY = true;
          return window.__CARDS;
        });
      })
      .catch(function (e) {
        window.__ERR = String(e && e.stack ? e.stack : e);
        const el = document.getElementById("note");
        if (el) el.textContent = "Could not load the weekly data.";
        throw e;
      });
  }

  window.RUN = boot;
  window.__draw = function (cardId, mode) {
    if (mode == null && (cardId === "relative" || cardId === "price")) {
      mode = cardId; cardId = null;
    }
    if (!cardId) {
      return Object.keys(cards).map(function (id) { return cards[id].setMode(mode || cards[id].getMode()); });
    }
    return cards[cardId].setMode(mode || cards[cardId].getMode());
  };
  window.__exportPng = function (cardId, mode) {
    const id = cardId || SHARE_CARD || "200w";
    return cards[id].exportPng(mode || cards[id].getMode());
  };
  window.__shareInfo = function (cardId, mode) {
    const id = cardId || SHARE_CARD || "200w";
    return cards[id].shareInfo(mode);
  };
  boot();
})();

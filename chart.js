/* BTC vs 200W SMA — three zones (PADDLE / RIDE / KICK OUT).
   Weekly or monthly high-low bars (real OHLC from CRYPTO:BTCUSD), Relative / Price and Weekly / Monthly toggles. Live Binance BTCUSDT
   (no key), falling back to the cached close. On-page mobile: CSS
   width + DPR backing store. Share PNG is always the 1200×675
   desktop card. Live-dot radius equals the line width (CSS/layout
   px, then multiplied only by DPR). Local preview only. */
(function () {
  "use strict";
  const FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,Inter,sans-serif';
  const BG = "#12161c", GRID = "#272d36", AX = "#b0b6bf";
  const GREY = "#c9ced6", LINE = "#6b7583", INK = "#f2f1ec";
  const SMA_C = "#8a919c";
  const ZONES = {
    paddle: { id: "paddle", name: "PADDLE", color: "#0f62fe",
      range: "below 1\u00d7", gloss: "build while it's quiet",
      action: "DCA in" },
    ride:   { id: "ride",   name: "RIDE",   color: "#00bcd4",
      range: "1\u00d7\u20132\u00d7", gloss: "stay in, keep the plan",
      action: "HODL" },
    kick:   { id: "kick",   name: "KICK OUT", color: "#ff9800",
      range: "above 2\u00d7", gloss: "take some profit",
      action: "DCA out" },
  };
  const ZONE_ORDER = ["paddle", "ride", "kick"];
  const SHARE_W = 1200, SHARE_H = 675, SHARE_D = 2;
  // Legend moved off the card; the plot uses that space. Year labels
  // still sit ~31px above the metrics divider.
  const DESKTOP_ST = {
    Pd: 56, Rgt: 4,
    tt: 36, ty: 82, wm: 20, wmc: "#8a919c",
    fs: 17.5, T: 108, B: 516, yr: 26,
    lg: 16.5, ly: 499, lh: 22, ny: 578,
    ml: 16, mlc: "#a7adb6", mv: 30,
    mly: 26, mvy: 62,
    lw: 3, smaw: 1.75, yearStep: 2,
  };
  const DAY = 864e5, PADW = 43, PADM = 10, MOBILE_MAX = 720;
  const BN = "https://data-api.binance.vision/api/v3/ticker/price?symbol=";
  const COIN_DEFS = {
    btc:  { id: "btc",  name: "BTC",  data: "data/btc-weekly.json",
            monthly: "data/btc-monthly.json",
            unit: "Price", liveUrl: BN + "BTCUSDT",  liveSrc: "Binance BTCUSDT" },
    ltc:  { id: "ltc",  name: "LTC",  data: "data/ltc-weekly.json",
            monthly: "data/ltc-monthly.json",
            unit: "Price", liveUrl: BN + "LTCUSDT",  liveSrc: "Binance LTCUSDT" },
    doge: { id: "doge", name: "DOGE", data: "data/doge-weekly.json",
            monthly: "data/doge-monthly.json",
            unit: "Price", liveUrl: BN + "DOGEUSDT", liveSrc: "Binance DOGEUSDT" },
  };
  const Q = new URLSearchParams(location.search);
  const COIN = COIN_DEFS[(Q.get("coin") || "btc").toLowerCase()] || COIN_DEFS.btc;
  const LIVE_URL = COIN.liveUrl;
  const LIVE_SRC = COIN.liveSrc;
  const SHARE = Q.get("share") === "1" || Q.get("cache") === "1";
  const START = Q.get("mode") === "price" ? "price" : "relative";
  const START_TF = Q.get("tf") === "monthly" ? "monthly" : "weekly";
  const SHARE_CARD = (Q.get("card") || "").toLowerCase();

  const CARD_DEFS = [{
    id: "200w", n: 200, smaLabel: "200W SMA", short: "200W",
    titleRel: COIN.name + " vs 200W SMA",
    titlePrice: COIN.name + " price vs 200W SMA",
    ariaRel: COIN.name + " versus 200-week SMA, weekly high-low bars, relative, three zones",
    ariaPrice: COIN.name + " price versus 200-week SMA, weekly high-low bars, three zones",
    file: COIN.id + "-200w-weekly",
  }];

  function zoneOfR(r) {
    if (!(r > 0) || !isFinite(r)) return "ride";
    if (r <= 1) return "paddle";
    if (r < 2) return "ride";
    return "kick";
  }
  function zoneColor(r) { return ZONES[zoneOfR(r)].color; }

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
  function ms(s) { return Date.parse(s + "T00:00:00Z"); }
  function pad2(n) { return String(n).padStart(2, "0"); }
  function fmtHM(d) { return pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }
  function fmtCached(pass) {
    const m = /(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/.exec(pass || "");
    if (!m) return pass || "cached close";
    const d = new Date(m[1] + "T" + m[2] + ":00+01:00");
    const mon = d.toLocaleString(undefined, { month: "short" });
    return d.getDate() + " " + mon + " " + d.getFullYear() + ", " + fmtHM(d);
  }

  function addDaysIso(iso, days) {
    const d = new Date(ms(iso) + days * DAY);
    return d.toISOString().slice(0, 10);
  }
  function addMonthsIso(iso, n) {
    const parts = iso.split("-");
    const dt = new Date(Date.UTC(+parts[0], +parts[1] - 1 + n, +parts[2] || 1));
    return dt.toISOString().slice(0, 10);
  }
  function lastDayOfMonth(iso) {
    const parts = iso.split("-");
    const dt = new Date(Date.UTC(+parts[0], +parts[1], 0));
    return dt.toISOString().slice(0, 10);
  }
  function weekCloseIso(startIso) {
    // Weekly bars are Monday-start; the close lands on Sunday (start + 6 days).
    return addDaysIso(startIso, 6);
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

  function desktopLayout(mode) {
    const isPrice = mode === "price";
    return Object.assign({
      W: SHARE_W, H: SHARE_H, dpr: SHARE_D, mobile: false,
    }, DESKTOP_ST, { Rgt: isPrice ? 70 : 4 });
  }

  function mobileLayout(cssW, mode) {
    const W = Math.max(280, Math.round(cssW));
    const isPrice = mode === "price";
    const Pd = 14, Rgt = isPrice ? 58 : 8;
    const tt = 18, ty = 28, wm = 12, fs = 11;
    const T = 44, plotH = Math.max(190, Math.round(W * 0.56));
    const B = T + plotH, yr = 17, lg = 12.5, lh = 17;
    // Clear gap between year-label glyphs and the metrics divider (~16px).
    const ly1 = B + yr + 29;
    const ny = ly1;
    const H = ny + 50;
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    return {
      W: W, H: H, dpr: dpr, mobile: true,
      Pd: Pd, Rgt: Rgt,
      tt: tt, ty: ty, wm: wm, wmc: "#8a919c",
      fs: fs, T: T, B: B, yr: yr,
      lg: lg, ly: ly1, lh: lh, ly1: ly1, ny: ny,
      ml: 10, mlc: "#a7adb6", mv: 17, mly: 18, mvy: 38,
      lw: 2.25, smaw: 1.5, yearStep: 4,
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

  function applyCard(jw, live, def) {
    const W = jw.W.map(function (b) { return b.slice(); });
    const cachedClose = W.length ? +W[W.length - 1][4] : null;
    const liveOn = !!(live && live.price > 0);
    const lastPx = liveOn ? live.price : cachedClose;
    if (W.length) {
      // Live close feeds the 200W SMA. Live price also extends the
      // in-progress week's real high or low; it never invents a range.
      W[W.length - 1][4] = lastPx;
      if (liveOn) {
        const last = W[W.length - 1];
        last[2] = Math.max(+last[2], lastPx);
        last[3] = Math.min(+last[3], lastPx);
      }
    }
    const cl = W.map(function (b) { return +b[4]; });
    const hi = W.map(function (b) { return +b[2]; });
    const loA = W.map(function (b) { return +b[3]; });
    const sm = smaArr(cl, def.n);
    const f = sm.findIndex(function (s) { return s != null; });
    if (f < 0) {
      return {
        id: def.id, n: def.n, smaLabel: def.smaLabel, short: def.short,
        insufficient: true, weeks: W.length, need: def.n,
        source: jw.source || "", pass: jw.pass || "",
        liveOn: liveOn, live: live || null,
        cachedClose: cachedClose, lastPx: lastPx, lastSma: null,
        start: null, lastWeek: W.length ? W[W.length - 1][0] : null,
        closedN: 0, closedPaddle: 0, closedRide: 0, closedKick: 0,
        closedLowAtOrBelow1: 0, closedHighAtOrAbove2: 0,
        closedInside12: 0, closedBoth: 0,
        liveZone: null, liveMult: null, missingHL: 0,
        interval: "weekly",
      };
    }
    // Refuse to invent highs or lows: every plotted week must already
    // carry a real high and low from the feed.
    let missingHL = 0;
    for (let i = f; i < W.length; i++) {
      const h = hi[i], l = loA[i];
      if (!(h > 0) || !(l > 0) || !isFinite(h) || !isFinite(l) || h < l) missingHL++;
    }
    // Open last bar (live) is excluded from closed-week counts.
    const countEnd = W.length - 1;
    let closedN = 0, closedPaddle = 0, closedRide = 0, closedKick = 0;
    let closedLowAtOrBelow1 = 0, closedHighAtOrAbove2 = 0;
    let closedInside12 = 0, closedBoth = 0;
    for (let i = f; i < countEnd; i++) {
      closedN++;
      const z = zoneOfR(cl[i] / sm[i]);
      if (z === "paddle") closedPaddle++;
      else if (z === "ride") closedRide++;
      else closedKick++;
      const rLo = loA[i] / sm[i], rHi = hi[i] / sm[i];
      const a = rLo <= 1, b = rHi >= 2;
      if (a) closedLowAtOrBelow1++;
      if (b) closedHighAtOrAbove2++;
      if (a && b) closedBoth++;
      if (!a && !b) closedInside12++;
    }
    const lastSma = sm[sm.length - 1];
    const liveMult = lastPx / lastSma;
    const liveZone = zoneOfR(liveMult);
    return {
      id: def.id, n: def.n, smaLabel: def.smaLabel, short: def.short,
      W: W, cl: cl, hi: hi, lo: loA, sm: sm, f: f,
      source: jw.source || "",
      pass: jw.pass || "",
      liveOn: liveOn,
      live: live || null,
      cachedClose: cachedClose,
      lastPx: lastPx,
      lastSma: lastSma,
      liveMult: liveMult,
      liveZone: liveZone,
      start: W[f][0],
      lastWeek: W[W.length - 1][0],
      closedN: closedN,
      closedPaddle: closedPaddle,
      closedRide: closedRide,
      closedKick: closedKick,
      closedLowAtOrBelow1: closedLowAtOrBelow1,
      closedHighAtOrAbove2: closedHighAtOrAbove2,
      closedInside12: closedInside12,
      closedBoth: closedBoth,
      missingHL: missingHL,
      interval: "weekly",
    };
  }

  // Monthly high-low bars from real CRYPTO:BTCUSD monthly OHLC.
  // The 200W itself stays a weekly-close average. For each calendar month
  // the divisor is the 200W as of the last weekly close on or before
  // that month's last calendar day (a Monday-start week closes on Sunday).
  // For the open current month, that is the latest 200W, including the
  // live week's close, so the live ratio matches the weekly view.
  function applyMonthly(jm, weeklyData, live, def) {
    const bars = jm.M || jm.W;
    if (!bars || !bars.length) {
      return {
        id: def.id, insufficient: true, interval: "monthly", missingHL: 0,
        need: def.n, weeks: 0, source: jm.source || "", pass: jm.pass || "",
      };
    }
    const W = bars.map(function (b) { return b.slice(); });
    const cachedClose = W.length ? +W[W.length - 1][4] : null;
    const liveOn = !!(live && live.price > 0);
    const lastPx = liveOn ? live.price : (weeklyData && weeklyData.lastPx) || cachedClose;
    if (W.length) {
      W[W.length - 1][4] = lastPx;
      if (liveOn) {
        const last = W[W.length - 1];
        last[2] = Math.max(+last[2], lastPx);
        last[3] = Math.min(+last[3], lastPx);
      }
    }
    const wW = weeklyData.W, wSm = weeklyData.sm;
    const weeklyCloses = [];
    if (wW && wSm) {
      for (let i = 0; i < wW.length; i++) {
        if (wSm[i] == null) continue;
        weeklyCloses.push({
          closeIso: weekCloseIso(wW[i][0]),
          sma: wSm[i],
          t: ms(wW[i][0]),
        });
      }
    }
    const cl = W.map(function (b) { return +b[4]; });
    const hi = W.map(function (b) { return +b[2]; });
    const loA = W.map(function (b) { return +b[3]; });
    const sm = new Array(W.length).fill(null);
    let wi = 0;
    for (let i = 0; i < W.length; i++) {
      const end = lastDayOfMonth(W[i][0]);
      let best = null;
      while (wi < weeklyCloses.length && weeklyCloses[wi].closeIso <= end) {
        best = weeklyCloses[wi];
        wi++;
      }
      if (best) {
        sm[i] = best.sma;
        // Rewind one so the next (later) month can start from this close
        // and walk forward; month ends are non-decreasing.
        wi = Math.max(0, wi - 1);
      }
    }
    const f = sm.findIndex(function (v) { return v != null; });
    if (f < 0) {
      return {
        id: def.id, n: def.n, smaLabel: def.smaLabel, short: def.short,
        insufficient: true, weeks: W.length, need: def.n,
        source: jm.source || "", pass: jm.pass || "",
        liveOn: liveOn, live: live || null,
        cachedClose: cachedClose, lastPx: lastPx, lastSma: null,
        start: null, lastWeek: W.length ? W[W.length - 1][0] : null,
        closedN: 0, closedPaddle: 0, closedRide: 0, closedKick: 0,
        closedLowAtOrBelow1: 0, closedHighAtOrAbove2: 0,
        closedInside12: 0, closedBoth: 0,
        liveZone: weeklyData.liveZone, liveMult: weeklyData.liveMult,
        missingHL: 0, interval: "monthly",
      };
    }
    let missingHL = 0;
    for (let i = f; i < W.length; i++) {
      const h = hi[i], l = loA[i];
      if (!(h > 0) || !(l > 0) || !isFinite(h) || !isFinite(l) || h < l) missingHL++;
    }
    const countEnd = W.length - 1;
    let closedN = 0, closedPaddle = 0, closedRide = 0, closedKick = 0;
    let closedLowAtOrBelow1 = 0, closedHighAtOrAbove2 = 0;
    let closedInside12 = 0, closedBoth = 0;
    for (let i = f; i < countEnd; i++) {
      closedN++;
      const z = zoneOfR(cl[i] / sm[i]);
      if (z === "paddle") closedPaddle++;
      else if (z === "ride") closedRide++;
      else closedKick++;
      const rLo = loA[i] / sm[i], rHi = hi[i] / sm[i];
      const a = rLo <= 1, b = rHi >= 2;
      if (a) closedLowAtOrBelow1++;
      if (b) closedHighAtOrAbove2++;
      if (a && b) closedBoth++;
      if (!a && !b) closedInside12++;
    }
    const lastSma = sm[sm.length - 1];
    const liveMult = lastPx / lastSma;
    const liveZone = zoneOfR(liveMult);
    const smaWeekly = weeklyCloses.map(function (w) { return { t: w.t, s: w.sma }; });
    return {
      id: def.id, n: def.n, smaLabel: def.smaLabel, short: def.short,
      W: W, cl: cl, hi: hi, lo: loA, sm: sm, f: f,
      source: jm.source || "",
      pass: jm.pass || "",
      liveOn: liveOn,
      live: live || null,
      cachedClose: cachedClose,
      lastPx: lastPx,
      lastSma: lastSma,
      liveMult: liveMult,
      liveZone: liveZone,
      start: W[f][0],
      lastWeek: W[W.length - 1][0],
      closedN: closedN,
      closedPaddle: closedPaddle,
      closedRide: closedRide,
      closedKick: closedKick,
      closedLowAtOrBelow1: closedLowAtOrBelow1,
      closedHighAtOrAbove2: closedHighAtOrAbove2,
      closedInside12: closedInside12,
      closedBoth: closedBoth,
      missingHL: missingHL,
      interval: "monthly",
      smaWeekly: smaWeekly,
    };
  }

  // Weekly high-low bars, coloured by exact depth and split at 1× and 2×.
  // Coordinates are snapped to the backing-store pixel grid so thin bars
  // stay crisp instead of antialiasing into mush.
  function drawZonedBars(x, pts, ST, L, Rx, T, B, Yr) {
    const dpr = ST.dpr || 1;
    const snap = function (v) { return Math.round(v * dpr) / dpr; };
    const px = 1 / dpr;
    const slot0 = pts.length ? Math.max(px, pts[0].x1 - pts[0].x0) : px;
    let w;
    if (slot0 >= 1.6) w = slot0 * 0.72;
    else if (slot0 >= 0.9) w = Math.max(px, slot0 - px);
    else w = Math.max(px, slot0 * 0.92);
    w = Math.max(px, snap(w));
    x.save();
    x.beginPath();
    x.rect(L, T, Math.max(0, Rx - L), Math.max(0, B - T));
    x.clip();
    pts.forEach(function (q) {
      let x0 = snap(q.cx - w / 2);
      if (x0 < L) x0 = L;
      if (x0 + w > Rx) x0 = Math.max(L, Rx - w);
      const cuts = [q.rLo];
      if (q.rLo < 1 && q.rHi > 1) cuts.push(1);
      if (q.rLo < 2 && q.rHi > 2) cuts.push(2);
      cuts.push(q.rHi);
      for (let k = 0; k < cuts.length - 1; k++) {
        const a = cuts[k], b = cuts[k + 1];
        if (!(b > a) && !(a === b && q.rLo === q.rHi)) continue;
        const yA = Yr(q.isPrice ? a * q.s : a);
        const yB = Yr(q.isPrice ? b * q.s : b);
        let y = Math.min(yA, yB);
        let h = Math.abs(yB - yA);
        if (!(h > 0)) { y = snap((yA + yB) / 2) - px / 2; h = px; }
        else {
          const yEnd = y + h;
          y = snap(y);
          h = Math.max(px, snap(yEnd) - y);
        }
        x.fillStyle = zoneColor((a + b) / 2);
        x.fillRect(x0, y, w, h);
      }
    });
    x.restore();
  }

  function drawDashed(x, drawPath, color, width, dash) {
    x.save();
    x.strokeStyle = color;
    x.lineWidth = width;
    x.setLineDash(dash);
    x.lineCap = "butt";
    x.lineJoin = "round";
    x.beginPath();
    drawPath();
    x.stroke();
    x.restore();
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
    const isMonth = DATA.interval === "monthly";
    const tfLabel = isMonth ? "Monthly" : "Weekly";
    const title = isPrice ? def.titlePrice : def.titleRel;
    F(600, ST.tt);
    const titleW = x.measureText(title).width;
    F(500, ST.wm);
    const wmW = x.measureText("@_CryptoSurf").width;
    const wmX = Wd - Pd;
    F(500, ST.mobile ? 11 : 18);
    const subW = x.measureText(tfLabel).width;
    const subGap = ST.mobile ? 8 : 14;
    if (Pd + titleW + subGap + subW + 8 > wmX - wmW) {
      ST = Object.assign({}, ST, { tt: Math.max(16, ST.tt - 1) });
    }
    F(600, ST.tt);
    const titleW2 = x.measureText(title).width;
    Tx(title, Pd, ST.ty, INK);
    F(500, ST.mobile ? 11 : 18);
    if (Pd + titleW2 + subGap + subW + 8 <= wmX - wmW) {
      Tx(tfLabel, Pd + titleW2 + subGap, ST.ty, ST.wmc);
    }
    F(500, ST.wm); Tx("@_CryptoSurf", wmX, ST.ty, ST.wmc, "right");

    const W = DATA.W, cl = DATA.cl, sm = DATA.sm, f = DATA.f;
    const tStart = ms(W[f][0]);
    const tEnd = isMonth
      ? ms(addMonthsIso(W[W.length - 1][0], 1 + PADM))
      : ms(W[W.length - 1][0]) + (1 + PADW) * 7 * DAY;

    const hiA = DATA.hi, loA = DATA.lo;
    let lo = Infinity, hi = -Infinity;
    if (isPrice) {
      for (let i = f; i < W.length; i++) {
        lo = Math.min(lo, loA[i], sm[i], 2 * sm[i]);
        hi = Math.max(hi, hiA[i], sm[i], 2 * sm[i]);
      }
    } else {
      for (let i = f; i < W.length; i++) {
        lo = Math.min(lo, loA[i] / sm[i]);
        hi = Math.max(hi, hiA[i] / sm[i]);
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
        // Keep the 1× and 2× references visible on a narrow screen.
        const keep = { 0.5: 1, 1: 1, 2: 1, 4: 1, 16: 1 };
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
      const y = Math.round(Yr(v));
      const is1 = !isPrice && v === 1;
      const is2 = !isPrice && v === 2;
      if (is1) {
        x.fillStyle = LINE;
        x.fillRect(L, y - 1, Rx - L, 2);
      } else if (is2) {
        // Drawn as a dashed reference after the other ticks.
      } else {
        x.fillStyle = GRID;
        x.fillRect(L, y, Rx - L, 1);
      }
      F(400, ST.fs);
      Tx(tickLab(v), L - 6, y + ST.fs * 0.35, (is1 || is2) ? GREY : AX, "right");
    });

    // Subtle dashed 2× reference in the relative view, even if 2
    // was filtered from the tick list (it almost never is).
    if (!isPrice) {
      const y2 = Yr(2);
      if (y2 >= T - 1 && y2 <= B + 1) {
        drawDashed(x, function () {
          x.moveTo(L, y2);
          x.lineTo(Rx, y2);
        }, "rgba(107,117,131,0.72)", ST.mobile ? 1 : 1.25, ST.mobile ? [3, 3] : [5, 4]);
        if (!ticks.some(function (v) { return v === 2; })) {
          F(400, ST.fs);
          Tx("2x", L - 6, y2 + ST.fs * 0.35, GREY, "right");
        }
      }
    }

    F(400, ST.fs);
    const y0 = new Date(tStart).getUTCFullYear();
    const y1 = new Date(tEnd).getUTCFullYear();
    const step = ST.yearStep || 2;
    let yy0 = y0;
    const rem = ((yy0 % step) + step) % step;
    if (rem) yy0 += step - rem;
    const minGap = ST.mobile ? 8 : 10;
    let lastRight = L - minGap;
    for (let yy = yy0; yy <= y1; yy += step) {
      const tw = x.measureText(String(yy)).width;
      let xx = X(Date.UTC(yy, 0, 1));
      // Nudge a first year that sits against the left axis, but only if the
      // nudged label won't collide with the next year.
      if (xx >= L - 8 && xx - tw / 2 < L + 2 && xx + tw / 2 < Rx) {
        const nudged = L + tw / 2 + (ST.mobile ? 3 : 4);
        const nextX = X(Date.UTC(yy + step, 0, 1));
        if (nudged + tw / 2 + minGap <= nextX - tw / 2) {
          xx = nudged;
        } else {
          continue;
        }
      }
      const left = xx - tw / 2, right = xx + tw / 2;
      if (left < L || right > Rx || left < lastRight + minGap) continue;
      Tx(String(yy), xx, B + ST.yr, AX, "center");
      lastRight = right;
    }

    const pts = [];
    const weekMs = 7 * DAY;
    for (let i = f; i < W.length; i++) {
      const t = ms(W[i][0]);
      const t1 = isMonth ? ms(addMonthsIso(W[i][0], 1)) : t + weekMs;
      const x0 = X(t), x1 = X(t1);
      pts.push({
        x: (x0 + x1) / 2,
        x0: x0,
        x1: x1,
        cx: (x0 + x1) / 2,
        p: cl[i],
        lo: loA[i],
        hi: hiA[i],
        s: sm[i],
        r: cl[i] / sm[i],
        rLo: loA[i] / sm[i],
        rHi: hiA[i] / sm[i],
        isPrice: isPrice,
        yp: Yr(isPrice ? cl[i] : cl[i] / sm[i]),
        ys: Yr(isPrice ? sm[i] : 1),
        y2: Yr(isPrice ? 2 * sm[i] : 2),
      });
    }

    if (isPrice) {
      let linePts = pts;
      if (DATA.smaWeekly && DATA.smaWeekly.length) {
        linePts = DATA.smaWeekly.map(function (q) {
          return { x: X(q.t + 3.5 * DAY), ys: Yr(q.s), y2: Yr(2 * q.s) };
        });
      }
      x.lineJoin = "round";
      x.lineCap = "round";
      x.beginPath();
      linePts.forEach(function (q, k) { k ? x.lineTo(q.x, q.ys) : x.moveTo(q.x, q.ys); });
      x.strokeStyle = SMA_C;
      x.lineWidth = ST.smaw;
      x.stroke();
      drawDashed(x, function () {
        linePts.forEach(function (q, k) { k ? x.lineTo(q.x, q.y2) : x.moveTo(q.x, q.y2); });
      }, "rgba(107,117,131,0.85)", ST.mobile ? 1.1 : 1.35, ST.mobile ? [3, 3] : [5, 4]);
      const lastP = linePts[linePts.length - 1] || pts[pts.length - 1];
      F(500, ST.mobile ? 10 : 12);
      const labX = Wd - Pd;
      let lab200 = lastP.ys + (ST.mobile ? 3 : 4);
      let lab2x = lastP.y2 + (ST.mobile ? 3 : 4);
      if (Math.abs(lab200 - lab2x) < (ST.mobile ? 11 : 13)) {
        if (lab2x < lab200) { lab2x -= 6; lab200 += 6; }
        else { lab2x += 6; lab200 -= 6; }
      }
      Tx("200W", labX, lab200, SMA_C, "right");
      Tx("2\u00d7 200W", labX, lab2x, SMA_C, "right");
    }
    if (!DATA.missingHL) drawZonedBars(x, pts, ST, L, Rx, T, B, Yr);

    const last = pts[pts.length - 1];
    const price = DATA.lastPx, smaV = DATA.lastSma, mult = price / smaV;
    const zNow = zoneOfR(mult);
    const zCol = ZONES[zNow].color;
    last.zone = zNow;
    last.lw = ST.lw;

    x.fillStyle = "#2c333d";
    x.fillRect(Pd, ST.ny, Wd - 2 * Pd, 1);

    const nums = [
      ["PRICE", fv(price), INK],
      [def.smaLabel, fv(smaV), INK],
      ["PRICE / " + def.short, mult.toFixed(2) + "x", zCol],
    ];
    const cw = (Wd - 2 * Pd) / 3;
    nums.forEach(function (q, jj) {
      F(400, ST.ml); Tx(q[0], Pd + jj * cw, ST.ny + ST.mly, ST.mlc);
      F(800, ST.mv); Tx(q[1], Pd + jj * cw, ST.ny + ST.mvy, q[2]);
    });

    return {
      L: L, Rx: Rx, T: T, B: B, top: top, bot: bot, ticks: ticks,
      last: last, price: price, sma: smaV, mult: mult, zone: zNow,
      layout: ST.mobile ? "mobile" : "desktop", W: Wd, H: H,
      start: DATA.start, n: DATA.n, smaLabel: def.smaLabel,
      closedN: DATA.closedN,
      closedPaddle: DATA.closedPaddle,
      closedRide: DATA.closedRide,
      closedKick: DATA.closedKick,
      closedLowAtOrBelow1: DATA.closedLowAtOrBelow1,
      closedHighAtOrAbove2: DATA.closedHighAtOrAbove2,
      closedInside12: DATA.closedInside12,
      closedBoth: DATA.closedBoth,
      missingHL: DATA.missingHL,
      interval: DATA.interval,
      liveZone: DATA.liveZone,
    };
  }

  const cards = {};
  let SHARED = null;

  function attachCard(def, datas) {
    const root = document.querySelector('.card[data-card="' + def.id + '"]');
    if (!root) throw new Error("missing card " + def.id);
    const canvas = root.querySelector("canvas");
    const stage = root.querySelector(".stage");
    const group = root.querySelector('.toggle:not(.toggle-tf)');
    const groupTf = root.querySelector(".toggle-tf");
    const shareBtn = root.querySelector(".share");
    let MODE = START;
    let TF = START_TF;
    let lastCssW = 0;

    function activeData() { return datas[TF] || datas.weekly; }

    const DATA0 = datas.weekly;
    if (DATA0.insufficient) {
      root.classList.add("is-short");
      if (stage && !stage.querySelector(".short-msg")) {
        const msg = document.createElement("p");
        msg.className = "short-msg";
        msg.textContent = "Not enough history yet: a zone appears after 200 weekly closes.";
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
      if (SHARE) return desktopLayout(mode);
      const cssW = stage && stage.clientWidth ? stage.clientWidth : (window.innerWidth || SHARE_W);
      if (cssW < MOBILE_MAX) return mobileLayout(cssW, mode);
      return desktopLayout(mode);
    }

    function draw(mode) {
      const layout = displayLayout(mode);
      const x = sizeCanvas(canvas, layout);
      lastCssW = layout.mobile ? layout.W : (stage && stage.clientWidth) || layout.W;
      const DATA = activeData();
      const meta = drawInto(x, mode, layout, DATA, def);
      const tfWord = DATA.interval === "monthly" ? "monthly" : "weekly";
      canvas.setAttribute(
        "aria-label",
        (mode === "price" ? def.ariaPrice : def.ariaRel) +
          ", " + tfWord + " high-low bars. Price " + fv(DATA.lastPx) + ", " + def.smaLabel + " " + fv(DATA.lastSma) +
          ", " + (DATA.lastPx / DATA.lastSma).toFixed(2) + " times, " +
          ZONES[zoneOfR(DATA.lastPx / DATA.lastSma)].name + " zone."
      );
      return meta;
    }

    function syncToggles() {
      group.querySelectorAll("[data-mode]").forEach(function (b) {
        b.setAttribute("aria-checked", b.getAttribute("data-mode") === MODE ? "true" : "false");
      });
      if (groupTf) {
        groupTf.querySelectorAll("[data-tf]").forEach(function (b) {
          b.setAttribute("aria-checked", b.getAttribute("data-tf") === TF ? "true" : "false");
        });
      }
    }

    function setMode(mode, opts) {
      MODE = mode === "price" ? "price" : "relative";
      syncToggles();
      const meta = draw(MODE);
      if (opts && opts.focus) {
        const el = group.querySelector('[data-mode="' + MODE + '"]');
        if (el) el.focus();
      }
      return meta;
    }

    function setTf(tf, opts) {
      TF = tf === "monthly" ? "monthly" : "weekly";
      syncToggles();
      const meta = draw(MODE);
      if (opts && opts.focus && groupTf) {
        const el = groupTf.querySelector('[data-tf="' + TF + '"]');
        if (el) el.focus();
      }
      return meta;
    }

    function setView(mode, tf, opts) {
      if (tf) TF = tf === "monthly" ? "monthly" : "weekly";
      return setMode(mode == null ? MODE : mode, opts);
    }

    function renderShareCanvas(mode, tf) {
      const prev = TF;
      if (tf) TF = tf === "monthly" ? "monthly" : "weekly";
      const DATA = activeData();
      const layout = desktopLayout(mode);
      const off = document.createElement("canvas");
      off.width = SHARE_W * SHARE_D;
      off.height = SHARE_H * SHARE_D;
      const x = off.getContext("2d");
      x.scale(SHARE_D, SHARE_D);
      drawInto(x, mode, layout, DATA, def);
      TF = prev;
      const out = document.createElement("canvas");
      out.width = SHARE_W;
      out.height = SHARE_H;
      const c = out.getContext("2d");
      c.imageSmoothingEnabled = true;
      c.drawImage(off, 0, 0, SHARE_W, SHARE_H);
      return out;
    }

    function downloadPng() {
      const out = renderShareCanvas(MODE, TF);
      const a = document.createElement("a");
      a.href = out.toDataURL("image/png");
      a.download = def.file + "-" + TF + "-" + MODE + ".png";
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
    if (groupTf) {
      groupTf.addEventListener("click", function (e) {
        const b = e.target.closest("[data-tf]");
        if (!b) return;
        setTf(b.getAttribute("data-tf"));
      });
      groupTf.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "ArrowUp" && e.key !== "ArrowDown" && e.key !== "Home" && e.key !== "End") return;
        e.preventDefault();
        if (e.key === "Home") return setTf("weekly", { focus: true });
        if (e.key === "End") return setTf("monthly", { focus: true });
        setTf(TF === "weekly" ? "monthly" : "weekly", { focus: true });
      });
    }
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
      data: datas,
      root: root,
      canvas: canvas,
      getMode: function () { return MODE; },
      getTf: function () { return TF; },
      setMode: setMode,
      setTf: setTf,
      setView: setView,
      draw: draw,
      onResize: onResize,
      exportPng: function (mode, tf) { return renderShareCanvas(mode || MODE, tf || TF).toDataURL("image/png"); },
      shareInfo: function (mode, tf) {
        const m = mode || MODE;
        const prev = TF;
        if (tf) TF = tf === "monthly" ? "monthly" : "weekly";
        const DATA = activeData();
        const layout = desktopLayout(m);
        const off = document.createElement("canvas");
        off.width = 8; off.height = 8;
        const meta = drawInto(off.getContext("2d"), m, layout, DATA, def);
        TF = prev;
        const last = meta.last || {};
        return {
          id: def.id, mode: m, tf: TF, interval: meta.interval,
          price: meta.price, sma: meta.sma, mult: meta.mult,
          zone: meta.zone,
          L: meta.L, Rx: meta.Rx, T: meta.T, B: meta.B, W: meta.W, H: meta.H,
          top: meta.top, bot: meta.bot, ticks: meta.ticks,
          start: meta.start, n: meta.n, smaLabel: def.smaLabel,
          closedN: meta.closedN,
          closedPaddle: meta.closedPaddle,
          closedRide: meta.closedRide,
          closedKick: meta.closedKick,
          closedLowAtOrBelow1: meta.closedLowAtOrBelow1,
          closedHighAtOrAbove2: meta.closedHighAtOrAbove2,
          closedInside12: meta.closedInside12,
          closedBoth: meta.closedBoth,
          liveZone: meta.liveZone,
          last: {
            x: last.x, yp: last.yp, p: last.p, s: last.s, r: last.r,
            zone: last.zone, dotR: last.dotR, dotStroke: last.dotStroke, lw: last.lw
          }
        };
      },
    };
  }

  function setNote() {
    const el = document.getElementById("note");
    if (!el || !SHARED) return;
    const live = SHARED.live;
    const first = SHARED.cards[0];
    if (first.liveOn) {
      const d = new Date(live.at);
      el.textContent = "Live price \u00b7 updated " + fmtHM(d);
      el.title = LIVE_SRC + " \u00b7 " + d.toLocaleString();
    } else {
      el.textContent = "Cached close \u00b7 " + fmtCached(first.pass);
      el.title = first.source || "cached";
    }
  }

  function setPageCopy() {
    if (!SHARED) return;
    setNote();
    const d = SHARED.weekly || SHARED.cards[0];
    const mo = SHARED.monthly;
    const tag = document.getElementById("tagline");
    if (tag) {
      tag.textContent = "Crypto value zones. Price vs the 200-week SMA.";
    }
    const h = document.getElementById("topline");
    if (h) {
      if (d.insufficient) {
        h.textContent = COIN.name + " does not have enough history for the 200-week average yet.";
      } else {
        const z = ZONES[d.liveZone];
        h.innerHTML = COIN.name + " is in the " +
          '<span class="zone z-' + z.id + ' nowrap">' + z.name + "</span>" +
          " zone " +
          '<span class="nowrap">\u2192 ' + z.action + "</span>";
      }
    }
    window.__PAGE = {
      coin: COIN.id,
      name: COIN.name,
      zone: d.liveZone,
      mult: d.liveMult,
      price: d.lastPx,
      sma: d.lastSma,
      lastWeek: d.lastWeek,
      start: d.start,
      closedN: d.closedN,
      closedPaddle: d.closedPaddle,
      closedRide: d.closedRide,
      closedKick: d.closedKick,
      closedLowAtOrBelow1: d.closedLowAtOrBelow1,
      closedHighAtOrAbove2: d.closedHighAtOrAbove2,
      closedInside12: d.closedInside12,
      closedBoth: d.closedBoth,
      missingHL: d.missingHL,
      source: d.source,
      monthlySource: mo && mo.source,
      monthly: mo && {
        start: mo.start, last: mo.lastWeek,
        closedN: mo.closedN,
        closedLowAtOrBelow1: mo.closedLowAtOrBelow1,
        closedHighAtOrAbove2: mo.closedHighAtOrAbove2,
        closedInside12: mo.closedInside12,
        closedBoth: mo.closedBoth,
        missingHL: mo.missingHL,
        sma: mo.lastSma, mult: mo.liveMult, zone: mo.liveZone,
      },
    };
  }

  function initChrome() {
    document.title = COIN.name + " 200W \u00b7 SurfDCA";
    document.querySelectorAll(".coins a[data-coin]").forEach(function (a) {
      const on = a.getAttribute("data-coin") === COIN.id;
      a.classList.toggle("is-current", on);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    document.querySelectorAll(".coin-fact").forEach(function (el) {
      el.hidden = el.getAttribute("data-coin") !== COIN.id;
    });
  }

  function boot() {
    initChrome();
    if (SHARE) {
      document.body.classList.add("share-only");
      const el = document.querySelector('.card[data-card="' + (SHARE_CARD || "200w") + '"]') ||
                 document.querySelector(".card");
      if (el) el.classList.add("share-target");
    }
    function loadJson(url, label) {
      return fetch(url).then(function (r) {
        if (!r.ok) throw new Error(label + " http " + r.status);
        return r.json();
      });
    }
    return Promise.all([
      loadJson(COIN.data, "weekly"),
      loadJson(COIN.monthly, "monthly"),
    ]).then(function (pack) {
        const jw = pack[0], jm = pack[1];
        if (!jw || !jw.W || !jw.W.length) throw new Error("weekly OHLC missing");
        if (!jm || !(jm.M || jm.W) || !(jm.M || jm.W).length) throw new Error("monthly OHLC missing");
        var liveP = SHARE ? Promise.resolve(null) : fetchLive().catch(function () { return null; });
        return liveP.then(function (live) {
          const def = CARD_DEFS[0];
          const weekly = applyCard(jw, live, def);
          const monthly = applyMonthly(jm, weekly, live, def);
          const built = [weekly];
          SHARED = {
            live: live, weekly: weekly, monthly: monthly, cards: built,
            source: jw.source, pass: jw.pass,
            monthlySource: jm.source, monthlyPass: jm.pass,
          };
          const inst = attachCard(def, { weekly: weekly, monthly: monthly });
          cards[inst.id] = inst;
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
            source: live && live.price > 0 ? live.source : "cached",
            url: live && live.url ? live.url : null,
            price: weekly.lastPx,
            cachedClose: weekly.cachedClose,
            pass: weekly.pass,
            sourceWeekly: weekly.source,
            sourceMonthly: monthly.source,
            lastWeek: weekly.lastWeek,
            lastMonth: monthly.lastWeek,
            at: live && live.at,
            coin: COIN.id,
            zone: weekly.liveZone,
            mult: weekly.liveMult,
          };
          window.__MONTHLY = {
            source: monthly.source, pass: monthly.pass,
            start: monthly.start, last: monthly.lastWeek,
            closedN: monthly.closedN,
            closedLowAtOrBelow1: monthly.closedLowAtOrBelow1,
            closedHighAtOrAbove2: monthly.closedHighAtOrAbove2,
            closedInside12: monthly.closedInside12,
            closedBoth: monthly.closedBoth,
            missingHL: monthly.missingHL,
            sma: monthly.lastSma, mult: monthly.liveMult, zone: monthly.liveZone,
            insufficient: !!monthly.insufficient,
          };
          window.__CARDS = built.map(function (d) {
            return {
              id: d.id, n: d.n, smaLabel: d.smaLabel, start: d.start, lastWeek: d.lastWeek,
              price: d.lastPx, sma: d.lastSma,
              mult: d.liveMult,
              zone: d.liveZone,
              closedN: d.closedN,
              closedPaddle: d.closedPaddle,
              closedRide: d.closedRide,
              closedKick: d.closedKick,
              closedLowAtOrBelow1: d.closedLowAtOrBelow1,
              closedHighAtOrAbove2: d.closedHighAtOrAbove2,
              closedInside12: d.closedInside12,
              closedBoth: d.closedBoth,
              missingHL: d.missingHL,
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
        if (el) el.textContent = "Could not load the weekly or monthly data.";
        throw e;
      });
  }

  window.RUN = boot;
  window.__draw = function (cardId, mode, tf) {
    if (cardId === "relative" || cardId === "price") {
      tf = mode; mode = cardId; cardId = null;
    }
    if (cardId === "weekly" || cardId === "monthly") {
      tf = cardId; cardId = null;
    }
    if (mode === "weekly" || mode === "monthly") {
      tf = mode; mode = null;
    }
    const go = function (id) { return cards[id].setView(mode, tf); };
    if (!cardId) {
      return Object.keys(cards).map(go);
    }
    return go(cardId);
  };
  window.__exportPng = function (cardId, mode, tf) {
    const id = cardId || SHARE_CARD || "200w";
    return cards[id].exportPng(mode, tf);
  };
  window.__shareInfo = function (cardId, mode, tf) {
    const id = cardId || SHARE_CARD || "200w";
    return cards[id].shareInfo(mode, tf);
  };
  boot();
})();

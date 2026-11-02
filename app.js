(() => {
  const P = ["bipu", "noma"];
  const NAME = { bipu: "Bipu", noma: "Noma" };
  const COLOR = { bipu: "var(--blue)", noma: "var(--orange)" };
  const POLL_MS = 15000;

  const cfg = window.STEP_DUEL_CONFIG || {};
  const URL_ = (cfg.supabaseUrl || "").replace(/\/+$/, "");
  const KEY = cfg.supabaseAnonKey || "";
  const remote = !!(URL_ && KEY);

  const state = { entries: [], who: "bipu", pass: "" };
  const $ = id => document.getElementById(id);
  const fmt = n => n == null ? "–" : Math.round(n).toLocaleString();
  const store = {
    get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} },
    del: k => { try { localStorage.removeItem(k); } catch (_) {} }
  };

  // ---------- dates ----------
  const pad = n => String(n).padStart(2, "0");
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const dayDiff = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
  const today = () => ymd(new Date());
  const short = s => parse(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const find = (p, d) => state.entries.find(e => e.player === p && e.day === d);

  // ---------- Supabase REST ----------
  const headers = extra => Object.assign({
    apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", "x-passcode": state.pass
  }, extra || {});

  async function checkPass(pass) {
    const r = await fetch(`${URL_}/rest/v1/rpc/passcode_ok`, { method: "POST", headers: Object.assign(headers(), { "x-passcode": pass }), body: "{}" });
    if (!r.ok) throw new Error("net");
    return (await r.json()) === true;
  }
  async function fetchEntries() {
    const r = await fetch(`${URL_}/rest/v1/entries?select=player,day,steps,weight&order=day.asc`, { headers: headers() });
    if (!r.ok) throw new Error("net");
    return (await r.json()).map(e => ({ player: e.player, day: e.day, steps: e.steps == null ? null : Number(e.steps), weight: e.weight == null ? null : Number(e.weight) }));
  }
  async function upsert(e) {
    const r = await fetch(`${URL_}/rest/v1/entries?on_conflict=player,day`, {
      method: "POST", headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({ player: e.player, day: e.day, steps: e.steps, weight: e.weight, updated_at: new Date().toISOString() })
    });
    if (r.status === 401 || r.status === 403) { const err = new Error("auth"); err.auth = true; throw err; }
    if (!r.ok) throw new Error("net");
  }

  // ---------- local fallback ----------
  const LS = "step-duel-local";
  const localLoad = () => { try { state.entries = JSON.parse(store.get(LS) || "[]"); } catch (_) { state.entries = []; } };
  const localSave = () => store.set(LS, JSON.stringify(state.entries));

  function setSync(kind, text) { const s = $("sync"); s.className = "sync" + (kind ? " " + kind : ""); $("syncText").textContent = text; }

  // ---------- charts ----------
  function legend() {
    const h = P.map(p => `<span><i style="background:${COLOR[p]}"></i>${NAME[p]}</span>`).join("");
    $("lg1").innerHTML = h; $("lg2").innerHTML = h;
  }
  function niceMax(v) { if (v <= 0) return 10000; const m = Math.pow(10, Math.floor(Math.log10(v))); for (const k of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (k * m >= v) return k * m; return 10 * m; }

  function renderSteps() {
    const days = []; for (let i = 13; i >= 0; i--) days.push(addDays(today(), -i));
    const vals = days.map(d => P.map(p => find(p, d)?.steps ?? null));
    if (!vals.flat().some(v => v != null)) { $("stepsChart").innerHTML = `<div class="empty">No steps in the last 14 days yet.</div>`; return; }
    const max = niceMax(Math.max(...vals.flat().filter(v => v != null)));
    const W = 560, H = 220, L = 36, R = 4, T = 8, B = 24, cw = (W - L - R) / days.length, bw = Math.min(12, cw / 2 - 2);
    const y = v => T + (H - T - B) * (1 - v / max);
    let g = "";
    for (let i = 0; i <= 4; i++) { const v = max * i / 4, yy = y(v); g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="var(--line)"/><text x="${L - 6}" y="${yy + 3}" text-anchor="end">${v >= 1000 ? +(v / 1000).toFixed(1) + "k" : v}</text>`; }
    days.forEach((d, i) => {
      const cx = L + cw * i + cw / 2;
      vals[i].forEach((v, k) => { if (v == null) return; const x = k === 0 ? cx - bw - 1 : cx + 1; g += `<rect x="${x}" y="${y(v)}" width="${bw}" height="${Math.max(1, y(0) - y(v))}" rx="3" fill="${COLOR[P[k]]}"><title>${NAME[P[k]]} · ${short(d)}: ${fmt(v)} steps</title></rect>`; });
      if (i % 2 === 1) g += `<text x="${cx}" y="${H - 6}" text-anchor="middle">${short(d)}</text>`;
    });
    $("stepsChart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily steps for Bipu and Noma, last 14 days">${g}</svg>`;
  }

  function renderWeight() {
    const series = P.map(p => state.entries.filter(e => e.player === p && e.weight != null).sort((a, b) => a.day < b.day ? -1 : 1));
    const all = series.flat();
    if (!all.length) { $("weightChart").innerHTML = `<div class="empty">No weigh-ins yet.</div>`; return; }
    const days = all.map(e => e.day).sort(), d0 = days[0], d1 = days[days.length - 1], span = Math.max(1, dayDiff(d0, d1));
    const ws = all.map(e => e.weight);
    let lo = Math.floor(Math.min(...ws) - 1), hi = Math.ceil(Math.max(...ws) + 1);
    const stepv = Math.max(1, Math.ceil((hi - lo) / 4)); lo = Math.floor(lo / stepv) * stepv; hi = lo + stepv * Math.max(2, Math.ceil((hi - lo) / stepv));
    const W = 560, H = 220, L = 36, R = 10, T = 10, B = 24;
    const x = d => L + (W - L - R) * dayDiff(d0, d) / span, y = v => T + (H - T - B) * (hi - v) / (hi - lo);
    let g = "";
    for (let v = lo; v <= hi; v += stepv) { const yy = y(v); g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="var(--line)"/><text x="${L - 6}" y="${yy + 3}" text-anchor="end">${v}</text>`; }
    g += `<text x="${L}" y="${H - 6}">${short(d0)}</text>${d1 !== d0 ? `<text x="${W - R}" y="${H - 6}" text-anchor="end">${short(d1)}</text>` : ""}`;
    series.forEach((sr, k) => {
      if (!sr.length) return;
      const c = COLOR[P[k]];
      if (sr.length > 1) g += `<polyline points="${sr.map(e => `${x(e.day).toFixed(1)},${y(e.weight).toFixed(1)}`).join(" ")}" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
      sr.forEach((e, i) => { const last = i === sr.length - 1; g += `<circle cx="${x(e.day)}" cy="${y(e.weight)}" r="${last ? 4.5 : 2.5}" fill="${c}" stroke="#fff" stroke-width="${last ? 2 : 0}"><title>${NAME[P[k]]} · ${short(e.day)}: ${e.weight} kg</title></circle>`; });
      const le = sr[sr.length - 1];
      const lx = x(le.day), anchor = lx < W / 2 ? "start" : "end";
      g += `<text x="${anchor === "start" ? lx + 6 : Math.min(lx, W - R - 2)}" y="${y(le.weight) - 9}" text-anchor="${anchor}"style="fill:${c};font-weight:700;font-size:11px">${le.weight}</text>`;
    });
    $("weightChart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight over time for Bipu and Noma">${g}</svg>`;
  }

  function render() { legend(); renderSteps(); renderWeight(); }

  // ---------- form ----------
  function say(text, cls) { const m = $("msg"); m.textContent = text || ""; m.className = "msg" + (cls ? " " + cls : ""); }
  let dirty = false;
  function fillForm(fromSync) {
    if (fromSync && dirty) return;
    const e = find(state.who, $("fDate").value);
    $("fSteps").value = e?.steps ?? ""; $("fWeight").value = e?.weight ?? "";
    $("saveBtn").textContent = e ? `Update ${NAME[state.who]}'s day` : `Save for ${NAME[state.who]}`;
  }
  function setWho(p) {
    state.who = p; dirty = false;
    P.forEach(q => $("who-" + q).setAttribute("aria-pressed", String(q === p)));
    store.set("step-duel-who", p);
    fillForm(); say("");
  }

  // ---------- sync loop ----------
  let timer = null, busy = false;
  async function pull() {
    if (!remote || !state.pass || busy) return;
    busy = true;
    try {
      state.entries = await fetchEntries();
      setSync("on", "Synced");
      render(); fillForm(true);
    } catch (_) { setSync("off", "Offline"); }
    finally { busy = false; }
  }
  function startPolling() {
    clearInterval(timer);
    pull();
    timer = setInterval(() => { if (document.visibilityState === "visible") pull(); }, POLL_MS);
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") pull(); });
  window.addEventListener("focus", pull);
  window.addEventListener("online", pull);

  function showGate(show) {
    $("gate").hidden = !show; $("app").hidden = show; $("lockBtn").hidden = show || !remote;
  }

  $("gate").addEventListener("submit", async ev => {
    ev.preventDefault();
    const pass = $("pass").value.trim();
    if (!pass) { $("passMsg").textContent = "Type the passcode."; $("passMsg").className = "msg err"; return; }
    $("passBtn").disabled = true;
    try {
      if (await checkPass(pass)) {
        state.pass = pass; store.set("step-duel-pass", pass); $("pass").value = ""; $("passMsg").textContent = "";
        showGate(false); startPolling();
      } else { $("passMsg").textContent = "That passcode isn't right."; $("passMsg").className = "msg err"; }
    } catch (_) { $("passMsg").textContent = "Can't reach the server. Check your internet and try again."; $("passMsg").className = "msg err"; }
    finally { $("passBtn").disabled = false; }
  });

  $("lockBtn").addEventListener("click", () => {
    store.del("step-duel-pass"); state.pass = ""; state.entries = []; clearInterval(timer);
    render(); fillForm(); showGate(true); setSync("", "Locked");
  });

  P.forEach(p => $("who-" + p).addEventListener("click", () => setWho(p)));
  $("fDate").addEventListener("change", () => { dirty = false; fillForm(); });
  ["fSteps", "fWeight"].forEach(id => $(id).addEventListener("input", () => { dirty = true; }));

  $("logForm").addEventListener("submit", async ev => {
    ev.preventDefault();
    const day = $("fDate").value, sRaw = $("fSteps").value.trim(), wRaw = $("fWeight").value.trim();
    if (!day) return say("Pick a date.", "err");
    if (day > today()) return say("That date is in the future.", "err");
    if (!sRaw && !wRaw) return say("Enter steps, weight, or both.", "err");
    const steps = sRaw ? Math.round(parseFloat(sRaw)) : null;
    const weight = wRaw ? Math.round(parseFloat(wRaw) * 10) / 10 : null;
    if (steps != null && (!isFinite(steps) || steps < 0 || steps > 150000)) return say("Steps should be between 0 and 150,000.", "err");
    if (weight != null && (!isFinite(weight) || weight < 20 || weight > 400)) return say("Weight should be between 20 and 400 kg.", "err");
    const entry = { player: state.who, day, steps, weight };
    $("saveBtn").disabled = true;
    try {
      if (remote) {
        await upsert(entry);
        state.entries = state.entries.filter(x => !(x.player === entry.player && x.day === entry.day)).concat(entry);
      } else {
        state.entries = state.entries.filter(x => !(x.player === entry.player && x.day === entry.day)).concat(entry);
        localSave();
      }
      dirty = false; render(); fillForm(); say(`Saved for ${NAME[state.who]}, ${short(day)}.`, "ok");
      if (remote) pull();
    } catch (e) {
      if (e.auth) { say("The passcode was changed. Unlock again.", "err"); store.del("step-duel-pass"); showGate(true); }
      else say("Couldn't save. Check your internet and try again.", "err");
    } finally { $("saveBtn").disabled = false; }
  });

  // ---------- boot ----------
  const w = store.get("step-duel-who"); if (P.includes(w)) state.who = w;
  P.forEach(q => $("who-" + q).setAttribute("aria-pressed", String(q === state.who)));
  $("fDate").value = today(); $("fDate").max = today();

  if (!remote) {
    localLoad(); showGate(false); $("lockBtn").hidden = true;
    setSync("off", "This phone only");
    render(); fillForm();
    say("Not connected to the shared database yet, so entries stay on this phone.");
  } else {
    render(); fillForm();
    state.pass = store.get("step-duel-pass") || "";
    if (state.pass) { showGate(false); setSync("", "Connecting…"); startPolling(); }
    else { showGate(true); setSync("", "Locked"); }
  }
})();

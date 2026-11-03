(() => {
  "use strict";

  const TOTAL = 50;
  const TIME_LIMIT_SECONDS = 5 * 60;
  const MAX_TRIES = 3;
  const MAX_NUMBER = 30;
  const HISTORY_LIMIT = 200;
  const MONKEYS = ["A", "B", "C"];
  // 16 big letters + 16 little letters + 18 numbers, picked fresh from all 82 each round.
  const MIX = { upper: 16, lower: 16, number: 18 };

  const KEYS = {
    name: "kennedy100.name",
    game: "kennedy100.game",
    history: "kennedy100.history",
    muted: "kennedy100.muted",
    monkey: "kennedy100.monkey",
  };

  const store = {
    get(key, fallback = null) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} },
    remove(key) { try { localStorage.removeItem(key); } catch (e) {} },
  };

  const $ = (id) => document.getElementById(id);
  const el = {
    splash: $("splash"), splashMonkey: $("splash-monkey"), splashFx: $("splash-fx"),
    mute: $("mute"), startForm: $("start-form"), name: $("name"), resume: $("resume"), ears: $("ears"), earsText: $("ears-text"),
    openScores: $("open-scores"), playerName: $("player-name"), count: $("count"), progressBar: $("progress-bar"), timer: $("timer"),
    card: $("card"), item: $("item"), itemHint: $("item-hint"), tries: $("tries"), cheer: $("cheer"), mic: $("mic"), micCap: $("mic-cap"), listenText: $("listen-text"),
    grownup: $("grownup"), guRight: $("gu-right"), guWrong: $("gu-wrong"), skip: $("skip"), quit: $("quit"),
    overlay: $("overlay"), overlayTitle: $("overlay-title"), overlayText: $("overlay-text"), overlayBar: $("overlay-bar"),
    overlayGo: $("overlay-go"), overlayAlt: $("overlay-alt"),
    restart: $("restart"), restartAsk: $("restart-ask"), restartYes: $("restart-yes"), restartNo: $("restart-no"),
    timesup: $("timesup"), keepGoing: $("keep-going"), seeScore: $("see-score"),
    resultsTitle: $("results-title"), scoreLine: $("score-line"), timeLine: $("time-line"), practiceSection: $("practice-section"),
    practice: $("practice"), grid: $("grid"), again: $("again"), resultsScores: $("results-scores"), print: $("print"),
    scoresList: $("scores-list"), scoresBack: $("scores-back"), scoresClear: $("scores-clear"),
  };

  const speech = window.K100Speech;

  // ---------- Banana Monkey: a different one each time the app opens ----------
  const monkeyIndex = (Number(store.get(KEYS.monkey, -1)) + 1) % MONKEYS.length;
  store.set(KEYS.monkey, monkeyIndex);
  const monkeyStyle = MONKEYS[monkeyIndex];
  document.documentElement.dataset.monkey = monkeyStyle;

  function drawMonkeys(root = document) {
    root.querySelectorAll(".monkey").forEach((m) => { m.innerHTML = window.monkeySVG(monkeyStyle, m.dataset.pose || "wave"); });
  }
  function setPose(node, pose) { node.dataset.pose = pose; node.innerHTML = window.monkeySVG(monkeyStyle, pose); }

  // ---------- Items ----------
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function allItems() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    return {
      upper: letters.map((c) => ({ kind: "upper", show: c, key: c.toLowerCase() })),
      lower: letters.map((c) => ({ kind: "lower", show: c.toLowerCase(), key: c.toLowerCase() })),
      number: Array.from({ length: MAX_NUMBER }, (_, i) => ({ kind: "number", show: String(i + 1), key: String(i + 1) })),
    };
  }

  function makeItems() {
    const pool = allItems();
    let items = [];
    for (const [kind, n] of Object.entries(MIX)) items = items.concat(shuffle(pool[kind].slice()).slice(0, n));
    // Shuffle until the same letter never shows twice in a row (like B then b).
    for (let tries = 0; tries < 200; tries++) {
      shuffle(items);
      if (items.every((it, i) => i === 0 || it.key !== items[i - 1].key)) break;
    }
    return items;
  }

  function itemName(it) {
    if (it.kind === "upper") return `big ${it.show}`;
    if (it.kind === "lower") return `little ${it.show}`;
    return it.show;
  }
  const heardLabel = (key) => (/^\d+$/.test(key) ? key : key.toUpperCase());

  // ---------- Sound ----------
  let muted = Boolean(store.get(KEYS.muted, false));
  const sound = {
    play(notes) {
      if (muted) return;
      const ctx = (speech && speech.audioContext()) || null;
      if (!ctx || ctx.state !== "running") return;
      let t = ctx.currentTime;
      for (const [freq, dur] of notes) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "triangle";
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(ctx.destination);
        o.start(t);
        o.stop(t + dur + 0.05);
        t += dur * 0.8;
      }
    },
    right() { this.play([[660, 0.12], [880, 0.18]]); },
    wrong() { this.play([[330, 0.2]]); },
    done() { this.play([[523, 0.14], [659, 0.14], [784, 0.14], [1047, 0.3]]); },
  };
  function renderMute() {
    el.mute.setAttribute("aria-pressed", String(muted));
    el.mute.setAttribute("aria-label", muted ? "Sound off. Press to turn on." : "Sound on. Press to mute.");
    el.mute.classList.toggle("is-muted", muted);
  }
  el.mute.addEventListener("click", () => { muted = !muted; store.set(KEYS.muted, muted); renderMute(); });

  // ---------- Screens ----------
  function show(name) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === `screen-${name}`));
    window.scrollTo(0, 0);
  }

  // ---------- Speech engine status ----------
  let earsState = "loading";
  let earsProgress = 0;
  function renderEars() {
    el.ears.dataset.state = earsState;
    if (earsState === "ready") el.earsText.textContent = "Banana Monkey is ready to listen 👂";
    else if (earsState === "error") el.earsText.textContent = navigator.onLine === false
      ? "Connect to Wi‑Fi once so Banana Monkey can learn to listen. After that it works offline."
      : "Banana Monkey's ears didn't load. You can still play with grown-up buttons.";
    else el.earsText.textContent = `Getting Banana Monkey's ears ready… ${Math.round(earsProgress * 100)}%`;
    if (overlayMode === "loading") renderLoadingOverlay();
  }
  function loadSpeech() {
    if (!speech) { earsState = "error"; renderEars(); return Promise.reject(new Error("no speech")); }
    earsState = "loading";
    renderEars();
    const p = speech.load((f) => { earsProgress = f; renderEars(); });
    p.then(() => { earsState = "ready"; renderEars(); maybeBegin(); })
      .catch(() => { earsState = "error"; renderEars(); if (overlayMode === "loading") showSpeechProblem("load"); });
    return p;
  }

  // ---------- Game state ----------
  let state = null;
  let timerHandle = null;
  let overlayMode = null;
  let micPaused = false;
  let busy = false;
  let shownAt = 0;

  function newResult() { return { tries: 0, heard: [], status: null, late: false, skipped: false }; }

  function saveGame() {
    if (!state || !state.playing) return;
    const { name, items, results, queue, pos, startedAt, timeUp, keptGoing, grownup } = state;
    store.set(KEYS.game, { name, items, results, queue, pos, startedAt, timeUp, keptGoing, grownup, elapsedMs: elapsedMs() });
  }

  function elapsedMs() {
    if (!state) return 0;
    return state.elapsedMs + (state.runningSince ? Date.now() - state.runningSince : 0);
  }
  function pauseClock() {
    if (!state || !state.playing || !state.runningSince) return;
    state.elapsedMs += Date.now() - state.runningSince;
    state.runningSince = null;
    saveGame();
  }
  function resumeClock() {
    if (!state || !state.playing || state.runningSince || document.hidden || overlayMode || micPaused || !el.timesup.hidden || !el.restartAsk.hidden) return;
    state.runningSince = Date.now();
  }

  function startGame(name) {
    store.set(KEYS.name, name);
    const items = makeItems();
    playGame({
      name, items, results: items.map(newResult), queue: items.map((_, i) => i), pos: 0,
      startedAt: Date.now(), timeUp: false, keptGoing: false, grownup: false, elapsedMs: 0,
    });
  }

  function playGame(saved) {
    state = { ...saved, playing: true, runningSince: null, finishedAt: null };
    el.playerName.textContent = state.name;
    el.cheer.textContent = "";
    el.timer.classList.remove("low");
    el.timer.classList.toggle("over", state.timeUp);
    el.timesup.hidden = true;
    el.restartAsk.hidden = true;
    el.grownup.hidden = !state.grownup;
    setMicPaused(false);
    show("game");
    renderItem();
    tick();
    clearInterval(timerHandle);
    timerHandle = setInterval(tick, 250);
    saveGame();
    connectEars();
  }

  // Get the mic and model going before the clock starts. Must run inside a tap on iPad.
  async function connectEars() {
    if (!state || !state.playing) return;
    setMicPaused(false);
    if (state.grownup) { hideOverlay(); maybeBegin(); return; }
    showOverlay("loading");
    try {
      await speech.startMic();
    } catch (e) {
      if (!state || !state.playing || state.grownup) return;
      showSpeechProblem(e && (e.name === "NotAllowedError" || e.name === "SecurityError") ? "denied" : "nomic");
      return;
    }
    if (!state || !state.playing || state.grownup) { speech.stopMic(); return; }
    if (earsState === "error") loadSpeech().catch(() => {});
    maybeBegin();
  }

  function maybeBegin() {
    if (!state || !state.playing || overlayMode !== "loading") return;
    if (!speech.isReady() || !speech.micRunning()) { renderLoadingOverlay(); return; }
    if (document.hidden) { showOverlay("paused"); return; }
    speech.reset();
    hideOverlay();
    shownAt = Date.now();
  }

  function useGrownupButtons() {
    state.grownup = true;
    if (speech) speech.stopMic();
    el.grownup.hidden = false;
    renderMicButton();
    hideOverlay();
    renderItem();
    saveGame();
  }

  // ---------- Overlays ----------
  // While any pop-up is showing, the game behind it (Skip, Restart, I'm done) can't be tapped or tabbed to.
  const popups = [el.overlay, el.timesup, el.restartAsk];
  function syncInert() {
    const open = popups.some((p) => !p.hidden);
    [...el.restartAsk.parentElement.children].forEach((c) => { if (!popups.includes(c)) c.inert = open; });
  }
  const popupWatch = new MutationObserver(syncInert);
  popups.forEach((p) => popupWatch.observe(p, { attributes: true, attributeFilter: ["hidden"] }));

  function showOverlay(mode) {
    overlayMode = mode;
    pauseClock();
    el.overlay.hidden = false;
    el.overlayAlt.hidden = true;
    el.overlayBar.hidden = true;
    el.overlayGo.hidden = false;
    if (mode === "loading") renderLoadingOverlay();
    if (mode === "paused") {
      el.overlayTitle.textContent = "Paused";
      el.overlayText.textContent = "The clock stopped while you were away. Tap to keep going.";
      el.overlayGo.textContent = "Keep going ▶";
    }
  }
  function renderLoadingOverlay() {
    el.overlayTitle.textContent = "Getting ready…";
    const loaded = speech && speech.isReady();
    el.overlayText.textContent = loaded
      ? "Tap Allow if the iPad asks to use the microphone."
      : "Banana Monkey is learning to listen. This takes a moment the first time.";
    el.overlayBar.hidden = loaded;
    el.overlayBar.firstElementChild.style.width = `${Math.round(earsProgress * 100)}%`;
    el.overlayGo.hidden = true;
    el.overlayAlt.hidden = false;
    el.overlayAlt.textContent = "Use grown-up buttons instead";
  }
  function showSpeechProblem(kind) {
    showOverlay("problem");
    el.overlayTitle.textContent = kind === "load" ? "Banana Monkey can't hear yet" : "The microphone is off";
    el.overlayText.textContent = kind === "denied"
      ? "Grown-up: allow the microphone for this site (Settings › Apps › Safari › Microphone, then choose Ask or Allow), then tap Try again."
      : kind === "load"
        ? "The listening part didn't download. Connect to Wi‑Fi and tap Try again, or play with grown-up buttons."
        : "We couldn't find a microphone. Tap Try again, or play with grown-up buttons.";
    el.overlayGo.textContent = "Try again";
    el.overlayAlt.hidden = false;
    el.overlayAlt.textContent = "Use grown-up buttons";
  }
  function hideOverlay() {
    overlayMode = null;
    el.overlay.hidden = true;
    resumeClock();
  }
  el.overlayGo.addEventListener("click", () => {
    if (overlayMode === "problem" && earsState === "error") loadSpeech().catch(() => {});
    connectEars();
  });
  el.overlayAlt.addEventListener("click", useGrownupButtons);

  // ---------- Rendering ----------
  function current() { return state && state.items[state.queue[state.pos]]; }
  function currentResult() { return state && state.results[state.queue[state.pos]]; }
  function doneCount() { return state.results.filter((r) => r.status).length; }

  function renderItem() {
    const it = current();
    if (!it) return;
    const r = currentResult();
    el.item.textContent = it.show;
    el.item.dataset.kind = it.kind;
    el.item.setAttribute("aria-label", itemName(it));
    el.itemHint.textContent = it.kind === "upper" ? "big letter" : it.kind === "lower" ? "little letter" : "number";
    el.card.classList.remove("right", "wrong", "missed", "pop");
    void el.card.offsetWidth;
    el.card.classList.add("pop");
    el.count.textContent = String(Math.min(TOTAL, doneCount() + 1));
    el.progressBar.style.width = `${(doneCount() / TOTAL) * 100}%`;
    renderTries(r);
    el.listenText.textContent = state.grownup ? "Say what you see!" : r.tries ? `Try again! ${MAX_TRIES - r.tries} ${MAX_TRIES - r.tries === 1 ? "try" : "tries"} left` : "Say what you see!";
    el.skip.disabled = false;
    shownAt = Date.now();
  }
  function renderTries(r) {
    el.tries.innerHTML = Array.from({ length: MAX_TRIES }, (_, i) => `<span class="${i < r.tries ? "used" : ""}">🍌</span>`).join("");
  }

  function fmt(sec) {
    const s = Math.max(0, Math.ceil(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }
  function tick() {
    if (!state || !state.playing) return;
    const left = TIME_LIMIT_SECONDS - elapsedMs() / 1000;
    if (left <= 0) {
      el.timer.textContent = `+${fmt(-left)}`;
      el.timer.classList.add("over");
      el.timer.classList.remove("low");
      if (!state.timeUp) {
        state.timeUp = true;
        pauseClock();
        el.timesup.hidden = false;
        sound.done();
        el.keepGoing.focus();
        saveGame();
      }
    } else {
      el.timer.textContent = fmt(left);
      el.timer.classList.toggle("low", left <= 30);
    }
    const lvl = speech && !state.grownup ? speech.level() : 0;
    el.mic.style.setProperty("--lvl", lvl.toFixed(2));
    el.mic.classList.toggle("live", Boolean(speech && speech.micRunning() && !state.grownup && !overlayMode && !micPaused));
  }

  // ---------- Answers ----------
  function mark(status, heardKey) {
    const r = currentResult();
    if (heardKey) r.heard.push(heardKey);
    if (status === "right" || status === "missed") {
      r.status = status;
      r.late = state.timeUp || elapsedMs() >= TIME_LIMIT_SECONDS * 1000;
      busy = true;
      el.skip.disabled = true;
      const it = current();
      el.card.classList.add(status === "right" ? "right" : "missed");
      el.progressBar.style.width = `${(doneCount() / TOTAL) * 100}%`;
      if (status === "right") {
        sound.right();
        el.listenText.textContent = `Yes! That's ${itemName(it)}`;
        el.cheer.textContent = pick(["Yay!", "Woo-hoo!", "Banana-rific!", "You got it!", "Nice!", "Super!"]);
      } else {
        sound.wrong();
        el.listenText.textContent = `That one is ${itemName(it)}. On to the next!`;
        el.cheer.textContent = "Good try!";
      }
      saveGame();
      const game = state;
      setTimeout(() => { if (state === game) next(); }, status === "right" ? 800 : 1500);
      return;
    }
    // A wrong try
    r.tries += 1;
    if (r.tries >= MAX_TRIES) { mark("missed"); return; }
    sound.wrong();
    el.card.classList.remove("wrong");
    void el.card.offsetWidth;
    el.card.classList.add("wrong");
    renderTries(r);
    const left = MAX_TRIES - r.tries;
    el.listenText.textContent = heardKey
      ? `I heard “${heardLabel(heardKey)}”. Try again! ${left} ${left === 1 ? "try" : "tries"} left`
      : `Try again! ${left} ${left === 1 ? "try" : "tries"} left`;
    saveGame();
  }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  function next() {
    busy = false;
    el.cheer.textContent = "";
    state.pos += 1;
    if (state.pos >= state.queue.length) { finish(); return; }
    if (speech && !state.grownup) speech.reset();
    renderItem();
    saveGame();
  }

  // Back of the line, but never right next to the same letter in the other case.
  function requeueAt(idx) {
    const q = state.queue;
    const key = state.items[idx].key;
    const keyAt = (i) => (i > state.pos && i < q.length ? state.items[q[i]].key : null);
    for (let at = q.length; at > state.pos + 1; at--) {
      if (keyAt(at - 1) !== key && keyAt(at) !== key) return at;
    }
    return q.length;
  }

  function skip() {
    if (!state || blocked()) return;
    const idx = state.queue[state.pos];
    const r = state.results[idx];
    if (!r.skipped) {
      r.skipped = true;
      state.queue.splice(requeueAt(idx), 0, idx);
      state.pos += 1;
      if (speech && !state.grownup) speech.reset();
      renderItem();
      saveGame();
    } else {
      mark("missed");
    }
  }

  // ---------- Mic pause ----------
  // Tapping the mic turns it fully off (the iPad's mic light goes out) and stops the clock until it's tapped again.
  function renderMicButton() {
    el.mic.classList.toggle("paused", micPaused);
    el.mic.disabled = Boolean(state && state.grownup);
    el.mic.setAttribute("aria-pressed", String(micPaused));
    el.mic.setAttribute("aria-label", micPaused ? "Microphone paused. Tap to turn it back on." : "Microphone on. Tap to pause.");
    el.micCap.textContent = micPaused ? "Paused" : "Pause";
    el.card.classList.toggle("mic-off", micPaused);
    if (state && state.playing && !busy) el.skip.disabled = micPaused;
  }
  function setMicPaused(on) {
    micPaused = on;
    renderMicButton();
  }
  async function toggleMic() {
    if (!state || !state.playing || state.grownup || busy || overlayMode || !el.timesup.hidden || !el.restartAsk.hidden) return;
    if (!micPaused) {
      setMicPaused(true);
      pauseClock();
      speech.stopMic();
      el.listenText.textContent = "Mic paused. Tap the mic when you're ready!";
      return;
    }
    try {
      await speech.startMic();
    } catch (e) {
      showSpeechProblem(e && (e.name === "NotAllowedError" || e.name === "SecurityError") ? "denied" : "nomic");
      return;
    }
    if (!state || !state.playing || !micPaused) return;
    setMicPaused(false);
    speech.reset();
    renderItem();
    resumeClock();
  }
  el.mic.addEventListener("click", toggleMic);

  const blocked = () => busy || overlayMode || micPaused || !el.timesup.hidden || !el.restartAsk.hidden;
  function canListen() { return state && state.playing && !blocked() && !state.grownup; }

  // Each listener gets a say: a "not yet" only counts once every listener heard something else.
  const wrongFrom = new Set();
  let wrongCard = -1;
  function handleSpeech(msg) {
    if (!canListen()) return;
    const it = current();
    if (wrongCard !== shownAt) { wrongFrom.clear(); wrongCard = shownAt; }
    const keys = speech.parse(msg.text);
    if (msg.type === "partial") {
      // Early yes as soon as the right word shows up ("twenty" waits, in case it's "twenty one").
      if (keys.includes(it.key) && it.key !== "20") mark("right", it.key);
      return;
    }
    if (Date.now() - shownAt < 350) return;
    if (!keys.length) {
      if (msg.text && msg.text.trim()) el.listenText.textContent = "Hmm, I didn't catch that. Say it again!";
      return;
    }
    if (keys.includes(it.key)) { mark("right", it.key); return; }
    wrongFrom.add(msg.src || 0);
    if (wrongFrom.size < (speech.listeners || 1)) return;
    wrongFrom.clear();
    mark("wrong", keys[keys.length - 1]);
  }
  if (speech) speech.on(handleSpeech);

  el.guRight.addEventListener("click", () => { if (state && !blocked()) mark("right"); });
  el.guWrong.addEventListener("click", () => { if (state && !blocked()) mark("wrong"); });

  // ---------- Restart ----------
  function askRestart() {
    if (!state || !state.playing) return;
    pauseClock();
    el.restartAsk.hidden = false;
    el.restartNo.focus();
  }
  function closeRestart(restart) {
    if (el.restartAsk.hidden) return;
    el.restartAsk.hidden = true;
    if (restart) {
      busy = false;
      store.remove(KEYS.game);
      startGame(state.name);
    } else {
      resumeClock();
    }
  }
  el.restart.addEventListener("click", () => { el.restart.blur(); askRestart(); });
  el.restartNo.addEventListener("click", () => closeRestart(false));
  el.restartYes.addEventListener("click", () => closeRestart(true));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el.restartAsk.hidden) { e.preventDefault(); closeRestart(false); }
  });
  el.skip.addEventListener("click", skip);
  el.quit.addEventListener("click", () => {
    if (!state) return;
    if (window.confirm("All done? Anything not answered yet counts as missed.")) finish();
  });
  el.keepGoing.addEventListener("click", () => {
    state.keptGoing = true;
    el.timesup.hidden = true;
    resumeClock();
    saveGame();
  });
  el.seeScore.addEventListener("click", finish);

  // ---------- Results & scores ----------
  function finish() {
    if (!state) return;
    pauseClock();
    clearInterval(timerHandle);
    state.playing = false;
    busy = false;
    el.timesup.hidden = true;
    el.overlay.hidden = true;
    el.restartAsk.hidden = true;
    overlayMode = null;
    setMicPaused(false);
    if (speech) speech.stopMic();
    state.results.forEach((r) => { if (!r.status) r.status = "missed"; });
    const used = Math.round(elapsedMs() / 1000);
    const score = state.results.filter((r) => r.status === "right" && !r.late).length;
    const late = state.results.filter((r) => r.status === "right" && r.late).length;
    const entry = { name: state.name, score, late, total: TOTAL, seconds: used, at: Date.now(), monkey: monkeyStyle };
    const history = store.get(KEYS.history, []);
    history.unshift(entry);
    store.set(KEYS.history, history.slice(0, HISTORY_LIMIT));
    store.remove(KEYS.game);
    renderResults(entry);
    sound.done();
  }

  function renderResults(entry) {
    const pct = entry.score / entry.total;
    el.resultsTitle.textContent = pct >= 0.9 ? `Amazing, ${entry.name}!` : pct >= 0.7 ? `Great job, ${entry.name}!` : `Nice work, ${entry.name}!`;
    el.scoreLine.innerHTML = `<strong>${entry.score}</strong> out of ${entry.total}` + (entry.late ? ` <span class="late-note">+ ${entry.late} after the bell ⏰</span>` : "");
    el.timeLine.textContent = entry.seconds >= TIME_LIMIT_SECONDS ? `Used all ${fmt(TIME_LIMIT_SECONDS)}${entry.seconds > TIME_LIMIT_SECONDS ? ` and ${fmt(entry.seconds - TIME_LIMIT_SECONDS)} more` : ""}` : `Finished in ${fmt(entry.seconds)}`;
    const missed = state.items.map((it, i) => ({ it, r: state.results[i] })).filter((x) => x.r.status === "missed");
    el.practiceSection.hidden = missed.length === 0;
    el.practice.innerHTML = missed.map(({ it, r }) => `<div class="chip"><span class="chip-item" data-kind="${it.kind}">${esc(it.show)}</span><span class="chip-sub">${r.heard.length ? `heard: ${r.heard.map((k) => esc(heardLabel(k))).join(", ")}` : "skipped"}</span></div>`).join("");
    el.grid.innerHTML = state.items.map((it, i) => {
      const r = state.results[i];
      const cls = r.status === "right" ? (r.late ? "late" : "right") : "missed";
      return `<span class="cell ${cls}" data-kind="${it.kind}" title="${esc(itemName(it))}">${esc(it.show)}</span>`;
    }).join("");
    show("results");
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function renderScores() {
    const history = store.get(KEYS.history, []);
    el.scoresList.innerHTML = history.length
      ? `<table class="scores"><thead><tr><th>Date</th><th>Name</th><th>Score</th><th>Time</th></tr></thead><tbody>${history.map((h) => `<tr><td>${new Date(h.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</td><td>${esc(h.name)}</td><td><strong>${h.score}</strong>/${h.total}${h.late ? ` <span class="late-note">+${h.late}⏰</span>` : ""}</td><td>${fmt(h.seconds)}</td></tr>`).join("")}</tbody></table>`
      : `<p class="empty">No scores yet. Play a round and your score shows up here!</p>`;
    show("scores");
  }

  el.again.addEventListener("click", () => { show("start"); renderStart(); });
  el.resultsScores.addEventListener("click", renderScores);
  el.openScores.addEventListener("click", renderScores);
  el.scoresBack.addEventListener("click", () => { show("start"); renderStart(); });
  el.scoresClear.addEventListener("click", () => {
    if (window.confirm("Clear all saved scores on this iPad?")) { store.remove(KEYS.history); renderScores(); }
  });
  el.print.addEventListener("click", () => window.print());

  function renderStart() {
    el.name.value = store.get(KEYS.name, "") || "";
    const saved = store.get(KEYS.game);
    el.resume.hidden = !saved;
    if (saved) el.resume.textContent = `Keep going, ${saved.name}! (${saved.results.filter((r) => r.status).length} of ${TOTAL} done)`;
  }
  el.startForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = el.name.value.trim();
    if (!name) { el.name.focus(); return; }
    store.remove(KEYS.game);
    startGame(name);
  });
  el.resume.addEventListener("click", () => {
    const saved = store.get(KEYS.game);
    if (saved) playGame(saved);
  });

  // ---------- Pause when the app is hidden ----------
  function onHide() {
    if (!state || !state.playing) return;
    pauseClock();
    if (!overlayMode && el.timesup.hidden && el.restartAsk.hidden) showOverlay("paused");
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden) onHide(); });
  window.addEventListener("pagehide", onHide);

  // ---------- Splash ----------
  function runSplash() {
    el.splashMonkey.innerHTML = window.monkeySVG(monkeyStyle, monkeyStyle === "B" ? "cheer" : "wave");
    el.splash.dataset.trick = monkeyStyle;
    const fx = { A: ["🍌", "🍌", "🍌"], B: ["🍌", "🍌", "🍌"], C: ["🎵", "🎶", "🎵"] }[monkeyStyle];
    el.splashFx.innerHTML = fx.map((f, i) => `<span class="fx fx${i}">${f}</span>`).join("");
    let gone = false;
    const hide = () => {
      if (gone) return;
      gone = true;
      el.splash.classList.add("hide");
      setTimeout(() => { el.splash.hidden = true; }, 400);
      if (!el.resume.hidden) el.resume.focus();
    };
    el.splash.addEventListener("click", hide);
    el.splash.addEventListener("keydown", hide);
    document.addEventListener("keydown", hide, { once: true });
    setTimeout(hide, 2200);
    el.splash.focus();
  }

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  drawMonkeys();
  renderMute();
  renderStart();
  runSplash();
  loadSpeech().catch(() => {});

  window.__k100 = { makeItems, allItems, getState: () => state, hear: (text, type = "final") => handleSpeech({ type, text }), KEYS, MIX, monkeyStyle };
})();

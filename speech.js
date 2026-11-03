// Offline speech recognition for Kennedy 100.
// Vosk (WebAssembly) runs in a worker and listens only for the answers the game can accept
// (letter names and the numbers 1 to 30), which keeps it small, fast and private: audio never leaves the iPad.
(() => {
  "use strict";

  const MODEL_URL = "model/vosk-model-small-en-us-0.15.tar.gz";

  // Words a child might say for each letter name. Same-sounding words count ("see" for C, "you" for U).
  const LETTER_WORDS = {
    a: ["a", "ay", "hey"], b: ["b", "bee", "be"], c: ["c", "see", "sea"], d: ["d", "dee"], e: ["e"],
    f: ["f"], g: ["g", "gee"], h: ["h"], i: ["i", "eye"], j: ["j", "jay"], k: ["k", "kay", "okay"],
    l: ["l", "el", "elle"], m: ["m", "em"], n: ["n", "en"], o: ["o", "oh"], p: ["p", "pee", "pea"],
    q: ["q", "queue", "cue"], r: ["r", "are", "our"], s: ["s", "yes"], t: ["t", "tea", "tee"], u: ["u", "you"],
    v: ["v"], w: ["w"], x: ["x", "ex"], y: ["y", "why"], z: ["z", "zee", "zed"],
  };
  const ONES = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  const TEENS = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];

  function numberPhrases(n) {
    if (n < 10) return [ONES[n - 1]];
    if (n < 20) return [TEENS[n - 10]];
    if (n === 20) return ["twenty"];
    if (n === 30) return ["thirty"];
    return [`twenty ${ONES[n - 21]}`];
  }

  // phrase -> answer key ("b" for the letter B/b, "17" for seventeen)
  const PHRASES = new Map();
  for (const [letter, words] of Object.entries(LETTER_WORDS)) for (const w of words) PHRASES.set(w, letter);
  for (let n = 1; n <= 30; n++) for (const p of numberPhrases(n)) PHRASES.set(p, String(n));
  const GRAMMAR = JSON.stringify([...PHRASES.keys(), "[unk]"]);

  // Turns recognizer text like "twenty one" or "bee bee" into answer keys: ["21"] or ["b", "b"].
  function parse(text) {
    const words = String(text || "").toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
    const out = [];
    for (let i = 0; i < words.length; i++) {
      const two = words[i + 1] ? `${words[i]} ${words[i + 1]}` : null;
      if (two && PHRASES.has(two)) { out.push(PHRASES.get(two)); i++; }
      else if (PHRASES.has(words[i])) out.push(PHRASES.get(words[i]));
    }
    return out;
  }

  let model = null;
  let recognizer = null;
  let loading = null;
  let ctx = null;
  let stream = null;
  let source = null;
  let node = null;
  let listeners = [];
  let level = 0;

  const emit = (msg) => listeners.forEach((fn) => fn(msg));

  async function fetchWithProgress(url, onProgress) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Model download failed (${res.status})`);
    const total = Number(res.headers.get("content-length")) || 0;
    if (!res.body || !total) return res.blob();
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
      onProgress(Math.min(0.95, (got / total) * 0.9));
    }
    return new Blob(chunks);
  }

  function deleteOldModelCopy() {
    // vosk-browser copies the unpacked model into IndexedDB under the URL it was given. We hand it a fresh
    // blob URL every launch (the service worker keeps the download offline), so clear the old copy first.
    return new Promise((resolve) => {
      try {
        const req = indexedDB.deleteDatabase("/vosk");
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      } catch (e) { resolve(); }
    });
  }

  // On the very first visit the service worker isn't in charge yet, so the model download would skip its
  // cache and the game wouldn't work offline until the next launch. Wait briefly for it to take over.
  async function waitForServiceWorker() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:" || navigator.serviceWorker.controller) return;
    await Promise.race([
      new Promise((resolve) => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true })),
      new Promise((resolve) => setTimeout(resolve, 8000)),
    ]);
  }

  // Like Vosk.createModel, but also fails (instead of waiting forever) when the worker reports an error.
  function createModel(url) {
    return new Promise((resolve, reject) => {
      const m = new window.Vosk.Model(url, -1);
      const fail = (msg) => {
        // Hard-stop the worker so its half-open copy of the model can't block the next try.
        try { m.worker.terminate(); } catch (e) {}
        reject(new Error((msg && msg.error) || "Speech model failed to load"));
      };
      m.on("load", (msg) => (msg.result ? resolve(m) : fail(msg)));
      m.on("error", fail);
      m.worker.addEventListener("error", fail);
    });
  }

  function load(onProgress = () => {}) {
    if (loading) return loading;
    loading = (async () => {
      if (!window.Vosk) throw new Error("Speech engine missing");
      onProgress(0.01);
      await waitForServiceWorker();
      const blob = await fetchWithProgress(MODEL_URL, onProgress);
      await deleteOldModelCopy();
      onProgress(0.92);
      const url = URL.createObjectURL(blob);
      try {
        model = await createModel(url);
      } finally {
        URL.revokeObjectURL(url);
      }
      if (ctx && stream) makeRecognizer();
      onProgress(1);
      return true;
    })();
    loading.catch(() => { loading = null; });
    return loading;
  }

  function makeRecognizer() {
    if (recognizer) { try { recognizer.remove(); } catch (e) {} }
    recognizer = new model.KaldiRecognizer(ctx.sampleRate, GRAMMAR);
    recognizer.on("result", (m) => emit({ type: "final", text: m.result.text || "" }));
    recognizer.on("partialresult", (m) => emit({ type: "partial", text: m.result.partial || "" }));
  }

  // Must be called from a tap so iPad Safari allows the microphone and audio.
  async function startMic() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state !== "running") { try { await ctx.resume(); } catch (e) {} }
    const live = stream && stream.getAudioTracks().some((t) => t.readyState === "live");
    if (!live) {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
        video: false,
      });
      if (source) source.disconnect();
      source = ctx.createMediaStreamSource(stream);
    }
    if (!node) {
      node = ctx.createScriptProcessor(4096, 1, 1);
      node.onaudioprocess = (e) => {
        const data = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < data.length; i += 8) sum += data[i] * data[i];
        level = Math.min(1, Math.sqrt(sum / (data.length / 8)) * 6);
        if (recognizer) { try { recognizer.acceptWaveform(e.inputBuffer); } catch (err) {} }
      };
      node.connect(ctx.destination);
    }
    source.disconnect();
    source.connect(node);
    if (model && !recognizer) makeRecognizer();
    return true;
  }

  // Throws away anything half-heard so the next card starts clean.
  function reset() { if (model && ctx) makeRecognizer(); }

  function stopMic() {
    if (source) { try { source.disconnect(); } catch (e) {} }
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    source = null;
    level = 0;
  }

  function micRunning() {
    return Boolean(ctx && ctx.state === "running" && stream && stream.getAudioTracks().some((t) => t.readyState === "live"));
  }

  window.K100Speech = {
    load,
    startMic,
    stopMic,
    reset,
    parse,
    micRunning,
    isReady: () => Boolean(model),
    level: () => level,
    audioContext: () => ctx,
    on: (fn) => { listeners.push(fn); },
    GRAMMAR,
  };
})();

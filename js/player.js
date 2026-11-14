/* Playback. The first stream is the highest concrete quality, never Auto.
   An HLS master is locked to its highest level before any fragment loads. */
(function () {
  const Mly = (window.Mly = window.Mly || {});

  function heightOf(video) {
    const label = String((video && video.quality) || "");
    if (/^\s*auto\b/i.test(label) || /adattiva|adaptive/i.test(label)) return -1;
    let m = label.match(/(2160|1440|1080|720|480|360|240)\s*p?/i);
    if (m) return parseInt(m[1], 10);
    if (/4\s*k/i.test(label)) return 2160;
    if (/2\s*k/i.test(label)) return 1440;
    const url = String((video && video.url) || "");
    m = url.match(/(2160|1440|1080|720|480|360|240)p/i);
    if (m) return parseInt(m[1], 10);
    if (/originale|original|source/i.test(label)) return 1;
    return 0;
  }

  function bestIndex(videos) {
    let best = 0;
    let score = -Infinity;
    let bestIsHls = false;
    (videos || []).forEach((v, i) => {
      if (!v || !v.url) return;
      const s = heightOf(v);
      const isHls = /\.m3u8(\?|$)/i.test(v.url);
      if (s > score || (s === score && isHls && !bestIsHls)) {
        score = s;
        best = i;
        bestIsHls = isHls;
      }
    });
    return best;
  }

  function lockHighest(hls) {
    const levels = hls.levels || [];
    if (!levels.length) return { index: 0, height: 0 };
    let best = 0;
    let h = -1;
    levels.forEach((level, i) => {
      const height = level.height || 0;
      if (height >= h) { h = height; best = i; }
    });
    hls.autoLevelCapping = best;
    hls.currentLevel = best;
    hls.loadLevel = best;
    hls.nextLevel = best;
    return { index: best, height: h, auto: hls.autoLevelEnabled };
  }

  let hls = null;
  let video = null;
  let frame = null;
  let usingAv = false;
  let lastSave = 0;
  let qualityOpen = false;
  let qualityIndex = 0;
  // Control row (Mangayomi-like overlay). -1 = keys drive the video directly.
  let ctl = -1;
  let subIndex = -1;
  let hideTimer = 0;
  const HIDE_MS = 3000; // overlay hides after 3 s without keys while playing
  const SKIP_INTRO_MS = 85000; // Mangayomi default skip duration
  const PLAY_SVG = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  const PAUSE_SVG = '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6zM14 5v14h4V5z"/></svg>';

  function isOpen() { return !!frame; }

  function qualityLabel(v, fallback) {
    if (!v) return fallback || "";
    if (v.quality) return v.quality;
    const h = heightOf(v);
    return h > 1 ? h + "p" : "Video";
  }
  // Short label for the Qualità button: only the resolution, never a server or source
  // name (AnimeWorld used to show up as a badge on the right).
  let lockedHeight = 0;
  function shortQuality(v) {
    if (!v) return "";
    const h = heightOf(v);
    if (h > 1) return h + "p";
    if (lockedHeight > 1) return lockedHeight + "p";
    if (h === -1) return "Auto";
    return "";
  }
  function nearestP(h) {
    const buckets = [2160, 1440, 1080, 720, 540, 480, 360, 240];
    let best = h;
    let dist = 80;
    buckets.forEach((b) => {
      const d = Math.abs(b - h);
      if (d < dist) { dist = d; best = b; }
    });
    return best;
  }
  function qualityButtonLabel() {
    if (!frame) return "Video";
    const h = heightOf(frame.videos[frame.videoIndex]);
    if (h > 1) return h + "p";
    if (lockedHeight > 1) return lockedHeight + "p";
    if (video && video.videoHeight > 1) return nearestP(video.videoHeight) + "p";
    return "Video";
  }

  function stop(noSave) {
    if (!noSave && frame && (video || usingAv)) { try { remember(false); } catch (e) {} }
    qualityOpen = false;
    ctl = -1;
    subIndex = -1;
    lockedHeight = 0;
    clearTimeout(hideTimer);
    if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }
    if (usingAv && window.webapis && window.webapis.avplay) {
      try { window.webapis.avplay.stop(); window.webapis.avplay.close(); } catch (e) {}
    }
    usingAv = false;
    if (video) {
      video.pause();
      video.removeAttribute("src");
      try { video.load(); } catch (e) {}
    }
    video = null;
    frame = null;
  }

  function currentMs() {
    if (usingAv && window.webapis && window.webapis.avplay) {
      try { return window.webapis.avplay.getCurrentTime(); } catch (e) { return 0; }
    }
    return video ? Math.floor(video.currentTime * 1000) : 0;
  }
  function durationMs() {
    if (usingAv && window.webapis && window.webapis.avplay) {
      try { return window.webapis.avplay.getDuration(); } catch (e) { return 0; }
    }
    return video && isFinite(video.duration) ? Math.floor(video.duration * 1000) : 0;
  }

  function remember(done) {
    if (!frame || !Mly.ui) return;
    let cur = currentMs();
    // While a resumed episode is still seeking, keep the saved position instead of 0.
    if (frame.resumeFrom) {
      if (cur >= frame.resumeFrom - 5000) frame.resumeFrom = 0;
      else if (!done) cur = frame.resumeFrom;
    }
    Mly.ui.rememberPlayback(frame, cur, durationMs(), !!done);
  }
  function save() { if (frame) { try { remember(false); } catch (e) {} } }
  document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
  window.addEventListener("pagehide", save);
  window.addEventListener("beforeunload", save);

  function isPaused() {
    if (usingAv && window.webapis && window.webapis.avplay) {
      try { return window.webapis.avplay.getState() !== "PLAYING"; } catch (e) { return false; }
    }
    return !video || video.paused;
  }

  function controls() {
    return [...document.querySelectorAll("#player-ctl [data-pc]")];
  }
  function usable(btn) { return btn && !btn.disabled; }

  function subtitleList() {
    const v = frame && frame.videos[frame.videoIndex];
    return (v && v.subtitles) || [];
  }

  function show() {
    const shade = document.getElementById("player-shade");
    if (shade) shade.classList.add("is-shown");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!frame || ctl >= 0 || qualityOpen || isPaused()) return;
      const el = document.getElementById("player-shade");
      if (el) el.classList.remove("is-shown");
    }, HIDE_MS);
  }

  function paintChrome() {
    const bar = document.getElementById("player-bar");
    const knob = document.getElementById("player-knob");
    const cur = document.getElementById("player-cur");
    const durEl = document.getElementById("player-dur");
    const time = document.getElementById("player-time");
    const list = document.getElementById("player-qualities");
    const q = document.getElementById("player-quality");
    const dur = durationMs();
    const now = currentMs();
    const ratio = dur ? Math.min(1, now / dur) : 0;
    if (bar) bar.style.transform = "scaleX(" + ratio + ")";
    if (knob) knob.style.left = (ratio * 100).toFixed(2) + "%";
    if (cur) cur.textContent = fmt(now);
    if (durEl) durEl.textContent = fmt(dur);
    if (time) time.textContent = fmt(now) + " / " + fmt(dur);
    if (q && frame) q.textContent = shortQuality(frame.videos[frame.videoIndex]);
    const paused = isPaused();
    const center = document.getElementById("player-center");
    if (center) {
      center.hidden = !paused || !frame || !(video && video.readyState >= 2 || usingAv);
    }
    const shade = document.getElementById("player-shade");
    if (shade && (paused || ctl >= 0 || qualityOpen)) { shade.classList.add("is-shown"); shade._sticky = true; }
    else if (shade && shade._sticky) { shade._sticky = false; show(); }
    const btns = controls();
    btns.forEach((btn) => {
      const id = btn.dataset.pc;
      if (id === "play") {
        const want = paused ? "play" : "pause";
        if (btn.dataset.state !== want) {
          btn.dataset.state = want;
          btn.innerHTML = paused ? PLAY_SVG : PAUSE_SVG;
          btn.setAttribute("aria-label", paused ? "Riproduci" : "Pausa");
        }
      } else if (id === "prev") btn.disabled = prevOf() < 0;
      else if (id === "next") btn.disabled = nextOf() < 0;
      else if (id === "quality") {
        const label = qualityButtonLabel();
        const span = btn.querySelector(".pctl-label");
        if (span && span.textContent !== label) span.textContent = label;
        btn.setAttribute("aria-label", "Qualità " + label);
        btn.disabled = !frame || frame.videos.length < 2;
      } else if (id === "subs") {
        const subs = subtitleList();
        btn.disabled = !subs.length;
        const label = !subs.length ? "Sottotitoli: nessuno" : subIndex < 0 ? "Sottotitoli: no" : "Sottotitoli: " + (subs[subIndex].label || ("Traccia " + (subIndex + 1)));
        const span = btn.querySelector(".pctl-label");
        if (span && span.textContent !== label) span.textContent = label;
      }
    });
    if (ctl >= 0 && !usable(btns[ctl])) ctl = btns.findIndex(usable);
    btns.forEach((btn, i) => btn.classList.toggle("is-focused", i === ctl));
    if (list) list.hidden = !qualityOpen;
    if (qualityOpen && list) {
      [...list.querySelectorAll("button")].forEach((btn, i) => {
        btn.classList.toggle("is-focused", i === qualityIndex);
        btn.classList.toggle("is-current", frame && i === frame.videoIndex);
        if (i === qualityIndex) btn.scrollIntoView({ block: "nearest" });
      });
    }
  }

  function applySubtitles() {
    if (!video) return;
    const tracks = video.textTracks || [];
    for (let i = 0; i < tracks.length; i++) tracks[i].mode = i === subIndex ? "showing" : "disabled";
  }
  function loadSubtitles() {
    if (!video) return;
    [...video.querySelectorAll("track")].forEach((t) => t.remove());
    subtitleList().forEach((t, i) => {
      const el = document.createElement("track");
      el.kind = "subtitles";
      el.label = t.label || ("Traccia " + (i + 1));
      el.src = t.file;
      video.appendChild(el);
    });
    applySubtitles();
  }

  function fmt(ms) {
    const s = Math.max(0, Math.floor((ms || 0) / 1000));
    const m = Math.floor(s / 60);
    return m + ":" + String(s % 60).padStart(2, "0");
  }

  const OFFLINE_ROOM = "Stanza privata o offline";

  function sourceLabel() {
    if (!frame || !frame.sourceId || !Mly.memory || !Mly.memory.extensions) return "";
    const src = Mly.memory.extensions[String(frame.sourceId)];
    return src ? ((src.name || "") + " " + (src.baseUrl || "")) : "";
  }
  function stripchatContext(url) {
    return /stripchat|doppiocdn|saawsedge/i.test(String(url || "") + " " + sourceLabel());
  }
  function playlistSeconds(text) {
    const parts = String(text || "").match(/#EXTINF:([0-9.]+)/gi) || [];
    return parts.reduce((sum, line) => sum + parseFloat(line.split(":")[1]), 0);
  }
  // The 12s "Find the real thing on STRIPCHAT.COM" clip is a short VOD.
  // A public room is a live playlist and is left alone. No HD bypass.
  function isPlaceholderPlaylist(text, url) {
    const body = String(text || "");
    const where = body + "\n" + String(url || "");
    if (/find the real thing/i.test(where) && /stripchat/i.test(where)) return true;
    if (!stripchatContext(url) && !/stripchat|doppiocdn|saawsedge/i.test(where)) return false;
    const vod = /#EXT-X-ENDLIST/i.test(body) || /PLAYLIST-TYPE:\s*VOD/i.test(body);
    const dur = playlistSeconds(body);
    return vod && dur >= 8 && dur <= 16;
  }
  async function isPlaceholderStream(url) {
    if (!stripchatContext(url) || !/\.m3u8(\?|$)/i.test(url)) return false;
    try {
      const text = await fetch(url, { credentials: "omit" }).then((r) => r.text());
      if (isPlaceholderPlaylist(text, url)) return true;
      if (/#EXTINF:/i.test(text)) return false;
      const next = text.split(/\r?\n/).map((l) => l.trim()).find((l) => l && l.charAt(0) !== "#");
      if (!next) return false;
      const abs = new URL(next, url).href;
      const nested = await fetch(abs, { credentials: "omit" }).then((r) => r.text());
      return isPlaceholderPlaylist(nested, abs);
    } catch (e) {
      return false;
    }
  }
  function blockOfflineRoom() {
    if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }
    if (video) {
      try { video.pause(); } catch (e) {}
      video.removeAttribute("src");
      try { video.load(); } catch (e) {}
    }
    showError(OFFLINE_ROOM);
    paintChrome();
  }

  async function playUrl(url, startMs) {
    if (await isPlaceholderStream(url)) { blockOfflineRoom(); return; }
    const useAv = Mly.memory.settings.useAvPlay && window.webapis && window.webapis.avplay && !/\.m3u8(\?|$)/i.test(url);
    if (useAv) {
      usingAv = true;
      const av = window.webapis.avplay;
      try {
        av.open(url);
        av.setDisplayRect(0, 0, 1920, 1080);
        av.setListener({
          onstreamcompleted: () => onEnded(),
          onerror: () => showError("Samsung AVPlay non riesce ad aprire questo flusso e per questo indirizzo non c'è alternativa."),
        });
        av.prepareAsync(() => {
          if (startMs > 3000) { try { av.seekTo(startMs); } catch (e) {} }
          av.play();
        }, () => showError("Samsung AVPlay non riesce a preparare questo flusso."));
        return;
      } catch (e) {
        usingAv = false;
      }
    }
    if (/\.m3u8(\?|$)/i.test(url) && window.Hls && window.Hls.isSupported()) {
      hls = new window.Hls({ autoStartLoad: false, capLevelToPlayerSize: false, startLevel: 0 });
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        const locked = lockHighest(hls);
        if (locked.height > 1) lockedHeight = locked.height;
        paintChrome();
        hls.startLoad(startMs > 3000 ? startMs / 1000 : -1);
        video.play().catch(() => {});
      });
      hls.on(window.Hls.Events.LEVEL_LOADED, (_, data) => {
        const details = data && data.details;
        if (!details || !stripchatContext(url) || details.live) return;
        const dur = details.totalduration || 0;
        if (dur >= 8 && dur <= 16) blockOfflineRoom();
      });
      hls.on(window.Hls.Events.ERROR, (_, data) => {
        if (!data || !data.fatal) return;
        showError("Riproduzione HLS non riuscita (" + data.type + "). " + headerNote());
      });
      hls.attachMedia(video);
      hls.loadSource(url);
      return;
    }
    if (/\.m3u8(\?|$)/i.test(url)) {
      showError("Questo flusso è HLS e hls.js non è disponibile, quindi non si può scegliere la variante più alta.");
      return;
    }
    video.src = url;
    const start = () => {
      if (stripchatContext(url) && isFinite(video.duration) && video.duration >= 8 && video.duration <= 16) {
        blockOfflineRoom();
        return;
      }
      if (startMs > 3000 && startMs < (video.duration || 1e12) * 1000 * 0.9) {
        try { video.currentTime = startMs / 1000; } catch (e) {}
      }
      video.play().catch(() => {});
    };
    if (video.readyState >= 1) start();
    else video.addEventListener("loadedmetadata", start, { once: true });
  }

  function headerNote() {
    return "Se il file richiede Cookie, Referer o User-Agent, questa TV non può inviarli. L'app non aggira questo limite.";
  }

  function showError(msg) {
    const el = document.getElementById("player-error");
    if (el) { el.hidden = false; el.textContent = msg; }
  }

  function prevOf() {
    return frame && Mly.ui && Mly.ui.prevIndex ? Mly.ui.prevIndex(frame.episodes, frame.episodeIndex) : -1;
  }
  function nextOf() {
    return frame && Mly.ui && Mly.ui.nextIndex ? Mly.ui.nextIndex(frame.episodes, frame.episodeIndex) : -1;
  }
  function onEnded() {
    remember(true);
    if (nextOf() >= 0) nextEpisode(true);
  }

  function attach(next) {
    stop(true);
    frame = next;
    frame.videoIndex = bestIndex(frame.videos);
    video = document.getElementById("player-video");
    const chosen = frame.videos[frame.videoIndex];
    paintChrome();
    if (!chosen || !chosen.url) {
      showError("Nessun flusso da riprodurre.");
      return;
    }
    video.addEventListener("timeupdate", () => {
      const now = Date.now();
      if (now - lastSave > 2000) { lastSave = now; remember(false); }
      paintChrome();
    });
    video.addEventListener("ended", onEnded);
    video.addEventListener("play", () => { paintChrome(); show(); });
    video.addEventListener("pause", paintChrome);
    video.addEventListener("error", () => showError("Il video non è partito. " + headerNote()));
    const start = frame.startAt || 0;
    frame.startAt = 0;
    frame.resumeFrom = start > 3000 ? start : 0;
    playUrl(chosen.url, start);
    loadSubtitles();
    show();
    remember(false);
  }

  function seek(delta) {
    if (!video && !usingAv) return;
    if (usingAv && window.webapis) {
      try { window.webapis.avplay.seekTo(Math.max(0, currentMs() + delta)); } catch (e) {}
      return;
    }
    video.currentTime = Math.max(0, Math.min(video.duration || 1e9, video.currentTime + delta / 1000));
  }

  function toggle() {
    if (usingAv && window.webapis) {
      const av = window.webapis.avplay;
      try {
        if (av.getState() === "PLAYING") av.pause();
        else av.play();
      } catch (e) {}
      return;
    }
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }

  function chooseQuality(i) {
    if (!frame || !frame.videos[i]) return;
    const at = currentMs();
    frame.videoIndex = i;
    qualityOpen = false;
    if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }
    if (video) {
      video.pause();
      video.removeAttribute("src");
    }
    lockedHeight = 0;
    playUrl(frame.videos[i].url, at);
    subIndex = -1;
    loadSubtitles();
    paintChrome();
  }

  function prevEpisode() {
    if (!frame) return false;
    const n = prevOf();
    if (n < 0) return false;
    remember(false);
    Mly.ui.playEpisode(frame, n, 0);
    return true;
  }

  function nextEpisode(ended) {
    if (!frame) return false;
    const n = nextOf();
    if (n < 0) return false;
    if (!ended) remember(false);
    Mly.ui.playEpisode(frame, n, 0);
    return true;
  }

  function isBackKey(e) {
    return e.key === "Escape" || e.key === "BrowserBack" || e.key === "GoBack" || e.keyCode === 10009 || e.keyCode === 461 || e.keyCode === 8 && !e.key;
  }

  function openQuality() {
    qualityOpen = true;
    qualityIndex = frame.videoIndex;
  }

  function press(id) {
    if (id === "prev") { if (!prevEpisode()) showError("Non c'è un episodio precedente."); }
    else if (id === "next") { if (!nextEpisode()) showError("Non c'è un episodio successivo."); }
    else if (id === "back10") seek(-10000);
    else if (id === "fwd10") seek(10000);
    else if (id === "play") toggle();
    else if (id === "skip") seek(SKIP_INTRO_MS);
    else if (id === "quality") { if (frame.videos.length > 1) openQuality(); }
    else if (id === "subs") {
      const subs = subtitleList();
      if (subs.length) { subIndex = subIndex + 1 >= subs.length ? -1 : subIndex + 1; applySubtitles(); }
    }
  }

  function moveCtl(step) {
    const btns = controls();
    for (let i = ctl + step; i >= 0 && i < btns.length; i += step) {
      if (usable(btns[i])) { ctl = i; return; }
    }
  }

  function openBar() {
    const btns = controls();
    // Mangayomi parks focus on play/pause, in the middle of the bottom bar.
    ctl = btns.findIndex((b) => b.dataset.pc === "play" && usable(b));
    if (ctl < 0) ctl = btns.findIndex(usable);
  }

  // Keys. Left/Right ±10 s, OK pause. Down opens the bottom bar on Play
  // (as in Mangayomi). In the bar: Left/Right move, OK presses, Up or Back
  // leave it. Media keys work everywhere.
  function handleKey(e) {
    if (!frame) return false;
    const key = e.key;
    const code = e.keyCode;
    show();
    if (qualityOpen) {
      const n = frame.videos.length;
      if (key === "ArrowDown") qualityIndex = Math.min(n - 1, qualityIndex + 1);
      else if (key === "ArrowUp") qualityIndex = Math.max(0, qualityIndex - 1);
      else if (key === "Enter") chooseQuality(qualityIndex);
      else if (isBackKey(e)) qualityOpen = false;
      else return true;
      paintChrome();
      return true;
    }
    if (key === "MediaPlayPause" || code === 10252) { toggle(); paintChrome(); return true; }
    if (key === "MediaPlay" || code === 415) { if (isPaused()) toggle(); paintChrome(); return true; }
    if (key === "MediaPause" || code === 19) { if (!isPaused()) toggle(); paintChrome(); return true; }
    if (key === "MediaFastForward" || code === 417) { seek(10000); paintChrome(); return true; }
    if (key === "MediaRewind" || code === 412) { seek(-10000); paintChrome(); return true; }
    if (key === "MediaTrackNext" || code === 10233) { press("next"); paintChrome(); return true; }
    if (key === "MediaTrackPrevious" || code === 10232) { press("prev"); paintChrome(); return true; }
    if (ctl >= 0) {
      if (key === "ArrowLeft") moveCtl(-1);
      else if (key === "ArrowRight") moveCtl(1);
      else if (key === "Enter") press(controls()[ctl].dataset.pc);
      else if (key === "ArrowUp" || isBackKey(e)) ctl = -1;
      else if (key === "ArrowDown") { /* already on the bottom bar */ }
      else return false;
      paintChrome();
      return true;
    }
    if (key === "ArrowLeft") seek(-10000);
    else if (key === "ArrowRight") seek(10000);
    else if (key === "Enter" || key === " ") toggle();
    else if (key === "ArrowDown") openBar();
    else if (key === "ArrowUp") { /* reveals the overlay; does not jump to Qualità */ }
    else return false;
    paintChrome();
    return true;
  }

  function probeHls(url) {
    return new Promise((resolve, reject) => {
      const el = document.createElement("video");
      const engine = new window.Hls({ autoStartLoad: false, capLevelToPlayerSize: false, startLevel: 0 });
      const timer = setTimeout(() => { engine.destroy(); reject(new Error("HLS manifest timed out")); }, 8000);
      engine.on(window.Hls.Events.MANIFEST_PARSED, () => {
        const locked = lockHighest(engine);
        clearTimeout(timer);
        const info = { index: locked.index, height: locked.height, auto: engine.autoLevelEnabled, levels: engine.levels.map((l) => l.height) };
        engine.destroy();
        resolve(info);
      });
      engine.on(window.Hls.Events.ERROR, (_, data) => {
        if (data && data.fatal) { clearTimeout(timer); engine.destroy(); reject(new Error(data.type || "hls")); }
      });
      engine.attachMedia(el);
      engine.loadSource(url);
    });
  }

  Mly.player = {
    heightOf, bestIndex, lockHighest, attach, stop, isOpen, handleKey, probeHls, paintChrome,
    chooseQuality, nextEpisode, prevEpisode, save, press, SKIP_INTRO_MS, isPlaceholderPlaylist, OFFLINE_ROOM,
    _frame: () => frame,
    state: () => ({ ctl, qualityOpen, subIndex, focused: (controls()[ctl] || {}).dataset ? controls()[ctl].dataset.pc : null }),
  };
})();

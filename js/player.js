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

  function isOpen() { return !!frame; }

  function qualityLabel(v, fallback) {
    if (!v) return fallback || "";
    if (v.quality) return v.quality;
    const h = heightOf(v);
    return h > 1 ? h + "p" : "Video";
  }

  function stop(noSave) {
    if (!noSave && frame && (video || usingAv)) { try { remember(false); } catch (e) {} }
    qualityOpen = false;
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

  function paintChrome() {
    const q = document.getElementById("player-quality");
    const bar = document.getElementById("player-bar");
    const time = document.getElementById("player-time");
    const list = document.getElementById("player-qualities");
    if (q && frame) q.textContent = qualityLabel(frame.videos[frame.videoIndex]);
    const dur = durationMs();
    const cur = currentMs();
    if (bar) bar.style.transform = "scaleX(" + (dur ? Math.min(1, cur / dur) : 0) + ")";
    if (time) {
      time.textContent = fmt(cur) + " / " + fmt(dur);
    }
    if (list) list.hidden = !qualityOpen;
    if (qualityOpen && list) {
      [...list.querySelectorAll("button")].forEach((btn, i) => {
        btn.classList.toggle("is-focused", i === qualityIndex);
        btn.classList.toggle("is-current", frame && i === frame.videoIndex);
      });
    }
  }

  function fmt(ms) {
    const s = Math.max(0, Math.floor((ms || 0) / 1000));
    const m = Math.floor(s / 60);
    return m + ":" + String(s % 60).padStart(2, "0");
  }

  function playUrl(url, startMs) {
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
        const label = document.getElementById("player-quality");
        if (label && locked.height > 1 && frame) {
          const named = qualityLabel(frame.videos[frame.videoIndex]);
          if (/auto/i.test(named) || heightOf(frame.videos[frame.videoIndex]) <= 0) label.textContent = locked.height + "p";
        }
        hls.startLoad(startMs > 3000 ? startMs / 1000 : -1);
        video.play().catch(() => {});
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
    video.addEventListener("error", () => showError("Il video non è partito. " + headerNote()));
    const start = frame.startAt || 0;
    frame.startAt = 0;
    frame.resumeFrom = start > 3000 ? start : 0;
    playUrl(chosen.url, start);
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
    playUrl(frame.videos[i].url, at);
    paintChrome();
  }

  function nextEpisode(ended) {
    if (!frame) return false;
    const n = nextOf();
    if (n < 0) return false;
    if (!ended) remember(false);
    Mly.ui.playEpisode(frame, n, 0);
    return true;
  }

  function handleKey(e) {
    if (!frame) return false;
    const key = e.key;
    if (qualityOpen) {
      const n = frame.videos.length;
      if (key === "ArrowDown") qualityIndex = Math.min(n - 1, qualityIndex + 1);
      else if (key === "ArrowUp") qualityIndex = Math.max(0, qualityIndex - 1);
      else if (key === "Enter") chooseQuality(qualityIndex);
      else if (key === "Escape" || key === "BrowserBack" || key === "GoBack" || e.keyCode === 10009 || e.keyCode === 461) qualityOpen = false;
      else return false;
      paintChrome();
      return true;
    }
    if (key === "ArrowLeft") seek(-10000);
    else if (key === "ArrowRight") seek(10000);
    else if (key === "Enter" || key === " ") toggle();
    else if (key === "ArrowUp") {
      qualityOpen = true;
      qualityIndex = frame.videoIndex;
      paintChrome();
    } else if (key === "ArrowDown") {
      if (!nextEpisode()) showError("Non c'è un episodio successivo.");
    } else return false;
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
    chooseQuality, nextEpisode, save,
  };
})();

/* Poster and row grids for a low-power TV.
   Cells are positioned with translate3d. Only the visible rows exist.
   Focus toggles a class. Covers load only for those cells, never as
   video or GIF previews, and size hints stay at the poster slot. */
(function () {
  const Mly = (window.Mly = window.Mly || {});
  // Compact TV grid: about the same density as v0.3.4 (many covers, a small gap),
  // with Mangayomi's 0.69 cover ratio. A wide 150 dp cell left only six covers
  // and large holes once the next screen forgot to copy the size.
  const MAX_W = 180;
  const ASPECT = 0.69;
  const POSTER_GAP = 12;
  let POSTER_W = 168;
  let POSTER_H = Math.round(168 / ASPECT);
  const ROW_H = 84;
  const ROW_GAP = 16;
  const OVERSCAN = 1;

  function thumb(url) {
    if (!url) return "";
    let u = String(url).trim();
    if (!u || /^(javascript|data):/i.test(u)) return "";
    if (/\.(gif|gifv|mp4|webm|m3u8|m4v|mov|avi)(\?|#|$)/i.test(u)) return "";
    if (/\/(preview|trailer|mediabook)\//i.test(u)) return "";
    try {
      const parsed = new URL(u, "https://placeholder.local/");
      ["w", "width", "imwidth", "maxwidth", "sz"].forEach((p) => {
        if (!parsed.searchParams.has(p)) return;
        const n = parseInt(parsed.searchParams.get(p), 10);
        if (n > 320) parsed.searchParams.set(p, "320");
      });
      u = parsed.href
        .replace("https://placeholder.local/", "")
        .replace(/\/extra_large\//, "/medium/")
        .replace(/\/large\//, "/medium/");
      // PMVHaven: the 426x240 thumbnail is enough for a poster slot (the "lg" one is 640x360).
      u = u.replace(/(\/thumbnails\/[0-9a-f]+\/)thumb_lg\.webp$/i, "$1thumb_md.webp");
      // PMVHaven custom covers are full-size JPEGs (1920x1080 up to 4K, up to 1.4 MB): use the 480x270 webp of the same video.
      u = u.replace(/\/([0-9a-f]{24})\/thumbnail\/custom_\1\.(jpe?g|png|webp)$/i, "/$1/thumbnail/webp320_$1.webp");
    } catch (e) {}
    return u;
  }

  function mount(host, opts) {
    const variant = opts.variant === "rows" ? "rows" : "posters";
    host.innerHTML = '<div class="vgrid-viewport"><div class="vgrid-track"></div></div>';
    const viewport = host.querySelector(".vgrid-viewport");
    const track = host.querySelector(".vgrid-track");
    let items = opts.items || [];
    let index = Math.max(0, opts.focusIndex || 0);
    let cols = 1;
    let scrollY = 0;
    let viewH = 0;
    let totalH = 0;
    const pool = [];
    let measured = false;

    let cellW = POSTER_W;
    let posterH = POSTER_H;
    const GAP = variant === "rows" ? ROW_GAP : POSTER_GAP;
    function cellH() { return variant === "rows" ? ROW_H : posterH; }
    function stride() { return cellH() + GAP; }

    function measure() {
      viewH = viewport.clientHeight || host.clientHeight || 0;
      const w = viewport.clientWidth || host.clientWidth || 0;
      if (variant === "rows") cols = 1;
      else if (w > 0) {
        // As many columns as fit under MAX_W, then the cell is exactly that wide.
        // Always write the size onto this host: a later screen starts from the
        // previous POSTER_W, so a "same width" check would skip it and the CSS
        // default (168px) would not match the positions.
        cols = Math.max(1, Math.ceil((w + GAP) / (MAX_W + GAP)));
        cellW = Math.max(1, Math.floor((w - (cols - 1) * GAP) / cols));
        posterH = Math.round(cellW / ASPECT);
        POSTER_W = cellW;
        POSTER_H = posterH;
        host.style.setProperty("--cell-w", cellW + "px");
        host.style.setProperty("--cell-h", posterH + "px");
      }
      const rows = items.length ? Math.ceil(items.length / cols) : 0;
      totalH = rows ? rows * cellH() + Math.max(0, rows - 1) * GAP : 0;
      if (track._h !== totalH) {
        track._h = totalH;
        track.style.height = totalH + "px";
      }
      measured = viewH > 0;
    }

    function makeCell() {
      const el = document.createElement("button");
      el.type = "button";
      el.className = variant === "rows" ? "vrow" : "vcell";
      if (variant === "rows") {
        el.innerHTML = '<span class="vrow-thumb"><img alt="" width="96" height="54" decoding="async"></span><span class="vrow-text"><span class="vrow-title"></span><span class="vrow-meta"></span></span>';
      } else {
        // Mangayomi compact grid: rounded cover, title over a bottom gradient (cover_view_widget.dart, bottom_text_widget.dart).
        el.innerHTML = '<span class="vcell-card"><span class="vcell-img"><img alt="" decoding="async"><span class="vcell-shade"></span><span class="vcell-title"></span></span></span>';
      }
      const img = el.querySelector("img");
      img.addEventListener("error", () => {
        const cur = img.getAttribute("src") || "";
        const orig = img.dataset.orig || "";
        if (orig && cur !== orig) { img.src = orig; return; }
        img.removeAttribute("src");
        img.parentElement.classList.add("broken");
      });
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const i = Number(el.dataset.i);
        if (!items[i]) return;
        index = i;
        paintFocus();
        if (opts.onActivate) opts.onActivate(items[i], i);
      });
      track.appendChild(el);
      pool.push(el);
      return el;
    }

    function paintFocus() {
      const focused = host.classList.contains("is-focused");
      for (let p = 0; p < pool.length; p++) {
        const el = pool[p];
        if (el.hidden) continue;
        el.classList.toggle("is-focused", focused && el.dataset.i === String(index));
      }
    }

    function bind(force) {
      if (!measured) measure();
      const rowH = stride();
      const rows = items.length ? Math.ceil(items.length / cols) : 0;
      const firstRow = Math.max(0, Math.floor(scrollY / rowH) - OVERSCAN);
      const vis = viewH > 0 ? Math.ceil(viewH / rowH) + OVERSCAN * 2 : rows;
      const lastRow = Math.min(rows - 1, firstRow + vis);
      const need = rows ? Math.max(0, (lastRow - firstRow + 1) * cols) : 0;
      while (pool.length < need) makeCell();
      let p = 0;
      for (let r = firstRow; r <= lastRow; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const el = pool[p++];
          if (!el) break;
          if (i >= items.length) { el.hidden = true; continue; }
          el.hidden = false;
          const x = variant === "rows" ? 0 : c * (cellW + GAP);
          const y = r * rowH;
          const transform = "translate3d(" + x + "px," + y + "px,0)";
          if (el.style.transform !== transform) el.style.transform = transform;
          if (variant !== "rows") {
            const wpx = cellW + "px";
            const hpx = posterH + "px";
            if (el.style.width !== wpx) el.style.width = wpx;
            if (el.style.height !== hpx) el.style.height = hpx;
          }
          const item = items[i];
          const key = (item.link || item.url || "") + "|" + (item.name || "");
          if (force || el.dataset.key !== key) {
            el.dataset.key = key;
            el.dataset.i = String(i);
            const title = el.querySelector(variant === "rows" ? ".vrow-title" : ".vcell-title");
            title.textContent = item.name || "";
            if (variant === "rows") {
              el.querySelector(".vrow-meta").textContent = item.meta || "";
              el.classList.toggle("is-watched", !!item.watched);
              el.classList.toggle("is-resume", !!item.resume);
            }
            const img = el.querySelector("img");
            const src = thumb(item.imageUrl);
            if (img.dataset.src !== src) {
              img.dataset.src = src;
              img.parentElement.classList.remove("broken");
              img.dataset.orig = item.imageUrl || "";
              if (src) img.src = src;
              else img.removeAttribute("src");
            }
          } else if (el.dataset.i !== String(i)) {
            el.dataset.i = String(i);
          }
        }
      }
      for (; p < pool.length; p++) {
        pool[p].hidden = true;
        const img = pool[p].querySelector("img");
        if (img && img.getAttribute("src")) {
          img.dataset.src = "";
          img.removeAttribute("src");
        }
      }
      paintFocus();
    }

    function reveal() {
      if (!items.length) return;
      if (!measured) measure();
      const row = Math.floor(index / cols);
      const y = row * stride();
      let next = scrollY;
      if (y < scrollY) next = y;
      else if (viewH && y + cellH() > scrollY + viewH) next = y + cellH() - viewH + GAP;
      const max = Math.max(0, totalH - viewH);
      next = Math.max(0, Math.min(max, next));
      if (next !== scrollY) {
        scrollY = next;
        track.style.transform = "translate3d(0," + (-scrollY) + "px,0)";
        bind(false);
      } else paintFocus();
      if (opts.onIndex) opts.onIndex(index);
    }

    function move(dir) {
      if (!items.length) return false;
      if (!measured) measure();
      const col = index % cols;
      let next = index;
      if (dir === "left") {
        if (col === 0) return false;
        next = index - 1;
      } else if (dir === "right") {
        if (col === cols - 1 || index + 1 >= items.length) return false;
        next = index + 1;
      } else if (dir === "up") {
        if (index - cols < 0) return false;
        next = index - cols;
      } else if (dir === "down") {
        if (index + cols < items.length) next = index + cols;
        else if (Math.floor(index / cols) < Math.floor((items.length - 1) / cols)) next = items.length - 1;
        else return false;
      }
      index = next;
      reveal();
      return true;
    }

    function setItems(next, keepIndex) {
      items = next || [];
      if (!keepIndex) index = 0;
      if (index >= items.length) index = Math.max(0, items.length - 1);
      scrollY = 0;
      track.style.transform = "translate3d(0,0,0)";
      measure();
      bind(true);
    }

    function activate() {
      if (items[index] && opts.onActivate) opts.onActivate(items[index], index);
    }

    const api = {
      move, setItems, activate,
      focus() { reveal(); },
      blur() { paintFocus(); },
      get index() { return index; },
      relayout() { measure(); bind(false); reveal(); },
    };
    host.addEventListener("click", () => api.activate());
    host._grid = api;
    requestAnimationFrame(() => {
      measure();
      // Show the remembered or suggested item even before the grid gets focus.
      if (index > 0 && items.length && viewH) {
        const y = Math.floor(index / cols) * stride();
        if (y + cellH() > viewH) {
          scrollY = Math.max(0, Math.min(Math.max(0, totalH - viewH), y - Math.floor((viewH - cellH()) / 2)));
          track.style.transform = "translate3d(0," + (-scrollY) + "px,0)";
        }
      }
      bind(true);
    });
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => { measure(); bind(false); });
      ro.observe(viewport);
      api.destroy = () => ro.disconnect();
    }
    return api;
  }

  Mly.grid = { mount, thumb, get POSTER_W() { return POSTER_W; }, get POSTER_H() { return POSTER_H; } };
})();

/* D-pad focus. Poster grids move inside themselves. Everything else
   uses geometry. Focus is a class change, not a redraw. */
(function () {
  const Mly = (window.Mly = window.Mly || {});
  const state = { focused: null };

  function visible(el) {
    if (!el || el.hidden || el.disabled) return false;
    if (el.closest("[hidden]")) return false;
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  }

  function focusables(root) {
    const modal = document.querySelector("[data-modal]:not([hidden])");
    const scope = modal || root || document.getElementById("app");
    return [...scope.querySelectorAll("[data-focus]")].filter(visible);
  }

  function focus(el) {
    if (!el || el === state.focused) {
      if (el && el._grid) el._grid.focus();
      return;
    }
    if (state.focused) {
      state.focused.classList.remove("is-focused");
      if (state.focused._grid) state.focused._grid.blur();
    }
    state.focused = el;
    el.classList.add("is-focused");
    if (el._grid) el._grid.focus();
    else if (el.dataset.zone !== "rail") el.scrollIntoView({ block: "nearest", inline: "nearest" });
    try { el.focus({ preventScroll: true }); } catch (e) {}
  }

  function rect(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  }

  function move(dir) {
    const items = focusables();
    let cur = state.focused && items.includes(state.focused) ? state.focused : items[0];
    if (!cur) return;
    if (cur._grid && cur._grid.move(dir)) return;
    if (dir === "up" && cur.dataset.up) {
      const target = document.querySelector('[data-fid="' + cur.dataset.up + '"]');
      if (target && items.includes(target)) { focus(target); return; }
    }
    if (rowMove(cur, dir, items)) return;
    const c = rect(cur);
    let best = null;
    let bestScore = Infinity;
    for (const el of items) {
      if (el === cur) continue;
      const r = rect(el);
      let ok = false;
      let primary = 0;
      let ortho = 0;
      if (dir === "left") { ok = r.right <= c.left + 8; primary = c.left - r.right; ortho = Math.abs(r.y - c.y); }
      else if (dir === "right") { ok = r.left >= c.right - 8; primary = r.left - c.right; ortho = Math.abs(r.y - c.y); }
      else if (dir === "up") { ok = r.bottom <= c.top + 8; primary = c.top - r.bottom; ortho = Math.abs(r.x - c.x); }
      else { ok = r.top >= c.bottom - 8; primary = r.top - c.bottom; ortho = Math.abs(r.x - c.x); }
      if (!ok) continue;
      const score = Math.max(0, primary) + ortho * 1.4;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best && dir === "left" && best.dataset.zone === "rail" && cur.dataset.zone !== "rail") {
      // Entering the rail lands on the selected tab, as in Mangayomi, instead of switching tab.
      best = document.querySelector(".rail-btn.is-selected") || best;
      focus(best);
      return;
    }
    if (best) {
      focus(best);
      if (best.dataset.zone === "rail" && best.dataset.tab && Mly.ui) Mly.ui.selectTab(best.dataset.tab, true);
      return;
    }
    if (dir === "left" && cur.dataset.zone !== "rail") {
      const rail = document.querySelector(".rail-btn.is-selected") || document.querySelector(".rail-btn");
      if (rail) focus(rail);
    } else if (dir === "right" && cur.dataset.zone === "rail") {
      const content = items.find((el) => el.dataset.zone !== "rail");
      if (content) focus(content);
    }
  }

  // Lists with buttons on each row (Estensioni): Left/Right stay in the row,
  // Up/Down go to the same column of the next row, as in Mangayomi.
  function rowMove(cur, dir, items) {
    const list = cur.closest("[data-rownav]");
    if (!list) return false;
    const row = cur.closest(".row");
    const rows = [...list.querySelectorAll(".row")];
    const cells = (r) => [...r.querySelectorAll("[data-focus]")].filter((el) => items.includes(el));
    if (!row) {
      // Buttons under the list (Aggiorna): Up goes back to the last row.
      if (dir !== "up") return false;
      for (let i = rows.length - 1; i >= 0; i--) {
        const c = cells(rows[i]);
        if (c.length) { focus(c[0]); return true; }
      }
      return false;
    }
    const mine = cells(row);
    const col = mine.indexOf(cur);
    if (dir === "right") { if (mine[col + 1]) focus(mine[col + 1]); return true; }
    if (dir === "left") { if (col > 0) { focus(mine[col - 1]); return true; } return false; }
    const step = dir === "down" ? 1 : -1;
    for (let i = rows.indexOf(row) + step; i >= 0 && i < rows.length; i += step) {
      const next = cells(rows[i]);
      if (next.length) { focus(next[Math.min(col, next.length - 1)]); return true; }
    }
    if (dir === "down") {
      const after = items.find((el) => list.contains(el) && !el.closest(".row"));
      if (after) { focus(after); return true; }
    }
    return false;
  }

  function current() { return state.focused; }

  Mly.nav = { focus, move, focusables, current };
})();

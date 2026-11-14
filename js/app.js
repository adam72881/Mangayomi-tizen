document.addEventListener("DOMContentLoaded", async () => {
  await window.Mly.db.init();
  window.Mly.ui.start();
});

(() => {
  const started = performance.now();
  let mouseMoves = 0;
  let clicks = 0;
  let keydowns = 0;
  let visibilityChanges = 0;
  let maxScrollDepth = 0;
  let sent = false;

  addEventListener('pointermove', () => { mouseMoves += 1; }, { passive: true });
  addEventListener('click', () => { clicks += 1; }, { passive: true });
  addEventListener('keydown', () => { keydowns += 1; }, { passive: true });
  document.addEventListener('visibilitychange', () => { visibilityChanges += 1; });
  addEventListener('scroll', () => {
    const height = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    maxScrollDepth = Math.max(maxScrollDepth, Math.min(100, scrollY / height * 100));
  }, { passive: true });

  function payload() {
    return JSON.stringify({
      duration: (performance.now() - started) / 1000,
      scrollDepth: maxScrollDepth,
      mouseMoves,
      clicks,
      keydowns,
      visibilityChanges,
      webdriver: Boolean(navigator.webdriver),
    });
  }

  function send(final = false) {
    if (final && sent) return;
    if (final) sent = true;
    const body = payload();
    if (final && navigator.sendBeacon) {
      navigator.sendBeacon('/api/behavior', new Blob([body], { type: 'application/json' }));
    } else {
      fetch('/api/behavior', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
    }
  }

  setTimeout(() => send(false), 10000);
  addEventListener('pagehide', () => send(true));
})();

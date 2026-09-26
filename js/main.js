/* Game & Watch — boot + fixed-step main loop */
(function () {
  'use strict';
  const GW = window.GW;
  const STEP = 1000 / 60;

  GW.layout();
  GW.os.init();

  let last = performance.now();
  let acc = 0;
  function frame(now) {
    let dt = now - last;
    last = now;
    if (dt > 250) dt = 250;
    acc += dt;
    let steps = 0;
    while (acc >= STEP - 0.5 && steps < 5) {
      GW.input.update();
      GW.os.update();
      acc -= STEP;
      steps++;
    }
    if (steps >= 5) acc = 0;
    if (acc < 0) acc = 0;
    GW.os.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // freeze sound together with the game when the tab is hidden
  document.addEventListener('visibilitychange', () => {
    const ctx = GW.audio.ctx;
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else ctx.resume();
  });
})();

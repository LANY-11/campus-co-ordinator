/* =========================================================================
   Relay — cursor extension
   Draws the custom dot + trailing ring cursor and adds click ripples.
   Skipped on touch devices and when the user prefers reduced motion.
   ========================================================================= */
(function () {
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!finePointer || reduced) return;

  const body = document.body;
  body.classList.add('relay-cursor');

  const dot = document.createElement('div');
  dot.className = 'relay-cursor-dot';
  const ring = document.createElement('div');
  ring.className = 'relay-cursor-ring';
  body.append(dot, ring);

  let mx = window.innerWidth / 2, my = window.innerHeight / 2;
  let rx = mx, ry = my;

  const HOT = 'button, a, .ticket, .demo-chip, .stat-card, .user-row, label[for], select';
  const TEXTY = 'input[type=text], input[type=email], input[type=password], textarea';

  window.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
    const target = e.target instanceof Element ? e.target : null;
    body.classList.toggle('cursor-hot', !!target && !!target.closest(HOT));
    body.classList.toggle('cursor-text', !!target && !!target.closest(TEXTY));
  }, { passive: true });

  window.addEventListener('mousedown', () => body.classList.add('cursor-down'));
  window.addEventListener('mouseup', () => body.classList.remove('cursor-down'));
  document.addEventListener('mouseleave', () => { dot.style.opacity = ring.style.opacity = '0'; });
  document.addEventListener('mouseenter', () => { dot.style.opacity = ring.style.opacity = '1'; });

  (function follow() {
    rx += (mx - rx) * 0.16;
    ry += (my - ry) * 0.16;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
    requestAnimationFrame(follow);
  })();

  // click ripple on buttons
  document.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const btn = target && target.closest('.btn-primary, .btn-blue, .btn-emerald, .btn-ghost');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'relay-ripple';
    ripple.style.left = (e.clientX - rect.left) + 'px';
    ripple.style.top = (e.clientY - rect.top) + 'px';
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });
})();

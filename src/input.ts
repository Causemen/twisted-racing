import type { CarInput } from './car';

const keys = new Set<string>();
const touch = { brake: false, fire: false, alt: false, nitro: false };
let stickSteer = 0;
let stickBrake = false;
export const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

// iOS Safari игнорирует user-scalable=no: гасим приближение двойным тапом и щипком вручную
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = performance.now();
  if (now - lastTouchEnd < 350) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });
document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });
for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });

// ЛКМ тоже стреляет: многие клавиатуры не ловят Пробел вместе с двумя стрелками
let mouseFire = false;
window.addEventListener('mousedown', (e) => {
  if (e.button === 0 && (e.target as HTMLElement).tagName === 'CANVAS') mouseFire = true;
});
window.addEventListener('mouseup', () => (mouseFire = false));

// Правый палец: кнопки. Палец можно не отрывать: скольжение с ОГНЯ на НИТРО переключает кнопку.
export function bindTouchButtons(root: HTMLElement) {
  const btns = [...root.querySelectorAll<HTMLElement>('[data-btn]')];
  const held = new Map<number, HTMLElement | null>();
  const sync = () => {
    for (const el of btns) {
      const name = el.dataset.btn as keyof typeof touch;
      touch[name] = [...held.values()].includes(el);
      el.classList.toggle('down', touch[name]);
    }
  };
  const under = (e: PointerEvent) => {
    const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-btn]');
    return hit && btns.includes(hit) ? hit : null;
  };
  for (const el of btns) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.releasePointerCapture?.(e.pointerId);
      held.set(e.pointerId, el);
      sync();
    });
  }
  window.addEventListener('pointermove', (e) => {
    if (!held.has(e.pointerId)) return;
    held.set(e.pointerId, under(e));
    sync();
  });
  const up = (e: PointerEvent) => {
    if (held.delete(e.pointerId)) sync();
  };
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

// Левый палец: плавающий стик в левой половине экрана. Влево-вправо — руль, вниз — тормоз (с рулём — занос).
export function bindTouchStick(zone: HTMLElement, base: HTMLElement, knob: HTMLElement) {
  const R = 52;
  let id = -1;
  let cx = 0;
  let cy = 0;
  const place = (x: number, y: number) => {
    const r = zone.getBoundingClientRect();
    base.style.left = `${x - r.left}px`;
    base.style.top = `${y - r.top}px`;
  };
  const release = () => {
    id = -1;
    stickSteer = 0;
    stickBrake = false;
    knob.style.transform = '';
    zone.classList.remove('active', 'braking');
    base.style.left = base.style.top = '';
  };
  zone.addEventListener('pointerdown', (e) => {
    if (id !== -1) return;
    e.preventDefault();
    id = e.pointerId;
    zone.setPointerCapture(id);
    cx = e.clientX;
    cy = e.clientY;
    place(cx, cy);
    zone.classList.add('active');
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    // Палец ушёл далеко — подтягиваем центр стика за ним, чтобы не упираться в край
    if (len > R * 1.6) {
      const k = (len - R * 1.6) / len;
      cx += dx * k;
      cy += dy * k;
      place(cx, cy);
      dx = e.clientX - cx;
      dy = e.clientY - cy;
    }
    const m = Math.min(1, R / Math.max(1, Math.hypot(dx, dy)));
    knob.style.transform = `translate(${dx * m}px, ${dy * m}px)`;
    const sx = Math.max(-1, Math.min(1, dx / R));
    stickSteer = Math.abs(sx) < 0.12 ? 0 : (sx - Math.sign(sx) * 0.12) / 0.88;
    stickBrake = dy > R * 0.55;
    zone.classList.toggle('braking', stickBrake);
  });
  zone.addEventListener('pointerup', (e) => e.pointerId === id && release());
  zone.addEventListener('pointercancel', (e) => e.pointerId === id && release());
}

export function readInput(out: CarInput) {
  const k = (...codes: string[]) => codes.some((c) => keys.has(c));
  const up = k('ArrowUp', 'KeyW');
  const down = k('ArrowDown', 'KeyS') || touch.brake || stickBrake;
  // На телефоне газ автоматический, пока не нажат тормоз
  out.throttle = down ? -1 : up || isTouch ? 1 : 0;
  out.steer = (k('ArrowRight', 'KeyD') ? 1 : 0) - (k('ArrowLeft', 'KeyA') ? 1 : 0) || stickSteer;
  out.fire = k('Space', 'KeyJ', 'KeyX', 'ControlLeft', 'ControlRight') || mouseFire || touch.fire;
  out.alt = k('ShiftLeft', 'ShiftRight', 'KeyK') || touch.alt;
  out.nitro = k('KeyE', 'KeyL') || touch.nitro;

  const pads = navigator.getGamepads?.() ?? [];
  for (const p of pads) {
    if (!p) continue;
    const ax = p.axes[0] ?? 0;
    if (Math.abs(ax) > 0.15) out.steer = ax;
    const gas = p.buttons[7]?.value ?? 0;
    const brake = p.buttons[6]?.value ?? 0;
    if (gas > 0.05 || brake > 0.05) out.throttle = gas - brake;
    if (p.buttons[0]?.pressed) out.fire = true;
    if (p.buttons[1]?.pressed) out.alt = true;
    if (p.buttons[2]?.pressed) out.nitro = true;
  }
}

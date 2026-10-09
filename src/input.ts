import type { CarInput } from './car';

const keys = new Set<string>();
const touch = { left: false, right: false, brake: false, fire: false, alt: false, nitro: false };
export const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

export function bindTouchButtons(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-btn]').forEach((el) => {
    const name = el.dataset.btn as keyof typeof touch;
    const set = (v: boolean) => (e: Event) => {
      e.preventDefault();
      touch[name] = v;
      el.classList.toggle('down', v);
    };
    el.addEventListener('pointerdown', set(true));
    el.addEventListener('pointerup', set(false));
    el.addEventListener('pointercancel', set(false));
    el.addEventListener('pointerleave', set(false));
  });
}

export function readInput(out: CarInput) {
  const k = (...codes: string[]) => codes.some((c) => keys.has(c));
  const up = k('ArrowUp', 'KeyW');
  const down = k('ArrowDown', 'KeyS') || touch.brake;
  // На телефоне газ автоматический, пока не нажат тормоз
  out.throttle = down ? -1 : up || isTouch ? 1 : 0;
  out.steer = (k('ArrowRight', 'KeyD') || touch.right ? 1 : 0) - (k('ArrowLeft', 'KeyA') || touch.left ? 1 : 0);
  out.fire = k('Space', 'KeyJ') || touch.fire;
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

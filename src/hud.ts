import { CAR_CLASSES, CONFIG, type CarClassId } from './config';
import type { Car } from './car';
import type { Track } from './track';

const $ = (id: string) => document.getElementById(id)!;

export class Hud {
  onStart: () => void = () => {};
  selectedClass: CarClassId = 'interceptor';
  private map = $('minimap') as HTMLCanvasElement;
  private mapCtx = this.map.getContext('2d')!;
  private bounds = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  private toastTimer = 0;

  constructor(private cars: Car[], private track: Track) {
    $('start-btn').addEventListener('click', () => this.onStart());
    this.buildCarSelect();
    // Повернуть карту так же, как камера: экран-вправо = (-x+z), экран-вверх = (x+z)
    const xs = track.samples.map((s) => s.p.z - s.p.x);
    const zs = track.samples.map((s) => -(s.p.x + s.p.z));
    this.bounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
  }

  private buildCarSelect() {
    const box = $('car-select');
    const colors: Record<CarClassId, string> = { interceptor: '#8a4fc0', hearse: '#b03a20', flea: '#6f8a3a', hauler: '#c9a227' };
    const bar = (label: string, v: number) => `<div class="stat"><span>${label}</span><i style="--v:${Math.round(v * 100)}%"></i></div>`;
    box.innerHTML = CAR_CLASSES.map(
      (c) => `<button type="button" class="car" data-id="${c.id}" style="--car:${colors[c.id]}">
        <b>${c.label}</b><small>${c.desc}</small>
        ${bar('Броня', c.hp / 150)}${bar('Скорость', (c.speed - 0.8) / 0.3)}${bar('Руль', (c.turn - 0.7) / 0.45)}${bar('Таран', c.ram / 2)}
      </button>`,
    ).join('');
    const sync = () => box.querySelectorAll<HTMLElement>('.car').forEach((b) => b.classList.toggle('on', b.dataset.id === this.selectedClass));
    box.querySelectorAll<HTMLElement>('.car').forEach((b) =>
      b.addEventListener('click', () => {
        this.selectedClass = b.dataset.id as CarClassId;
        sync();
      }),
    );
    sync();
  }

  menu() {
    $('overlay').hidden = false;
    $('hud').hidden = true;
  }

  hideOverlay() {
    $('overlay').hidden = true;
    $('hud').hidden = false;
  }

  countdown(t: number) {
    const el = $('countdown');
    el.hidden = t <= -0.5;
    el.textContent = t > 0.5 ? String(Math.ceil(t - 0.5)) : 'ВПЕРЁД!';
  }

  feed(text: string, highlight = false) {
    const box = $('feed');
    const line = document.createElement('div');
    line.textContent = text;
    if (highlight) line.className = 'hl';
    box.prepend(line);
    setTimeout(() => line.remove(), 3500);
    while (box.children.length > 4) box.lastChild!.remove();
  }

  toast(text: string) {
    const el = $('toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (el.hidden = true), 1400);
  }

  private standings() {
    const N = this.track.N;
    return [...this.cars].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.progress(N) - a.progress(N);
    });
  }

  update(player: Car, time: number) {
    const order = this.standings();
    const place = order.indexOf(player) + 1;
    $('lap').textContent = `${Math.min(Math.max(player.lap, 1), CONFIG.laps)}/${CONFIG.laps}`;
    $('place').textContent = `${place}/${this.cars.length}`;
    $('kills').textContent = String(player.kills);
    $('time').textContent = formatTime(time);
    ($('hp') as HTMLElement).style.width = `${(player.hp / player.cls.hp) * 100}%`;
    $('hp').classList.toggle('low', player.hp < 30);
    ($('heat') as HTMLElement).style.width = `${Math.min(1, player.heat) * 100}%`;
    $('heat').classList.toggle('over', player.overheated);
    ($('nitro') as HTMLElement).style.width = `${(player.nitroActive > 0 ? 0 : player.nitro) * 100}%`;
    $('nitro').classList.toggle('ready', player.nitro >= 1 && player.nitroActive <= 0);
    $('weapon').textContent = player.weapon ? `${player.weapon === 'rocket' ? 'Ракеты' : 'Мины'} ×${player.ammo}` : '—';
    $('dead').hidden = player.alive;
    if (!player.alive) $('dead').textContent = `Уничтожен! Возрождение через ${Math.max(0, player.respawnTimer).toFixed(1)}`;
    this.drawMap();
  }

  results(time: number) {
    const rows = this.standings()
      .map((c, i) => {
        const t = c.finished ? formatTime(c.finishTime) : 'не финишировал';
        return `<tr class="${c.isPlayer ? 'me' : ''}"><td>${i + 1}</td><td>${c.name}</td><td>${t}</td><td>${c.kills}</td></tr>`;
      })
      .join('');
    $('overlay-body').innerHTML = `
      <h2>Результаты</h2>
      <table><thead><tr><th>#</th><th>Гонщик</th><th>Время</th><th>Убийства</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="muted">Время заезда: ${formatTime(time)}</p>`;
    $('start-btn').textContent = 'Ещё заезд';
    $('overlay').hidden = false;
  }

  private drawMap() {
    const ctx = this.mapCtx;
    const W = this.map.width;
    const H = this.map.height;
    const b = this.bounds;
    const pad = 10;
    const k = Math.min((W - pad * 2) / (b.maxX - b.minX), (H - pad * 2) / (b.maxZ - b.minZ));
    const tx = (x: number, z: number): [number, number] => [
      pad + (z - x - b.minX) * k,
      pad + (-(x + z) - b.minZ) * k,
    ];
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(40,30,25,0.75)';
    ctx.beginPath();
    this.track.samples.forEach((s, i) => {
      const [x, y] = tx(s.p.x, s.p.z);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
    for (const c of this.cars) {
      if (!c.alive) continue;
      const [x, y] = tx(c.pos.x, c.pos.z);
      ctx.fillStyle = '#' + c.color.toString(16).padStart(6, '0');
      ctx.beginPath();
      ctx.arc(x, y, c.isPlayer ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();
      if (c.isPlayer) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }
}

function formatTime(t: number) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

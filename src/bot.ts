import * as THREE from 'three';
import type { Car } from './car';
import type { Combat } from './combat';
import type { Track } from './track';

export type BotStyle = 'racer' | 'brawler' | 'miner';

/** Простой бот: едет по центральной линии со своим смещением и стреляет, когда кто-то в прицеле. */
export class Bot {
  private lane: number;
  private stuckTime = 0;
  private reverseTime = 0;
  private t = Math.random() * 100;

  constructor(
    readonly car: Car,
    readonly style: BotStyle,
    private aim: number, // 0..1, точность
  ) {
    this.lane = (Math.random() - 0.5) * 10;
  }

  think(dt: number, track: Track, cars: Car[], combat: Combat) {
    const car = this.car;
    const inp = car.input;
    this.t += dt;
    if (!car.alive) return;

    const speed = car.speed;
    const ahead = Math.round((9 + speed * 0.45) / track.spacing);
    const s = track.samples[(car.idx + ahead) % track.N];
    const half = track.width / 2 - 2.5;
    let lane = THREE.MathUtils.clamp(this.lane + Math.sin(this.t * 0.3) * 3, -half, half);
    // Объезд препятствий впереди
    const N = track.N;
    const horizon = Math.round(ahead * 1.6);
    for (const o of track.obstacles) {
      if (!o.alive) continue;
      const d = (o.idx - car.idx + N) % N;
      if (d <= 0 || d > horizon) continue;
      const myLat = track.lateral(car.pos, car.idx);
      const clear = o.r + 2.6;
      if (Math.abs(o.lat - lane) < clear || Math.abs(o.lat - myLat) < clear) {
        const side = lane >= o.lat ? 1 : -1;
        let alt = o.lat + side * (clear + 0.6);
        if (Math.abs(alt) > half) alt = o.lat - side * (clear + 0.6);
        lane = THREE.MathUtils.clamp(alt, -half, half);
        break;
      }
    }
    const target = s.p.clone().addScaledVector(s.n, lane);
    const desired = Math.atan2(target.x - car.pos.x, target.z - car.pos.z);
    let diff = desired - car.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));

    // Застрял — сдаём назад
    if (speed < 2 && inp.throttle > 0) this.stuckTime += dt;
    else this.stuckTime = 0;
    if (this.stuckTime > 1.2) {
      this.reverseTime = 0.9;
      this.stuckTime = 0;
    }
    if (this.reverseTime > 0) {
      this.reverseTime -= dt;
      inp.throttle = -1;
      inp.steer = THREE.MathUtils.clamp(diff * 3, -1, 1);
      inp.fire = false;
      inp.alt = false;
      return;
    }

    inp.steer = THREE.MathUtils.clamp(-diff * 2.6, -1, 1);
    inp.throttle = Math.abs(diff) > 0.7 && speed > 16 ? 0.2 : 1;
    inp.nitro = Math.abs(diff) < 0.08 && Math.random() < 0.02;

    // Оружие
    const f = car.forward;
    const cone = 0.08 + (1 - this.aim) * 0.1;
    const inSight = combat.findTarget(car, this.style === 'brawler' ? 32 : 24, cone);
    inp.fire = !!inSight && Math.random() < 0.3 + this.aim * 0.7;

    inp.alt = false;
    if (car.weapon === 'rocket') {
      inp.alt = !!combat.findTarget(car, 55, 0.4) && Math.random() < 0.04;
    } else if (car.weapon === 'mine') {
      for (const o of cars) {
        if (o === car || !o.alive) continue;
        const d = o.pos.clone().sub(car.pos);
        if (d.length() < 16 && d.dot(f) < 0) inp.alt = Math.random() < (this.style === 'miner' ? 0.08 : 0.03);
      }
    }
  }
}

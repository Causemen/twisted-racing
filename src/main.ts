import * as THREE from 'three';
import { CONFIG } from './config';
import { Car } from './car';
import { Bot, type BotStyle } from './bot';
import { Combat } from './combat';
import { Particles } from './particles';
import { Track } from './track';
import { bindTouchButtons, isTouch, readInput } from './input';
import { Hud } from './hud';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game')!.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd9a86c);
scene.fog = new THREE.Fog(0xd9a86c, 140, 260);

scene.add(new THREE.HemisphereLight(0xffe6c0, 0x6a4a30, 1.4));
const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera;
sc.left = sc.bottom = -45;
sc.right = sc.top = 45;
sc.near = 1;
sc.far = 200;
scene.add(sun, sun.target);

// Изометрическая камера, как в Rock n' Roll Racing
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 500);
const CAM_OFFSET = new THREE.Vector3(-55, 70, -55);
const camTarget = new THREE.Vector3();
let shake = 0;

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  const aspect = w / h;
  const view = aspect < 1 ? 38 : 28; // половина высоты кадра в метрах
  camera.left = -view * aspect;
  camera.right = view * aspect;
  camera.top = view;
  camera.bottom = -view;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const track = new Track();
scene.add(track.group);
const particles = new Particles();
scene.add(particles.mesh);

const SPECS: { name: string; color: number; style?: BotStyle; aim?: number; speed?: number }[] = [
  { name: 'Ты', color: 0x2f6fb0 },
  { name: 'Бешеный Пёс', color: 0xb03a20, style: 'brawler', aim: 0.7, speed: 0.97 },
  { name: 'Ржавая Вдова', color: 0x6f8a3a, style: 'racer', aim: 0.5, speed: 1.0 },
  { name: 'Поп-Минёр', color: 0xc9a227, style: 'miner', aim: 0.4, speed: 0.95 },
];

const cars = SPECS.map((s, i) => new Car({ name: s.name, color: s.color, isPlayer: i === 0, speedMult: s.speed }));
for (const c of cars) scene.add(c.mesh);
const player = cars[0];

const hud = new Hud(cars, track);

const combat = new Combat(scene, cars, particles, track, {
  onKill(victim, killer) {
    if (killer) hud.feed(`${killer.name} уничтожил ${victim === player ? 'тебя' : victim.name}`, killer === player);
    else hud.feed(`${victim.name} разбился`);
  },
  onBlast(pos, power) {
    const d = pos.distanceTo(player.pos);
    shake = Math.max(shake, power * Math.max(0, 1 - d / 40));
  },
  onPickup(car, label) {
    if (car === player) hud.toast(label);
  },
});

const bots = cars.slice(1).map((c, i) => new Bot(c, SPECS[i + 1].style!, SPECS[i + 1].aim!));

type State = 'menu' | 'countdown' | 'race' | 'finished';
let state: State = 'menu';
let countdown = 0;
let raceTime = 0;
let elapsed = 0;

function placeOnGrid() {
  const N = track.N;
  cars.forEach((c, i) => {
    const row = Math.floor(i / 2);
    const idx = (N - 8 - row * 7) % N;
    const s = track.samples[idx];
    c.pos.copy(s.p).addScaledVector(s.n, i % 2 ? 4.5 : -4.5);
    c.heading = Math.atan2(s.t.x, s.t.z);
    c.vel.set(0, 0, 0);
    c.y = c.vy = 0;
    c.idx = idx;
    c.lap = 0;
    c.hp = CONFIG.car.hp;
    c.alive = true;
    c.finished = false;
    c.kills = c.deaths = 0;
    c.weapon = null;
    c.ammo = 0;
    c.heat = 0;
    c.nitro = 1;
    c.nitroActive = 0;
    c.invuln = 0;
    c.lastHitBy = null;
    c.input = { throttle: 0, steer: 0, fire: false, alt: false, nitro: false };
  });
}

function startRace() {
  combat.reset();
  placeOnGrid();
  state = 'countdown';
  countdown = 3.5;
  raceTime = 0;
  hud.hideOverlay();
}

hud.onStart = startRace;
bindTouchButtons(document.getElementById('touch')!);
if (isTouch) document.body.classList.add('touch');
document.getElementById('touch')!.hidden = !isTouch;

function respawn(c: Car) {
  const s = track.samples[c.idx];
  c.pos.copy(s.p);
  c.heading = Math.atan2(s.t.x, s.t.z);
  c.vel.set(0, 0, 0);
  c.y = c.vy = 0;
  c.hp = CONFIG.car.hp;
  c.alive = true;
  c.invuln = CONFIG.invulnTime;
  c.lastHitBy = null;
  c.heat = 0;
  c.overheated = false;
}

function physics(c: Car, dt: number) {
  if (!c.alive) {
    c.respawnTimer -= dt;
    if (c.respawnTimer <= 0) respawn(c);
    return;
  }
  c.update(dt);

  const N = track.N;
  const prev = c.idx;
  c.idx = track.nearest(c.pos, c.idx);
  if (prev > N * 0.75 && c.idx < N * 0.25) c.lap++;
  else if (prev < N * 0.25 && c.idx > N * 0.75) c.lap--;

  if (!c.finished && c.lap > CONFIG.laps) {
    c.finished = true;
    c.finishTime = raceTime;
    if (c === player) hud.feed('Финиш!', true);
  }

  // Обочина и внешняя граница
  const s = track.samples[c.idx];
  const off = track.lateral(c.pos, c.idx);
  c.offroad = Math.abs(off) > track.width / 2 + 0.5;
  const lim = track.width / 2 + track.shoulder - CONFIG.car.radius;
  if (Math.abs(off) > lim) {
    const sign = Math.sign(off);
    c.pos.addScaledVector(s.n, -(off - sign * lim));
    const vn = c.vel.dot(s.n);
    if (vn * sign > 0) {
      c.vel.addScaledVector(s.n, -vn * 1.4);
      c.vel.multiplyScalar(0.9);
      if (Math.abs(vn) > CONFIG.car.wallDamageThreshold) combat.damage(c, (Math.abs(vn) - CONFIG.car.wallDamageThreshold) * 0.6, null);
    }
  }
  if (c.offroad && c.speed > 8 && c.onGround && Math.random() < 0.5) {
    particles.spawn(c.pos.clone().addScaledVector(c.forward, -1.8).setY(0.3), new THREE.Vector3(0, 1.5, 0), 0.7, 0.6, 0xc89a62, 0xd9b07a, 2);
  }

  // Препятствия
  for (const o of track.obstacles) {
    if (!o.alive || c.y > 1.2) continue;
    const dx = c.pos.x - o.pos.x;
    const dz = c.pos.z - o.pos.z;
    const minD = o.r + CONFIG.car.radius;
    const d2 = dx * dx + dz * dz;
    if (d2 >= minD * minD) continue;
    const d = Math.sqrt(d2) || 1e-3;
    const n = new THREE.Vector3(dx / d, 0, dz / d);
    c.pos.addScaledVector(n, minD - d);
    const vn = c.vel.dot(n);
    if (vn < 0) {
      if (o.kind === 'barrel') {
        combat.destroyObstacle(o, c);
        continue;
      }
      c.vel.addScaledVector(n, -vn * 1.35);
      c.vel.multiplyScalar(0.85);
      if (-vn > CONFIG.car.wallDamageThreshold) {
        combat.damage(c, (-vn - CONFIG.car.wallDamageThreshold) * 0.7, null);
      }
      if (-vn > 6) particles.sparks(o.pos.clone().addScaledVector(n, o.r).setY(0.8), 8);
    }
  }

  // Трамплины
  for (const r of track.ramps) {
    const d = (c.idx - r + N) % N;
    if (d <= 2 && Math.abs(off) < track.width * 0.21 && c.vel.dot(s.t) > 10) {
      c.launch(c.speed * 0.42);
    }
  }

  // Дым и огонь от повреждений
  if (c.hp < 50 && Math.random() < (c.hp < 25 ? 0.6 : 0.25)) {
    const p = c.pos.clone().setY(c.y + 1.3);
    particles.spawn(p, new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2), 0.9, 0.5, c.hp < 25 ? 0xff7020 : 0x6a6058, 0x2a2622, 2);
  }
  if (c.nitroActive > 0) {
    const p = c.pos.clone().addScaledVector(c.forward, -2.2).setY(c.y + 0.9);
    particles.spawn(p, c.forward.multiplyScalar(-6), 0.25, 0.5, 0x80c0ff, 0xff6020, 0.5);
  }
}

function carCollisions() {
  const R2 = CONFIG.car.radius * 2;
  for (let i = 0; i < cars.length; i++)
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      if (!a.alive || !b.alive || Math.abs(a.y - b.y) > 1.5) continue;
      const d = b.pos.clone().sub(a.pos).setY(0);
      const dist = d.length();
      if (dist >= R2 || dist < 1e-4) continue;
      const n = d.divideScalar(dist);
      const overlap = R2 - dist;
      a.pos.addScaledVector(n, -overlap / 2);
      b.pos.addScaledVector(n, overlap / 2);
      const rel = a.vel.dot(n) - b.vel.dot(n);
      if (rel > 0) {
        const imp = rel * 0.75;
        a.vel.addScaledVector(n, -imp);
        b.vel.addScaledVector(n, imp);
        if (rel > CONFIG.car.ramDamageThreshold) {
          const dmg = (rel - CONFIG.car.ramDamageThreshold) * 0.8;
          // Больше урона получает тот, в кого врезались
          const aHitsB = a.vel.dot(n) + imp > 0;
          combat.damage(b, aHitsB ? dmg : dmg * 0.4, a);
          combat.damage(a, aHitsB ? dmg * 0.4 : dmg, b);
          particles.sparks(a.pos.clone().addScaledVector(n, CONFIG.car.radius).setY(0.8), 10);
        }
      }
    }
}

function rubberBand() {
  const N = track.N;
  const pp = player.progress(N);
  for (const b of bots) {
    const gap = (b.car.progress(N) - pp) / N; // в кругах
    b.car.speedMult = b.car.baseSpeedMult * THREE.MathUtils.clamp(1 - gap * 0.12, 0.9, 1.06);
  }
}

function step(dt: number) {
  elapsed += dt;

  if (state !== 'menu' && countdown > -1) {
    countdown -= dt;
    hud.countdown(countdown);
    if (state === 'countdown' && countdown <= 0) state = 'race';
  }

  const running = state === 'race' || state === 'finished';
  if (running) {
    raceTime += dt;
    if (!player.finished) readInput(player.input);
    else Object.assign(player.input, { throttle: 0.4, steer: 0, fire: false, alt: false, nitro: false });
    for (const b of bots) b.think(dt, track, cars, combat);
    rubberBand();
    for (const c of cars) {
      physics(c, dt);
      combat.handleWeapons(c);
    }
    carCollisions();
    combat.update(dt);
    if (state === 'race' && player.finished) {
      state = 'finished';
      setTimeout(() => hud.results(raceTime), 1500);
    }
  }
  particles.update(dt);
}

function render(dt: number) {
  for (const c of cars) c.syncMesh(elapsed);

  // Камера смотрит немного вперёд по ходу движения
  const look = player.pos.clone().addScaledVector(player.vel, 0.35);
  camTarget.lerp(look, 1 - Math.exp(-4 * dt));
  shake = Math.max(0, shake - dt * 2.5);
  const jitter = new THREE.Vector3((Math.random() - 0.5) * shake * 1.5, 0, (Math.random() - 0.5) * shake * 1.5);
  camera.position.copy(camTarget).add(CAM_OFFSET).add(jitter);
  camera.lookAt(camTarget.clone().add(jitter));
  sun.position.copy(camTarget).add(new THREE.Vector3(-30, 60, 20));
  sun.target.position.copy(camTarget);

  if (state !== 'menu') hud.update(player, raceTime);
  renderer.render(scene, camera);
}

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  step(dt);
  render(dt);
  requestAnimationFrame(frame);
}

// Отладка: прокрутить симуляцию вперёд без отрисовки (для автотестов)
(window as unknown as Record<string, unknown>).__advance = (seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) step(1 / 60);
  return cars.map((c) => ({ name: c.name, lap: c.lap, idx: c.idx, hp: Math.round(c.hp), kills: c.kills, deaths: c.deaths, speed: +c.speed.toFixed(1) }));
};

placeOnGrid();
camTarget.copy(player.pos);
hud.menu();
frame();

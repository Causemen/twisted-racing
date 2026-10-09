import * as THREE from 'three';
import { CAR_CLASSES, CONFIG } from './config';
import { Car } from './car';
import { Bot } from './bot';
import { Ui } from './ui';
import type { RaceConfig, RaceEntry } from './race';
import { HOST, HOST_LINES } from './campaign';
import { Combat } from './combat';
import { Particles } from './particles';
import { Track, TRACKS } from './track';
import { bindTouchButtons, bindTouchStick, isTouch, readInput } from './input';
import { Hud } from './hud';
import { Flashes, Scorches, SkidMarks } from './effects';
import { LIGHTING, flicker } from './scenery';
import { initAudio, isMuted, sfx, toggleMute, updateCarSound } from './audio';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game')!.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd9a86c);
scene.fog = new THREE.Fog(0xd9a86c, 140, 260);

const hemi = new THREE.HemisphereLight(0xffe6c0, 0x6a4a30, 1.4);
scene.add(hemi);
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

let track = new Track(TRACKS[0]);
scene.add(track.group);
applyTheme();

function applyTheme() {
  const sky = track.def.colors.sky;
  (scene.background as THREE.Color).set(sky);
  scene.fog!.color.set(sky);
  const l = LIGHTING[track.def.id] ?? LIGHTING.junkyard;
  hemi.color.set(l.hemiSky);
  hemi.groundColor.set(l.hemiGround);
  hemi.intensity = l.hemi;
  sun.color.set(l.sun);
  sun.intensity = l.sunPower;
  const fog = scene.fog as THREE.Fog;
  [fog.near, fog.far] = l.fog;
}

function loadTrack(id: string) {
  if (track.def.id === id) return;
  scene.remove(track.group);
  track = new Track(TRACKS.find((t) => t.id === id) ?? TRACKS[0]);
  scene.add(track.group);
  applyTheme();
  combat.setTrack(track);
  hud.setTrack(track);
}
const particles = new Particles();
scene.add(particles.mesh);
const skids = new SkidMarks();
scene.add(skids.mesh);
const flashes = new Flashes(scene);
const scorches = new Scorches();
scene.add(scorches.mesh);

const cars: Car[] = [];
let bots: Bot[] = [];
let player!: Car;
const lines = new Map<Car, RaceEntry['lines']>();

function setupCars(entries: RaceEntry[]) {
  for (const c of cars) scene.remove(c.mesh);
  cars.length = 0;
  lines.clear();
  bots = [];
  for (const e of entries) {
    const cls = CAR_CLASSES.find((c) => c.id === e.cls)!;
    const car = new Car({ name: e.name, color: cls.color, isPlayer: !!e.isPlayer, speedMult: e.speed ?? 1, cls, mods: e.mods });
    cars.push(car);
    scene.add(car.mesh);
    if (e.lines) lines.set(car, e.lines);
    if (!e.isPlayer) bots.push(new Bot(car, e.style ?? 'racer', e.aim ?? 0.5));
  }
  player = cars.find((c) => c.isPlayer)!;
}
setupCars([{ name: 'Ты', cls: 'interceptor', isPlayer: true }]);

const hud = new Hud(cars, track);

const combat = new Combat(scene, cars, particles, track, {
  onKill(victim, killer) {
    if (killer) hud.feed(`${killer.name} уничтожил ${victim === player ? 'тебя' : victim.name}`, killer === player);
    else hud.feed(`${victim.name} разбился`);
    const vl = lines.get(victim);
    const kl = killer ? lines.get(killer) : undefined;
    if (vl?.killed) hud.feed(`${vl.speaker}: «${vl.killed}»`);
    else if (kl?.hitPlayer && victim === player) hud.feed(`${kl.speaker}: «${kl.hitPlayer}»`);
    else if (Math.random() < 0.35) hud.feed(`${HOST}: «${HOST_LINES.kill[Math.floor(Math.random() * HOST_LINES.kill.length)]}»`);
  },
  onBlast(pos, power) {
    flashes.flash(pos, power);
    scorches.add(pos, power);
    const d = pos.distanceTo(player.pos);
    shake = Math.max(shake, power * Math.max(0, 1 - d / 40));
  },
  onPickup(car, label) {
    if (car === player) {
      hud.toast(label);
      sfx.pickup();
    }
  },
  onSound(kind, pos) {
    sfx[kind](hearing(pos));
  },
});

/** Громкость звука в точке: чем дальше от игрока, тем тише. */
function hearing(pos: THREE.Vector3) {
  return Math.max(0, 1 - pos.distanceTo(player.pos) / 70);
}


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
    c.hp = c.maxHp;
    c.alive = true;
    c.finished = false;
    c.kills = c.deaths = 0;
    c.weapon = c.cls.startMines ? 'mine' : null;
    c.ammo = c.cls.startMines ?? 0;
    c.heat = 0;
    c.nitro = 1;
    c.nitroActive = 0;
    c.invuln = 0;
    c.lastHitBy = null;
    c.input = { throttle: 0, steer: 0, fire: false, alt: false, nitro: false };
  });
}

let laps = CONFIG.laps;
let lastLapAnnounced = false;

function startRace(cfg: RaceConfig) {
  void initAudio();
  loadTrack(cfg.track);
  setupCars(cfg.entries);
  laps = cfg.laps;
  hud.laps = laps;
  lastLapAnnounced = false;
  combat.reset();
  skids.clear();
  scorches.clear();
  placeOnGrid();
  state = 'countdown';
  countdown = 3.5;
  raceTime = 0;
  hud.hideOverlay();
}

const ui = new Ui(startRace);

function abortRace() {
  if (state === 'menu') return;
  state = 'menu';
  ui.aborted();
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') abortRace();
});
document.getElementById('quit')!.addEventListener('click', abortRace);
const muteBtn = document.getElementById('mute')!;
const syncMute = () => (muteBtn.textContent = isMuted() ? 'Звук выкл' : 'Звук вкл');
syncMute();
muteBtn.addEventListener('click', () => {
  toggleMute();
  syncMute();
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') {
    toggleMute();
    syncMute();
  }
});
bindTouchButtons(document.getElementById('touch')!);
bindTouchStick(document.getElementById('stick-zone')!, document.getElementById('stick')!, document.getElementById('stick-knob')!);
if (isTouch) document.body.classList.add('touch');
document.getElementById('touch')!.hidden = !isTouch;

function respawn(c: Car) {
  const s = track.samples[c.idx];
  c.pos.copy(s.p);
  c.heading = Math.atan2(s.t.x, s.t.z);
  c.vel.set(0, 0, 0);
  c.y = c.vy = 0;
  c.hp = c.maxHp;
  c.alive = true;
  c.invuln = CONFIG.invulnTime;
  c.lastHitBy = null;
  c.heat = 0;
  c.overheated = false;
  c.drifting = false;
  c.steerState = 0;
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

  if (!c.finished && c.lap > laps) {
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
      if (-vn > 6) {
        particles.sparks(o.pos.clone().addScaledVector(n, o.r).setY(0.8), 8);
        sfx.impact(hearing(c.pos) * Math.min(1, -vn / 25));
      }
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
  if (c.alive && c.hp < 50 && Math.random() < (c.hp < 25 ? 0.7 : 0.3)) {
    particles.damageSmoke(c.pos.clone().setY(c.y + 1.3), c.hp < 25);
  }
  // Следы шин при заносе и резком торможении
  const fwd = c.forward;
  const slip = Math.abs(c.vel.dot(new THREE.Vector3(fwd.z, 0, -fwd.x)));
  const braking = c.input.throttle < 0 && c.vel.dot(fwd) > 8;
  if (c.onGround && !c.offroad && (slip > 5 || braking)) skids.add(c, c.pos, c.heading, 0.95 * (c.cls.scale / 1.7), 1.1 * (c.cls.scale / 1.7));
  else skids.lift(c);

  if (c.nitroActive > 0) {
    // Пламя из выхлопов модели: у Колесницы бьёт вверх из труб органа
    for (const ex of c.exhausts) {
      const p = c.mesh.localToWorld(ex.clone());
      const up = ex.y > 1.5 ? 5 : 0.5;
      const v = c.forward.multiplyScalar(-6).add(new THREE.Vector3(0, up, 0)).add(c.vel.clone().multiplyScalar(0.8));
      if (Math.random() < 0.5) particles.spawn(p, v, 0.22, ex.y > 1.5 ? 0.55 : 0.45, 0x2048a0, 0xa03008, 0.4, 0, true);
    }
  }
}

function carCollisions() {
  for (let i = 0; i < cars.length; i++)
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      if (!a.alive || !b.alive || Math.abs(a.y - b.y) > 1.5) continue;
      const d = b.pos.clone().sub(a.pos).setY(0);
      const dist = d.length();
      // Радиус столкновения растёт с размером модели: Фура толще Блохи
      const R2 = CONFIG.car.radius * (a.cls.scale + b.cls.scale) / 1.7;
      if (dist >= R2 || dist < 1e-4) continue;
      const n = d.divideScalar(dist);
      const overlap = R2 - dist;
      a.pos.addScaledVector(n, -overlap / 2);
      b.pos.addScaledVector(n, overlap / 2);
      const rel = a.vel.dot(n) - b.vel.dot(n);
      if (rel > 0) {
        // Больше урона получает тот, в кого врезались
        const aHitsB = a.vel.dot(n) > -b.vel.dot(n);
        const imp = rel * CONFIG.car.ramPush;
        const ma = a.cls.mass;
        const mb = b.cls.mass;
        a.vel.addScaledVector(n, (-imp * mb) / (ma + mb));
        b.vel.addScaledVector(n, (imp * ma) / (ma + mb));
        if (rel > CONFIG.car.ramDamageThreshold) {
          const dmg = (rel - CONFIG.car.ramDamageThreshold) * 0.8;
          combat.damage(b, (aHitsB ? dmg : dmg * 0.4) * a.cls.ram, a);
          combat.damage(a, (aHitsB ? dmg * 0.4 : dmg) * b.cls.ram, b);
          particles.sparks(a.pos.clone().addScaledVector(n, CONFIG.car.radius).setY(0.8), 10);
          sfx.impact(hearing(a.pos));
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
    if (!lastLapAnnounced && player.lap === laps && laps > 1) {
      lastLapAnnounced = true;
      hud.feed(`${HOST}: «${HOST_LINES.lastLap}»`, true);
    }
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
      const result = hud.result(player, raceTime);
      setTimeout(() => {
        if (state === 'finished') {
          state = 'menu';
          ui.finished(result);
        }
      }, 1500);
    }
  }
  particles.update(dt);
  flashes.update(dt);
  flicker(elapsed);
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
  const slip = Math.abs(player.vel.dot(new THREE.Vector3(player.forward.z, 0, -player.forward.x)));
  updateCarSound(player.speed, CONFIG.car.maxSpeed, player.onGround ? slip : 0, player.alive && state !== 'menu');
  renderer.render(scene, camera);
}

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  step(dt);
  render(dt);
  requestAnimationFrame(frame);
}

// Отладка для автотестов: досрочно засчитать финиш игроку
(window as unknown as Record<string, unknown>).__forceFinish = () => {
  player.lap = laps + 1;
};

// Отладка: прокрутить симуляцию вперёд без отрисовки (для автотестов)
(window as unknown as Record<string, unknown>).__advance = (seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) step(1 / 60);
  return cars.map((c) => ({ name: c.name, lap: c.lap, idx: c.idx, hp: Math.round(c.hp), kills: c.kills, deaths: c.deaths, speed: +c.speed.toFixed(1), heading: +c.heading.toFixed(2), player: c.isPlayer }));
};

placeOnGrid();
camTarget.copy(player.pos);
ui.main();
frame();

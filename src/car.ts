import * as THREE from 'three';
import { CONFIG, NO_MODS, type CarClass, type CarMods } from './config';
import { buildCarModel } from './carModels';

export interface CarInput {
  throttle: number; // -1..1
  steer: number; // -1..1, плюс = вправо
  fire: boolean;
  alt: boolean;
  nitro: boolean;
}

export type ItemType = 'rocket' | 'mine';

export interface CarSpec {
  name: string;
  color: number;
  isPlayer: boolean;
  speedMult?: number;
  cls: CarClass;
  mods?: CarMods;
}

const C = CONFIG.car;

export class Car {
  readonly name: string;
  readonly isPlayer: boolean;
  readonly color: number;
  readonly mesh = new THREE.Group();
  private readonly body = new THREE.Group();
  private wheels: THREE.Object3D[] = [];

  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  heading = 0;
  y = 0;
  vy = 0;

  readonly cls: CarClass;
  readonly maxHp: number;
  readonly turnMult: number;
  readonly gunMult: number;
  hp: number;
  alive = true;
  respawnTimer = 0;
  invuln = 0;
  lastHitBy: Car | null = null;
  kills = 0;
  deaths = 0;

  idx = 0;
  lap = 0;
  finished = false;
  finishTime = 0;

  weapon: ItemType | null = null;
  ammo = 0;
  altCooldown = 0;
  heat = 0;
  overheated = false;
  gunCooldown = 0;
  nitro = 1;
  nitroActive = 0;
  speedMult: number;
  baseSpeedMult: number;
  offroad = false;

  input: CarInput = { throttle: 0, steer: 0, fire: false, alt: false, nitro: false };

  constructor(spec: CarSpec) {
    this.name = spec.name;
    this.isPlayer = spec.isPlayer;
    this.color = spec.color;
    this.cls = spec.cls;
    const mods = spec.mods ?? NO_MODS;
    this.maxHp = Math.round(spec.cls.hp * mods.hp);
    this.hp = this.maxHp;
    this.turnMult = spec.cls.turn * mods.turn;
    this.gunMult = spec.cls.gun * mods.gun;
    this.baseSpeedMult = this.speedMult = (spec.speedMult ?? 1) * spec.cls.speed * mods.speed;
    this.buildMesh();
  }

  get forward() {
    return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  get speed() {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  get onGround() {
    return this.y <= 0.0001 && this.vy <= 0;
  }

  progress(N: number) {
    return this.lap * N + this.idx;
  }

  update(dt: number) {
    this.invuln = Math.max(0, this.invuln - dt);
    this.gunCooldown = Math.max(0, this.gunCooldown - dt);
    this.altCooldown = Math.max(0, this.altCooldown - dt);
    this.heat = Math.max(0, this.heat - CONFIG.gun.coolRate * dt);
    if (this.overheated && this.heat < 0.3) this.overheated = false;

    if (this.nitroActive > 0) {
      this.nitroActive -= dt;
    } else {
      this.nitro = Math.min(1, this.nitro + C.nitroRegen * dt);
      if (this.input.nitro && this.nitro >= 1 && this.alive) {
        this.nitro = 0;
        this.nitroActive = C.nitroDuration;
      }
    }

    const { throttle, steer } = this.input;
    const f = this.forward;
    const r = new THREE.Vector3(f.z, 0, -f.x);

    if (this.onGround) {
      let vf = this.vel.dot(f);
      let vl = this.vel.dot(r);
      const boosting = this.nitroActive > 0;
      const maxS = C.maxSpeed * this.speedMult * (boosting ? C.nitroMult : 1) * (this.offroad ? C.offroadSpeed : 1);

      if (boosting) {
        vf += C.accel * 1.8 * dt;
      } else if (throttle > 0) {
        if (vf < maxS) vf += C.accel * throttle * dt;
      } else if (throttle < 0) {
        vf -= (vf > 0 ? C.brake : C.accel * 0.6) * -throttle * dt;
      }

      vf *= Math.exp(-((throttle === 0 && !boosting ? C.coastDrag : C.drag) + (this.offroad ? C.offroadDrag : 0)) * dt);
      if (vf > maxS) vf += (maxS - vf) * Math.min(1, 3 * dt);
      if (vf < -C.reverseMax) vf = -C.reverseMax;

      const speedFactor = Math.min(1, Math.abs(vf) / maxS);
      const grip = Math.max(1.2, C.grip - Math.abs(steer) * speedFactor * C.driftGripLoss);
      vl *= Math.exp(-grip * dt);

      this.vel.copy(f).multiplyScalar(vf).addScaledVector(r, vl);

      const turnScale = THREE.MathUtils.clamp(vf / 4, -1, 1);
      this.heading -= steer * C.turnRate * this.turnMult * turnScale * dt;
    } else {
      this.vy -= CONFIG.gravity * dt;
      this.vel.multiplyScalar(Math.exp(-0.1 * dt));
      this.heading -= steer * C.turnRate * 0.25 * dt;
    }

    this.pos.addScaledVector(this.vel, dt);
    this.y += this.vy * dt;
    if (this.y < 0) {
      this.y = 0;
      this.vy = 0;
    }
  }

  launch(speedUp: number) {
    if (this.onGround) this.vy = speedUp;
  }

  syncMesh(time: number) {
    this.mesh.visible = this.alive && !(this.invuln > 0 && Math.floor(time * 12) % 2 === 0);
    this.mesh.position.set(this.pos.x, this.y, this.pos.z);
    this.mesh.rotation.y = this.heading;
    const roll = THREE.MathUtils.clamp(-this.vel.dot(new THREE.Vector3(this.forward.z, 0, -this.forward.x)) * 0.02, -0.15, 0.15);
    this.body.rotation.z = roll;
    this.body.rotation.x = this.onGround ? 0 : THREE.MathUtils.clamp(-this.vy * 0.02, -0.3, 0.3);
    const spin = this.vel.dot(this.forward) * 0.016;
    for (const w of this.wheels) w.rotation.x += spin;
  }

  private buildMesh() {
    const { root, wheels } = buildCarModel(this.cls.id);
    this.wheels = wheels;
    this.body.add(root);
    this.mesh.add(this.body);
  }
}

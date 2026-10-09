import * as THREE from 'three';
import { CONFIG } from './config';

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
}

const C = CONFIG.car;

export class Car {
  readonly name: string;
  readonly isPlayer: boolean;
  readonly color: number;
  readonly mesh = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly wheels: THREE.Mesh[] = [];

  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  heading = 0;
  y = 0;
  vy = 0;

  hp: number = C.hp;
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
    this.baseSpeedMult = this.speedMult = spec.speedMult ?? 1;
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
      this.heading -= steer * C.turnRate * turnScale * dt;
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
    const paint = new THREE.MeshLambertMaterial({ color: this.color });
    const dark = new THREE.MeshLambertMaterial({ color: 0x2a2420 });
    const metal = new THREE.MeshLambertMaterial({ color: 0x8d8478 });
    const glass = new THREE.MeshLambertMaterial({ color: 0x1b2730 });

    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.body) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };

    add(new THREE.BoxGeometry(2, 0.7, 3.8), paint, 0, 0.75, 0);
    add(new THREE.BoxGeometry(1.6, 0.6, 1.6), glass, 0, 1.35, -0.3);
    add(new THREE.BoxGeometry(1.7, 0.12, 1.7), paint, 0, 1.7, -0.3);
    add(new THREE.BoxGeometry(2.2, 0.35, 0.4), metal, 0, 0.6, 2.0);
    add(new THREE.BoxGeometry(2.1, 0.3, 0.3), dark, 0, 0.55, -2.0);
    // Шипы на бампере
    const spike = new THREE.ConeGeometry(0.14, 0.6, 5);
    spike.rotateX(Math.PI / 2);
    for (const x of [-0.8, -0.27, 0.27, 0.8]) add(spike, metal, x, 0.6, 2.45);
    // Выхлопные трубы
    const pipe = new THREE.CylinderGeometry(0.12, 0.12, 1.4, 6);
    for (const x of [-0.75, 0.75]) {
      const p = add(pipe, metal, x, 1.25, -1.5);
      p.rotation.x = -0.5;
    }
    // Пулемёт на крыше
    const gun = add(new THREE.BoxGeometry(0.25, 0.25, 1.2), dark, 0, 1.9, 0.2);
    gun.castShadow = true;

    const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.5, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    for (const [x, z] of [[-1.1, 1.25], [1.1, 1.25], [-1.1, -1.25], [1.1, -1.25]]) {
      this.wheels.push(add(wheelGeo, dark, x, 0.55, z));
    }

    this.mesh.add(this.body);
  }
}

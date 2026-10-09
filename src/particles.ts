import * as THREE from 'three';

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  grow: number;
  color: THREE.Color;
  endColor: THREE.Color;
  gravity: number;
}

const MAX = 1200;

/** Все частицы одним InstancedMesh: дёшево даже на телефоне. */
export class Particles {
  readonly mesh: THREE.InstancedMesh;
  private readonly list: Particle[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly c = new THREE.Color();

  constructor() {
    this.mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.5, 0),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      MAX,
    );
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < MAX; i++) {
      this.mesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
      this.mesh.setColorAt(i, new THREE.Color(0));
    }
  }

  spawn(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    life: number,
    size: number,
    color: number,
    endColor = color,
    grow = 0,
    gravity = 0,
  ) {
    if (this.list.length >= MAX) this.list.shift();
    this.list.push({
      pos: pos.clone(),
      vel: vel.clone(),
      life,
      maxLife: life,
      size,
      grow,
      color: new THREE.Color(color),
      endColor: new THREE.Color(endColor),
      gravity,
    });
  }

  explosion(pos: THREE.Vector3, power = 1) {
    const v = new THREE.Vector3();
    for (let i = 0; i < 40 * power; i++) {
      v.set(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(6 + Math.random() * 14 * power);
      const hot = Math.random() < 0.6;
      this.spawn(pos, v, 0.4 + Math.random() * 0.5, 0.6 + Math.random() * 1.2 * power, hot ? 0xffd040 : 0xff5a10, 0x3a2a20, 1.5, 6);
    }
    for (let i = 0; i < 18 * power; i++) {
      v.set(Math.random() - 0.5, Math.random() * 0.5 + 0.5, Math.random() - 0.5).multiplyScalar(5);
      this.spawn(pos, v, 1.2 + Math.random(), 1 + Math.random() * 1.5, 0x4a4038, 0x1a1816, 1.8, -1);
    }
    // Обломки
    for (let i = 0; i < 10 * power; i++) {
      v.set(Math.random() - 0.5, Math.random() + 0.6, Math.random() - 0.5).multiplyScalar(14);
      this.spawn(pos, v, 1 + Math.random() * 0.6, 0.35, 0x2b2522, 0x2b2522, 0, 30);
    }
  }

  sparks(pos: THREE.Vector3, n = 4) {
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.set(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5).normalize().multiplyScalar(8 + Math.random() * 6);
      this.spawn(pos, v, 0.15 + Math.random() * 0.15, 0.2, 0xfff0a0, 0xff6010, 0, 10);
    }
  }

  update(dt: number) {
    let w = 0;
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vel.y -= p.gravity * dt;
      p.vel.multiplyScalar(Math.exp(-1.8 * dt));
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < 0.05) {
        p.pos.y = 0.05;
        p.vel.y *= -0.3;
      }
      this.list[w++] = p;
    }
    this.list.length = w;

    for (let i = 0; i < MAX; i++) {
      const p = this.list[i];
      if (!p) {
        this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0));
        continue;
      }
      const t = 1 - p.life / p.maxLife;
      const size = p.size * (1 + p.grow * t) * (t > 0.7 ? (1 - t) / 0.3 : 1);
      this.s.setScalar(size);
      this.m.compose(p.pos, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
      this.c.copy(p.color).lerp(p.endColor, t);
      this.mesh.setColorAt(i, this.c);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

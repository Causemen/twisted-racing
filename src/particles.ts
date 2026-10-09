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
  glow: boolean;
}

const MAX = 1200;

/**
 * Частицы двумя InstancedMesh: обычные (дым, пыль, обломки) и светящиеся (огонь, искры, вспышки),
 * которые складываются по яркости. Дёшево даже на телефоне.
 */
export class Particles {
  readonly mesh = new THREE.Group();
  private readonly solid: THREE.InstancedMesh;
  private readonly glowing: THREE.InstancedMesh;
  private readonly list: Particle[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly c = new THREE.Color();
  private readonly hsl = { h: 0, s: 0, l: 0 };
  private prevSolid = MAX;
  private prevGlow = MAX;

  constructor() {
    const geo = new THREE.IcosahedronGeometry(0.5, 0);
    const make = (mat: THREE.Material) => {
      const mesh = new THREE.InstancedMesh(geo, mat, MAX);
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < MAX; i++) {
        mesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
        mesh.setColorAt(i, new THREE.Color(0));
      }
      this.mesh.add(mesh);
      return mesh;
    };
    this.solid = make(new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.glowing = make(new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.glowing.renderOrder = 2;
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
    glow?: boolean,
  ) {
    if (this.list.length >= MAX * 2) this.list.shift();
    // Яркие насыщенные цвета (огонь, искры, нитро) светятся, остальное обычный дым и пыль
    const start = new THREE.Color(color);
    start.getHSL(this.hsl);
    this.list.push({
      pos: pos.clone(),
      vel: vel.clone(),
      life,
      maxLife: life,
      size,
      grow,
      color: start,
      endColor: new THREE.Color(endColor),
      gravity,
      glow: glow ?? (this.hsl.s > 0.8 && this.hsl.l > 0.55),
    });
  }

  explosion(pos: THREE.Vector3, power = 1) {
    const v = new THREE.Vector3();
    // Огненный шар: несколько крупных светящихся сгустков, быстро раздуваются
    for (let i = 0; i < 4 * power; i++) {
      v.set(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5).multiplyScalar(6);
      this.spawn(pos, v, 0.3 + Math.random() * 0.2, 1.5 * power, 0xc08030, 0x200400, 2.2, -2, true);
    }
    // Языки пламени
    for (let i = 0; i < 34 * power; i++) {
      v.set(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(6 + Math.random() * 14 * power);
      const hot = Math.random() < 0.6;
      this.spawn(pos, v, 0.4 + Math.random() * 0.5, 0.6 + Math.random() * 1.2 * power, hot ? 0xd09020 : 0xc04008, 0x100400, 1.5, 6, true);
    }
    // Столб дыма: поднимается и долго висит
    for (let i = 0; i < 22 * power; i++) {
      v.set((Math.random() - 0.5) * 4, 2 + Math.random() * 4, (Math.random() - 0.5) * 4);
      const p = pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random(), (Math.random() - 0.5) * 2));
      this.spawn(p, v, 1.6 + Math.random() * 1.6, 1 + Math.random() * 1.5 * power, 0x4a4038, 0x22201e, 2.2, -1.5, false);
    }
    // Обломки и угли
    for (let i = 0; i < 12 * power; i++) {
      v.set(Math.random() - 0.5, Math.random() + 0.6, Math.random() - 0.5).multiplyScalar(14);
      this.spawn(pos, v, 1 + Math.random() * 0.6, 0.35, 0x2b2522, 0x2b2522, 0, 30, false);
    }
    for (let i = 0; i < 14 * power; i++) {
      v.set(Math.random() - 0.5, Math.random() + 0.4, Math.random() - 0.5).multiplyScalar(18);
      this.spawn(pos, v, 0.8 + Math.random() * 0.8, 0.18, 0xffa030, 0x601000, 0, 20, true);
    }
  }

  /** Дым и огонь из подбитой машины. */
  damageSmoke(pos: THREE.Vector3, burning: boolean) {
    const v = new THREE.Vector3((Math.random() - 0.5) * 2, 3 + Math.random() * 1.5, (Math.random() - 0.5) * 2);
    this.spawn(pos, v, 1 + Math.random() * 0.6, 0.5 + Math.random() * 0.3, burning ? 0x2a2420 : 0x6a6058, 0x1a1816, 2.4, -0.5, false);
    if (burning) {
      v.set((Math.random() - 0.5) * 1.5, 2 + Math.random() * 2, (Math.random() - 0.5) * 1.5);
      this.spawn(pos, v, 0.35 + Math.random() * 0.2, 0.55, 0xffc040, 0x601000, 0.8, -1, true);
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

    let ns = 0;
    let ng = 0;
    for (const p of this.list) {
      const mesh = p.glow ? this.glowing : this.solid;
      const i = p.glow ? ng++ : ns++;
      if (i >= MAX) continue;
      const t = 1 - p.life / p.maxLife;
      const size = p.size * (1 + p.grow * t) * (t > 0.7 ? (1 - t) / 0.3 : 1);
      this.s.setScalar(size);
      this.m.compose(p.pos, this.q, this.s);
      mesh.setMatrixAt(i, this.m);
      this.c.copy(p.color).lerp(p.endColor, t);
      mesh.setColorAt(i, this.c);
    }
    this.m.makeScale(0, 0, 0);
    for (const [mesh, used, prev] of [[this.solid, ns, this.prevSolid], [this.glowing, ng, this.prevGlow]] as const) {
      for (let i = used; i < prev; i++) mesh.setMatrixAt(i, this.m);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    this.prevSolid = Math.min(ns, MAX);
    this.prevGlow = Math.min(ng, MAX);
  }
}

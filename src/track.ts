import * as THREE from 'three';
import { CONFIG } from './config';

export interface TrackSample {
  p: THREE.Vector3;
  t: THREE.Vector3; // направление трассы
  n: THREE.Vector3; // поперечная ось
}

// Контрольные точки центральной линии (x, z). Замкнутый круг.
const CONTROL: [number, number][] = [
  [0, 0], [60, -5], [100, 20], [110, 60], [80, 85], [40, 70], [15, 95],
  [-30, 100], [-60, 70], [-45, 35], [-70, 10], [-50, -25],
];

const SAMPLE_COUNT = 1200;
const SCALE = 1.4;

export type ObstacleKind = 'rock' | 'block' | 'tires' | 'barrel';

export interface Obstacle {
  kind: ObstacleKind;
  pos: THREE.Vector3;
  r: number;
  idx: number;
  lat: number;
  mesh: THREE.Object3D;
  alive: boolean;
  respawn: number;
}

export class Track {
  readonly width = CONFIG.trackWidth;
  readonly samples: TrackSample[] = [];
  readonly shoulder = CONFIG.shoulder;
  readonly ramps = [280, 630, 920];
  readonly pickupSpots = [150, 440, 750, 1060];
  readonly obstacles: Obstacle[] = [];
  readonly group = new THREE.Group();
  readonly spacing: number;

  get N() {
    return this.samples.length;
  }

  constructor() {
    const curve = new THREE.CatmullRomCurve3(
      CONTROL.map(([x, z]) => new THREE.Vector3(x * SCALE, 0, z * SCALE)),
      true,
      'centripetal',
    );
    const pts = curve.getSpacedPoints(SAMPLE_COUNT).slice(0, SAMPLE_COUNT);
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[(i - 1 + pts.length) % pts.length];
      const next = pts[(i + 1) % pts.length];
      const t = next.clone().sub(prev).normalize();
      const n = new THREE.Vector3(-t.z, 0, t.x);
      this.samples.push({ p: pts[i], t, n });
    }
    this.spacing = curve.getLength() / SAMPLE_COUNT;
    this.build();
  }

  /** Индекс ближайшей точки центральной линии. hint ускоряет поиск. */
  nearest(pos: THREE.Vector3, hint = -1): number {
    const N = this.N;
    let best = 0;
    let bestD = Infinity;
    const check = (i: number) => {
      const s = this.samples[i];
      const dx = s.p.x - pos.x;
      const dz = s.p.z - pos.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    };
    if (hint < 0) {
      for (let i = 0; i < N; i++) check(i);
    } else {
      for (let k = -40; k <= 40; k++) check((hint + k + N) % N);
    }
    return best;
  }

  lateral(pos: THREE.Vector3, idx: number): number {
    const s = this.samples[idx];
    return (pos.x - s.p.x) * s.n.x + (pos.z - s.p.z) * s.n.z;
  }

  private build() {
    const W = this.width;
    const N = this.N;

    // Земля
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshLambertMaterial({ color: 0xc9935a }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(20, -0.05, 40);
    ground.receiveShadow = true;
    this.group.add(ground);

    // Полотно трассы и бордюры
    this.group.add(this.ribbon(W / 2 + 4, 0.01, () => new THREE.Color(0xa87444)));
    this.group.add(this.ribbon(W / 2, 0.03, (i) => {
      const c = new THREE.Color(0x4a3f38);
      return c.offsetHSL(0, 0, ((i * 7919) % 13) / 400);
    }));
    this.group.add(this.kerbs());

    // Старт/финиш
    const startTex = this.checkerTexture();
    const start = new THREE.Mesh(
      new THREE.PlaneGeometry(W, 2.5),
      new THREE.MeshLambertMaterial({ map: startTex }),
    );
    const s0 = this.samples[0];
    start.rotation.x = -Math.PI / 2;
    start.rotation.z = Math.atan2(s0.t.x, s0.t.z);
    start.position.copy(s0.p).setY(0.05);
    this.group.add(start);

    // Трамплины
    for (const r of this.ramps) {
      const s = this.samples[r];
      const ramp = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.4, 0.5, 5),
        new THREE.MeshLambertMaterial({ color: 0x8c7a5b }),
      );
      ramp.position.copy(s.p).setY(0.3);
      ramp.rotation.order = 'YXZ';
      ramp.rotation.y = Math.atan2(s.t.x, s.t.z);
      ramp.rotation.x = -0.18;
      ramp.castShadow = true;
      ramp.receiveShadow = true;
      this.group.add(ramp);
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.4, 0.52, 0.6),
        new THREE.MeshLambertMaterial({ color: 0xe0b020 }),
      );
      stripe.position.set(0, 0, 2.2);
      ramp.add(stripe);
    }

    this.placeObstacles();
    this.boundaryRocks();
    this.scatterScenery();
  }

  private placeObstacles() {
    let seed = 1234;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const N = this.N;
    const W = this.width;
    const near = (i: number, list: number[], d: number) => list.some((r) => Math.abs(((i - r + N + N / 2) % N) - N / 2) < d);

    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x8a6446 });
    const blockGeo = new THREE.BoxGeometry(2.6, 1.3, 1.3);
    const blockMat = new THREE.MeshLambertMaterial({ color: 0x9a948a });
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0xb03a1a });
    const tireGeo = new THREE.TorusGeometry(0.75, 0.32, 6, 12);
    const tireMat = new THREE.MeshLambertMaterial({ color: 0x1f1b18 });
    const barrelGeo = new THREE.CylinderGeometry(0.65, 0.65, 1.5, 10);
    const barrelMat = new THREE.MeshLambertMaterial({ color: 0xb8321a, emissive: 0x200400 });
    const bandMat = new THREE.MeshLambertMaterial({ color: 0xe0b020 });

    const add = (kind: ObstacleKind, idx: number, lat: number) => {
      const s = this.samples[idx];
      const pos = s.p.clone().addScaledVector(s.n, lat);
      let mesh: THREE.Object3D;
      let r: number;
      if (kind === 'rock') {
        const size = 1.4 + rnd() * 1.4;
        const m = new THREE.Mesh(rockGeo, rockMat);
        m.scale.set(size, size * 0.8, size);
        m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
        m.position.set(pos.x, size * 0.45, pos.z);
        mesh = m;
        r = size * 0.95;
      } else if (kind === 'block') {
        const g = new THREE.Group();
        const b = new THREE.Mesh(blockGeo, blockMat);
        b.position.y = 0.65;
        const st = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.25, 1.32), stripeMat);
        st.position.y = 1.0;
        g.add(b, st);
        g.position.copy(pos);
        g.rotation.y = Math.atan2(s.t.x, s.t.z) + Math.PI / 2 + (rnd() - 0.5) * 0.6;
        mesh = g;
        r = 1.4;
      } else if (kind === 'tires') {
        const g = new THREE.Group();
        for (let k = 0; k < 3; k++) {
          const t = new THREE.Mesh(tireGeo, tireMat);
          t.rotation.x = Math.PI / 2;
          t.position.y = 0.32 + k * 0.6;
          g.add(t);
        }
        g.position.copy(pos);
        mesh = g;
        r = 1.15;
      } else {
        const g = new THREE.Group();
        const b = new THREE.Mesh(barrelGeo, barrelMat);
        b.position.y = 0.75;
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.67, 0.67, 0.2, 10), bandMat);
        band.position.y = 1.0;
        g.add(b, band);
        g.position.copy(pos);
        mesh = g;
        r = 0.8;
      }
      mesh.traverse((o) => {
        o.castShadow = true;
        o.receiveShadow = true;
      });
      this.group.add(mesh);
      this.obstacles.push({ kind, pos: pos.setY(0), r, idx, lat, mesh, alive: true, respawn: 0 });
    };

    let i = 45;
    while (i < N - 45) {
      if (!near(i, this.ramps, 30) && !near(i, this.pickupSpots, 15)) {
        const edge = rnd() < 0.6;
        const side = rnd() < 0.5 ? -1 : 1;
        const lat = edge ? side * (W / 2 - 1.5 + rnd() * 5) : (rnd() - 0.5) * W * 0.55;
        const k = rnd();
        if (k < 0.3) {
          // Группа взрывоопасных бочек
          const n = 1 + Math.floor(rnd() * 3);
          for (let b = 0; b < n; b++) add('barrel', (i + b * 2) % N, lat + (rnd() - 0.5) * 2.5);
        } else if (k < 0.55) add('rock', i, lat);
        else if (k < 0.8) add(edge ? 'block' : 'tires', i, lat);
        else {
          add('block', i, lat);
          add('block', (i + 3) % N, lat + (lat > 0 ? -2.4 : 2.4));
        }
      }
      i += 22 + Math.floor(rnd() * 22);
    }
  }

  /** Крупные камни по внешнему краю обочины: видимая граница вместо забора. */
  private boundaryRocks() {
    let seed = 99;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const mat = new THREE.MeshLambertMaterial({ color: 0x7d5a3e });
    const N = this.N;
    const count = Math.ceil(N / 6) * 2;
    const inst = new THREE.InstancedMesh(geo, mat, count);
    inst.castShadow = true;
    inst.receiveShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let w = 0;
    for (let i = 0; i < N; i += 6) {
      const s = this.samples[i];
      for (const side of [-1, 1]) {
        const size = 2.2 + rnd() * 2.5;
        const pos = s.p.clone().addScaledVector(s.n, side * (this.width / 2 + this.shoulder + 1.5 + rnd() * 2));
        pos.y = size * 0.35;
        q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3));
        m.compose(pos, q, new THREE.Vector3(size, size * 0.75, size));
        inst.setMatrixAt(w++, m);
      }
    }
    inst.count = w;
    this.group.add(inst);
  }

  private ribbon(half: number, y: number, color: (i: number) => THREE.Color) {
    const N = this.N;
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i < N; i++) {
      const s = this.samples[i];
      const c = color(i);
      for (const side of [-1, 1]) {
        pos.push(s.p.x + s.n.x * half * side, y, s.p.z + s.n.z * half * side);
        col.push(c.r, c.g, c.b);
      }
      const a = i * 2;
      const b = ((i + 1) % N) * 2;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    mesh.receiveShadow = true;
    return mesh;
  }

  private kerbs() {
    const group = new THREE.Group();
    const W = this.width;
    for (const side of [-1, 1]) {
      const half0 = W / 2;
      const half1 = W / 2 + 1;
      const N = this.N;
      const pos: number[] = [];
      const col: number[] = [];
      for (let i = 0; i < N; i++) {
        const a = this.samples[i];
        const b = this.samples[(i + 1) % N];
        const c = Math.floor(i / 6) % 2 ? new THREE.Color(0xb02a1a) : new THREE.Color(0xd8cfc0);
        const quad = [
          a.p.clone().addScaledVector(a.n, side * half0),
          b.p.clone().addScaledVector(b.n, side * half0),
          a.p.clone().addScaledVector(a.n, side * half1),
          b.p.clone().addScaledVector(b.n, side * half1),
        ];
        for (const k of [0, 1, 2, 2, 1, 3]) {
          pos.push(quad[k].x, 0.04, quad[k].z);
          col.push(c.r, c.g, c.b);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }

  private checkerTexture() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 16;
    const ctx = c.getContext('2d')!;
    for (let x = 0; x < 16; x++)
      for (let y = 0; y < 2; y++) {
        ctx.fillStyle = (x + y) % 2 ? '#111' : '#eee';
        ctx.fillRect(x * 8, y * 8, 8, 8);
      }
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private scatterScenery() {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x9a7350 });
    const barrelGeo = new THREE.CylinderGeometry(0.6, 0.6, 1.4, 10);
    const barrelMat = new THREE.MeshLambertMaterial({ color: 0x7a2e1c });
    const tireGeo = new THREE.TorusGeometry(0.8, 0.35, 6, 12);
    const tireMat = new THREE.MeshLambertMaterial({ color: 0x1d1a18 });
    const wreckMat = new THREE.MeshLambertMaterial({ color: 0x5b3a26 });

    for (let k = 0; k < 320; k++) {
      const x = -170 + rnd() * 380;
      const z = -120 + rnd() * 340;
      const p = new THREE.Vector3(x, 0, z);
      const i = this.nearest(p);
      const d = Math.abs(this.lateral(p, i));
      const along = p.distanceTo(this.samples[i].p);
      if (Math.min(d, along) < this.width / 2 + this.shoulder + 5) continue;
      const near = Math.min(d, along) < this.width / 2 + this.shoulder + 14;
      const kind = rnd();
      let mesh: THREE.Mesh;
      if (kind < 0.55) {
        mesh = new THREE.Mesh(rockGeo, rockMat);
        const s = 1 + rnd() * (near ? 2 : 5);
        mesh.scale.set(s, s * (0.5 + rnd() * 0.6), s);
        mesh.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
        mesh.position.set(x, s * 0.3, z);
      } else if (kind < 0.75) {
        mesh = new THREE.Mesh(barrelGeo, barrelMat);
        mesh.position.set(x, 0.7, z);
        if (rnd() < 0.3) {
          mesh.rotation.z = Math.PI / 2;
          mesh.position.y = 0.6;
        }
      } else if (kind < 0.9) {
        mesh = new THREE.Mesh(tireGeo, tireMat);
        mesh.rotation.x = Math.PI / 2;
        mesh.position.set(x, 0.35, z);
      } else {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 4.4), wreckMat);
        mesh.rotation.set(0, rnd() * 6, (rnd() - 0.5) * 0.4);
        mesh.position.set(x, 0.6, z);
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
  }
}

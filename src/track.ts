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

const SAMPLE_COUNT = 900;

export class Track {
  readonly width = CONFIG.trackWidth;
  readonly samples: TrackSample[] = [];
  readonly ramps = [210, 470, 690];
  readonly pickupSpots = [110, 330, 560, 790];
  readonly group = new THREE.Group();
  readonly spacing: number;

  get N() {
    return this.samples.length;
  }

  constructor() {
    const curve = new THREE.CatmullRomCurve3(
      CONTROL.map(([x, z]) => new THREE.Vector3(x, 0, z)),
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
      for (let k = -30; k <= 30; k++) check((hint + k + N) % N);
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
      new THREE.PlaneGeometry(700, 700),
      new THREE.MeshLambertMaterial({ color: 0xc9935a }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(20, -0.05, 40);
    ground.receiveShadow = true;
    this.group.add(ground);

    // Полотно трассы и бордюры
    this.group.add(this.ribbon(W / 2 + 1.2, 0.01, () => new THREE.Color(0x6b4a2f)));
    this.group.add(this.ribbon(W / 2, 0.03, (i) => {
      const c = new THREE.Color(0x4a3f38);
      return c.offsetHSL(0, 0, ((i * 7919) % 13) / 400);
    }));
    this.group.add(this.kerbs());

    // Ограждение из ржавых блоков
    const wallGeo = new THREE.BoxGeometry(0.9, 1.4, this.spacing * 4.2);
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const count = Math.floor(N / 4) * 2;
    const walls = new THREE.InstancedMesh(wallGeo, wallMat, count);
    walls.castShadow = true;
    walls.receiveShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    let w = 0;
    const rust = [0x8a4b2a, 0x6e3b22, 0x9c6b3c, 0x5a4a3f];
    for (let i = 0; i < N; i += 4) {
      const s = this.samples[i];
      q.setFromAxisAngle(up, Math.atan2(s.t.x, s.t.z));
      for (const side of [-1, 1]) {
        const pos = s.p.clone().addScaledVector(s.n, side * (W / 2 + 1.6));
        pos.y = 0.7;
        m.compose(pos, q, new THREE.Vector3(1, 0.8 + ((i * 31) % 5) / 10, 1));
        walls.setMatrixAt(w, m);
        walls.setColorAt(w, new THREE.Color(rust[(i / 4 + (side > 0 ? 1 : 0)) % rust.length]));
        w++;
      }
    }
    this.group.add(walls);

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
        new THREE.BoxGeometry(W * 0.62, 0.5, 5),
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
        new THREE.BoxGeometry(W * 0.62, 0.52, 0.6),
        new THREE.MeshLambertMaterial({ color: 0xe0b020 }),
      );
      stripe.position.set(0, 0, 2.2);
      ramp.add(stripe);
    }

    this.scatterScenery();
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

    for (let k = 0; k < 260; k++) {
      const x = -140 + rnd() * 320;
      const z = -100 + rnd() * 280;
      const p = new THREE.Vector3(x, 0, z);
      const i = this.nearest(p);
      const d = Math.abs(this.lateral(p, i));
      const along = p.distanceTo(this.samples[i].p);
      if (Math.min(d, along) < this.width / 2 + 4) continue;
      const near = Math.min(d, along) < this.width / 2 + 14;
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

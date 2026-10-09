import * as THREE from 'three';
import type { CarClassId } from './config';

/**
 * Low-poly модели машин банд, собранные из примитивов прямо в коде.
 * Пропорции и цвета взяты из лора (lore/cars.md, «Шпаргалка для low-poly моделей»).
 * Нос машины смотрит в +z, земля на y = 0. Колёса отдаются отдельно, чтобы их крутить.
 */
export interface CarModel {
  root: THREE.Group;
  wheels: THREE.Object3D[];
}

const mats = new Map<string, THREE.Material>();
function mat(color: number, opts: { emissive?: number; transparent?: number } = {}) {
  const key = `${color}:${opts.emissive ?? ''}:${opts.transparent ?? ''}`;
  let m = mats.get(key);
  if (!m) {
    const lm = new THREE.MeshLambertMaterial({ color, flatShading: true });
    if (opts.emissive !== undefined) {
      lm.emissive.set(opts.emissive);
      lm.emissiveIntensity = 1;
    }
    if (opts.transparent !== undefined) {
      lm.transparent = true;
      lm.opacity = opts.transparent;
    }
    m = lm;
    mats.set(key, m);
  }
  return m;
}

const DARK = 0x221e1c;
const TIRE = 0x1c1a19;
const METAL = 0x8d8478;
const CHROME = 0xc0c6cc;
const GLASS = 0x1b2730;
const LIGHT = 0xfff2c0;

/** Мелкий конструктор: всё добавляется в текущую группу. */
class Kit {
  readonly root = new THREE.Group();
  readonly wheels: THREE.Object3D[] = [];

  box(w: number, h: number, d: number, color: number | THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, parent: THREE.Object3D = this.root) {
    return this.mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z, rx, ry, rz, parent);
  }

  cyl(rTop: number, rBot: number, h: number, seg: number, color: number | THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, parent: THREE.Object3D = this.root) {
    return this.mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), color, x, y, z, rx, ry, rz, parent);
  }

  mesh(geo: THREE.BufferGeometry, color: number | THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, parent: THREE.Object3D = this.root) {
    const m = new THREE.Mesh(geo, typeof color === 'number' ? mat(color) : color);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  /** Колесо: шина и колпак, ось вдоль x. */
  wheel(r: number, w: number, x: number, z: number, hub: number | THREE.Material = METAL) {
    const g = new THREE.Group();
    g.position.set(x, r, z);
    const tire = new THREE.CylinderGeometry(r, r, w, 10);
    tire.rotateZ(Math.PI / 2);
    this.mesh(tire, TIRE, 0, 0, 0, 0, 0, 0, g);
    const cap = new THREE.CylinderGeometry(r * 0.45, r * 0.45, w + 0.04, 6);
    cap.rotateZ(Math.PI / 2);
    this.mesh(cap, hub, 0, 0, 0, 0, 0, 0, g);
    // Протектор-«зуб», чтобы было видно вращение
    this.box(w + 0.02, r * 0.3, r * 0.3, METAL, 0, r * 0.82, 0, 0, 0, 0, g);
    this.root.add(g);
    this.wheels.push(g);
    return g;
  }

  /** Лёгкий пулемёт на крыше, общий для всех банд. */
  gun(x: number, y: number, z: number, s = 1) {
    this.box(0.36 * s, 0.2 * s, 0.4 * s, DARK, x, y + 0.1 * s, z);
    this.box(0.12 * s, 0.12 * s, 0.9 * s, DARK, x, y + 0.2 * s, z + 0.45 * s);
  }

  /** Фары спереди. */
  headlights(xs: number[], y: number, z: number, r = 0.14) {
    for (const x of xs) this.cyl(r, r, 0.08, 8, mat(LIGHT, { emissive: 0xffe6a0 }), x, y, z, Math.PI / 2);
  }

  done(): CarModel {
    return { root: this.root, wheels: this.wheels };
  }
}

/** Плоская картинка из canvas: вывески, наклейки. */
function canvasPlane(w: number, h: number, px: number, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void, emissive = false) {
  const c = document.createElement('canvas');
  c.width = px;
  c.height = Math.round((px * h) / w);
  draw(c.getContext('2d')!, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = emissive
    ? new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    : new THREE.MeshLambertMaterial({ map: tex, transparent: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  return mesh;
}

// ───────────────────────── Ржавый Перехватчик ─────────────────────────
function interceptor(): CarModel {
  const k = new Kit();
  const ORANGE = 0xc8641e;
  const RUST = 0x6b3a1f;
  const DOOR = 0x8a7a52; // двери от другой машины, выгоревшая охра
  const ROOF = 0x5c6b63; // крыша от третьей, облезлый серо-зелёный
  // Днище и пороги
  k.box(2.0, 0.35, 4.1, RUST, 0, 0.55, 0);
  // Лоскутные панели: капот, середина, багажник
  k.box(1.9, 0.4, 1.3, ORANGE, 0, 0.9, 1.35, -0.06);
  k.box(2.04, 0.5, 1.5, DOOR, 0, 0.85, -0.05);
  k.box(1.9, 0.42, 1.1, RUST, 0, 0.9, -1.45);
  // Кабина
  k.box(1.6, 0.5, 1.4, GLASS, 0, 1.3, -0.2);
  k.box(1.7, 0.12, 1.5, ROOF, 0, 1.6, -0.25);
  // Оранжевые полосы банды
  k.box(0.22, 0.02, 1.3, 0xf09030, -0.4, 1.12, 1.33, -0.06);
  k.box(0.22, 0.02, 1.3, 0xf09030, 0.4, 1.12, 1.33, -0.06);
  // Заплаты и заклёпки
  k.box(0.5, 0.36, 0.04, 0x9c4a22, -1.03, 0.85, 0.2);
  k.box(0.04, 0.3, 0.6, ORANGE, -1.03, 0.82, -1.3);
  // Бампер-таран из рельса
  k.box(2.2, 0.22, 0.25, METAL, 0, 0.55, 2.15);
  k.box(2.0, 0.2, 0.2, DARK, 0, 0.55, -2.1);
  k.headlights([-0.65, 0.65], 0.88, 2.01);
  // Клешня-ковш на правом борту (правый = -x): кронштейн и сложенный ковш
  const R = -1;
  k.box(0.18, 0.18, 1.8, METAL, R * 1.15, 1.05, -0.3, 0.1);
  k.cyl(0.14, 0.14, 0.3, 8, DARK, R * 1.15, 1.05, -1.2, 0, 0, Math.PI / 2);
  const bucket = new THREE.Group();
  bucket.position.set(R * 1.3, 1.05, 0.85);
  k.root.add(bucket);
  k.box(0.5, 0.6, 0.7, 0xd8a020, 0, 0, 0, 0, 0, 0, bucket);
  for (const z of [-0.22, 0, 0.22]) k.mesh(new THREE.ConeGeometry(0.06, 0.22, 4), METAL, 0, -0.38, z, Math.PI, 0, 0, bucket);
  // Рожица Мамочки на ковше
  for (const z of [-0.14, 0.14]) {
    k.box(0.02, 0.14, 0.12, 0xffffff, R * 0.26, 0.12, z, 0, 0, 0, bucket);
    k.box(0.02, 0.06, 0.06, DARK, R * 0.27, 0.12, z, 0, 0, 0, bucket);
  }
  k.box(0.02, 0.05, 0.34, DARK, R * 0.26, -0.12, 0, 0, 0, 0, bucket);
  // Лишнее запасное колесо на багажнике
  const spare = new THREE.CylinderGeometry(0.42, 0.42, 0.28, 10);
  k.mesh(spare, TIRE, 0.2, 1.25, -1.5, 0.15);
  k.cyl(0.18, 0.18, 0.3, 6, METAL, 0.2, 1.25, -1.5, 0.15);
  k.gun(0.15, 1.66, 0);
  // Колёса разного калибра: всё с разных машин
  k.wheel(0.5, 0.42, -1.05, 1.3);
  k.wheel(0.55, 0.42, 1.05, 1.3, ORANGE);
  k.wheel(0.55, 0.48, -1.05, -1.35);
  k.wheel(0.55, 0.48, 1.05, -1.35, 0x5c6b63);
  return k.done();
}

// ───────────────────────── Песчаная Блоха ─────────────────────────
function flea(): CarModel {
  const k = new Kit();
  const WHITE = 0xf2f2ee;
  const BLUE = 0x7fb2d9;
  const tube = (a: THREE.Vector3, b: THREE.Vector3, color = WHITE, r = 0.07) => {
    const len = a.distanceTo(b);
    const m = k.cyl(r, r, len, 6, color, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return m;
  };
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  // Поддон и мотор сзади
  k.box(1.3, 0.12, 2.8, 0xb8b4a8, 0, 0.62, 0);
  k.box(0.8, 0.45, 0.6, DARK, 0, 0.9, -1.0);
  k.cyl(0.07, 0.07, 0.6, 6, METAL, 0.3, 1.2, -1.35, -0.7);
  // Рама из трубок: продольные, дуга безопасности, нос
  for (const s of [-1, 1]) {
    tube(v(s * 0.65, 0.68, 1.4), v(s * 0.65, 0.68, -1.4));
    tube(v(s * 0.6, 0.68, 0.5), v(s * 0.5, 1.5, -0.1), BLUE);
    tube(v(s * 0.5, 1.5, -0.1), v(s * 0.55, 0.68, -0.9), BLUE);
    tube(v(s * 0.65, 0.68, 1.4), v(s * 0.35, 1.05, 1.0));
  }
  tube(v(-0.5, 1.5, -0.1), v(0.5, 1.5, -0.1), BLUE);
  tube(v(-0.35, 1.05, 1.0), v(0.35, 1.05, 1.0));
  tube(v(-0.7, 0.62, 1.55), v(0.7, 0.62, 1.55), METAL, 0.09);
  // Сиденье и руль
  k.box(0.5, 0.1, 0.5, DARK, 0, 0.8, 0.1);
  k.box(0.5, 0.5, 0.1, DARK, 0, 1.0, -0.15, -0.2);
  k.mesh(new THREE.TorusGeometry(0.17, 0.035, 5, 10), DARK, 0, 1.08, 0.5, -0.9);
  // Шезлонг на крыше в бело-голубую полоску
  const chair = new THREE.Group();
  chair.position.set(0, 1.56, -0.1);
  k.root.add(chair);
  for (let i = 0; i < 4; i++) k.box(0.7, 0.05, 0.16, i % 2 ? BLUE : WHITE, 0, 0.08, 0.28 - i * 0.16, 0, 0, 0, chair);
  for (let i = 0; i < 4; i++) k.box(0.7, 0.05, 0.16, i % 2 ? BLUE : WHITE, 0, 0.18 + i * 0.12, -0.36 - i * 0.07, -1.0, 0, 0, chair);
  // Зонт: самая высокая точка
  k.cyl(0.035, 0.035, 1.5, 5, WHITE, 0.25, 2.3, -0.35);
  const segs = 8;
  for (let i = 0; i < segs; i++) {
    const g = new THREE.ConeGeometry(1.25, 0.45, 2, 1, true, (i / segs) * Math.PI * 2, (Math.PI * 2) / segs);
    const m = k.mesh(g, i % 2 ? BLUE : WHITE, 0.25, 3.1, -0.35);
    (m.material as THREE.Material).side = THREE.DoubleSide;
  }
  k.cyl(0.05, 0.05, 0.12, 5, BLUE, 0.25, 3.38, -0.35);
  // Верёвки-вожжи от руля к шезлонгу
  for (const s of [-1, 1]) tube(v(s * 0.15, 1.12, 0.5), v(s * 0.3, 1.7, -0.25), 0xc8a060, 0.02);
  k.headlights([-0.35, 0.35], 1.0, 1.08, 0.11);
  k.gun(0, 1.08, 1.05, 0.8);
  // Колёса-баллоны, выступают за кузов
  for (const [x, z] of [[-1.05, 1.15], [1.05, 1.15]]) k.wheel(0.62, 0.62, x, z, BLUE);
  for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1]]) k.wheel(0.72, 0.75, x, z, BLUE);
  return k.done();
}

/** Языки пламени на борту: треугольники из canvas. */
function flameDecal(w: number, h: number) {
  return canvasPlane(w, h, 256, (g, W, H) => {
    const tongue = (x: number, len: number, col: string) => {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(W * 0.95, H * (0.5 - len * 0.35));
      g.quadraticCurveTo(W * 0.4, H * 0.1, x, H * (0.3 + len * 0.1));
      g.quadraticCurveTo(W * 0.45, H * 0.55, W * 0.15, H * 0.9);
      g.quadraticCurveTo(W * 0.6, H * 0.7, W * 0.95, H * (0.5 + len * 0.35));
      g.fill();
    };
    tongue(0, 1, '#c8102e');
    tongue(W * 0.25, 0.7, '#ff6a00');
    tongue(W * 0.5, 0.4, '#f5c400');
  });
}

// ───────────────────────── Огненная Колесница ─────────────────────────
function chariot(): CarModel {
  const k = new Kit();
  const BLACK = 0x1a1a1a;
  const RED = 0xc8102e;
  const YELLOW = 0xf5c400;
  // Низкий длинный кузов, кабина сдвинута назад
  k.box(2.0, 0.45, 4.6, BLACK, 0, 0.62, 0);
  k.box(2.04, 0.12, 4.5, RED, 0, 0.88, 0);
  k.box(1.6, 0.45, 1.3, GLASS, 0, 1.15, -1.1);
  k.box(1.7, 0.1, 1.2, BLACK, 0, 1.42, -1.15);
  // Сцена вместо капота: помост с микрофонной стойкой
  k.box(1.7, 0.12, 0.9, 0x5a3a22, 0, 0.98, 1.85);
  k.cyl(0.025, 0.025, 0.7, 5, METAL, 0, 1.38, 1.95);
  k.mesh(new THREE.SphereGeometry(0.07, 6, 4), DARK, 0, 1.75, 1.97);
  // Открытый мотор, торчит над капотом
  k.box(1.1, 0.55, 1.1, 0x3a3a3a, 0, 1.2, 0.75);
  k.box(1.2, 0.18, 0.8, CHROME, 0, 1.55, 0.75);
  for (const x of [-0.3, 0, 0.3]) k.cyl(0.1, 0.12, 0.25, 6, RED, x, 1.72, 0.85);
  // Трубы органа: пучок вертикальных выхлопов за мотором
  const heights = [1.0, 1.35, 1.7, 1.35, 1.0];
  heights.forEach((h, i) => {
    const x = (i - 2) * 0.22;
    k.cyl(0.09, 0.09, h, 7, CHROME, x, 1.25 + h / 2, 0.05);
    k.cyl(0.11, 0.1, 0.08, 7, DARK, x, 1.25 + h, 0.05);
  });
  // Колонки и прожекторы на крыше
  for (const x of [-0.5, 0.5]) {
    k.box(0.5, 0.55, 0.45, DARK, x, 1.75, -1.2);
    k.cyl(0.15, 0.15, 0.03, 8, 0x555555, x, 1.8, -0.97, Math.PI / 2);
  }
  for (const x of [-0.75, 0.75]) {
    k.cyl(0.13, 0.1, 0.25, 7, mat(LIGHT, { emissive: 0xffd060 }), x, 1.58, -0.6, Math.PI / 2 - 0.4);
  }
  k.gun(0, 1.47, -1.6, 0.9);
  // Языки пламени и рваные постеры по бортам
  for (const s of [-1, 1]) {
    const f = flameDecal(2.4, 0.45);
    f.position.set(s * 1.025, 0.62, 0.6);
    f.rotation.y = s * Math.PI / 2;
    if (s < 0) f.scale.x = -1;
    k.root.add(f);
    k.box(0.02, 0.32, 0.36, YELLOW, s * 1.025, 0.65, -1.3, 0, 0, s * 0.1);
    k.box(0.02, 0.28, 0.3, 0xe8e0d0, s * 1.03, 0.62, -1.75, 0.2);
  }
  k.box(2.1, 0.2, 0.2, CHROME, 0, 0.5, 2.35);
  k.headlights([-0.7, 0.7], 0.75, 2.31);
  k.wheel(0.42, 0.34, -1.0, 1.5);
  k.wheel(0.42, 0.34, 1.0, 1.5);
  k.wheel(0.62, 0.6, -1.05, -1.45, RED);
  k.wheel(0.62, 0.6, 1.05, -1.45, RED);
  return k.done();
}

// ───────────────────────── Шипастый Катафалк ─────────────────────────
function hearse(): CarModel {
  const k = new Kit();
  const BLACK = 0x141018;
  const PURPLE = 0x6b2d8c;
  k.box(2.0, 0.5, 5.8, BLACK, 0, 0.7, 0);
  // Капот и высокая задняя часть с окнами
  k.box(1.9, 0.3, 1.6, BLACK, 0, 1.08, 2.0);
  k.box(1.9, 0.95, 3.8, BLACK, 0, 1.42, -0.85);
  // Окна: передние тёмные, задние с фиолетовыми шторками
  k.box(1.94, 0.45, 0.8, GLASS, 0, 1.55, 0.7);
  for (const s of [-1, 1]) {
    for (const z of [-0.3, -1.3]) {
      k.box(0.03, 0.5, 0.75, PURPLE, s * 0.96, 1.5, z);
      k.box(0.04, 0.1, 0.8, 0xc9a227, s * 0.97, 1.78, z); // карниз
    }
  }
  // Заднее окно с гробом «Зарезервировано»
  k.box(1.5, 0.55, 0.04, mat(0x9ab0c0, { transparent: 0.35 }), 0, 1.5, -2.77);
  k.box(0.6, 0.35, 1.4, 0x6a4026, 0, 1.3, -2.1);
  k.box(0.3, 0.02, 0.15, 0xe0d8c0, 0, 1.48, -2.75);
  k.box(1.96, 0.08, 3.7, BLACK, 0, 1.92, -0.85);
  for (const s of [-1, 1]) k.box(0.1, 0.1, 3.72, PURPLE, s * 0.95, 1.93, -0.85);
  // Выдвижные дисковые пилы на обоих бортах
  for (const s of [-1, 1]) {
    k.box(0.3, 0.2, 0.8, METAL, s * 1.1, 0.75, 0.6);
    for (const z of [1.1, -0.6]) {
      const saw = new THREE.Group();
      saw.position.set(s * 1.3, 0.85, z);
      k.root.add(saw);
      k.cyl(0.55, 0.55, 0.05, 14, CHROME, 0, 0, 0, 0, 0, Math.PI / 2, saw);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        k.mesh(new THREE.ConeGeometry(0.06, 0.18, 3), CHROME, 0, Math.sin(a) * 0.6, Math.cos(a) * 0.6, a, 0, 0, saw);
      }
      k.cyl(0.12, 0.12, 0.12, 6, DARK, 0, 0, 0, 0, 0, Math.PI / 2, saw);
    }
  }
  // Венок на крыше
  k.mesh(new THREE.TorusGeometry(0.45, 0.13, 5, 10), 0x2f5a2a, 0, 2.05, -0.6, Math.PI / 2);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.mesh(new THREE.IcosahedronGeometry(0.09, 0), 0xb0203a, Math.cos(a) * 0.45, 2.15, -0.6 + Math.sin(a) * 0.45);
  }
  k.box(0.7, 0.04, 0.16, PURPLE, 0, 2.0, -1.12, 0, 0.3); // лента
  // Кованые фонари по углам крыши
  for (const [x, z] of [[-0.85, 0.95], [0.85, 0.95], [-0.85, -2.65], [0.85, -2.65]]) {
    k.cyl(0.03, 0.03, 0.25, 4, DARK, x, 2.05, z);
    k.box(0.2, 0.26, 0.2, DARK, x, 2.28, z);
    k.box(0.14, 0.18, 0.22, mat(LIGHT, { emissive: 0xffb040 }), x, 2.28, z);
    k.mesh(new THREE.ConeGeometry(0.17, 0.16, 4), DARK, x, 2.49, z, 0, Math.PI / 4);
  }
  k.gun(0, 1.96, 0.6, 0.9);
  k.box(2.1, 0.22, 0.22, CHROME, 0, 0.55, 2.95);
  k.headlights([-0.7, 0.7], 0.95, 2.82);
  for (const z of [1.9, -1.9]) {
    k.wheel(0.52, 0.42, -1.0, z);
    k.wheel(0.52, 0.42, 1.0, z);
  }
  return k.done();
}

// ───────────────────────── Железный Поп ─────────────────────────
function pope(): CarModel {
  const k = new Kit();
  const GREEN = 0x4b5d2a;
  const GOLD = 0xc9a227;
  const REBAR = 0x5a3424;
  // Бронефургон-коробка с кабиной
  k.box(2.3, 0.4, 4.9, DARK, 0, 0.6, 0);
  k.box(2.2, 1.0, 1.3, GREEN, 0, 1.25, 1.75);
  k.box(2.0, 0.35, 0.05, GLASS, 0, 1.45, 2.41);
  k.box(2.3, 1.55, 3.4, GREEN, 0, 1.55, -0.6);
  // Золотые узоры: пояса и уголки
  for (const y of [0.95, 2.2]) k.box(2.34, 0.08, 3.44, GOLD, 0, y, -0.6);
  for (const s of [-1, 1]) {
    for (const z of [0.4, -1.5]) k.mesh(new THREE.OctahedronGeometry(0.16, 0), GOLD, s * 1.17, 1.6, z);
    // Кресты из арматуры
    k.box(0.06, 1.0, 0.1, REBAR, s * 1.18, 1.55, -0.55);
    k.box(0.06, 0.1, 0.62, REBAR, s * 1.18, 1.75, -0.55);
  }
  k.box(0.06, 0.55, 0.08, REBAR, 0, 1.65, 2.42);
  k.box(0.5, 0.08, 0.08, REBAR, 0, 1.75, 2.42);
  // Колоколенка с колоколом
  const tower = new THREE.Group();
  tower.position.set(0, 2.33, -0.9);
  k.root.add(tower);
  k.box(0.9, 0.12, 0.9, GREEN, 0, 0, 0, 0, 0, 0, tower);
  for (const [x, z] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]]) k.box(0.1, 0.8, 0.1, GREEN, x, 0.45, z, 0, 0, 0, tower);
  k.mesh(new THREE.ConeGeometry(0.7, 0.7, 4), GOLD, 0, 1.2, 0, 0, Math.PI / 4, 0, tower);
  k.box(0.05, 0.4, 0.05, GOLD, 0, 1.75, 0, 0, 0, 0, tower);
  k.box(0.22, 0.05, 0.05, GOLD, 0, 1.8, 0, 0, 0, 0, tower);
  k.mesh(new THREE.CylinderGeometry(0.12, 0.28, 0.4, 8, 1, true), GOLD, 0, 0.55, 0, 0, 0, 0, tower);
  k.mesh(new THREE.SphereGeometry(0.06, 5, 4), DARK, 0, 0.33, 0, 0, 0, 0, tower);
  // Открытый задний люк-«исповедальня»
  k.box(1.4, 1.0, 0.05, DARK, 0, 1.4, -2.31);
  k.box(1.4, 0.06, 0.9, GREEN, 0, 0.92, -2.75);
  for (const x of [-0.35, 0, 0.35]) k.cyl(0.13, 0.13, 0.08, 8, 0x3a3a30, x, 0.99, -2.75);
  // Пёс Псалом на подножке
  k.box(0.2, 0.06, 1.2, METAL, -1.25, 0.55, 1.2);
  const dog = new THREE.Group();
  dog.position.set(-1.25, 0.58, 1.3);
  k.root.add(dog);
  const FUR = 0x8a6a48;
  k.box(0.22, 0.22, 0.45, FUR, 0, 0.18, 0, 0, 0, 0, dog);
  k.box(0.2, 0.2, 0.22, FUR, 0, 0.38, 0.22, 0, 0, 0, dog);
  k.box(0.12, 0.1, 0.12, 0x5a4430, 0, 0.34, 0.37, 0, 0, 0, dog);
  for (const s of [-1, 1]) k.box(0.05, 0.12, 0.08, 0x5a4430, s * 0.09, 0.5, 0.18, 0, 0, s * 0.3, dog);
  k.box(0.04, 0.04, 0.2, FUR, 0, 0.3, -0.28, 0.6, 0, 0, dog);
  k.box(2.4, 0.3, 0.25, METAL, 0, 0.6, 2.5);
  k.headlights([-0.75, 0.75], 0.95, 2.41);
  k.gun(0.6, 1.75, 1.6, 0.9);
  for (const z of [1.55, -1.6]) {
    k.wheel(0.55, 0.45, -1.15, z);
    k.wheel(0.55, 0.45, 1.15, z);
  }
  return k.done();
}

// ───────────────────────── Боевая Фура ─────────────────────────
function hauler(): CarModel {
  const k = new Kit();
  const BLUE = 0x1f4e9c;
  const PINK = 0xff5fa2;
  const chrome = mat(CHROME, { emissive: 0x30343a });
  // Рама
  k.box(1.8, 0.35, 7.2, DARK, 0, 0.6, -0.4);
  // Кабина тягача
  k.box(2.6, 0.9, 1.6, BLUE, 0, 1.3, 2.3);
  k.box(2.6, 1.3, 1.4, BLUE, 0, 1.95, 1.0);
  k.box(2.4, 0.5, 0.05, GLASS, 0, 2.15, 1.71);
  k.mesh(new THREE.TorusGeometry(0.17, 0.06, 5, 10), PINK, 0.6, 2.05, 1.55, -1.1); // розовый меховой руль
  // Хромированная решётка-«улыбка»
  k.box(2.7, 0.3, 0.3, chrome, 0, 0.6, 3.2);
  for (let i = 0; i < 9; i++) {
    const x = (i - 4) * 0.22;
    const h = 0.75 - Math.abs(i - 4) * 0.06;
    k.box(0.1, h, 0.08, chrome, x, 1.2 - (0.75 - h) / 2, 3.13);
  }
  k.box(2.0, 0.08, 0.1, chrome, 0, 0.85, 3.14);
  k.headlights([-1.1, 1.1], 1.4, 3.12, 0.18);
  // Выхлопные стояки
  for (const s of [-1, 1]) k.cyl(0.11, 0.11, 2.2, 7, chrome, s * 1.35, 2.0, 0.4);
  // Турель в люке с Вовочкой
  const tur = new THREE.Group();
  tur.position.set(0, 2.6, 1.0);
  k.root.add(tur);
  k.cyl(0.55, 0.6, 0.18, 8, METAL, 0, 0, 0, 0, 0, 0, tur);
  k.box(0.32, 0.4, 0.26, 0x3a7a3a, 0, 0.3, -0.05, 0, 0, 0, tur); // куртка
  k.mesh(new THREE.SphereGeometry(0.15, 7, 5), 0xf0c8a0, 0, 0.62, -0.05, 0, 0, 0, tur);
  k.box(0.3, 0.07, 0.3, 0xd02020, 0, 0.75, -0.05, 0, 0, 0, tur); // кепка
  k.box(0.5, 0.25, 0.4, DARK, 0, 0.3, 0.3, 0, 0, 0, tur);
  for (const x of [-0.1, 0.1]) k.cyl(0.05, 0.05, 1.0, 6, DARK, x, 0.32, 0.9, Math.PI / 2, 0, 0, tur);
  // Прицеп-закусочная
  k.box(2.5, 1.6, 3.6, 0xe8e2d6, 0, 1.75, -2.35);
  k.box(2.54, 0.25, 3.64, PINK, 0, 1.0, -2.35);
  k.box(2.54, 0.12, 3.64, BLUE, 0, 2.58, -2.35);
  for (const s of [-1, 1]) {
    for (const z of [-1.4, -2.3, -3.2]) k.box(0.03, 0.5, 0.6, mat(0xfff0b0, { emissive: 0x806030 }), s * 1.26, 1.9, z);
  }
  // Неоновая вывеска «У Мамаши» на крыше прицепа
  const sign = canvasPlane(2.4, 0.6, 512, (g, W, H) => {
    g.fillStyle = '#1a0a14';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#ff5fa2';
    g.lineWidth = 8;
    g.strokeRect(6, 6, W - 12, H - 12);
    g.font = `bold ${Math.round(H * 0.62)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = '#ff5fa2';
    g.shadowBlur = 18;
    g.fillStyle = '#ffd0e6';
    g.fillText('У МАМАШИ', W / 2, H / 2 + 4);
  }, true);
  // Вывеска стоит вдоль прицепа и читается с обеих сторон
  for (const side of [-1, 1]) {
    const face = side < 0 ? sign : sign.clone();
    face.position.set(side * 0.03, 3.05, -2.35);
    face.rotation.y = side * Math.PI / 2;
    k.root.add(face);
  }
  k.box(0.04, 0.66, 2.5, DARK, 0, 3.05, -2.35);
  k.box(0.08, 0.3, 0.08, DARK, 0, 2.7, -1.5);
  k.box(0.08, 0.3, 0.08, DARK, 0, 2.7, -3.2);
  // Пин-ап силуэт Мамаши на бортах
  for (const s of [-1, 1]) {
    const pin = canvasPlane(0.9, 1.1, 128, (g, W, H) => {
      g.fillStyle = '#ff5fa2';
      g.beginPath();
      g.arc(W * 0.5, H * 0.17, W * 0.13, 0, Math.PI * 2); // голова
      g.fill();
      g.fillStyle = '#111';
      g.beginPath();
      g.arc(W * 0.47, H * 0.13, W * 0.16, Math.PI, Math.PI * 2.1); // чёрные волосы
      g.fill();
      g.fillStyle = '#ff5fa2';
      g.beginPath();
      g.moveTo(W * 0.42, H * 0.28);
      g.quadraticCurveTo(W * 0.2, H * 0.45, W * 0.45, H * 0.55);
      g.quadraticCurveTo(W * 0.75, H * 0.62, W * 0.4, H * 0.95);
      g.lineTo(W * 0.62, H * 0.95);
      g.quadraticCurveTo(W * 0.85, H * 0.6, W * 0.6, H * 0.5);
      g.quadraticCurveTo(W * 0.75, H * 0.38, W * 0.58, H * 0.28);
      g.fill();
    });
    pin.position.set(s * 1.27, 1.95, -0.75);
    pin.rotation.y = s * Math.PI / 2;
    k.root.add(pin);
  }
  k.wheel(0.6, 0.5, -1.2, 2.3, chrome);
  k.wheel(0.6, 0.5, 1.2, 2.3, chrome);
  for (const z of [0.4, -2.9, -3.7]) {
    k.wheel(0.6, 0.55, -1.2, z, chrome);
    k.wheel(0.6, 0.55, 1.2, z, chrome);
  }
  return k.done();
}

const BUILDERS: Record<CarClassId, () => CarModel> = { interceptor, flea, chariot, hearse, pope, hauler };

export function buildCarModel(id: CarClassId): CarModel {
  return BUILDERS[id]();
}

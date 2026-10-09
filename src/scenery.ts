import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DARK, Kit, METAL, TIRE, canvasPlane, mat } from './lowpoly';
import type { Track } from './track';

/**
 * Окружение территорий: фирменный декор каждой банды за краем трассы и вышка-Источник.
 * Всё чисто визуальное: ни с чем не сталкивается и не влияет на гонку.
 */

type Rnd = () => number;
type Prop = (k: Kit, r: Rnd) => number; // строит модель в k.root и возвращает её высоту
interface Theme {
  landmark: Prop;
  props: [number, Prop][]; // вес, конструктор
  boundary: { shape: 'rock' | 'box' | 'barrier' | 'barrel'; colors: number[] };
  density: number; // попыток расставить предмет на 1000 м²
}

// Камера смотрит вдоль +x+z под углом ~42°: высокий предмет закрывает землю за собой в эту сторону
const VIEW = new THREE.Vector3(1, 0, 1).normalize();
const SHADE = 1.15;

const pick = <T,>(r: Rnd, list: T[]) => list[Math.floor(r() * list.length)];

// ───────────────────────── Общие детали ─────────────────────────

function rock(color: number, s = 1): Prop {
  return (k, r) => {
    const size = s * (1.5 + r() * 3);
    const m = k.mesh(new THREE.DodecahedronGeometry(1, 0), color, 0, size * 0.3, 0, r() * 3, r() * 3, r() * 3);
    m.scale.set(size, size * (0.5 + r() * 0.5), size);
    return size;
  };
}

const barrels: Prop = (k, r) => {
  const n = 1 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * 3;
    const z = (r() - 0.5) * 3;
    if (r() < 0.3) k.cyl(0.6, 0.6, 1.4, 8, pick(r, [0x7a2e1c, 0x3a4a5a, 0x6a6a2a]), x, 0.6, z, 0, r() * 3, Math.PI / 2);
    else {
      k.cyl(0.6, 0.6, 1.4, 8, pick(r, [0x7a2e1c, 0x3a4a5a, 0x6a6a2a]), x, 0.7, z);
      k.cyl(0.62, 0.62, 0.12, 8, 0xc09030, x, 1.0, z);
    }
  }
  return 1.4;
};

const tireStack: Prop = (k, r) => {
  const n = 2 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) k.mesh(new THREE.TorusGeometry(0.8, 0.35, 5, 10), TIRE, (r() - 0.5) * 0.3, 0.35 + i * 0.62, (r() - 0.5) * 0.3, Math.PI / 2);
  return n * 0.62;
};

/** Остов машины без колёс. */
function wreck(colors: number[]): Prop {
  return (k, r) => {
    const c = pick(r, colors);
    const g = new THREE.Group();
    g.rotation.set((r() - 0.5) * 0.3, r() * 6, (r() - 0.5) * 0.5);
    k.root.add(g);
    k.box(2.2, 0.7, 4.4, c, 0, 0.55, 0, 0, 0, 0, g);
    k.box(1.8, 0.6, 2.0, c, 0, 1.15, -0.4, 0, 0, 0, g);
    k.box(1.7, 0.4, 0.05, DARK, 0, 1.15, 0.62, 0, 0, 0, g);
    if (r() < 0.5) k.box(1.0, 0.1, 1.2, 0x5a3a26, 0.4, 0.95, 1.7, 0, 0, 0.6, g); // оторванный капот
    return 1.5;
  };
}

/** Буровая вышка-Источник: решётчатая пирамида с площадкой. */
function derrick(k: Kit, h: number, leg: number, accent: number, base = 0) {
  const b = h * 0.18;
  const t = h * 0.05;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const a = new THREE.Vector3(sx * b, base, sz * b);
    const c = new THREE.Vector3(sx * t, base + h, sz * t);
    const m = k.cyl(0.18, 0.25, a.distanceTo(c), 5, leg, (a.x + c.x) / 2, (a.y + c.y) / 2, (a.z + c.z) / 2);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.clone().sub(a).normalize());
  }
  // Поперечные пояса
  for (let i = 1; i < 6; i++) {
    const f = i / 6;
    const w = b + (t - b) * f;
    const y = base + h * f;
    for (const [x, z, ry] of [[0, -w, 0], [0, w, 0], [-w, 0, Math.PI / 2], [w, 0, Math.PI / 2]]) k.box(w * 2, 0.16, 0.16, i % 2 ? accent : leg, x, y, z, 0, ry);
  }
  k.box(t * 2 + 1.6, 0.25, t * 2 + 1.6, leg, 0, base + h, 0);
  k.box(b * 2 + 2, 0.5, b * 2 + 2, 0x4a4038, 0, base + 0.25, 0);
  // Качалка у подножия
  k.box(0.6, 2.2, 0.6, DARK, b + 2.5, base + 1.1, 0);
  k.box(0.4, 0.4, 4, accent, b + 2.5, base + 2.4, 0, 0.2);
  k.box(0.9, 1.2, 0.5, DARK, b + 2.5, base + 2.0, 2.0, 0.2);
}

/** Флаг банды на шесте. */
function flag(k: Kit, x: number, z: number, h: number, color: number, base = 0) {
  k.cyl(0.08, 0.1, h, 5, METAL, x, base + h / 2, z);
  const f = k.box(0.05, 1.0, 1.6, color, x, base + h - 0.6, z + 0.8);
  f.rotation.y = 0.15;
}

/** Плакат или вывеска на canvas. */
function sign(text: string, sub: string, bg: string, fg: string, neon = false) {
  return canvasPlane(6, 3, 256, (g, W, H) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = fg;
    g.lineWidth = 6;
    g.strokeRect(5, 5, W - 10, H - 10);
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (neon) {
      g.shadowColor = fg;
      g.shadowBlur = 14;
    }
    g.font = `bold ${Math.round(H * 0.3)}px sans-serif`;
    g.fillText(text, W / 2, H * 0.4, W - 20);
    g.font = `${Math.round(H * 0.16)}px sans-serif`;
    g.fillText(sub, W / 2, H * 0.72, W - 20);
  }, neon);
}

/** Табло на двух столбах, видно с обеих сторон. */
function board(k: Kit, face: () => THREE.Mesh, h: number) {
  k.cyl(0.15, 0.15, h, 5, METAL, -2.4, h / 2, 0);
  k.cyl(0.15, 0.15, h, 5, METAL, 2.4, h / 2, 0);
  k.box(6.2, 3.2, 0.2, DARK, 0, h + 1.4, 0);
  for (const s of [-1, 1]) {
    const p = face();
    p.position.set(0, h + 1.4, s * 0.11);
    p.rotation.set(0, s < 0 ? Math.PI : 0, 0);
    k.root.add(p);
  }
}

// ───────────────────────── Свалка: Ржавники ─────────────────────────
const RUSTS = [0x7a4426, 0x8a5a30, 0x5c6b63, 0x9c4a22, 0x6b3a1f, 0x8a7a52];

const junkyard: Theme = {
  density: 1.1,
  boundary: { shape: 'box', colors: RUSTS },
  landmark: (k) => {
    derrick(k, 26, 0x6b3a1f, 0xc8641e);
    // Заплаты разного цвета и флаги Ржавников
    for (let i = 0; i < 6; i++) k.box(1.2, 1.2, 0.1, RUSTS[i], (i % 2 ? 1 : -1) * 2.5, 4 + i * 3, 3.2 - i * 0.35);
    flag(k, 1.5, 1.5, 6, 0xf09030, 26);
    flag(k, -1.5, -1.5, 4, 0xc8641e, 26);
    return 33;
  },
  props: [
    [3, wreck(RUSTS)],
    [2, (k, r) => {
      // Штабель спрессованных машин
      const n = 2 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) k.box(2.4, 1.2, 1.6, pick(r, RUSTS), (r() - 0.5) * 0.4, 0.6 + i * 1.2, (r() - 0.5) * 0.4, 0, r() * 0.4);
      return n * 1.2;
    }],
    [2, tireStack],
    [2, barrels],
    [1, (k, r) => {
      // Куча хлама
      for (let i = 0; i < 7; i++) k.box(0.6 + r() * 1.6, 0.3 + r() * 0.8, 0.6 + r() * 1.6, pick(r, [...RUSTS, METAL]), (r() - 0.5) * 3, r() * 0.8, (r() - 0.5) * 3, r(), r() * 3, r());
      return 1.5;
    }],
    [0.4, (k) => {
      // Кран с магнитом
      k.box(1.6, 8, 1.6, 0xc8641e, 0, 4, 0);
      k.box(1, 1, 9, 0xc8641e, 0, 8.3, 3.5);
      k.cyl(0.04, 0.04, 3, 4, DARK, 0, 6.6, 7.5);
      k.cyl(1.0, 1.0, 0.5, 8, DARK, 0, 5, 7.5);
      return 9;
    }],
    [0.6, (k, r) => {
      flag(k, 0, 0, 4 + r() * 2, 0xf09030);
      return 6;
    }],
  ],
};

// ───────────────────────── Соляная пустошь: Солевары ─────────────────────────
const SALT = 0xf2f0ea;
const SALTBLUE = 0x7fb2d9;

const saltflat: Theme = {
  density: 0.8,
  boundary: { shape: 'rock', colors: [0xe8e4da, 0xd8d2c4, 0xf4f2ec] },
  landmark: (k) => {
    // Белая Игла: высокая тонкая вышка в бело-голубую полоску
    derrick(k, 34, SALT, SALTBLUE);
    k.cyl(0.25, 0.25, 8, 5, SALTBLUE, 0, 38, 0);
    k.mesh(new THREE.ConeGeometry(0.6, 1.6, 5), SALT, 0, 42.5, 0);
    flag(k, 1.2, 0, 3, SALTBLUE, 34);
    return 43;
  },
  props: [
    [3, (k, r) => {
      // Соляной конус
      const h = 1.5 + r() * 4;
      k.mesh(new THREE.ConeGeometry(h * 0.9, h, 7), SALT, 0, h / 2, 0, 0, r() * 3);
      if (r() < 0.4) k.mesh(new THREE.ConeGeometry(h * 0.5, h * 0.6, 6), 0xe0dccf, h * 0.8, h * 0.3, 0.5);
      return h;
    }],
    [3, (k, r) => {
      // Корка соли: плоские шестигранники
      for (let i = 0; i < 4; i++) k.cyl(1 + r() * 2, 1.2 + r() * 2, 0.15, 6, pick(r, [0xffffff, 0xece6d8]), (r() - 0.5) * 6, 0.08, (r() - 0.5) * 6, 0, r() * 3);
      return 0.2;
    }],
    [1.5, (k, r) => {
      // Испарительный пруд
      const w = 6 + r() * 6;
      k.box(w + 0.6, 0.3, w * 0.7 + 0.6, 0xd8d0bc, 0, 0.12, 0);
      k.box(w, 0.32, w * 0.7, mat(0x9cc8e0, { emissive: 0x10202a }), 0, 0.14, 0);
      return 0.3;
    }],
    [1.5, (k, r) => {
      // Шезлонг под зонтом
      k.cyl(0.05, 0.05, 2.6, 5, SALT, 0, 1.3, 0);
      for (let i = 0; i < 8; i++) {
        const m = k.mesh(new THREE.ConeGeometry(1.6, 0.6, 2, 1, true, (i / 8) * Math.PI * 2, Math.PI / 4), i % 2 ? SALTBLUE : SALT, 0, 2.7, 0);
        (m.material as THREE.Material).side = THREE.DoubleSide;
      }
      k.box(0.7, 0.1, 1.6, SALTBLUE, 0.6, 0.4, 0.6, 0.35, r());
      return 3;
    }],
    [1, (k, r) => {
      // Колья с верёвкой: граница соляного участка
      for (let i = 0; i < 4; i++) k.cyl(0.08, 0.1, 1.4, 4, 0x8a6a48, i * 2.5, 0.7, (r() - 0.5) * 0.4);
      k.box(7.5, 0.04, 0.04, 0xc8a060, 3.75, 1.25, 0);
      return 1.4;
    }],
    [0.6, wreck([0xd8d0c0, 0xa89a84])],
  ],
};

// ───────────────────────── Нефтезавод: Факельщики ─────────────────────────
const flame = (k: Kit, x: number, y: number, z: number, s: number) => {
  k.mesh(new THREE.ConeGeometry(0.9 * s, 3 * s, 6), mat(0xff6a00, { emissive: 0xff4000 }), x, y + 1.5 * s, z);
  k.mesh(new THREE.ConeGeometry(0.5 * s, 2 * s, 6), mat(0xffd040, { emissive: 0xffc020 }), x, y + 1.1 * s, z);
};

const refinery: Theme = {
  density: 0.9,
  boundary: { shape: 'barrel', colors: [0x3a302a, 0x7a2e1c, 0x2a2624] },
  landmark: (k) => {
    // Вечный Факел: огромная факельная труба
    k.cyl(1.2, 1.8, 30, 8, 0x8a8478, 0, 15, 0);
    for (let i = 1; i < 6; i++) k.cyl(1.9 - i * 0.12, 1.9 - i * 0.12, 0.6, 8, i % 2 ? 0xc8102e : 0xe8e0d0, 0, i * 5, 0);
    flame(k, 0, 30, 0, 2.6);
    // Сцена Леди Копоть у подножия
    k.box(10, 1, 6, 0x2a2624, 0, 0.5, 6);
    for (const x of [-4, 4]) {
      k.box(1.8, 3.5, 1.6, DARK, x, 2.75, 7.5);
      k.cyl(0.5, 0.5, 0.05, 8, 0x555555, x, 3.2, 6.7, Math.PI / 2);
    }
    k.box(10, 0.4, 0.4, METAL, 0, 6, 8.5);
    for (const x of [-3, 0, 3]) k.cyl(0.3, 0.2, 0.6, 6, mat(0xfff2c0, { emissive: 0xffd060 }), x, 5.6, 8.3, -0.6);
    return 38;
  },
  props: [
    [2, (k, r) => {
      // Резервуар
      const rad = 3 + r() * 3;
      const h = 4 + r() * 4;
      k.cyl(rad, rad, h, 12, pick(r, [0xd8d0c0, 0xb0a898, 0x8a8478]), 0, h / 2, 0);
      k.cyl(rad + 0.05, rad + 0.05, 0.6, 12, 0x7a2e1c, 0, h * 0.75, 0);
      k.cyl(rad * 0.9, rad, 0.6, 12, 0x6a625a, 0, h + 0.3, 0);
      return h + 0.6;
    }],
    [1.5, (k, r) => {
      // Ректификационная колонна
      const h = 10 + r() * 10;
      k.cyl(1, 1.2, h, 8, 0xa8a098, 0, h / 2, 0);
      for (let y = 3; y < h; y += 3) k.cyl(1.35, 1.35, 0.2, 8, DARK, 0, y, 0);
      k.box(0.4, h, 0.1, DARK, 1.2, h / 2, 0);
      return h;
    }],
    [1.5, (k, r) => {
      // Эстакада с трубами
      const len = 10 + r() * 10;
      for (let z = -len / 2; z <= len / 2; z += 5) {
        k.box(0.3, 3, 0.3, DARK, -1.2, 1.5, z);
        k.box(0.3, 3, 0.3, DARK, 1.2, 1.5, z);
        k.box(2.8, 0.25, 0.4, DARK, 0, 3, z);
      }
      for (const x of [-0.7, 0, 0.7]) k.cyl(0.3, 0.3, len, 6, pick(r, [0x7a2e1c, 0x8a8478, 0xc0a020]), x, 3.4, 0, Math.PI / 2);
      return 3.7;
    }],
    [1, (k, r) => {
      // Факел поменьше
      const h = 6 + r() * 5;
      k.cyl(0.4, 0.6, h, 6, 0x8a8478, 0, h / 2, 0);
      flame(k, 0, h, 0, 1);
      return h + 3;
    }],
    [2, (k, r) => {
      // Лужа мазута
      k.cyl(2 + r() * 3, 2 + r() * 3, 0.06, 9, mat(0x0c0a0a), 0, 0.03, 0, 0, r() * 3);
      return 0.1;
    }],
    [2, barrels],
  ],
};

// ───────────────────────── Каньон Гремучих ─────────────────────────
const RED_ROCK = [0xa04a2a, 0xb5603a, 0x8a3e22, 0xc06a40];
const PURPLE = 0x6b2d8c;

const mesa: Prop = (k, r) => {
  const tiers = 2 + Math.floor(r() * 3);
  let y = 0;
  let rad = 5 + r() * 5;
  for (let i = 0; i < tiers; i++) {
    const h = 3 + r() * 5;
    k.cyl(rad * 0.9, rad, h, 6 + Math.floor(r() * 3), pick(r, RED_ROCK), (r() - 0.5), y + h / 2, (r() - 0.5), 0, r() * 3);
    y += h;
    rad *= 0.7 + r() * 0.2;
  }
  return y;
};

const canyon: Theme = {
  density: 0.7,
  boundary: { shape: 'rock', colors: RED_ROCK },
  landmark: (k) => {
    // Гнездо: вышка на вершине скалы, в венках и фиолетовых лентах
    k.cyl(8, 10, 10, 7, 0x8a3e22, 0, 5, 0);
    k.cyl(6, 8, 4, 7, 0xa04a2a, 0, 12, 0, 0, 0.4);
    derrick(k, 20, 0x141018, PURPLE, 14);
    k.mesh(new THREE.TorusGeometry(1.6, 0.4, 5, 10), 0x2f5a2a, 0, 26, 2.2);
    for (const s of [-1, 1]) k.box(0.1, 8, 1.2, PURPLE, s * 2.6, 22, 0, 0, 0, s * 0.12);
    return 34;
  },
  props: [
    [3, mesa],
    [2, rock(0xa04a2a, 1.4)],
    [1.5, (k, r) => {
      // Кладбище Гремучих: холмики и кресты
      for (let i = 0; i < 3; i++) {
        const x = i * 2.4;
        const z = (r() - 0.5);
        k.box(1.2, 0.4, 2.2, 0x7a3a22, x, 0.2, z);
        k.box(0.15, 1.6, 0.15, 0x3a2a20, x, 0.8, z - 1.1);
        k.box(0.8, 0.15, 0.15, 0x3a2a20, x, 1.2, z - 1.1);
        if (r() < 0.5) k.mesh(new THREE.TorusGeometry(0.35, 0.1, 4, 8), 0x2f5a2a, x, 0.5, z - 1.0);
      }
      return 1.6;
    }],
    [1, (k, r) => {
      // Шест с фиолетовым стягом
      const h = 4 + r() * 3;
      k.cyl(0.08, 0.1, h, 5, DARK, 0, h / 2, 0);
      k.box(0.05, 2.2, 1.0, PURPLE, 0, h - 1.3, 0.5);
      return h;
    }],
    [0.7, wreck([0x141018, 0x5b3a26])],
  ],
};

// ───────────────────────── Мёртвый город: Святые Тротила ─────────────────────────
const CONCRETE = [0x8a8478, 0x9a948a, 0x6e6a62, 0x7a766e];

const ruin: Prop = (k, r) => {
  const w = 6 + r() * 8;
  const d = 6 + r() * 8;
  const floors = 2 + Math.floor(r() * 4);
  const fh = 3.2;
  const c = pick(r, CONCRETE);
  k.box(w, floors * fh, d, c, 0, (floors * fh) / 2, 0);
  // Пустые окна на всех четырёх сторонах
  for (let f = 0; f < floors; f++) {
    const y = f * fh + fh * 0.55;
    for (let x = -w / 2 + 1.5; x < w / 2 - 0.8; x += 2.2) for (const s of [-1, 1]) if (r() < 0.85) k.box(1.1, 1.4, 0.1, DARK, x, y, s * (d / 2 + 0.01));
    for (let z = -d / 2 + 1.5; z < d / 2 - 0.8; z += 2.2) for (const s of [-1, 1]) if (r() < 0.85) k.box(0.1, 1.4, 1.1, DARK, s * (w / 2 + 0.01), y, z);
  }
  // Обрушенный верх и арматура
  for (let i = 0; i < 4; i++) k.box(1 + r() * 2.5, 0.8 + r() * 2, 1 + r() * 2.5, c, (r() - 0.5) * (w - 2), floors * fh + 0.5, (r() - 0.5) * (d - 2), 0, r(), 0);
  for (let i = 0; i < 3; i++) k.cyl(0.05, 0.05, 2, 4, 0x5a3424, (r() - 0.5) * w, floors * fh + 1, (r() - 0.5) * d, (r() - 0.5) * 0.6, 0, (r() - 0.5) * 0.6);
  // Обломки у стены
  for (let i = 0; i < 4; i++) k.box(0.8 + r(), 0.5 + r(), 0.8 + r(), c, (r() - 0.5) * w * 1.3, 0.3, d / 2 + 1 + r() * 2, r(), r(), r());
  return floors * fh + 2;
};

const deadcity: Theme = {
  density: 0.9,
  boundary: { shape: 'box', colors: CONCRETE },
  landmark: (k) => {
    // Колокольня: уцелевшая башня собора
    const G = 0xc9a227;
    k.box(14, 6, 10, 0x8a8478, 0, 3, -7);
    k.box(7, 22, 7, 0x9a948a, 0, 11, 0);
    for (const y of [8, 15]) for (const s of [-1, 1]) k.box(1.4, 3, 0.1, DARK, 0, y, s * 3.51);
    // Ярус с колоколом
    for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) k.box(1, 5, 1, 0x9a948a, x, 24.5, z);
    k.mesh(new THREE.CylinderGeometry(0.8, 1.8, 2.4, 8, 1, true), G, 0, 24.5, 0);
    k.mesh(new THREE.ConeGeometry(5.5, 6, 4), G, 0, 30, 0, 0, Math.PI / 4);
    k.box(0.4, 3, 0.4, G, 0, 34.5, 0);
    k.box(1.8, 0.4, 0.4, G, 0, 35, 0);
    k.box(7.2, 0.4, 7.2, 0x6b8a3a, 0, 22, 0);
    return 36;
  },
  props: [
    [3, ruin],
    [3, (k, r) => {
      // Уцелевший кусок стены с пустыми окнами
      const len = 5 + r() * 6;
      const h = 2.5 + r() * 2.5;
      const c = pick(r, CONCRETE);
      k.box(len, h, 0.6, c, 0, h / 2, 0);
      for (let x = -len / 2 + 1.4; x < len / 2 - 1; x += 2.2) if (r() < 0.8) k.box(1.1, 1.3, 0.62, DARK, x, h * 0.55, 0);
      for (let i = 0; i < 3; i++) k.box(0.6 + r(), 0.4 + r() * 0.6, 0.6 + r(), c, (r() - 0.5) * len, 0.3, 0.8 + r(), r(), r(), r());
      return h;
    }],
    [2, (k, r) => {
      // Завал
      for (let i = 0; i < 8; i++) k.box(0.8 + r() * 2, 0.5 + r() * 1.2, 0.8 + r() * 2, pick(r, CONCRETE), (r() - 0.5) * 5, r() * 0.6, (r() - 0.5) * 5, r(), r() * 3, r());
      return 1.5;
    }],
    [1.2, (k, r) => {
      // Погнутый фонарь
      k.cyl(0.12, 0.15, 5, 5, DARK, 0, 2.5, 0, 0, 0, (r() - 0.5) * 0.5);
      k.box(1.6, 0.15, 0.15, DARK, 0.6, 5, 0);
      k.box(0.5, 0.25, 0.4, 0x5a5650, 1.3, 4.85, 0);
      return 5;
    }],
    [1, (k) => {
      // Крест из арматуры Святых
      k.box(0.25, 4, 0.25, 0x5a3424, 0, 2, 0);
      k.box(2, 0.25, 0.25, 0x5a3424, 0, 2.9, 0);
      k.box(1.2, 0.5, 1.2, 0x7a766e, 0, 0.25, 0);
      return 4;
    }],
    [1, wreck([0x4b5d2a, 0x6e6a62, 0x5b3a26])],
    [0.8, barrels],
  ],
};

// ───────────────────────── Разбитое шоссе: Дальнобои ─────────────────────────
const PINK = 0xff5fa2;

const highway: Theme = {
  density: 0.9,
  boundary: { shape: 'barrier', colors: [0xb8b4aa, 0xc8c4ba, 0xa8a49a] },
  landmark: (k) => {
    // Стоянка: вышка у заправки под неоновой вывеской
    derrick(k, 24, 0x1f4e9c, 0xc0c6cc);
    k.box(12, 0.5, 8, 0xe8e2d6, -12, 5, 0);
    for (const [x, z] of [[-17, -3], [-7, -3], [-17, 3], [-7, 3]]) k.box(0.4, 5, 0.4, METAL, x, 2.5, z);
    for (const x of [-14, -10]) {
      k.box(0.8, 1.6, 0.6, 0xc8102e, x, 0.8, 0);
      k.box(0.6, 0.4, 0.62, 0xfff2c0, x, 1.3, 0);
    }
    board(k, () => sign('СТОЯНКА', 'горючка · кофе · ремонт', '#1a0a14', '#ff5fa2', true), 9);
    return 30;
  },
  props: [
    [1.2, (k, r) => {
      // Обломок эстакады
      const len = 14 + r() * 10;
      const h = 6 + r() * 3;
      for (const z of [-len / 2 + 2, len / 2 - 2]) {
        k.box(1.5, h, 1.5, 0x9a948a, -3, h / 2, z);
        k.box(1.5, h, 1.5, 0x9a948a, 3, h / 2, z);
      }
      k.box(10, 1, len, 0x7a766e, 0, h + 0.5, 0, (r() - 0.5) * 0.15);
      k.box(10.2, 0.6, 0.3, 0xc8c4ba, 0, h + 1.3, len / 2);
      return h + 1;
    }],
    [1.2, (k, r) => {
      // Рекламный щит
      const ads: [string, string][] = [['У МАМАШИ', 'кофе 24/7 · 5 км'], ['ГОРЯЧИЙ ЭФИР', 'смотри Колесо!'], ['ШИНЫ', 'почти новые'], ['КОФЕ', 'не только кофе']];
      const [t, s] = pick(r, ads);
      const bg = pick(r, ['#1f4e9c', '#e8e2d6', '#1a0a14']);
      const fg = pick(r, ['#ff5fa2', '#f5c400', '#c8102e']);
      board(k, () => sign(t, s, bg, fg), 4);
      return 7;
    }],
    [2, wreck([0x1f4e9c, 0xc8c4ba, 0x8a8478, 0x6b3a1f])],
    [1, (k, r) => {
      // Брошенная фура
      const g = new THREE.Group();
      g.rotation.set(0, r() * 6, (r() - 0.5) * 0.2);
      k.root.add(g);
      k.box(2.6, 2.4, 2, pick(r, [0x1f4e9c, 0x7a2e1c, 0x5c6b63]), 0, 1.5, 4, 0, 0, 0, g);
      k.box(2.7, 2.8, 8, 0xb0a898, 0, 1.8, -1.5, 0, 0, 0, g);
      k.box(2.72, 0.4, 8.02, PINK, 0, 0.6, -1.5, 0, 0, 0, g);
      return 3.2;
    }],
    [1.5, (k, r) => {
      // Плита разбитого асфальта
      k.box(4 + r() * 4, 0.3, 4 + r() * 4, 0x38383c, 0, 0.1, 0, (r() - 0.5) * 0.15, r() * 3, (r() - 0.5) * 0.15);
      return 0.4;
    }],
    [1, (k, r) => {
      // Дорожный знак
      k.cyl(0.08, 0.08, 3, 5, METAL, 0, 1.5, 0, 0, 0, (r() - 0.5) * 0.4);
      k.cyl(0.7, 0.7, 0.08, 3, pick(r, [0xc8102e, 0xf5c400, 0x1f4e9c]), 0, 3.2, 0, Math.PI / 2);
      return 3.8;
    }],
    [0.8, tireStack],
  ],
};

const THEMES: Record<string, Theme> = { junkyard, saltflat, refinery, canyon, deadcity, highway };

// ───────────────────────── Свет территорий ─────────────────────────

export interface Lighting {
  hemiSky: number;
  hemiGround: number;
  hemi: number;
  sun: number;
  sunPower: number;
  fog: [number, number];
}

/** Время суток и настроение у каждой территории своё. */
export const LIGHTING: Record<string, Lighting> = {
  junkyard: { hemiSky: 0xffe6c0, hemiGround: 0x6a4a30, hemi: 1.4, sun: 0xfff0d8, sunPower: 2.2, fog: [140, 260] },
  saltflat: { hemiSky: 0xf4f6ff, hemiGround: 0xb8b0a0, hemi: 1.5, sun: 0xffffff, sunPower: 2.4, fog: [150, 280] },
  refinery: { hemiSky: 0xffb070, hemiGround: 0x3a2418, hemi: 1.1, sun: 0xff9a50, sunPower: 1.9, fog: [110, 230] },
  canyon: { hemiSky: 0xffc8a0, hemiGround: 0x6a2a18, hemi: 1.3, sun: 0xffc080, sunPower: 2.3, fog: [130, 250] },
  deadcity: { hemiSky: 0xc8ccd4, hemiGround: 0x4a4640, hemi: 1.35, sun: 0xe8e8f0, sunPower: 1.6, fog: [100, 220] },
  highway: { hemiSky: 0xffd8a0, hemiGround: 0x6a5030, hemi: 1.35, sun: 0xffd090, sunPower: 2.3, fog: [140, 270] },
};

/** Языки пламени на факелах дрожат. */
export function flicker(time: number) {
  const outer = mat(0xff6a00, { emissive: 0xff4000 }) as THREE.MeshLambertMaterial;
  const inner = mat(0xffd040, { emissive: 0xffc020 }) as THREE.MeshLambertMaterial;
  outer.emissiveIntensity = 0.8 + 0.35 * Math.sin(time * 17) * Math.sin(time * 7.3);
  inner.emissiveIntensity = 1 + 0.25 * Math.sin(time * 23 + 1);
}

// ───────────────────────── Расстановка ─────────────────────────

export function buildScenery(track: Track): THREE.Group {
  const theme = THEMES[track.def.id] ?? junkyard;
  let seed = track.def.seed * 31 + 17;
  const rnd: Rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const out = new THREE.Group();
  out.add(boundary(track, theme, rnd));

  const edge = track.width / 2 + track.shoulder;
  const dist = (x: number, z: number) => {
    const p = new THREE.Vector3(x, 0, z);
    return p.distanceTo(track.samples[track.nearest(p)].p);
  };
  // Предмет не должен закрывать трассу от камеры: проверяем тень обзора за ним
  const fits = (x: number, z: number, radius: number, h: number) => {
    if (dist(x, z) < edge + 7 + radius) return false;
    const reach = h * SHADE + radius;
    for (let s = 4; s < reach; s += 4) if (dist(x + VIEW.x * s, z + VIEW.z * s) < edge + 2) return false;
    return true;
  };

  const box = new THREE.Box3();
  for (const s of track.samples) box.expandByPoint(s.p);
  box.expandByScalar(70);
  const size = box.getSize(new THREE.Vector3());

  // Вышка-Источник: самое просторное место рядом с трассой
  const lm = new Kit();
  const lmH = theme.landmark(lm, rnd);
  let best: THREE.Vector3 | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < 260; i++) {
    const x = box.min.x + rnd() * size.x;
    const z = box.min.z + rnd() * size.z;
    const d = dist(x, z);
    if (!fits(x, z, 14, lmH)) continue;
    const score = -Math.abs(d - (edge + 26)); // ближе к трассе, но с запасом
    if (score > bestScore) {
      bestScore = score;
      best = new THREE.Vector3(x, 0, z);
    }
  }
  if (best) {
    lm.root.position.copy(best);
    // Разворачиваем лицом к камере: площадка и вывеска видны
    lm.root.rotation.y = Math.PI * 1.25;
    out.add(bake(lm.root));
  }

  // Фирменный декор
  const total = theme.props.reduce((a, [w]) => a + w, 0);
  const tries = Math.round(((size.x * size.z) / 1000) * theme.density * 4);
  const props = new Kit();
  const placed: [number, number, number][] = best ? [[best.x, best.z, 22]] : [];
  for (let i = 0; i < tries; i++) {
    const x = box.min.x + rnd() * size.x;
    const z = box.min.z + rnd() * size.z;
    let w = rnd() * total;
    const [, build] = theme.props.find(([pw]) => (w -= pw) < 0) ?? theme.props[0];
    const k = new Kit();
    const h = build(k, rnd);
    const radius = new THREE.Box3().setFromObject(k.root).getSize(new THREE.Vector3()).length() / 2;
    if (placed.some(([px, pz, pr]) => Math.hypot(x - px, z - pz) < radius + pr)) continue;
    if (!fits(x, z, radius, h)) continue;
    placed.push([x, z, radius]);
    k.root.position.set(x, 0, z);
    k.root.rotation.y = rnd() * Math.PI * 2;
    props.root.add(k.root);
  }
  // Пятна на земле: другой оттенок грунта, чтобы пустошь не была плоской заливкой
  const ground = new THREE.Color(track.def.colors.ground);
  const shades = [-0.06, -0.035, 0.03].map((l) => mat(ground.clone().offsetHSL(0, 0, l).getHex()));
  const patches = new Kit();
  for (let i = 0; i < tries * 1.5; i++) {
    const x = box.min.x + rnd() * size.x;
    const z = box.min.z + rnd() * size.z;
    const rad = 3 + rnd() * 9;
    if (dist(x, z) < edge + 2 + rad) continue;
    patches.mesh(new THREE.CircleGeometry(rad, 7), pick(rnd, shades), x, -0.04 + rnd() * 0.01, z, -Math.PI / 2, 0, rnd() * 3);
  }
  out.add(bake(props.root));
  const flat = bake(patches.root);
  flat.traverse((o) => (o.castShadow = false));
  out.add(flat);
  return out;
}

/** Граница территории за обочиной: камни, прессованные машины, отбойники или бочки. */
function boundary(track: Track, theme: Theme, rnd: Rnd) {
  const { shape, colors } = theme.boundary;
  const geo =
    shape === 'rock' ? new THREE.DodecahedronGeometry(1, 0)
    : shape === 'barrel' ? new THREE.CylinderGeometry(0.6, 0.6, 1.4, 8).translate(0, 0.7, 0)
    : shape === 'barrier' ? jersey()
    : new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const N = track.N;
  const step = shape === 'barrier' ? 3 : shape === 'barrel' ? 2 : 6;
  const count = Math.ceil(N / step) * 2 * (shape === 'barrel' ? 2 : 1);
  const inst = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ flatShading: true }), count);
  inst.castShadow = true;
  inst.receiveShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const c = new THREE.Color();
  let w = 0;
  const put = (pos: THREE.Vector3, rot: THREE.Quaternion, scale: THREE.Vector3) => {
    // Там, где трасса подходит к самой себе, граница легла бы на соседний участок
    if (pos.distanceTo(track.samples[track.nearest(pos)].p) < track.width / 2 + track.shoulder) return;
    m.compose(pos, rot, scale);
    inst.setMatrixAt(w, m);
    inst.setColorAt(w++, c.set(pick(rnd, colors)));
  };
  for (let i = 0; i < N; i += step) {
    const s = track.samples[i];
    const yaw = Math.atan2(s.t.x, s.t.z);
    for (const side of [-1, 1]) {
      const out = track.width / 2 + track.shoulder;
      if (shape === 'rock') {
        const size = 2.2 + rnd() * 2.5;
        const pos = s.p.clone().addScaledVector(s.n, side * (out + 1.5 + rnd() * 2));
        pos.y = size * 0.35;
        q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3));
        put(pos, q, new THREE.Vector3(size, size * 0.75, size));
      } else if (shape === 'box') {
        // Прессованные машины или бетонные блоки, иногда друг на друге
        const pos = s.p.clone().addScaledVector(s.n, side * (out + 2 + rnd() * 1.5));
        const h = 1.2 + rnd() * 1.2;
        q.setFromAxisAngle(up, yaw + (rnd() - 0.5) * 0.5);
        put(pos, q, new THREE.Vector3(2.4 + rnd(), h, 1.6 + rnd() * 0.6));
      } else if (shape === 'barrier') {
        const pos = s.p.clone().addScaledVector(s.n, side * (out + 1.2));
        q.setFromAxisAngle(up, yaw + (rnd() - 0.5) * 0.12);
        put(pos, q, new THREE.Vector3(1, 1, 1));
      } else {
        for (let b = 0; b < 2; b++) {
          const pos = s.p.clone().addScaledVector(s.n, side * (out + 1.5 + b * 1.3 + rnd() * 0.4));
          q.setFromAxisAngle(up, rnd() * 3);
          put(pos, q, new THREE.Vector3(1, 0.9 + rnd() * 0.2, 1));
        }
      }
    }
  }
  inst.count = w;
  return inst;
}

/** Бетонный отбойник «нью-джерси» длиной 3 м. */
function jersey() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.6, 0);
  shape.lineTo(0.6, 0);
  shape.lineTo(0.35, 0.3);
  shape.lineTo(0.2, 1.0);
  shape.lineTo(-0.2, 1.0);
  shape.lineTo(-0.35, 0.3);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: 2.9, bevelEnabled: false });
  g.translate(0, 0, -1.45);
  return g;
}

/** Склеивает неподвижный декор по материалам: сотни деталей рисуются за несколько вызовов. */
function bake(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.Material;
    let g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    if (g.index) g = g.toNonIndexed();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2));
    const list = byMat.get(mat) ?? [];
    list.push(g);
    byMat.set(mat, list);
  });
  const out = new THREE.Group();
  for (const [mat, list] of byMat) {
    const merged = mergeGeometries(list);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    out.add(mesh);
    for (const g of list) g.dispose();
  }
  return out;
}

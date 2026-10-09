import * as THREE from 'three';

/** Общие кирпичики low-poly моделей: кэш материалов, конструктор из примитивов, картинки из canvas. */
const mats = new Map<string, THREE.Material>();
export function mat(color: number, opts: { emissive?: number; transparent?: number } = {}) {
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

export const DARK = 0x221e1c;
export const TIRE = 0x1c1a19;
export const METAL = 0x8d8478;
export const CHROME = 0xc0c6cc;
export const GLASS = 0x1b2730;
export const LIGHT = 0xfff2c0;

/** Мелкий конструктор: всё добавляется в текущую группу. */
export interface CarModel {
  root: THREE.Group;
  wheels: THREE.Object3D[];
}

export class Kit {
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
export function canvasPlane(w: number, h: number, px: number, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void, emissive = false) {
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


import * as THREE from 'three';

const MARKS = 1500;

/** Следы шин на асфальте: кольцевой буфер, старые следы перезаписываются новыми. */
export class SkidMarks {
  readonly mesh: THREE.InstancedMesh;
  private next = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3(1, 1, 1);
  private up = new THREE.Vector3(0, 1, 0);
  private last = new WeakMap<object, THREE.Vector3>();

  constructor() {
    const geo = new THREE.PlaneGeometry(0.42, 1);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(
      geo,
      new THREE.MeshBasicMaterial({ color: 0x1a1512, transparent: true, opacity: 0.45, depthWrite: false }),
      MARKS,
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    for (let i = 0; i < MARKS; i++) this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0));
  }

  /** Оставить след под задними колёсами машины, если она проехала достаточно. */
  add(owner: object, pos: THREE.Vector3, heading: number, halfTrack: number, back: number) {
    const prev = this.last.get(owner);
    if (prev && prev.distanceTo(pos) < 0.7) return;
    const len = prev ? Math.min(prev.distanceTo(pos), 2) : 0.8;
    this.last.set(owner, pos.clone());
    const f = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    const r = new THREE.Vector3(f.z, 0, -f.x);
    this.q.setFromAxisAngle(this.up, heading);
    for (const side of [-1, 1]) {
      const p = pos.clone().addScaledVector(f, -back - len / 2).addScaledVector(r, side * halfTrack);
      p.y = 0.045;
      this.s.set(1, 1, len);
      this.m.compose(p, this.q, this.s);
      this.mesh.setMatrixAt(this.next, this.m);
      this.next = (this.next + 1) % MARKS;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Разорвать линию следа (машина перестала скользить). */
  lift(owner: object) {
    this.last.delete(owner);
  }

  clear() {
    for (let i = 0; i < MARKS; i++) this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0));
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Короткие вспышки света от взрывов. */
export class Flashes {
  private lights: THREE.PointLight[] = [];
  private i = 0;

  constructor(scene: THREE.Scene) {
    for (let k = 0; k < 4; k++) {
      const l = new THREE.PointLight(0xffa040, 0, 24, 1.6);
      scene.add(l);
      this.lights.push(l);
    }
  }

  flash(pos: THREE.Vector3, power: number) {
    const l = this.lights[this.i++ % this.lights.length];
    l.position.set(pos.x, 3, pos.z);
    l.intensity = 120 * power;
  }

  update(dt: number) {
    for (const l of this.lights) l.intensity *= Math.exp(-7 * dt);
  }
}

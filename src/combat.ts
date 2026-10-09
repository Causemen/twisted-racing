import * as THREE from 'three';
import { CONFIG } from './config';
import type { Car } from './car';
import type { Particles } from './particles';
import type { Obstacle, Track } from './track';

interface Bullet {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  owner: Car;
}

interface Rocket {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  life: number;
  owner: Car;
  target: Car | null;
}

interface Mine {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  age: number;
  owner: Car;
}

interface Pickup {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  cooldown: number;
}

export interface CombatEvents {
  onKill(victim: Car, killer: Car | null): void;
  onBlast(pos: THREE.Vector3, power: number): void;
  onPickup(car: Car, label: string): void;
  onSound(kind: 'gun' | 'rocket' | 'explosion', pos: THREE.Vector3): void;
}

export class Combat {
  private bullets: Bullet[] = [];
  private rockets: Rocket[] = [];
  private mines: Mine[] = [];
  private pickups: Pickup[] = [];
  private bulletGeo = new THREE.BoxGeometry(0.18, 0.18, 1.1);
  private bulletMat = new THREE.MeshBasicMaterial({ color: 0xffe080 });
  private time = 0;

  constructor(
    private scene: THREE.Scene,
    private cars: Car[],
    private particles: Particles,
    private track: Track,
    private events: CombatEvents,
  ) {
    this.spawnPickups();
  }

  setTrack(track: Track) {
    for (const p of this.pickups) this.scene.remove(p.mesh);
    this.pickups = [];
    this.track = track;
    this.spawnPickups();
  }

  reset() {
    for (const b of this.bullets) this.scene.remove(b.mesh);
    for (const r of this.rockets) this.scene.remove(r.mesh);
    for (const m of this.mines) this.scene.remove(m.mesh);
    this.bullets = [];
    this.rockets = [];
    this.mines = [];
    for (const p of this.pickups) {
      p.cooldown = 0;
      p.mesh.visible = true;
    }
    for (const o of this.track.obstacles) {
      o.alive = true;
      o.mesh.visible = true;
    }
  }

  /** Взрывоопасная бочка: взрывается от удара, пуль и соседних взрывов. */
  destroyObstacle(o: Obstacle, by: Car | null) {
    if (!o.alive || o.kind !== 'barrel') return;
    o.alive = false;
    o.mesh.visible = false;
    o.respawn = 14;
    this.blast(o.pos.clone().setY(0.8), 5, 30, by);
  }

  private hitObstacle(pos: THREE.Vector3, pad = 0): Obstacle | null {
    for (const o of this.track.obstacles) {
      if (!o.alive) continue;
      const dx = pos.x - o.pos.x;
      const dz = pos.z - o.pos.z;
      if (dx * dx + dz * dz < (o.r + pad) ** 2 && pos.y < 2.4) return o;
    }
    return null;
  }

  damage(target: Car, amount: number, source: Car | null) {
    if (!target.alive || target.invuln > 0 || amount <= 0) return;
    target.hp -= amount;
    if (source && source !== target) target.lastHitBy = source;
    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
      target.deaths++;
      target.respawnTimer = CONFIG.respawnTime;
      target.vel.set(0, 0, 0);
      target.weapon = null;
      target.ammo = 0;
      const killer = target.lastHitBy;
      if (killer && killer !== target) killer.kills++;
      const p = target.pos.clone().setY(1);
      this.particles.explosion(p, 1.3);
      this.events.onBlast(p, 1.3);
      this.events.onSound('explosion', p);
      this.events.onKill(target, killer);
    }
  }

  /** Стрельба по вводу машины. Вызывается каждый кадр. */
  handleWeapons(car: Car) {
    if (!car.alive) return;
    const f = car.forward;
    const g = CONFIG.gun;

    if (car.input.fire && !car.overheated && car.gunCooldown <= 0) {
      car.gunCooldown = 1 / g.rate;
      car.heat += g.heatPerShot;
      if (car.heat >= 1) car.overheated = true;
      let aim = car.heading;
      const t = this.findTarget(car, 40, g.aimAssist);
      if (t) aim = Math.atan2(t.pos.x - car.pos.x, t.pos.z - car.pos.z);
      const spread = (Math.random() - 0.5) * 2 * g.spread;
      const dir = new THREE.Vector3(Math.sin(aim + spread), 0, Math.cos(aim + spread));
      const pos = car.pos.clone().addScaledVector(f, 2.6).setY(car.y + 1.9);
      const mesh = new THREE.Mesh(this.bulletGeo, this.bulletMat);
      mesh.position.copy(pos);
      mesh.rotation.y = aim + spread;
      this.scene.add(mesh);
      this.bullets.push({ mesh, pos, vel: dir.multiplyScalar(g.speed).add(car.vel), life: g.life, owner: car });
      this.particles.spawn(pos, f.clone().multiplyScalar(4), 0.06, 0.45, 0xfff2b0, 0xff8020);
      this.events.onSound('gun', pos);
    }

    if (car.input.alt && car.weapon && car.ammo > 0 && car.altCooldown <= 0) {
      if (car.weapon === 'rocket') this.fireRocket(car);
      else this.dropMine(car);
      car.ammo--;
      if (car.ammo <= 0) car.weapon = null;
    }
  }

  private fireRocket(car: Car) {
    car.altCooldown = CONFIG.rocket.cooldown;
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.2, 6), new THREE.MeshLambertMaterial({ color: 0xd0d0c0 }));
    body.rotation.x = Math.PI / 2;
    mesh.add(body);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 6), new THREE.MeshLambertMaterial({ color: 0xc02010 }));
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 0.8;
    mesh.add(tip);
    const f = car.forward;
    const pos = car.pos.clone().addScaledVector(f, 2.8).setY(car.y + 1.2);
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.events.onSound('rocket', pos);
    this.rockets.push({
      mesh,
      pos,
      dir: f,
      speed: CONFIG.rocket.speed + Math.max(0, car.vel.dot(f)),
      life: CONFIG.rocket.life,
      owner: car,
      target: this.findTarget(car, 70, 0.6),
    });
  }

  private dropMine(car: Car) {
    car.altCooldown = 0.35;
    const mesh = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.3, 8), new THREE.MeshLambertMaterial({ color: 0x3a3a30 }));
    base.castShadow = true;
    mesh.add(base);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff2010 }));
    light.position.y = 0.2;
    mesh.add(light);
    const pos = car.pos.clone().addScaledVector(car.forward, -3).setY(0.15);
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.mines.push({ mesh, pos, age: 0, owner: car });
  }

  findTarget(car: Car, range: number, cone: number): Car | null {
    const f = car.forward;
    let best: Car | null = null;
    let bestScore = Infinity;
    for (const o of this.cars) {
      if (o === car || !o.alive) continue;
      const d = o.pos.clone().sub(car.pos);
      const dist = d.length();
      if (dist > range || dist < 1) continue;
      const ang = Math.acos(THREE.MathUtils.clamp(d.dot(f) / dist, -1, 1));
      if (ang > cone) continue;
      const score = dist * (1 + ang * 2);
      if (score < bestScore) {
        bestScore = score;
        best = o;
      }
    }
    return best;
  }

  private blast(pos: THREE.Vector3, radius: number, dmg: number, owner: Car | null) {
    for (const c of this.cars) {
      if (!c.alive) continue;
      const d = c.pos.distanceTo(new THREE.Vector3(pos.x, 0, pos.z));
      if (d < radius) {
        const k = 1 - (d / radius) * 0.6;
        this.damage(c, dmg * k, owner);
        const push = c.pos.clone().sub(pos).setY(0).normalize().multiplyScalar(12 * k);
        c.vel.add(push);
        c.launch(6 * k);
      }
    }
    // Цепная реакция по бочкам
    for (const o of this.track.obstacles) {
      if (o.alive && o.kind === 'barrel' && o.pos.distanceTo(new THREE.Vector3(pos.x, 0, pos.z)) < radius) {
        setTimeout(() => this.destroyObstacle(o, owner), 120);
      }
    }
    this.particles.explosion(pos, 0.8);
    this.events.onBlast(pos, 0.8);
    this.events.onSound('explosion', pos);
  }

  update(dt: number) {
    this.time += dt;
    const R = CONFIG.car.radius;

    // Пули
    this.bullets = this.bullets.filter((b) => {
      b.life -= dt;
      let hit = false;
      for (let step = 0; step < 2 && !hit; step++) {
        b.pos.addScaledVector(b.vel, dt / 2);
        for (const c of this.cars) {
          if (c === b.owner || !c.alive) continue;
          const dx = c.pos.x - b.pos.x;
          const dz = c.pos.z - b.pos.z;
          if (dx * dx + dz * dz < (R + 0.4) ** 2 && Math.abs(b.pos.y - (c.y + 1)) < 1.8) {
            this.damage(c, CONFIG.gun.damage * b.owner.gunMult, b.owner);
            this.particles.sparks(b.pos, 4);
            hit = true;
            break;
          }
        }
      }
      if (!hit) {
        const o = this.hitObstacle(b.pos);
        if (o) {
          this.particles.sparks(b.pos, 3);
          if (o.kind === 'barrel') this.destroyObstacle(o, b.owner);
          hit = true;
        }
      }
      b.mesh.position.copy(b.pos);
      if (hit || b.life <= 0) {
        this.scene.remove(b.mesh);
        return false;
      }
      return true;
    });

    // Ракеты
    this.rockets = this.rockets.filter((r) => {
      r.life -= dt;
      if (r.target && r.target.alive) {
        const want = r.target.pos.clone().sub(r.pos).setY(0).normalize();
        const ang = Math.acos(THREE.MathUtils.clamp(want.dot(r.dir), -1, 1));
        const k = Math.min(1, (CONFIG.rocket.turn * dt) / Math.max(ang, 1e-4));
        r.dir.lerp(want, k).normalize();
      }
      r.pos.addScaledVector(r.dir, r.speed * dt);
      r.mesh.position.copy(r.pos);
      r.mesh.rotation.y = Math.atan2(r.dir.x, r.dir.z);
      this.particles.spawn(r.pos, new THREE.Vector3(0, 1, 0), 0.5, 0.35, 0xffb040, 0x50483f, 2.5);

      let boom = r.life <= 0 || !!this.hitObstacle(r.pos, 0.3);
      for (const c of this.cars) {
        if (c === r.owner || !c.alive) continue;
        if (c.pos.distanceTo(new THREE.Vector3(r.pos.x, c.pos.y, r.pos.z)) < R + 0.8) boom = true;
      }
      if (boom) {
        this.blast(r.pos, CONFIG.rocket.radius, CONFIG.rocket.damage, r.owner);
        this.scene.remove(r.mesh);
        return false;
      }
      return true;
    });

    // Мины
    this.mines = this.mines.filter((m) => {
      m.age += dt;
      const armed = m.age > CONFIG.mine.armTime;
      const light = m.mesh.children[1] as THREE.Mesh;
      light.visible = !armed || Math.floor(this.time * 4) % 2 === 0;
      let boom = m.age > CONFIG.mine.life;
      if (armed) {
        for (const c of this.cars) {
          if (!c.alive || (c === m.owner && m.age < 2)) continue;
          if (c.y < 1 && c.pos.distanceTo(m.pos.clone().setY(0)) < CONFIG.mine.radius) boom = true;
        }
      }
      if (boom) {
        this.blast(m.pos, CONFIG.mine.blastRadius, CONFIG.mine.damage, m.owner);
        this.scene.remove(m.mesh);
        return false;
      }
      return true;
    });

    for (const o of this.track.obstacles) {
      if (o.alive) continue;
      o.respawn -= dt;
      if (o.respawn <= 0 && !this.cars.some((c) => c.pos.distanceTo(o.pos) < 4)) {
        o.alive = true;
        o.mesh.visible = true;
      }
    }

    // Ящики
    for (const p of this.pickups) {
      if (p.cooldown > 0) {
        p.cooldown -= dt;
        if (p.cooldown <= 0) p.mesh.visible = true;
        continue;
      }
      p.mesh.rotation.y += dt * 1.5;
      p.mesh.position.y = 1 + Math.sin(this.time * 3 + p.pos.x) * 0.2;
      for (const c of this.cars) {
        if (!c.alive) continue;
        if (c.pos.distanceTo(p.pos) < R + 1.2) {
          this.give(c);
          p.cooldown = CONFIG.pickupRespawn;
          p.mesh.visible = false;
          this.particles.sparks(p.pos.clone().setY(1), 10);
          break;
        }
      }
    }
  }

  private give(car: Car) {
    const roll = Math.random();
    let label: string;
    if (roll < 0.4) {
      car.weapon = 'rocket';
      car.ammo = 3;
      label = 'Ракеты ×3';
    } else if (roll < 0.7) {
      car.weapon = 'mine';
      car.ammo = 3;
      label = 'Мины ×3';
    } else if (roll < 0.85 && car.hp < car.maxHp) {
      car.hp = Math.min(car.maxHp, car.hp + CONFIG.repairAmount);
      label = 'Ремонт';
    } else {
      car.nitro = 1;
      label = 'Нитро';
    }
    this.events.onPickup(car, label);
  }

  private spawnPickups() {
    const geo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
    const mat = new THREE.MeshLambertMaterial({ color: 0xd08a20, emissive: 0x402000 });
    for (const idx of this.track.pickupSpots) {
      const s = this.track.samples[idx];
      for (const off of [-6, 0, 6]) {
        const pos = s.p.clone().addScaledVector(s.n, off);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos).setY(1);
        mesh.castShadow = true;
        this.scene.add(mesh);
        this.pickups.push({ mesh, pos, cooldown: 0 });
      }
    }
  }
}

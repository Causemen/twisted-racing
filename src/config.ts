// Все числа баланса в одном месте, чтобы их можно было крутить без правки логики.
export const CONFIG = {
  laps: 3,
  trackWidth: 26,
  shoulder: 14, // ширина песчаной обочины за краем трассы
  gravity: 42,
  respawnTime: 2.5,
  invulnTime: 1.5,
  pickupRespawn: 8,

  car: {
    accel: 46,
    brake: 60,
    maxSpeed: 32,
    reverseMax: 10,
    drag: 0.35,
    coastDrag: 0.9,
    grip: 9,
    driftGripLoss: 5,
    turnRate: 3.5,
    offroadSpeed: 0.62,
    offroadDrag: 1.4,
    radius: 1.3,
    hp: 100,
    nitroMult: 1.45,
    nitroDuration: 1.6,
    nitroRegen: 0.08,
    wallDamageThreshold: 14,
    ramDamageThreshold: 12,
  },

  gun: { aimAssist: 0.22, rate: 9, speed: 80, life: 0.45, damage: 3.5, spread: 0.04, heatPerShot: 0.055, coolRate: 0.4 },
  rocket: { speed: 46, life: 2.2, damage: 38, radius: 4.5, turn: 2.4, cooldown: 0.5 },
  mine: { damage: 32, radius: 2.4, blastRadius: 4, armTime: 0.6, life: 30 },
  repairAmount: 40,
};

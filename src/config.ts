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
    accel: 30,
    brake: 52,
    maxSpeed: 27, // чуть медленнее, чтобы на телефоне успевать видеть трассу
    reverseMax: 10,
    drag: 0.35,
    coastDrag: 0.9,
    grip: 8,
    driftGripLoss: 4,
    turnRate: 4, // на малой скорости
    highSpeedSteer: 0.32, // насколько руль мягче на максимальной скорости (доля)
    steerResponse: 10, // как быстро руль доходит до упора, 1/с (вес машины)
    // Управляемый дрифт: тормоз + поворот на скорости
    driftMinSpeed: 13,
    driftGrip: 2.6, // как быстро траектория догоняет нос в заносе, рад/с
    driftTurn: 1.5,
    driftMaxSlip: 0.65, // максимальный угол заноса, рад (~37°)
    driftBrake: 5, // тормоз в заносе почти не гасит скорость
    driftNitro: 0.14, // заряд нитро в секунду заноса
    offroadSpeed: 0.62,
    offroadDrag: 1.4,
    radius: 1.3,
    hp: 100,
    nitroMult: 1.45,
    nitroDuration: 1.6,
    nitroRegen: 0.08,
    wallDamageThreshold: 12,
    ramDamageThreshold: 10,
    ramPush: 1.8, // сила разлёта при столкновении машин
  },

  gun: { aimAssist: 0.22, rate: 9, speed: 80, life: 0.45, damage: 3.5, spread: 0.04, heatPerShot: 0.11, coolRate: 0.4 },
  rocket: { speed: 46, life: 6.5, damage: 38, radius: 4.5, turn: 2.4, cooldown: 0.5 },
  mine: { damage: 32, radius: 2.4, blastRadius: 4, armTime: 0.6, life: 30 },
  repairAmount: 40,
};

export type CarClassId = 'interceptor' | 'hauler' | 'flea' | 'hearse' | 'chariot' | 'pope';

export interface CarClass {
  id: CarClassId;
  label: string;
  desc: string;
  hp: number;
  speed: number; // множитель максимальной скорости
  turn: number; // множитель поворота
  mass: number; // влияет на толчки при столкновениях
  ram: number; // множитель урона от тарана
  scale: number; // размер модели
  gun: number; // множитель урона пулемёта
  startMines?: number; // мины с собой на старте
  color: number; // цвет на мини-карте
}

export const CAR_CLASSES: CarClass[] = [
  { id: 'interceptor', label: 'Ржавый Перехватчик', desc: 'Сбалансированный', hp: 100, speed: 1, turn: 1, mass: 1, ram: 1, scale: 1.7, gun: 1, color: 0xd07020 },
  { id: 'flea', label: 'Песчаная Блоха', desc: 'Быстрая и вёрткая, но хрупкая', hp: 70, speed: 1.09, turn: 1.15, mass: 0.7, ram: 0.8, scale: 1.5, gun: 1, color: 0xcfe0f0 },
  { id: 'chariot', label: 'Огненная Колесница', desc: 'Пулемёт бьёт на треть сильнее', hp: 95, speed: 1.0, turn: 1.0, mass: 1, ram: 1, scale: 1.7, gun: 1.35, color: 0xe03020 },
  { id: 'hearse', label: 'Шипастый Катафалк', desc: 'Таран бьёт вдвое сильнее', hp: 115, speed: 0.96, turn: 0.95, mass: 1.25, ram: 2, scale: 1.75, gun: 1, color: 0x8a4fc0 },
  { id: 'pope', label: 'Железный Поп', desc: 'Выезжает с запасом мин', hp: 105, speed: 0.97, turn: 0.97, mass: 1.1, ram: 1, scale: 1.7, gun: 1, startMines: 3, color: 0x6f8a3a },
  { id: 'hauler', label: 'Боевая Фура', desc: 'Много брони, тяжёлая, медленная', hp: 150, speed: 0.91, turn: 0.85, mass: 1.7, ram: 1.3, scale: 1.95, gun: 1, color: 0x3a6ad0 },
];

/** Улучшения из гаража кампании, множители поверх класса. */
export interface CarMods {
  speed: number;
  hp: number;
  turn: number;
  gun: number;
}
export const NO_MODS: CarMods = { speed: 1, hp: 1, turn: 1, gun: 1 };

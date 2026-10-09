// Кампания по лору (docs: /mnt/project-files/twisted-racing/lore/world.md, раздел 4–5):
// игрок вступает в банду, захватывает пять чужих Источников, отбивается от налётов
// и бросает вызов своему главарю. Сохранение в localStorage браузера.
import type { BotStyle } from './bot';
import type { CarClassId, CarMods } from './config';

export type GangId = 'rust' | 'salt' | 'fire' | 'rattle' | 'tnt' | 'haul';

export interface GangLines {
  intro: string; // наставник, знакомство
  mentorWin: string; // наставник, после победы
  bossBefore: string;
  bossLose: string;
  hitPlayer: string;
  killed: string;
  final: string;
}

export interface Gang {
  id: GangId;
  name: string;
  leader: string;
  cls: CarClassId;
  track: string;
  tower: string;
  color: string;
  style: BotStyle;
  members: string[];
  motto: string;
  lines: GangLines;
}

export const GANGS: Gang[] = [
  {
    id: 'rust', name: 'Ржавники', leader: 'Гайка', cls: 'interceptor', track: 'junkyard', tower: 'Старая Ворчунья', color: '#d07020', style: 'racer',
    members: ['Болт', 'Шуруп', 'Гнутый', 'Паяльник'], motto: 'Не выбросим, приварим.',
    lines: {
      intro: 'Ой, новенький! Колёса есть, руль есть, тормоза есть? Нет? Отлично, тормоза для трусов. Мамочка, поздоровайся!',
      mentorWin: 'Бублик тобой гордится! Он просто стесняется сказать, у него динамик сломан.',
      bossBefore: 'Классный у тебя карбюратор! Можно я его заберу? Ну, после.',
      bossLose: 'Ладно-ладно, вышка твоя. Но если заскрипит, зови. Починю. Наверное. Может, взорвётся.',
      hitPlayer: 'Ой! Это не я, это Мамочка!',
      killed: 'Мамочка, держи меня!',
      final: 'Ученик решил разобрать учителя на запчасти? Ну давай, посмотрим, кто кого.',
    },
  },
  {
    id: 'salt', name: 'Солевары', leader: 'Сухарь', cls: 'flea', track: 'saltflat', tower: 'Белая Игла', color: '#cfe0f0', style: 'racer',
    members: ['Пересол', 'Крупка', 'Сушёный', 'Рапа'], motto: 'Броня это лишний вес.',
    lines: {
      intro: 'Новенький. Расход горючки, судя по виду, большой. Запиши, Копейка: в долг.',
      mentorWin: 'Прибыль. Небольшая. Копейка довольна. Я нет. Я никогда.',
      bossBefore: 'Ты сжёг сорок литров, чтобы доехать сюда. Обратно не хватит.',
      bossLose: 'Вышку забирай. Соль вокруг неё моя. Счёт пришлю.',
      hitPlayer: 'Пыль глотай бесплатно. Это подарок. Последний.',
      killed: 'Убыток! Копейка, не смотри!',
      final: 'Я учил тебя считать. Посчитай, сколько у тебя шансов. Я уже посчитал.',
    },
  },
  {
    id: 'fire', name: 'Факельщики', leader: 'Леди Копоть', cls: 'chariot', track: 'refinery', tower: 'Вечный Факел', color: '#e03020', style: 'brawler',
    members: ['Огарок', 'Искра', 'Фитиль', 'Сажа'], motto: 'Пустошь, я вас не слышу!',
    lines: {
      intro: 'Ещё один фанат! Автографы после концерта. Сегодня ты на разогреве, детка!',
      mentorWin: 'Вот это соло! Пустошь, вы это слышали?! ГРОМЧЕ!',
      bossBefore: 'Добро пожаловать на мой концерт. Билет в один конец!',
      bossLose: 'Ладно, сегодня ты хедлайнер. Но бис всегда за мной.',
      hitPlayer: 'ГОРИ, ДЕТКА! Это была баллада!',
      killed: 'Это не конец, это антракт!',
      final: 'Ученик хочет забрать мою сцену? Последний концерт, детка. Прощальное турне!',
    },
  },
  {
    id: 'rattle', name: 'Гремучие', leader: 'Мотыль', cls: 'hearse', track: 'canyon', tower: 'Гнездо', color: '#8a4fc0', style: 'brawler',
    members: ['Венок', 'Саван', 'Креп', 'Лопата'], motto: 'Хороним красиво, даже врагов.',
    lines: {
      intro: 'Добро пожаловать в семью. Позвольте снять мерку. Нет-нет, это привычка.',
      mentorWin: 'Чудесная гонка. Почти никто не пострадал. Мне даже немного грустно.',
      bossBefore: 'Дуб или сосна? Спрашиваю заранее, чтобы потом не беспокоить родных.',
      bossLose: 'Какая жалость. Мерку я сохраню. Вдруг пригодится.',
      hitPlayer: 'Мои соболезнования. Искренние.',
      killed: 'Ничего страшного. У меня скидка у самого себя.',
      final: 'Я снял с вас мерку в первый же день. Простите. Работа такая.',
    },
  },
  {
    id: 'tnt', name: 'Святые Тротила', leader: 'Отец Тротил', cls: 'pope', track: 'deadcity', tower: 'Колокольня', color: '#6f8a3a', style: 'miner',
    members: ['Брат Фугас', 'Брат Запал', 'Сестра Шашка', 'Брат Детонатор'], motto: 'Всё сущее надо немного взорвать.',
    lines: {
      intro: 'Мир тебе, чадо! ЧТО? Говорю, мир тебе! Под ноги смотри. Нет, правда, смотри.',
      mentorWin: 'Аминь и бабах! Праведно проехал, громко!',
      bossBefore: 'Исповедуйся, чадо, пока есть время. На третьем круге будет поздно.',
      bossLose: 'Отпускаю тебе эту победу. И вышку отпускаю. Скрепя сердце и детонатор.',
      hitPlayer: 'БЛАГОСЛОВИЛ!',
      killed: 'Ну вот, сам себя отпел. ЧТО?',
      final: 'Блудное чадо вернулось! И, вижу, за моим креслом. Помолимся. Быстро.',
    },
  },
  {
    id: 'haul', name: 'Дальнобои', leader: 'Мамаша Люкс', cls: 'hauler', track: 'highway', tower: 'Стоянка', color: '#3a6ad0', style: 'brawler',
    members: ['Кузов', 'Прицеп', 'Солярка', 'Тягач'], motto: 'Ну привет, сладкий.',
    lines: {
      intro: 'Ну привет, сладкий. Новенький? Заходи, не стесняйся. Вовочка, отвернись.',
      mentorWin: 'Ох, какой ты быстрый. Мамаше нравятся быстрые. На дороге, Вовочка, на дороге!',
      bossBefore: 'Не бойся, сладкий. Я буду нежной. Первые два круга.',
      bossLose: 'Ммм, сильный. Забирай вышку. И заезжай как-нибудь на кофе.',
      hitPlayer: 'Прости, сладкий, не удержалась.',
      killed: 'Вот так со мной ещё никто не обращался!',
      final: 'Решил отобрать у Мамаши руль? Смелый. Мне нравится. Но я сверху.',
    },
  },
];

export const HOST = 'Жорж Блеск';
export const HOST_LINES = {
  kill: [
    'Минус один! Передайте родственникам купон на скидку!',
    'Какой таран! Отдел страхования плачет!',
    'Это была не ошибка, это был контент!',
    'Не переключайтесь, у нас тут люди горят, а у вас там ужин стынет.',
  ],
  lastLap: 'Последний круг! Делайте ставки, пока водители ещё живы!',
  raid: (gang: string, tower: string) => `Срочно в эфир! ${gang} идут отбивать вышку «${tower}». Гонка-оборона, не пропустите!`,
  raidMissed: (tower: string) => `Вышка «${tower}» простаивает. Пустошь любит нас! Ну, или боится, нам без разницы.`,
};

export function gang(id: GangId): Gang {
  return GANGS.find((g) => g.id === id)!;
}

// ---------- Состояние ----------

export type TowerState = 'none' | 'active' | 'idle';

export interface Territory {
  progress: number; // 0..2 выиграно обычных гонок, 3 = Источник захвачен
  tower: TowerState;
  bankAt: number; // время последнего сбора пассивного дохода
}

export type Upgrade = 'engine' | 'armor' | 'tires' | 'gun';

export interface CampaignState {
  v: 1;
  gang: GangId;
  fuel: number;
  upgrades: Record<Upgrade, number>;
  territories: Partial<Record<GangId, Territory>>;
  raid: GangId | null;
  finalWon: boolean;
  races: number;
}

const KEY = 'tr-campaign-v1';

export const UPGRADES: { id: Upgrade; label: string; desc: string }[] = [
  { id: 'engine', label: 'Двигатель', desc: '+2,5% к скорости' },
  { id: 'armor', label: 'Броня', desc: '+12% к прочности' },
  { id: 'tires', label: 'Шины', desc: '+5% к повороту' },
  { id: 'gun', label: 'Пулемёт', desc: '+12% к урону' },
];
export const MAX_LEVEL = 5;
export const upgradeCost = (level: number) => 120 * (level + 1);

const PLACE_FUEL = [120, 70, 35, 15];
const KILL_FUEL = 20;
const TOWER_RACE_FUEL = 20; // с каждой активной вышки за любую гонку
const TOWER_HOURLY = 12; // пассивный доход вышки в час
const TOWER_BANK_HOURS = 8; // бак вышки

export function load(): CampaignState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as CampaignState;
    return s.v === 1 ? s : null;
  } catch {
    return null;
  }
}

export function save(s: CampaignState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* без сохранения игра всё равно идёт */
  }
}

export function reset() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function newCampaign(g: GangId): CampaignState {
  const territories: Partial<Record<GangId, Territory>> = {};
  for (const x of GANGS) if (x.id !== g) territories[x.id] = { progress: 0, tower: 'none', bankAt: 0 };
  return { v: 1, gang: g, fuel: 100, upgrades: { engine: 0, armor: 0, tires: 0, gun: 0 }, territories, raid: null, finalWon: false, races: 0 };
}

export function mods(s: CampaignState): CarMods {
  const u = s.upgrades;
  return { speed: 1 + 0.025 * u.engine, hp: 1 + 0.12 * u.armor, turn: 1 + 0.05 * u.tires, gun: 1 + 0.12 * u.gun };
}

export const towersOwned = (s: CampaignState) => Object.values(s.territories).filter((t) => t!.progress >= 3).length;
export const towersActive = (s: CampaignState) => Object.values(s.territories).filter((t) => t!.tower === 'active').length;
export const finalUnlocked = (s: CampaignState) => towersOwned(s) >= 5;

/** Собрать пассивный доход с вышек. Возвращает собранное количество. */
export function collectPassive(s: CampaignState, now = Date.now()): number {
  let total = 0;
  for (const t of Object.values(s.territories)) {
    if (!t || t.tower !== 'active') continue;
    const hours = Math.min(TOWER_BANK_HOURS, (now - t.bankAt) / 3.6e6);
    const got = Math.floor(hours * TOWER_HOURLY);
    if (got > 0) {
      total += got;
      t.bankAt = now;
    }
  }
  s.fuel += total;
  return total;
}

export function buyUpgrade(s: CampaignState, u: Upgrade): boolean {
  const lvl = s.upgrades[u];
  const cost = upgradeCost(lvl);
  if (lvl >= MAX_LEVEL || s.fuel < cost) return false;
  s.fuel -= cost;
  s.upgrades[u] = lvl + 1;
  return true;
}

// ---------- Гонки ----------

export type RaceKind = 'territory' | 'boss' | 'farm' | 'defense' | 'final';

export interface Opponent {
  name: string;
  cls: CarClassId;
  style: BotStyle;
  aim: number;
  speed: number;
  lines?: { hitPlayer?: string; killed?: string; speaker: string };
}

export interface CampaignRace {
  kind: RaceKind;
  gang: GangId; // чья территория (для финала — своя банда)
  track: string;
  title: string;
  speaker: string;
  quote: string;
  opponents: Opponent[];
}

/** Какую гонку предлагает территория сейчас. */
export function nextRaceKind(s: CampaignState, g: GangId): RaceKind {
  const t = s.territories[g]!;
  if (s.raid === g) return 'defense';
  if (t.tower === 'idle') return 'defense';
  if (t.progress >= 3) return 'farm';
  if (t.progress === 2) return 'boss';
  return 'territory';
}

export function buildRace(s: CampaignState, kind: RaceKind, g: GangId): CampaignRace {
  const G = gang(g);
  const owned = towersOwned(s);
  const t = s.territories[g];
  const step = kind === 'territory' ? t?.progress ?? 0 : 2;
  const baseAim = 0.4 + step * 0.08 + owned * 0.04;
  const baseSpeed = 0.94 + step * 0.015 + owned * 0.01;
  const otherClasses: CarClassId[] = ['interceptor', 'flea', 'chariot', 'hearse', 'pope', 'hauler'];
  const member = (i: number, cls: CarClassId): Opponent => ({
    name: G.members[i % G.members.length],
    cls,
    style: G.style,
    aim: Math.min(0.9, baseAim + i * 0.03),
    speed: baseSpeed + i * 0.005,
  });
  const leader: Opponent = {
    name: G.leader,
    cls: G.cls,
    style: G.style,
    aim: Math.min(0.95, 0.72 + owned * 0.04),
    speed: 1.0 + owned * 0.008,
    lines: { hitPlayer: G.lines.hitPlayer, killed: G.lines.killed, speaker: G.leader },
  };
  const odd = otherClasses.filter((c) => c !== G.cls)[(s.races + step) % 5];
  const mentor = gang(s.gang);

  switch (kind) {
    case 'territory':
      return {
        kind, gang: g, track: G.track,
        title: `${G.name}: гонка ${step + 1} из 2`,
        speaker: mentor.leader,
        quote: step === 0 ? `Территория «${G.name}». Займи место не ниже второго, и к нам начнут прислушиваться.` : `Ещё одна гонка, и ${G.leader} выйдет сама. Или сам. Не важно, главное место не ниже второго.`,
        opponents: [member(0, G.cls), member(1, odd), member(2, G.cls)],
      };
    case 'boss':
      return {
        kind, gang: g, track: G.track,
        title: `Босс: ${G.leader}`,
        speaker: G.leader,
        quote: G.lines.bossBefore,
        opponents: [leader, member(0, G.cls), member(1, odd)],
      };
    case 'farm':
      return {
        kind, gang: g, track: G.track,
        title: `${G.name}: гонка за горючку`,
        speaker: HOST,
        quote: 'Повтор на бис! Зрители обожают, когда кто-то горит второй раз на той же трассе.',
        opponents: [member(0, G.cls), member(1, odd), member(2, G.cls)],
      };
    case 'defense':
      return {
        kind, gang: g, track: G.track,
        title: `Оборона вышки «${G.tower}»`,
        speaker: HOST,
        quote: t?.tower === 'idle' ? `Вышка «${G.tower}» стоит без дела. Выиграй гонку, и она снова твоя.` : HOST_LINES.raid(G.name, G.tower) + ' Нужна только победа.',
        opponents: [member(0, G.cls), member(1, G.cls), member(2, odd)],
      };
    case 'final':
      return {
        kind, gang: s.gang, track: mentor.track,
        title: `Вызов: ${mentor.leader}`,
        speaker: mentor.leader,
        quote: mentor.lines.final,
        opponents: [{ ...leader, name: mentor.leader, cls: mentor.cls, style: mentor.style, aim: 0.9, speed: 1.03, lines: { hitPlayer: mentor.lines.hitPlayer, killed: mentor.lines.killed, speaker: mentor.leader } }],
      };
  }
}

export interface RaceOutcome {
  won: boolean; // выполнено условие гонки
  fuel: { label: string; amount: number }[];
  speaker: string;
  quote: string;
  news: string[]; // объявления Жоржа: налёты, простои, захваты
}

/** Применить итог гонки к сохранению. place начинается с 1. */
export function applyResult(s: CampaignState, race: CampaignRace, place: number, kills: number): RaceOutcome {
  const G = gang(race.gang);
  const mentor = gang(s.gang);
  const fuel: { label: string; amount: number }[] = [];
  const news: string[] = [];
  fuel.push({ label: `${place}-е место`, amount: PLACE_FUEL[Math.min(place, PLACE_FUEL.length) - 1] });
  if (kills) fuel.push({ label: `Уничтожения ×${kills}`, amount: kills * KILL_FUEL });
  const active = towersActive(s);
  if (active) fuel.push({ label: `Вышки ×${active}`, amount: active * TOWER_RACE_FUEL });

  const t = s.territories[race.gang];
  let won = false;
  let speaker = mentor.leader;
  let quote = '';
  switch (race.kind) {
    case 'territory':
      won = place <= 2;
      if (won && t) t.progress = Math.min(2, t.progress + 1);
      quote = won ? mentor.lines.mentorWin : 'Не беда. Подкрути машину в гараже и попробуй ещё раз.';
      break;
    case 'boss':
      won = place === 1;
      if (won && t) {
        t.progress = 3;
        t.tower = 'active';
        t.bankAt = Date.now();
        speaker = G.leader;
        quote = G.lines.bossLose;
        news.push(`Источник «${G.tower}» теперь твой. Он приносит горючку за каждую гонку и понемногу копит её, пока тебя нет.`);
      } else quote = 'Босса берут только первым местом. Ещё попытка?';
      break;
    case 'farm':
      won = true;
      quote = mentor.lines.mentorWin;
      break;
    case 'defense':
      won = place === 1;
      if (t) {
        if (won) {
          if (t.tower === 'idle') t.bankAt = Date.now();
          t.tower = 'active';
          news.push(`Вышка «${G.tower}» отбита и снова качает горючку.`);
        } else {
          t.tower = 'idle';
          news.push(HOST_LINES.raidMissed(G.tower));
        }
      }
      if (s.raid === race.gang) s.raid = null;
      quote = won ? mentor.lines.mentorWin : 'Вышку не потеряли, просто она встала. Отобьёшь, когда будешь готов.';
      break;
    case 'final':
      won = place === 1;
      if (won) s.finalWon = true;
      speaker = mentor.leader;
      quote = won ? `Ладно. Ты главарь «${mentor.name}». Только не зазнавайся.` : 'Рановато ты на меня полез. Возвращайся, когда подрастёшь.';
      break;
  }

  for (const f of fuel) s.fuel += f.amount;
  s.races++;

  // Налёт на одну из активных вышек
  if (!s.raid && race.kind !== 'final') {
    const targets = (Object.keys(s.territories) as GangId[]).filter((id) => s.territories[id]!.tower === 'active' && id !== race.gang);
    if (targets.length && Math.random() < 0.3) {
      s.raid = targets[Math.floor(Math.random() * targets.length)];
      const R = gang(s.raid);
      news.push(HOST_LINES.raid(R.name, R.tower) + ' Если поедешь в другую гонку, вышка встанет.');
    }
  }
  save(s);
  return { won, fuel, speaker, quote, news };
}

/** Старт гонки: пропущенный налёт останавливает вышку. Возвращает новость или null. */
export function onRaceStart(s: CampaignState, race: CampaignRace | null): string | null {
  if (!s.raid || (race && race.kind === 'defense' && race.gang === s.raid)) return null;
  const R = gang(s.raid);
  const t = s.territories[s.raid];
  if (t) t.tower = 'idle';
  s.raid = null;
  save(s);
  return HOST_LINES.raidMissed(R.tower);
}

/** Доход вышек за быструю гонку (по лору — за любую гонку). */
export function quickRaceIncome(s: CampaignState): number {
  const amount = towersActive(s) * TOWER_RACE_FUEL;
  s.fuel += amount;
  save(s);
  return amount;
}

import type { BotStyle } from './bot';
import type { CarClassId, CarMods } from './config';

export interface RaceEntry {
  name: string;
  cls: CarClassId;
  isPlayer?: boolean;
  style?: BotStyle;
  aim?: number;
  speed?: number;
  mods?: CarMods;
  lines?: { hitPlayer?: string; killed?: string; speaker: string };
}

export interface RaceConfig {
  track: string;
  entries: RaceEntry[]; // первый — игрок
  laps: number;
}

export interface Standing {
  name: string;
  color: number;
  isPlayer: boolean;
  finished: boolean;
  time: number;
  kills: number;
}

export interface RaceResult {
  place: number;
  kills: number;
  time: number;
  standings: Standing[];
}

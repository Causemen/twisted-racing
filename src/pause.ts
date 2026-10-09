// Пауза в гонке и настройки (звук, вибрация, размер кнопок, режим для левши).
import { isMuted, toggleMute } from './audio';

type BtnSize = 's' | 'm' | 'l';
export interface Settings {
  vibro: boolean;
  btn: BtnSize;
  lefty: boolean;
}

const KEY = 'rm-settings-v1';
const DEFAULTS: Settings = { vibro: true, btn: 'm', lefty: false };

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings: Settings = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* приватный режим: настройки живут до перезагрузки */
  }
}

export function applySettings() {
  const b = document.body.classList;
  b.toggle('lefty', settings.lefty);
  b.remove('btn-s', 'btn-m', 'btn-l');
  b.add(`btn-${settings.btn}`);
}

/** Короткая вибрация на телефоне, если игрок её не выключил. */
export function buzz(pattern: number | number[]) {
  if (settings.vibro) navigator.vibrate?.(pattern);
}

const HOST_PAUSE = [
  'Рекламная пауза! Не переключайтесь, после рекламы кого-нибудь взорвут.',
  'Пауза. Гонщики курят, механики молятся, зрители делают ставки.',
  'Перерыв на рекламу горючки. Горючка: пахнет как победа, горит как надежда.',
];

const $ = (id: string) => document.getElementById(id)!;

export class Pause {
  open = false;
  private inRace = false;

  constructor(private onResume: () => void, private onQuit: () => void, private onMute: () => void) {
    applySettings();
    const root = $('pause');
    root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-p]');
      if (!el) return;
      const act = el.dataset.p!;
      if (act === 'resume') this.close();
      else if (act === 'quit') {
        this.close(false);
        this.onQuit();
      } else if (act === 'sound') {
        toggleMute();
        this.onMute();
      } else if (act === 'vibro') {
        settings.vibro = !settings.vibro;
        if (settings.vibro) navigator.vibrate?.(40);
      } else if (act === 'lefty') settings.lefty = !settings.lefty;
      else if (act.startsWith('btn-')) settings.btn = act.slice(4) as BtnSize;
      save();
      applySettings();
      this.render();
    });
  }

  /** inRace: пауза в гонке (продолжить/выйти); иначе только настройки из меню. */
  show(inRace: boolean) {
    this.inRace = inRace;
    this.open = true;
    this.render();
    $('pause').hidden = false;
  }

  close(resume = true) {
    if (!this.open) return;
    this.open = false;
    $('pause').hidden = true;
    if (resume && this.inRace) this.onResume();
  }

  private render() {
    const on = (v: boolean) => (v ? 'вкл' : 'выкл');
    const touch = document.body.classList.contains('touch');
    const size = (id: BtnSize, label: string) => `<button type="button" class="seg${settings.btn === id ? ' on' : ''}" data-p="btn-${id}">${label}</button>`;
    const line = HOST_PAUSE[Math.floor(Math.random() * HOST_PAUSE.length)];
    $('pause-box').innerHTML = `
      <h2>${this.inRace ? 'Пауза' : 'Настройки'}</h2>
      ${this.inRace ? `<p class="pause-host"><b>Жорж Блеск:</b> ${line}</p>` : ''}
      <div class="opts">
        <button type="button" class="opt" data-p="sound"><span>Звук</span><b>${on(!isMuted())}</b></button>
        ${touch ? `<button type="button" class="opt" data-p="vibro"><span>Вибрация</span><b>${on(settings.vibro)}</b></button>
        <div class="opt"><span>Кнопки</span><span class="segs">${size('s', 'Мелкие')}${size('m', 'Средние')}${size('l', 'Крупные')}</span></div>
        <button type="button" class="opt" data-p="lefty"><span>Режим для левши</span><b>${on(settings.lefty)}</b></button>` : ''}
      </div>
      ${touch && settings.lefty ? '<p class="muted small">Руль справа, ОГОНЬ слева.</p>' : ''}
      <div class="row">${
        this.inRace
          ? '<button type="button" class="go" data-p="resume">Продолжить</button><button type="button" class="btn2" data-p="quit">Выйти из гонки</button>'
          : '<button type="button" class="go" data-p="resume">Готово</button>'
      }</div>`;
  }
}

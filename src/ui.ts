// Экраны вне гонки: главное меню, быстрая гонка, кампания (банды, карта, гараж, итоги).
import { CAR_CLASSES, CONFIG, type CarClassId } from './config';
import { TRACKS } from './track';
import type { RaceConfig, RaceResult } from './race';
import type { BotStyle } from './bot';
import * as C from './campaign';

const $ = (id: string) => document.getElementById(id)!;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const cls = (id: CarClassId) => CAR_CLASSES.find((c) => c.id === id)!;
const trackLabel = (id: string) => TRACKS.find((t) => t.id === id)?.label ?? id;

function fmtTime(t: number) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

const QUICK_BOTS: { name: string; style: BotStyle; aim: number; speed: number }[] = [
  { name: 'Бешеный Пёс', style: 'brawler', aim: 0.7, speed: 0.97 },
  { name: 'Ржавая Вдова', style: 'racer', aim: 0.5, speed: 1.0 },
  { name: 'Поп-Минёр', style: 'miner', aim: 0.4, speed: 0.95 },
];

const KEYS_HTML = `<div class="keys">
  <div><kbd>WASD</kbd> или стрелки — руль, газ, тормоз</div>
  <div><kbd>Пробел</kbd>, <kbd>X</kbd> или левая кнопка мыши — пулемёт (следи за перегревом)</div>
  <div><kbd>Shift</kbd> — ракеты или мины, <kbd>E</kbd> — нитро, <kbd>M</kbd> — звук, <kbd>Esc</kbd> — выйти из гонки</div>
  <div>На телефоне газ автоматический. Левый палец ведёт стик (влево-вправо руль, вниз тормоз), правый жмёт ОГОНЬ, ракеты и нитро; между кнопками можно скользить, не отрывая палец.</div>
</div>`;

type Mode = { kind: 'quick' } | { kind: 'campaign'; race: C.CampaignRace };

export class Ui {
  private quickTrack = TRACKS[0].id;
  private quickClass: CarClassId = 'interceptor';
  private mode: Mode = { kind: 'quick' };
  private state: C.CampaignState | null = C.load();

  constructor(private start: (cfg: RaceConfig) => void) {}

  private show(html: string) {
    $('screen').innerHTML = html;
    $('screen').scrollTop = 0;
    $('overlay').hidden = false;
    $('hud').hidden = true;
  }

  private on(sel: string, fn: (el: HTMLElement) => void) {
    $('screen').querySelectorAll<HTMLElement>(sel).forEach((el) => el.addEventListener('click', () => fn(el)));
  }

  private quote(speaker: string, text: string) {
    return `<figure class="quote"><blockquote>«${esc(text)}»</blockquote><figcaption>${esc(speaker)}</figcaption></figure>`;
  }

  // ---------- Главное меню ----------

  main() {
    const s = this.state;
    const cont = s ? `Продолжить кампанию <small>${esc(C.gang(s.gang).name)} · ${C.towersOwned(s)}/5 вышек</small>` : 'Кампания <small>Вступи в банду и захвати пустошь</small>';
    this.show(`
      <h1>TWISTED RACING</h1>
      <p class="muted">Шесть банд, шесть Источников, одно правило Колеса: стрелять можно, сходить с трассы нельзя.</p>
      <div class="menu">
        <button type="button" class="big" data-act="campaign">${cont}</button>
        <button type="button" class="big alt" data-act="quick">Быстрая гонка <small>Любая трасса, любая машина</small></button>
      </div>
      ${KEYS_HTML}
      <p class="ver">Версия 0.6</p>`);
    this.on('[data-act="campaign"]', () => (this.state ? this.map() : this.gangSelect()));
    this.on('[data-act="quick"]', () => this.quickSetup());
  }

  // ---------- Быстрая гонка ----------

  private quickSetup() {
    const bar = (label: string, v: number) => `<div class="stat"><span>${label}</span><i style="--v:${Math.round(Math.max(0.05, Math.min(1, v)) * 100)}%"></i></div>`;
    this.show(`
      <div class="head"><button type="button" class="back" data-act="back">← Меню</button><h2>Быстрая гонка</h2></div>
      <h3>Трасса</h3>
      <div class="grid2" id="trk">${TRACKS.map((t) => `<button type="button" class="trk" data-id="${t.id}"><b>${t.label}</b><small>${t.desc}</small></button>`).join('')}</div>
      <h3>Машина</h3>
      <div class="grid2" id="car">${CAR_CLASSES.map(
        (c) => `<button type="button" class="car" data-id="${c.id}" style="--car:${hex(c.color)}"><b>${c.label}</b><small>${c.desc}</small>
          ${bar('Броня', c.hp / 150)}${bar('Скорость', (c.speed - 0.8) / 0.3)}${bar('Руль', (c.turn - 0.7) / 0.45)}${bar('Таран', c.ram / 2)}</button>`,
      ).join('')}</div>
      <button type="button" class="go" data-act="go">Старт</button>`);
    const sync = () => {
      $('screen').querySelectorAll<HTMLElement>('.trk').forEach((b) => b.classList.toggle('on', b.dataset.id === this.quickTrack));
      $('screen').querySelectorAll<HTMLElement>('.car').forEach((b) => b.classList.toggle('on', b.dataset.id === this.quickClass));
    };
    this.on('.trk', (b) => ((this.quickTrack = b.dataset.id!), sync()));
    this.on('.car', (b) => ((this.quickClass = b.dataset.id as CarClassId), sync()));
    this.on('[data-act="back"]', () => this.main());
    this.on('[data-act="go"]', () => this.startQuick());
    sync();
  }

  private startQuick() {
    const others = CAR_CLASSES.filter((c) => c.id !== this.quickClass).sort(() => Math.random() - 0.5);
    const news = this.state ? C.onRaceStart(this.state, null) : null;
    if (news) this.pendingNews.push(news);
    this.mode = { kind: 'quick' };
    this.start({
      track: this.quickTrack,
      laps: CONFIG.laps,
      entries: [
        { name: 'Ты', cls: this.quickClass, isPlayer: true, mods: this.state ? C.mods(this.state) : undefined },
        ...QUICK_BOTS.map((b, i) => ({ ...b, cls: others[i].id })),
      ],
    });
  }

  private pendingNews: string[] = [];

  // ---------- Итоги ----------

  finished(r: RaceResult) {
    if (this.mode.kind === 'campaign' && this.state) return this.campaignResult(this.mode.race, r);
    const income = this.state ? C.quickRaceIncome(this.state) : 0;
    const news = this.pendingNews.splice(0);
    this.show(`
      <h2>Результаты</h2>
      ${this.table(r)}
      ${income ? `<p class="muted">Вышки принесли ${income} л горючки.</p>` : ''}
      ${news.map((n) => this.quote(C.HOST, n)).join('')}
      <div class="row"><button type="button" class="go" data-act="again">Ещё заезд</button><button type="button" class="btn2" data-act="menu">Меню</button></div>`);
    this.on('[data-act="again"]', () => this.startQuick());
    this.on('[data-act="menu"]', () => this.main());
  }

  aborted() {
    if (this.mode.kind === 'campaign') this.map();
    else this.quickSetup();
  }

  private table(r: RaceResult) {
    const rows = r.standings
      .map((c, i) => `<tr class="${c.isPlayer ? 'me' : ''}"><td>${i + 1}</td><td><i class="dot" style="background:${hex(c.color)}"></i>${esc(c.name)}</td><td>${c.finished ? fmtTime(c.time) : '—'}</td><td>${c.kills}</td></tr>`)
      .join('');
    return `<div class="tbl"><table><thead><tr><th>#</th><th>Гонщик</th><th>Время</th><th>Убийства</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  // ---------- Кампания ----------

  private gangSelect() {
    this.show(`
      <div class="head"><button type="button" class="back" data-act="back">← Меню</button><h2>Выбери банду</h2></div>
      <p class="muted">Ты новичок без имени. Главарь банды станет наставником и даст машину. Свой Источник ты не захватываешь, остальные пять придётся брать гонками.</p>
      <div class="grid2">${C.GANGS.map((g) => {
        const k = cls(g.cls);
        return `<button type="button" class="gang" data-id="${g.id}" style="--car:${g.color}">
          <b>${g.name}</b><small>Главарь: ${g.leader}</small><small>Машина: ${k.label}</small><small>Территория: ${trackLabel(g.track)}</small><em>«${g.motto}»</em></button>`;
      }).join('')}</div>`);
    this.on('[data-act="back"]', () => this.main());
    this.on('.gang', (b) => {
      const g = C.gang(b.dataset.id as C.GangId);
      this.show(`
        <h2>${esc(g.name)}</h2>
        ${this.quote(g.leader, g.lines.intro)}
        <p class="muted">Твоя машина: ${cls(g.cls).label}. Захвати пять чужих Источников, и по закону Колеса сможешь бросить вызов самому главарю.</p>
        <div class="row"><button type="button" class="go" data-act="join">Вступить</button><button type="button" class="btn2" data-act="back">Назад</button></div>`);
      this.on('[data-act="join"]', () => {
        this.state = C.newCampaign(g.id);
        C.save(this.state);
        this.map();
      });
      this.on('[data-act="back"]', () => this.gangSelect());
    });
  }

  private map() {
    const s = this.state!;
    const passive = C.collectPassive(s);
    C.save(s);
    const mine = C.gang(s.gang);
    const terr = (Object.keys(s.territories) as C.GangId[]).map((id) => {
      const g = C.gang(id);
      const t = s.territories[id]!;
      const kind = C.nextRaceKind(s, id);
      const pips = [0, 1, 2].map((i) => `<i class="${t.progress > i ? 'done' : ''}${i === 2 ? ' boss' : ''}"></i>`).join('');
      const status =
        s.raid === id ? '<span class="tag warn">Налёт!</span>' : t.tower === 'active' ? '<span class="tag ok">Вышка твоя</span>' : t.tower === 'idle' ? '<span class="tag bad">Простой</span>' : '';
      const label = { territory: `Гонка ${t.progress + 1}`, boss: `Босс: ${g.leader}`, farm: 'Гонка за горючку', defense: s.raid === id ? 'Гонка-оборона' : 'Отбить вышку', final: '' }[kind];
      return `<div class="terr" style="--car:${g.color}">
        <div><b>${g.name}</b> ${status}<small>${trackLabel(g.track)} · вышка «${g.tower}»</small><div class="pips">${pips}</div></div>
        <button type="button" class="${kind === 'defense' || kind === 'boss' ? 'go sm' : 'btn2 sm'}" data-race="${id}">${label}</button></div>`;
    });
    const fin = C.finalUnlocked(s)
      ? `<div class="terr final" style="--car:${mine.color}"><div><b>Вызов наставнику</b><small>${mine.leader}, ${trackLabel(mine.track)}, один на один</small></div>
         <button type="button" class="go sm" data-final="1">${s.finalWon ? 'Ещё раз' : 'Бросить вызов'}</button></div>`
      : `<p class="muted small">Вызов наставнику откроется после пяти захваченных Источников.</p>`;
    const raidBanner = s.raid ? this.quote(C.HOST, C.HOST_LINES.raid(C.gang(s.raid).name, C.gang(s.raid).tower) + ' Если поедешь в другую гонку, вышка встанет.') : '';
    this.show(`
      <div class="head"><button type="button" class="back" data-act="menu">← Меню</button><h2>Пустошь</h2></div>
      <div class="bank"><span>Горючка <b>${s.fuel} л</b></span><span>Вышки <b>${C.towersOwned(s)}/5</b></span><span>Банда <b style="color:${mine.color}">${mine.name}</b></span></div>
      ${passive ? `<p class="muted small">Пока тебя не было, вышки накачали ${passive} л.</p>` : ''}
      ${s.finalWon ? this.quote(mine.leader, `Ты теперь главарь «${mine.name}». Кстати, тебе письмо из Шпиля. Пахнет неприятностями.`) : ''}
      ${raidBanner}
      <div class="terrs">${terr.join('')}${fin}</div>
      <div class="row"><button type="button" class="btn2" data-act="garage">Гараж</button><button type="button" class="btn2 danger" data-act="reset">Начать заново</button></div>`);
    this.on('[data-act="menu"]', () => this.main());
    this.on('[data-act="garage"]', () => this.garage());
    this.on('[data-act="reset"]', (b) => {
      if (b.dataset.sure) {
        C.reset();
        this.state = null;
        this.gangSelect();
      } else {
        b.dataset.sure = '1';
        b.textContent = 'Точно стереть прогресс?';
      }
    });
    this.on('[data-race]', (b) => {
      const id = b.dataset.race as C.GangId;
      this.preRace(C.buildRace(s, C.nextRaceKind(s, id), id));
    });
    this.on('[data-final]', () => this.preRace(C.buildRace(s, 'final', s.gang)));
  }

  private preRace(race: C.CampaignRace) {
    const s = this.state!;
    const opp = race.opponents.map((o) => `<li><i class="dot" style="background:${hex(cls(o.cls).color)}"></i>${esc(o.name)} <small>${cls(o.cls).label}</small></li>`).join('');
    const goal = { territory: 'Нужно место не ниже второго.', boss: 'Нужна победа.', farm: 'Просто заработай горючки.', defense: 'Нужна победа, иначе вышка встанет.', final: 'Один на один. Нужна победа.' }[race.kind];
    const warn = s.raid && !(race.kind === 'defense' && race.gang === s.raid) ? `<p class="warn-text">Налёт на вышку «${C.gang(s.raid).tower}» останется без ответа, и вышка встанет.</p>` : '';
    this.show(`
      <h2>${esc(race.title)}</h2>
      <p class="muted">${trackLabel(race.track)} · ${goal}</p>
      ${this.quote(race.speaker, race.quote)}
      <h3>Соперники</h3><ul class="opp">${opp}</ul>
      ${warn}
      <div class="row"><button type="button" class="go" data-act="go">Поехали</button><button type="button" class="btn2" data-act="back">На карту</button></div>`);
    this.on('[data-act="back"]', () => this.map());
    this.on('[data-act="go"]', () => {
      const news = C.onRaceStart(s, race);
      if (news) this.pendingNews.push(news);
      this.mode = { kind: 'campaign', race };
      const mine = C.gang(s.gang);
      this.start({
        track: race.track,
        laps: CONFIG.laps,
        entries: [{ name: 'Ты', cls: mine.cls, isPlayer: true, mods: C.mods(s) }, ...race.opponents.map((o) => ({ ...o }))],
      });
    });
  }

  private campaignResult(race: C.CampaignRace, r: RaceResult) {
    const s = this.state!;
    const out = C.applyResult(s, race, r.place, r.kills);
    const total = out.fuel.reduce((a, f) => a + f.amount, 0);
    const news = [...this.pendingNews.splice(0), ...out.news];
    const finalWin = race.kind === 'final' && out.won;
    this.show(`
      <h2>${finalWin ? 'Хозяин пустоши' : out.won ? 'Победа' : 'Не вышло'}</h2>
      ${this.table(r)}
      <div class="fuel">${out.fuel.map((f) => `<div><span>${esc(f.label)}</span><b>+${f.amount}</b></div>`).join('')}<div class="sum"><span>Итого</span><b>+${total} л</b></div></div>
      ${this.quote(out.speaker, out.quote)}
      ${finalWin ? this.quote(C.HOST, 'Поздравляем нового хозяина пустоши! Шпиль ждёт вас на приём. Налог на эфир с завтрашнего дня сто процентов, но это мелочи.') : ''}
      ${news.map((n) => this.quote(C.HOST, n)).join('')}
      <div class="row"><button type="button" class="go" data-act="map">На карту</button><button type="button" class="btn2" data-act="garage">Гараж</button></div>`);
    this.on('[data-act="map"]', () => this.map());
    this.on('[data-act="garage"]', () => this.garage());
  }

  private garage() {
    const s = this.state!;
    const k = cls(C.gang(s.gang).cls);
    const m = C.mods(s);
    const rows = C.UPGRADES.map((u) => {
      const lvl = s.upgrades[u.id];
      const cost = C.upgradeCost(lvl);
      const max = lvl >= C.MAX_LEVEL;
      const pips = Array.from({ length: C.MAX_LEVEL }, (_, i) => `<i class="${i < lvl ? 'done' : ''}"></i>`).join('');
      return `<div class="upg"><div><b>${u.label}</b><small>${u.desc}</small><div class="pips">${pips}</div></div>
        <button type="button" class="${max ? 'btn2' : 'go'} sm" data-up="${u.id}" ${max || s.fuel < cost ? 'disabled' : ''}>${max ? 'Максимум' : `${cost} л`}</button></div>`;
    }).join('');
    this.show(`
      <div class="head"><button type="button" class="back" data-act="map">← Карта</button><h2>Гараж</h2></div>
      <div class="bank"><span>Горючка <b>${s.fuel} л</b></span><span>Машина <b>${k.label}</b></span></div>
      <p class="muted small">Броня ${Math.round(k.hp * m.hp)} · скорость ×${(k.speed * m.speed).toFixed(2)} · руль ×${(k.turn * m.turn).toFixed(2)} · пулемёт ×${(k.gun * m.gun).toFixed(2)}</p>
      <div class="upgs">${rows}</div>`);
    this.on('[data-act="map"]', () => this.map());
    this.on('[data-up]', (b) => {
      if (C.buyUpgrade(s, b.dataset.up as C.Upgrade)) {
        C.save(s);
        this.garage();
      }
    });
  }
}

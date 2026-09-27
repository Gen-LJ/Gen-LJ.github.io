/* Kaung L Joy · portfolio
   The arcane bits: loading screen, sky, tooltips, XP, achievements, chat and sounds.
   A classic script (not a module), so the page also works when opened straight from disk. */
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };
  const session = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };

  let calm = root.classList.contains('calm');
  const wideScreen = matchMedia('(min-width: 1200px)');

  const EMAIL = 'kaungljoy@gmail.com';
  const CAREER_START = new Date('2023-06-01T09:00:00+06:30'); // first day as a mobile developer
  const LEVEL_START = new Date('2025-04-01T09:00:00+06:30');  // Senior Mobile Developer at UMG

  /* ------------------------------------------------------------ sound (synthesised, off by default) */
  const Sound = (() => {
    let ctx = null;
    let on = store.get('klj-sound') === 'on';
    const listeners = [];

    function audio() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function tone(freq, { type = 'sine', at = 0, dur = 0.2, vol = 0.05, to = 0, attack = 0.006 } = {}) {
      const c = audio();
      if (!c) return;
      const t = c.currentTime + at;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }

    function hiss({ at = 0, dur = 0.22, vol = 0.05, freq = 2200 } = {}) {
      const c = audio();
      if (!c) return;
      const len = Math.floor(c.sampleRate * dur);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource();
      src.buffer = buf;
      const filter = c.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq;
      filter.Q.value = 0.8;
      const gain = c.createGain();
      gain.gain.value = vol;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(c.destination);
      src.start(c.currentTime + at);
    }

    const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, G4 = 392;
    const sfx = {
      click: () => tone(640, { type: 'triangle', dur: 0.07, vol: 0.035 }),
      open: () => { hiss({ dur: 0.22, vol: 0.05, freq: 2400 }); tone(420, { type: 'triangle', dur: 0.12, vol: 0.02, at: 0.02 }); },
      close: () => hiss({ dur: 0.16, vol: 0.04, freq: 1400 }),
      coin: () => { tone(1568, { type: 'square', dur: 0.07, vol: 0.018 }); tone(2093, { type: 'square', dur: 0.18, vol: 0.018, at: 0.06 }); },
      discover: () => [C5, G5].forEach((f, i) => tone(f, { type: 'triangle', dur: 0.5, vol: 0.03, at: i * 0.12 })),
      achievement: () => [C5, E5, G5, C6].forEach((f, i) => tone(f, { type: 'triangle', dur: 0.6, vol: 0.045, at: i * 0.09 })),
      levelup: () => {
        [G4, C5, E5, G5, C6].forEach((f, i) => tone(f, { type: 'sawtooth', dur: 0.35, vol: 0.022, at: i * 0.08 }));
        [C5, E5, G5].forEach((f) => tone(f, { type: 'triangle', dur: 1.6, vol: 0.04, at: 0.45 }));
      },
      whisper: () => tone(880, { type: 'sine', dur: 0.25, vol: 0.03, to: 1320 }),
      error: () => tone(160, { type: 'sawtooth', dur: 0.18, vol: 0.03 }),
      yell: () => { tone(220, { type: 'sawtooth', dur: 0.6, vol: 0.035, to: 330 }); tone(110, { type: 'square', dur: 0.6, vol: 0.02 }); },
    };

    return {
      get on() { return on; },
      set(value) {
        on = value;
        store.set('klj-sound', on ? 'on' : 'off');
        if (on) audio();
        listeners.forEach((fn) => fn(on));
      },
      toggle() {
        this.set(!on);
        if (on) sfx.click();
        return on;
      },
      play(name) {
        if (!on || !sfx[name]) return;
        try { sfx[name](); } catch (e) { /* audio is decoration */ }
      },
      onChange(fn) { listeners.push(fn); fn(on); },
    };
  })();

  /* ------------------------------------------------------------ small UI helpers */
  const uimsgEl = $('.uimsg');
  function uiMessage(text, isError = false) {
    if (!uimsgEl) return;
    const p = document.createElement('p');
    p.textContent = text;
    if (isError) p.className = 'is-error';
    uimsgEl.replaceChildren(p);
    setTimeout(() => p.remove(), 2700);
  }

  const zoneEl = $('.zonetext');
  function zoneText(name, sub) {
    if (!zoneEl || calm) return;
    $('.zonetext__name', zoneEl).textContent = name;
    $('.zonetext__sub', zoneEl).textContent = sub;
    zoneEl.classList.remove('is-on');
    void zoneEl.offsetWidth;
    zoneEl.classList.add('is-on');
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function playedParts(from, to = new Date()) {
    let s = Math.max(0, Math.floor((to - from) / 1000));
    const days = Math.floor(s / 86400); s -= days * 86400;
    const hours = Math.floor(s / 3600); s -= hours * 3600;
    const minutes = Math.floor(s / 60); s -= minutes * 60;
    return { days, hours, minutes, seconds: s };
  }
  function formatPlayed(from) {
    const p = playedParts(from);
    const n = (v, word) => `${v.toLocaleString('en-US')} ${word}${v === 1 ? '' : 's'}`;
    return `${n(p.days, 'day')}, ${n(p.hours, 'hour')}, ${n(p.minutes, 'minute')}, ${n(p.seconds, 'second')}`;
  }

  /* ------------------------------------------------------------ chat */
  const chat = (() => {
    const box = $('.chat');
    const tab = $('.chat__tab');
    const panel = $('#chat-panel');
    const logEl = $('.chat__log');
    const form = $('.chat__form');
    const input = $('#chat-input');
    const unreadEl = $('.chat__unread');
    let unread = 0;
    let open = false;
    const history = [];
    let histIdx = -1;

    function log(text, kind = 'system') {
      if (!logEl) return;
      const p = document.createElement('p');
      p.className = `chat__line chat__line--${kind}`;
      p.textContent = text;
      logEl.appendChild(p);
      while (logEl.children.length > 80) logEl.firstChild.remove();
      logEl.scrollTop = logEl.scrollHeight;
      if (!open && unreadEl) {
        unread += 1;
        unreadEl.textContent = unread > 9 ? '9+' : String(unread);
        unreadEl.hidden = false;
      }
    }

    function setOpen(value, prefill = '') {
      if (!box) return;
      open = value;
      panel.hidden = !open;
      tab.setAttribute('aria-expanded', String(open));
      if (open) {
        unread = 0;
        unreadEl.hidden = true;
        logEl.scrollTop = logEl.scrollHeight;
        input.value = prefill;
        input.focus();
        Sound.play('open');
      }
    }

    if (tab) tab.addEventListener('click', () => setOpen(!open));
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        input.value = '';
        if (!text) { setOpen(false); tab.focus(); return; }
        history.unshift(text);
        histIdx = -1;
        runCommand(text);
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); tab.focus(); }
        if (e.key === 'ArrowUp' && history.length) { histIdx = Math.min(history.length - 1, histIdx + 1); input.value = history[histIdx]; e.preventDefault(); }
        if (e.key === 'ArrowDown' && histIdx > -1) { histIdx -= 1; input.value = histIdx === -1 ? '' : history[histIdx]; e.preventDefault(); }
      });
    }

    return {
      log,
      open: (prefill) => setOpen(true, prefill),
      close: () => setOpen(false),
      get isOpen() { return open; },
      get available() { return !!box && wideScreen.matches; },
    };
  })();

  /* ------------------------------------------------------------ achievements */
  const ACHIEVEMENTS = [
    { id: 'enter', name: 'A New Adventure', desc: 'Enter the world', pts: 5, icon: 'g-helm' },
    { id: 'explorer', name: 'Explorer', desc: 'Discover every zone', pts: 10, icon: 'g-map' },
    { id: 'loremaster', name: 'Loremaster', desc: 'Read the chronicle to the very end', pts: 25, icon: 'g-book' },
    { id: 'keybinder', name: 'Keybinder', desc: 'Travel with a key binding', pts: 5, icon: 'g-gear' },
    { id: 'collector', name: 'Collector', desc: 'Inspect five items', pts: 10, icon: 'g-eye' },
    { id: 'coin', name: 'Master of Coin', desc: 'Spin every coin in the Treasury', pts: 10, icon: 'g-coins' },
    { id: 'raven', name: 'Send a Raven', desc: 'Reach out by email', pts: 10, icon: 'g-mail' },
    { id: 'scroll', name: 'Scroll of Knowledge', desc: 'Take the CV scroll', pts: 10, icon: 'g-scroll' },
    { id: 'chatty', name: '/say Hello', desc: 'Use a chat command', pts: 5, icon: 'g-chat' },
    { id: 'leeroy', name: 'Leeroy Jenkins!', desc: 'Enter the ancient code', pts: 50, icon: 'g-flame' },
  ];

  let earned;
  try { earned = new Set(JSON.parse(store.get('klj-ach') || '[]')); } catch (e) { earned = new Set(); }

  const toastsEl = $('.toasts');
  const toastQueue = [];
  let toastBusy = false;

  function nextToast() {
    const a = toastQueue.shift();
    if (!a) { toastBusy = false; return; }
    toastBusy = true;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML =
      `<span class="toast__icon"><svg class="ico"><use href="#${a.icon}"/></svg></span>` +
      '<span class="toast__text"><span class="toast__kicker">Achievement Earned</span>' +
      '<strong class="toast__title"></strong><span class="toast__desc"></span></span>' +
      `<span class="toast__shield">${a.pts}</span>`;
    $('.toast__title', el).textContent = a.name;
    $('.toast__desc', el).textContent = a.desc;
    toastsEl.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-out');
      setTimeout(() => { el.remove(); nextToast(); }, 500);
    }, 3800);
  }

  function renderAchievements() {
    const list = $('[data-ach-list]');
    const count = $('[data-ach-count]');
    if (count) count.textContent = `${earned.size} / ${ACHIEVEMENTS.length}`;
    if (!list) return;
    list.replaceChildren(...ACHIEVEMENTS.map((a) => {
      const li = document.createElement('li');
      const got = earned.has(a.id);
      if (got) li.className = 'is-earned';
      li.innerHTML = `<svg class="ico"><use href="#${got ? a.icon : 'g-star'}"/></svg><span><span class="achlist__name"></span><small></small></span>`;
      $('.achlist__name', li).textContent = got ? `${a.name} (${a.pts})` : a.name;
      $('small', li).textContent = a.desc;
      return li;
    }));
  }

  function award(id) {
    if (earned.has(id)) return;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return;
    earned.add(id);
    store.set('klj-ach', JSON.stringify(Array.from(earned)));
    toastQueue.push(a);
    if (!toastBusy) nextToast();
    Sound.play('achievement');
    chat.log(`You have earned the achievement [${a.name}]!`, 'system');
    renderAchievements();
  }

  /* ------------------------------------------------------------ tooltips */
  const tipEl = $('.tooltip');
  const TIP_SEL = '[data-tip], [data-tip-item], [data-coin]';
  let tipOwner = null;
  let tipMode = null;
  const inspected = new Set();

  function tipNode(owner) {
    if (owner.dataset.tip) {
      const src = document.getElementById(owner.dataset.tip);
      if (!src) return null;
      const node = src.cloneNode(true);
      node.removeAttribute('id');
      return node;
    }
    if (owner.dataset.tipItem) {
      const card = document.getElementById(`item-${owner.dataset.tipItem}`);
      if (!card) return null;
      const node = document.createElement('div');
      node.className = `tt ${Array.from(card.classList).find((c) => c.startsWith('q-')) || ''}`;
      node.appendChild($('.item__body', card).cloneNode(true));
      return node;
    }
    if (owner.dataset.coin) {
      const node = document.createElement('div');
      node.className = 'tt';
      node.innerHTML = '<p class="tt__name"></p><p class="tt__row"><span></span><span></span></p><p class="tt__desc"></p>';
      $('.tt__name', node).textContent = owner.dataset.coin;
      const spans = $$('.tt__row span', node);
      spans[0].textContent = owner.dataset.kind;
      spans[1].textContent = owner.classList.contains('coin--gold') ? 'Gold' : owner.classList.contains('coin--silver') ? 'Silver' : 'Copper';
      $('.tt__desc', node).textContent = 'Integrated for subscriptions and in-app purchases.';
      return node;
    }
    return null;
  }

  function placeAtPoint(x, y) {
    const r = tipEl.getBoundingClientRect();
    const pad = 12;
    let left = x + 18;
    let top = y + 22;
    if (left + r.width > innerWidth - pad) left = x - r.width - 16;
    if (top + r.height > innerHeight - pad) top = y - r.height - 16;
    left = clamp(left, pad, innerWidth - r.width - pad);
    top = clamp(top, pad, innerHeight - r.height - pad);
    tipEl.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
  }

  function placeByOwner(owner) {
    const b = owner.getBoundingClientRect();
    const r = tipEl.getBoundingClientRect();
    const pad = 12;
    let left = b.left + b.width / 2 - r.width / 2;
    let top = b.top - r.height - 12;
    if (top < pad) top = b.bottom + 12;
    left = clamp(left, pad, innerWidth - r.width - pad);
    top = clamp(top, pad, innerHeight - r.height - pad);
    tipEl.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
  }

  function showTip(owner, mode, point) {
    const node = tipNode(owner);
    if (!node || !tipEl) return;
    if (tipOwner && tipOwner !== owner) tipOwner.classList.remove('is-tipped');
    tipOwner = owner;
    tipMode = mode;
    owner.classList.add('is-tipped');
    tipEl.replaceChildren(node);
    tipEl.hidden = false;
    const anchored = mode !== 'pointer' || owner.matches('.action, .minimap__btn');
    if (anchored || !point) placeByOwner(owner);
    else placeAtPoint(point.x, point.y);

    if (!owner.matches('.action, .minimap__btn, .mail__postage')) {
      inspected.add(owner.dataset.tip || owner.dataset.tipItem || owner.dataset.coin);
      if (inspected.size >= 5) award('collector');
    }
  }

  function hideTip() {
    if (!tipOwner) return;
    tipOwner.classList.remove('is-tipped');
    tipOwner = null;
    tipMode = null;
    if (tipEl) tipEl.hidden = true;
  }

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const owner = e.target.closest(TIP_SEL);
    if (!owner || owner === tipOwner) return;
    showTip(owner, 'pointer', { x: e.clientX, y: e.clientY });
  });
  document.addEventListener('pointermove', (e) => {
    if (!tipOwner || tipMode !== 'pointer' || e.pointerType === 'touch') return;
    if (tipOwner.matches('.action, .minimap__btn')) return;
    placeAtPoint(e.clientX, e.clientY);
  }, { passive: true });
  document.addEventListener('pointerout', (e) => {
    if (!tipOwner || tipMode !== 'pointer') return;
    const to = e.relatedTarget;
    if (to && tipOwner.contains(to)) return;
    if (e.target.closest(TIP_SEL) === tipOwner) hideTip();
  });
  document.addEventListener('focusin', (e) => {
    const owner = e.target.closest(TIP_SEL);
    if (owner && owner.matches(':focus-visible')) showTip(owner, 'focus');
  });
  document.addEventListener('focusout', (e) => {
    if (tipOwner && tipMode === 'focus' && e.target.closest(TIP_SEL) === tipOwner) hideTip();
  });
  // Touch: tapping a button that carries a tooltip toggles it; tapping elsewhere closes it.
  document.addEventListener('click', (e) => {
    const owner = e.target.closest(TIP_SEL);
    if (owner && owner.tagName === 'BUTTON' && (tipMode === 'touch' || !matchMedia('(hover: hover)').matches)) {
      if (tipOwner === owner) hideTip();
      else showTip(owner, 'touch');
      return;
    }
    if (tipMode === 'touch' && (!owner || owner !== tipOwner)) hideTip();
  });
  addEventListener('scroll', () => { if (tipOwner && tipMode !== 'pointer') hideTip(); }, { passive: true });

  /* ------------------------------------------------------------ hero sky */
  const hero = $('.hero');

  function starfield(canvas) {
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, stars = [], shooting = null, nextShot = 0, running = false, raf = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(440, Math.round((w * h) / 3800));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.pow(Math.random(), 1.4) * h * 0.8,
        r: Math.random() < 0.07 ? 1.1 + Math.random() * 0.9 : 0.35 + Math.random() * 0.7,
        a: 0.3 + Math.random() * 0.7,
        s: 0.5 + Math.random() * 2.2,
        p: Math.random() * Math.PI * 2,
        blue: Math.random() < 0.25,
      }));
      draw(performance.now());
    }

    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const tw = calm ? 1 : 0.55 + 0.45 * Math.sin((t / 1000) * s.s + s.p);
        ctx.globalAlpha = s.a * tw;
        ctx.fillStyle = s.blue ? '#cfe3ff' : '#ffffff';
        if (s.r > 1) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(s.x, s.y, s.r * 1.6, s.r * 1.6);
        }
      }
      if (shooting) {
        const k = (t - shooting.t0) / shooting.dur;
        if (k >= 1) {
          shooting = null;
        } else {
          const x = shooting.x + shooting.dx * k;
          const y = shooting.y + shooting.dy * k;
          const grad = ctx.createLinearGradient(x, y, x - shooting.dx * 0.18, y - shooting.dy * 0.18);
          grad.addColorStop(0, 'rgba(255,255,255,0.95)');
          grad.addColorStop(1, 'rgba(160,210,255,0)');
          ctx.globalAlpha = Math.sin(k * Math.PI);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - shooting.dx * 0.18, y - shooting.dy * 0.18);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    function loop(t) {
      if (!shooting && t > nextShot) {
        shooting = { x: w * (0.2 + Math.random() * 0.7), y: h * Math.random() * 0.3, dx: -(220 + Math.random() * 260), dy: 120 + Math.random() * 120, t0: t, dur: 900 };
        nextShot = t + 5000 + Math.random() * 7000;
      }
      draw(t);
      raf = requestAnimationFrame(loop);
    }

    return {
      resize,
      start() { if (running || calm) return; running = true; nextShot = performance.now() + 2500; raf = requestAnimationFrame(loop); },
      stop() { running = false; cancelAnimationFrame(raf); draw(performance.now()); },
    };
  }

  function embers(canvas) {
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, parts = [], base = 0, running = false, raf = 0, last = 0;
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 32;
    const sctx = sprite.getContext('2d');
    const g = sctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,240,200,1)');
    g.addColorStop(0.25, 'rgba(255,176,90,0.9)');
    g.addColorStop(1, 'rgba(255,90,20,0)');
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, 32, 32);

    function spawn(y) {
      return {
        x: Math.random() * w,
        y: y === undefined ? h + 10 : y,
        vy: 14 + Math.random() * 40,
        vx: -6 + Math.random() * 12,
        r: 0.9 + Math.random() * 2.1,
        life: 0,
        max: 5 + Math.random() * 7,
        ph: Math.random() * Math.PI * 2,
        sw: 0.6 + Math.random() * 1.4,
      };
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      base = Math.min(64, Math.round(w / 24));
      parts = Array.from({ length: base }, () => spawn(h * (0.4 + Math.random() * 0.6)));
    }

    function loop(t) {
      const dt = Math.min(0.05, (t - last) / 1000 || 0);
      last = t;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life += dt;
        p.y -= p.vy * dt;
        p.x += (p.vx + Math.sin(p.life * p.sw + p.ph) * 14) * dt;
        const k = p.life / p.max;
        if (k >= 1 || p.y < h * 0.12) {
          if (parts.length > base) { parts.splice(i, 1); continue; }
          Object.assign(p, spawn());
          continue;
        }
        const alpha = k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88;
        ctx.globalAlpha = Math.max(0, alpha) * 0.75;
        ctx.drawImage(sprite, p.x - p.r * 2, p.y - p.r * 2, p.r * 4, p.r * 4);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(loop);
    }

    return {
      resize,
      start() { if (running || calm) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); },
      stop() { running = false; cancelAnimationFrame(raf); ctx.clearRect(0, 0, w, h); },
      burst() {
        for (let i = 0; i < 70; i++) {
          const p = spawn(h * (0.75 + Math.random() * 0.25));
          p.vy *= 3.2;
          p.max = 2 + Math.random() * 2;
          parts.push(p);
        }
      },
    };
  }

  const sky = { stars: null, embers: null, visible: true };
  if (hero) {
    const starsCanvas = $('[data-stars]', hero);
    const embersCanvas = $('[data-embers]', hero);
    if (starsCanvas && starsCanvas.getContext) sky.stars = starfield(starsCanvas);
    if (embersCanvas && embersCanvas.getContext) sky.embers = embers(embersCanvas);
    sky.stars && sky.stars.resize();
    sky.embers && sky.embers.resize();

    const syncSky = () => {
      const run = sky.visible && !document.hidden && !calm;
      [sky.stars, sky.embers].forEach((s) => s && (run ? s.start() : s.stop()));
    };
    sky.sync = syncSky;
    new IntersectionObserver(([entry]) => { sky.visible = entry.isIntersecting; syncSky(); }).observe(hero);
    document.addEventListener('visibilitychange', syncSky);

    // Pointer parallax on the layered scenery
    let tx = 0, ty = 0, cx = 0, cy = 0, praf = 0;
    const step = () => {
      cx += (tx - cx) * 0.07;
      cy += (ty - cy) * 0.07;
      hero.style.setProperty('--px', cx.toFixed(4));
      hero.style.setProperty('--py', cy.toFixed(4));
      praf = Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001 ? requestAnimationFrame(step) : 0;
    };
    hero.addEventListener('pointermove', (e) => {
      if (calm || e.pointerType !== 'mouse') return;
      const r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      ty = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (!praf) praf = requestAnimationFrame(step);
    });

    // "Version 3.3" = years.months since the first day as a developer
    const version = $('[data-version]');
    if (version) {
      const now = new Date();
      const months = (now.getFullYear() - 2023) * 12 + (now.getMonth() - 5);
      version.textContent = `Version ${Math.floor(months / 12)}.${months % 12} (June 2023) Release`;
    }
  }

  /* ------------------------------------------------------------ loading screen */
  function runLoader() {
    const loader = $('.loader');
    const ready = () => {
      root.classList.add('is-ready');
      booted = true;
      if (currentZone && currentZone.id !== 'top') discover(currentZone);
    };
    if (!loader || !root.classList.contains('is-loading')) {
      if (loader) loader.remove();
      ready();
      return;
    }
    const tips = [
      'Press 1 to 6 to jump between zones, just like your action bars.',
      'Hover over a legendary weapon to inspect it. Orange means main weapon.',
      'ShweStream has been downloaded more than 50,000 times.',
      'Ten payment gateways were integrated. Gold, silver and copper.',
      'Press Esc to open the Game Menu. Sound is off until you turn it on.',
      'Read to the very end of the chronicle to level up.',
    ];
    if (wideScreen.matches) tips.push('Press Enter to open chat, then try /played.');
    const tipText = $('[data-loader-tip]', loader);
    if (tipText) tipText.textContent = tips[Math.floor(Math.random() * tips.length)];

    const fill = $('.loader__fill', loader);
    const t0 = performance.now();
    const minTime = 1600;
    let fontsReady = !document.fonts;
    let finished = false;
    if (document.fonts) document.fonts.ready.then(() => { fontsReady = true; });

    function finish() {
      if (finished) return;
      finished = true;
      fill.style.setProperty('--p', 1);
      setTimeout(() => {
        loader.classList.add('is-done');
        root.classList.remove('is-loading');
        session.set('klj-loaded', '1');
        ready();
        setTimeout(() => loader.remove(), 900);
      }, 240);
    }

    function frame(now) {
      if (finished) return;
      const elapsed = now - t0;
      let p = clamp(elapsed / minTime, 0, 1);
      if (!fontsReady) p = Math.min(p, 0.92);
      fill.style.setProperty('--p', (1 - Math.pow(1 - p, 2.2)).toFixed(4));
      if ((p >= 1 && fontsReady) || elapsed > 5000) { finish(); return; }
      requestAnimationFrame(frame);
    }
    loader.addEventListener('click', finish);
    addEventListener('keydown', finish, { once: true });
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------ reveal on scroll + counters */
  function countUp(el) {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    if (calm || !target) { el.textContent = target + suffix; return; }
    const t0 = performance.now();
    const dur = 1500;
    const tick = (now) => {
      const k = clamp((now - t0) / dur, 0, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3))) + suffix;
      if (k < 1) requestAnimationFrame(tick);
    };
    el.textContent = `0${suffix}`;
    requestAnimationFrame(tick);
  }

  [['.deeds__list', '.reveal'], ['.items', '.reveal'], ['.schools', '.reveal'], ['.mailroom__side', '.reveal']].forEach(([group, sel]) => {
    $$(`${group} > ${sel}`).forEach((el, i) => { el.style.transitionDelay = `${(i % 6) * 80}ms`; });
  });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        $$('[data-count]', entry.target).forEach(countUp);
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.1 });
    $$('.reveal').forEach((el) => io.observe(el));
  } else {
    $$('.reveal').forEach((el) => el.classList.add('is-in'));
  }

  /* ------------------------------------------------------------ zones, XP and navigation */
  const zones = $$('[data-zone]');
  const actions = $$('.action[data-key]');
  const xpBar = $('.actionbar__xp');
  const xpFill = $('.actionbar__xp-fill');
  const xpText = $('[data-xp-text]');
  const zoneLabel = $('[data-zone-label]');
  const minimap = $('[data-minimap]');
  const player = $('.minimap__player');
  const discovered = new Set();
  let currentZone = null;
  let autoScroll = false;
  let autoTimer = 0;
  let leveled = false;
  let lastY = scrollY;
  let zoneTops = [];
  let booted = false;

  const ZONE_LOOK = {
    top: ['#1d2a5c', 'g-star'],
    character: ['#6b5320', 'g-helm'],
    armoury: ['#6b2a18', 'g-swords'],
    realms: ['#4a2468', 'g-castle'],
    journey: ['#1f4d2a', 'g-map'],
    quests: ['#6b5a2a', 'g-quest'],
    contact: ['#1b3f66', 'g-mail'],
  };
  const PATCH = 58;

  if (minimap) {
    zones.forEach((z) => {
      const [color, icon] = ZONE_LOOK[z.id] || ['#333', 'g-star'];
      const a = document.createElement('a');
      a.className = 'minimap__zonepatch';
      a.href = `#${z.id}`;
      a.style.setProperty('--c', color);
      a.setAttribute('aria-label', z.dataset.zone);
      a.innerHTML = `<svg class="ico"><use href="#${icon}"/></svg>`;
      minimap.appendChild(a);
    });
  }

  function measure() {
    zoneTops = zones.map((z) => {
      const r = z.getBoundingClientRect();
      return { top: r.top + scrollY, height: r.height };
    });
  }

  function onZoneChange(zone) {
    const name = zone.dataset.zone;
    if (zoneLabel) zoneLabel.textContent = name;
    actions.forEach((a) => {
      const on = a.getAttribute('href') === `#${zone.id}`;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
    if (zone.id !== 'top' && !autoScroll && booted) discover(zone);
  }

  function discover(zone) {
    if (discovered.has(zone.id)) return;
    discovered.add(zone.id);
    const name = zone.dataset.zone;
    const xp = Number(zone.dataset.xp || 100);
    zoneText(name, `Discovered · +${xp} XP`);
    chat.log(`Discovered: ${name}. You gain ${xp} experience.`, 'system');
    Sound.play('discover');
    if (zone.id === 'character') award('enter');
    if (discovered.size >= zones.length - 1) award('explorer');
  }

  function levelUp() {
    leveled = true;
    const el = $('.levelup');
    if (el && !calm) {
      el.classList.remove('is-on');
      void el.offsetWidth;
      el.classList.add('is-on');
    }
    Sound.play('levelup');
    chat.log('Congratulations, you have reached the end of the chronicle!', 'system');
    setTimeout(() => award('loremaster'), 1400);
  }

  function update() {
    const y = scrollY;
    const max = root.scrollHeight - innerHeight;
    const progress = max > 0 ? clamp(y / max, 0, 1) : 0;

    if (xpFill) xpFill.style.setProperty('--xp', progress.toFixed(4));
    if (xpBar) xpBar.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
    if (xpText) xpText.textContent = `${Math.round(progress * 100)}%`;

    if (hero) {
      const heroH = hero.offsetHeight || innerHeight;
      root.classList.toggle('is-playing', y > heroH * 0.35);
      if (!calm && y < heroH * 1.2) hero.style.setProperty('--sy', clamp(y / heroH, 0, 1).toFixed(4));
    }

    let zone = zones[0];
    for (const z of zones) {
      if (z.getBoundingClientRect().top <= innerHeight * 0.42) zone = z;
    }
    if (zone && zone !== currentZone) {
      currentZone = zone;
      onZoneChange(zone);
    }

    if (minimap && zoneTops.length) {
      const probe = y + innerHeight / 2;
      let pos = 0;
      for (let i = 0; i < zoneTops.length; i++) {
        const z = zoneTops[i];
        if (probe >= z.top) pos = i + clamp((probe - z.top) / (z.height || 1), 0, 1);
      }
      minimap.style.transform = `translate3d(0, ${(63 - pos * PATCH).toFixed(1)}px, 0)`;
      if (player && Math.abs(y - lastY) > 2) player.style.setProperty('--dir', y > lastY ? '180deg' : '0deg');
    }
    lastY = y;

    if (!leveled && max > innerHeight && progress > 0.995) levelUp();
  }

  let ticking = false;
  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; update(); });
  };
  addEventListener('scroll', () => {
    requestUpdate();
    if (autoScroll) {
      clearTimeout(autoTimer);
      autoTimer = setTimeout(endAutoScroll, 160);
    }
  }, { passive: true });

  let resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      sky.stars && sky.stars.resize();
      sky.embers && sky.embers.resize();
      measure();
      requestUpdate();
    }, 150);
  });

  function endAutoScroll() {
    autoScroll = false;
    if (currentZone && currentZone.id !== 'top') discover(currentZone);
  }

  function cooldown(btn) {
    if (!btn || calm) return;
    btn.classList.remove('is-cooling');
    void btn.offsetWidth;
    btn.classList.add('is-cooling');
    setTimeout(() => btn.classList.remove('is-cooling'), 1200);
  }

  function goTo(id, { focusTitle = true } = {}) {
    const target = document.getElementById(id);
    if (!target) return;
    autoScroll = true;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(endAutoScroll, 1400);
    target.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    if (focusTitle) {
      const title = $('.section__title', target);
      if (title) title.focus({ preventScroll: true });
    }
    if (history.replaceState) history.replaceState(null, '', `#${id}`);
    cooldown(actions.find((a) => a.getAttribute('href') === `#${id}`));
    Sound.play('click');
  }

  function highlightItem(card) {
    if (!card) return;
    card.classList.add('is-highlight');
    setTimeout(() => card.classList.remove('is-highlight'), 2200);
  }

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const id = link.getAttribute('href').slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    hideTip();
    if (link.dataset.openQuest) selectQuest(link.dataset.openQuest);
    if (id === 'top') {
      autoScroll = true;
      clearTimeout(autoTimer);
      autoTimer = setTimeout(endAutoScroll, 1400);
      scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
      if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
      Sound.play('click');
      return;
    }
    if (target.classList.contains('item')) {
      autoScroll = true;
      clearTimeout(autoTimer);
      autoTimer = setTimeout(endAutoScroll, 1400);
      target.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
      highlightItem(target);
      Sound.play('click');
      return;
    }
    goTo(id, { focusTitle: !link.closest('.hero') });
  });

  /* ------------------------------------------------------------ keyboard */
  const KEYMAP = {
    1: 'character', 2: 'armoury', 3: 'realms', 4: 'journey', 5: 'quests', 6: 'contact',
    c: 'character', p: 'armoury', j: 'realms', m: 'journey', l: 'quests',
  };
  const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  let konamiAt = 0;

  const menu = $('#gamemenu');
  const lightbox = $('#lightbox');
  const dialogOpen = () => (menu && menu.open) || (lightbox && lightbox.open);

  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]');
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();

    if (key === 'escape') {
      if (tipOwner) { hideTip(); return; }
      if (dialogOpen() || typing) return;
      e.preventDefault();
      openMenu();
      return;
    }
    if (typing || dialogOpen()) return;

    konamiAt = key === KONAMI[konamiAt] ? konamiAt + 1 : key === KONAMI[0] ? 1 : 0;
    if (konamiAt === KONAMI.length) { konamiAt = 0; leeroy(); return; }

    if (KEYMAP[key]) {
      e.preventDefault();
      goTo(KEYMAP[key]);
      award('keybinder');
      return;
    }
    const onPage = e.target === document.body || e.target === root;
    if (chat.available && ((key === 'enter' && onPage) || key === '/')) {
      e.preventDefault();
      chat.open(key === '/' ? '/' : '');
    }
  });

  /* ------------------------------------------------------------ Easter eggs */
  function dance() {
    const els = [$('.unitframe'), $('.charsheet__portrait')].filter(Boolean);
    els.forEach((el) => {
      el.classList.remove('is-dancing');
      void el.offsetWidth;
      el.classList.add('is-dancing');
      setTimeout(() => el.classList.remove('is-dancing'), 3200);
    });
  }

  function leeroy() {
    award('leeroy');
    chat.log('[Kaung L Joy] yells: LEEEEEEROOOOOOY JENKINS!', 'yell');
    uiMessage('At least I have chicken.');
    Sound.play('yell');
    if (!calm) {
      [$('#top'), $('#main')].forEach((el) => el && el.animate && el.animate([
        { transform: 'translate(0, 0)' }, { transform: 'translate(-7px, 3px)' }, { transform: 'translate(6px, -4px)' },
        { transform: 'translate(-4px, 2px)' }, { transform: 'translate(3px, -1px)' }, { transform: 'translate(0, 0)' },
      ], { duration: 520, easing: 'ease-out' }));
      if (sky.embers && sky.visible) sky.embers.burst();
    }
  }

  /* ------------------------------------------------------------ chat commands */
  let whispered = false;
  function maybeWhisper() {
    if (whispered) return;
    whispered = true;
    setTimeout(() => {
      chat.log('[Kaung L Joy] whispers: Thanks for stopping by! Press 6 to send me a raven.', 'whisper');
      Sound.play('whisper');
    }, 900);
  }

  const clockFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
  let yangonFmt;
  try { yangonFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Yangon' }); } catch (e) { yangonFmt = null; }
  const yangonTime = (d = new Date()) => (yangonFmt ? yangonFmt.format(d) : `${pad2((d.getUTCHours() + 6 + Math.floor((d.getUTCMinutes() + 30) / 60)) % 24)}:${pad2((d.getUTCMinutes() + 30) % 60)}`);

  function runCommand(text) {
    if (!text.startsWith('/')) {
      chat.log(`[You] says: ${text}`, 'say');
      maybeWhisper();
      return;
    }
    const [head, ...rest] = text.slice(1).split(/\s+/);
    const cmd = (head || '').toLowerCase();
    const args = rest.join(' ');
    award('chatty');
    switch (cmd) {
      case 'help':
      case '?':
        chat.log('Commands: /played /who /roll /dance /wave /cheer /hire /cv /time /sound /yell', 'system');
        break;
      case 'played':
        chat.log(`Total time played: ${formatPlayed(CAREER_START)}`, 'system');
        chat.log(`Time played this level: ${formatPlayed(LEVEL_START)}`, 'system');
        break;
      case 'who':
        chat.log('[Kaung L Joy]: Senior Mobile Developer <Optionenter> - Yangon, Myanmar', 'system');
        break;
      case 'roll': {
        const max = clamp(parseInt(rest[0], 10) || 100, 1, 1000000);
        chat.log(`You roll ${1 + Math.floor(Math.random() * max)} (1-${max})`, 'system');
        break;
      }
      case 'dance':
        dance();
        chat.log('You dance with Kaung L Joy.', 'emote');
        break;
      case 'wave':
      case 'hello':
      case 'hi':
        chat.log('You wave at Kaung L Joy.', 'emote');
        setTimeout(() => chat.log('Kaung L Joy waves back at you.', 'emote'), 700);
        break;
      case 'cheer':
        chat.log('You cheer at Kaung L Joy!', 'emote');
        break;
      case 'hire':
      case 'invite':
        chat.log('Kaung L Joy joins your party. Heading to the mailbox...', 'system');
        goTo('contact');
        break;
      case 'cv': {
        const link = $('a[data-cv]');
        if (link) link.click();
        break;
      }
      case 'time':
        chat.log(`Local time ${clockFmt.format(new Date())}. Realm time in Yangon ${yangonTime()}.`, 'system');
        break;
      case 'sound':
        Sound.toggle();
        chat.log(`Sound effects ${Sound.on ? 'on' : 'off'}.`, 'system');
        break;
      case 'say':
      case 's':
        if (args) { chat.log(`[You] says: ${args}`, 'say'); maybeWhisper(); }
        break;
      case 'yell':
      case 'y':
        if (args) chat.log(`[You] yells: ${args.toUpperCase()}`, 'yell');
        break;
      case 'leeroy':
        leeroy();
        break;
      default:
        chat.log(`Unknown command "/${cmd}". Type /help for a list.`, 'system');
        Sound.play('error');
    }
  }

  /* ------------------------------------------------------------ Treasury coins */
  const spun = new Set();
  $$('.coin').forEach((coin) => {
    const spin = () => {
      if (coin.classList.contains('is-spinning')) return;
      if (!calm) coin.classList.add('is-spinning');
      Sound.play('coin');
      spun.add(coin.dataset.coin);
      if (spun.size === $$('.coin').length) award('coin');
    };
    coin.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') spin(); });
    coin.addEventListener('click', spin);
    coin.addEventListener('animationend', () => coin.classList.remove('is-spinning'));
  });

  /* ------------------------------------------------------------ quest log */
  const questTabs = $$('.questlog__entry');
  function selectQuest(id, focus = false) {
    questTabs.forEach((tab) => {
      const on = tab.dataset.quest === id;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      if (!panel) return;
      panel.hidden = !on;
      if (on) {
        panel.classList.remove('is-opening');
        void panel.offsetWidth;
        panel.classList.add('is-opening');
        if (focus) tab.focus();
      }
    });
    Sound.play('open');
  }
  questTabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectQuest(tab.dataset.quest));
    tab.addEventListener('keydown', (e) => {
      let j = null;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') j = (i + 1) % questTabs.length;
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') j = (i - 1 + questTabs.length) % questTabs.length;
      if (e.key === 'Home') j = 0;
      if (e.key === 'End') j = questTabs.length - 1;
      if (j !== null) {
        e.preventDefault();
        selectQuest(questTabs[j].dataset.quest, true);
      }
    });
  });

  /* ------------------------------------------------------------ lightbox */
  if (lightbox) {
    const img = $('.lightbox__img', lightbox);
    const cap = $('.lightbox__cap', lightbox);
    $$('[data-lightbox]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const thumb = $('img', btn);
        img.src = btn.dataset.lightbox;
        img.alt = thumb ? thumb.alt : '';
        cap.textContent = btn.dataset.caption || '';
        if (typeof lightbox.showModal === 'function') {
          hideTip();
          lightbox.showModal();
          Sound.play('open');
        } else {
          window.open(btn.dataset.lightbox, '_blank', 'noopener');
        }
      });
    });
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox || e.target.closest('[data-close]')) lightbox.close();
    });
    lightbox.addEventListener('close', () => Sound.play('close'));
  }

  /* ------------------------------------------------------------ game menu */
  function setCalm(value) {
    calm = value;
    root.classList.toggle('calm', calm);
    store.set('klj-motion', calm ? 'off' : 'on');
    const label = $('[data-motion-label]');
    if (label) label.textContent = calm ? 'Off' : 'On';
    if (sky.sync) sky.sync();
    if (hero) {
      hero.style.setProperty('--px', 0);
      hero.style.setProperty('--py', 0);
      hero.style.setProperty('--sy', 0);
    }
    requestUpdate();
  }

  function openMenu() {
    if (!menu || menu.open || typeof menu.showModal !== 'function') return;
    hideTip();
    renderAchievements();
    menu.showModal();
    Sound.play('open');
  }
  $$('[data-open-menu]').forEach((b) => b.addEventListener('click', () => { cooldown(b); openMenu(); }));

  if (menu) {
    menu.addEventListener('click', (e) => {
      if (e.target === menu) { menu.close(); return; }
      const b = e.target.closest('[data-menu]');
      if (!b) return;
      const action = b.dataset.menu;
      if (action === 'sound') Sound.toggle();
      if (action === 'motion') setCalm(!calm);
      if (action === 'close') menu.close();
      if (action === 'keys' || action === 'achievements') {
        const panel = document.getElementById(b.getAttribute('aria-controls'));
        const open = b.getAttribute('aria-expanded') !== 'true';
        b.setAttribute('aria-expanded', String(open));
        if (panel) panel.hidden = !open;
        Sound.play('click');
      }
    });
    menu.addEventListener('close', () => Sound.play('close'));
    const motionLabel = $('[data-motion-label]');
    if (motionLabel) motionLabel.textContent = calm ? 'Off' : 'On';
  }

  Sound.onChange((on) => {
    $$('[data-sound-label]').forEach((el) => { el.textContent = on ? 'On' : 'Off'; });
    $$('[data-sound-toggle]').forEach((el) => el.setAttribute('aria-pressed', String(on)));
  });
  $$('[data-sound-toggle]').forEach((b) => b.addEventListener('click', () => {
    Sound.toggle();
    uiMessage(Sound.on ? 'Sound effects on' : 'Sound effects off');
  }));

  /* ------------------------------------------------------------ mail, copy, CV */
  const mailForm = $('[data-mail-form]');
  if (mailForm) {
    mailForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const subject = mailForm.elements.namedItem('subject').value.trim() || 'A quest for you';
      const body = mailForm.elements.namedItem('body').value.trim();
      let url = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}`;
      if (body) url += `&body=${encodeURIComponent(body)}`;
      window.location.href = url;
      award('raven');
      uiMessage('Your raven takes flight.');
      chat.log('Mail sent. A raven takes flight toward Yangon.', 'system');
      Sound.play('whisper');
    });
  }

  $$('[data-raven]').forEach((a) => a.addEventListener('click', () => award('raven')));
  $$('[data-cv]').forEach((a) => a.addEventListener('click', () => {
    award('scroll');
    chat.log('You receive item: [Scroll of Kaung L Joy].', 'loot');
  }));

  $$('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
    const text = btn.dataset.copy;
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.select();
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
    }
    uiMessage(ok ? `Copied ${text}` : text);
    Sound.play('coin');
  }));

  /* ------------------------------------------------------------ clocks and /played */
  const localClock = $('[data-clock]');
  const yangonClock = $('[data-yangon-clock]');
  const played = $('[data-played]');
  function tickClocks() {
    const now = new Date();
    if (localClock) localClock.textContent = clockFmt.format(now);
    if (yangonClock) yangonClock.textContent = yangonTime(now);
    if (played) played.textContent = formatPlayed(CAREER_START);
  }
  tickClocks();
  setInterval(tickClocks, 1000);

  /* ------------------------------------------------------------ start */
  chat.log("Welcome to Kaung L Joy's realm.", 'system');
  chat.log('[Guild] Kaung L Joy: Open to new quests. Press 6 for the mailbox.', 'guild');
  chat.log('Type /help for a list of commands.', 'system');

  renderAchievements();
  measure();
  update();
  addEventListener('load', () => { measure(); requestUpdate(); });
  runLoader();
  window.__kljReady = true;
})();

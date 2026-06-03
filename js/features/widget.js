/* ═══════════════════════════════════════
   LIFEPLAN v7 — WIDGET + VOICE + ALARM
   FIX: AudioContext resumed on user gesture
        Speech synthesis waits for voices
        Alarm + voice both work reliably
═══════════════════════════════════════ */
const Widget = (() => {
  let snoozeUntil     = null;
  let checkInterval   = null;
  let _audioCtx       = null;
  let _voicesReady    = false;
  let _deferredPrompt = null;
  let _gestureUnlocked= false;

  /* ── UNLOCK AUDIO ON FIRST GESTURE ── */
  const _unlockAudio = () => {
    if (_gestureUnlocked) return;
    _gestureUnlocked = true;
    try {
      _audioCtx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (_audioCtx.state === 'suspended') _audioCtx.resume();
      // Create and immediately stop a silent buffer to unlock
      const buf = _audioCtx.createBuffer(1, 1, 22050);
      const src = _audioCtx.createBufferSource();
      src.buffer = buf;
      src.connect(_audioCtx.destination);
      src.start(0);
    } catch(e) {}
  };

  /* ── WAIT FOR VOICES TO LOAD ── */
  const _getVoices = () => new Promise(resolve => {
    const voices = window.speechSynthesis?.getVoices() || [];
    if (voices.length > 0) { resolve(voices); return; }
    const handler = () => {
      resolve(window.speechSynthesis.getVoices());
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
    };
    window.speechSynthesis?.addEventListener('voiceschanged', handler);
    // Fallback timeout
    setTimeout(() => resolve(window.speechSynthesis?.getVoices() || []), 1500);
  });

  /* ── ALARM SOUND (Web Audio API) ── */
  const playAlarm = (volume = 0.8) => {
    try {
      _audioCtx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (_audioCtx.state === 'suspended') {
        _audioCtx.resume().then(() => _doPlayAlarm(volume));
      } else {
        _doPlayAlarm(volume);
      }
    } catch(e) { console.warn('Alarm error:', e); }
  };

  const _doPlayAlarm = (volume) => {
    const ctx     = _audioCtx;
    const pattern = [880, 1100, 880, 1100, 660, 880];
    let   t       = ctx.currentTime + 0.05;
    pattern.forEach(freq => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(volume, t + 0.06);
      gain.gain.linearRampToValueAtTime(0, t + 0.28);
      osc.start(t);
      osc.stop(t + 0.32);
      t += 0.38;
    });
  };

  /* ── SPEAK (Web Speech API) ── */
  const speak = async (text) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported');
      return;
    }
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const cfg    = State.alertCfg || {};
    const pKey   = cfg.personality || 'friendly';
    const p      = State.VOICE_PERSONALITIES[pKey];
    const voices = await _getVoices();

    const utt    = new SpeechSynthesisUtterance(text);
    utt.pitch    = p.pitch  || 1.0;
    utt.rate     = p.rate   || 1.0;
    utt.volume   = cfg.volume !== undefined ? cfg.volume : 0.9;
    utt.lang     = 'en-US';

    // Pick best English voice
    const voice =
      voices.find(v => v.lang === 'en-US' && v.name.toLowerCase().includes('google')) ||
      voices.find(v => v.lang === 'en-US') ||
      voices.find(v => v.lang.startsWith('en')) ||
      voices[0];
    if (voice) utt.voice = voice;

    utt.onerror  = e => console.warn('Speech error:', e.error);

    // Chrome bug: long utterances get cut off — split into sentence chunks
    const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
    const speakChain = (idx) => {
      if (idx >= sentences.length) return;
      const u = new SpeechSynthesisUtterance(sentences[idx].trim());
      u.pitch = utt.pitch; u.rate = utt.rate;
      u.volume = utt.volume; u.lang = utt.lang;
      if (voice) u.voice = voice;
      u.onend = () => speakChain(idx + 1);
      window.speechSynthesis.speak(u);
    };
    speakChain(0);
  };

  const buildMsg = () => {
    const cfg  = State.alertCfg || {};
    const p    = State.VOICE_PERSONALITIES[cfg.personality || 'friendly'];
    const msgs = p.messages;
    const msg  = msgs[Math.floor(Math.random() * msgs.length)];
    return msg.replace(/{name}/g, State.me()?.name || 'Friend');
  };

  /* ── TODAY'S PROGRESS ── */
  const getProgress = () => {
    const tt = (State.tables || []).filter(t => !t.archived && t.type === 'timetable');
    if (!tt.length) return { done:0, total:0, pct:0 };
    let done = 0, total = 0;
    tt.forEach(tbl => {
      const { wk, dy } = TZ.getTodayWkDay(tbl);
      const blks = State.blocks[tbl.id] || [];
      const st   = ((State.schedState[tbl.id] || {})[wk] || {})[dy] || [];
      total += blks.length;
      done  += st.filter(s => s === 1).length;
    });
    return { done, total, pct: total > 0 ? Math.round(done / total * 100) : 0 };
  };

  /* ── SHOW WIDGET ── */
  const show = () => {
    if (snoozeUntil && new Date() < snoozeUntil) return;
    const p = getProgress();
    if (!p.total || p.pct === 100) return;

    const msg  = buildMsg();
    const name = State.me()?.name || '?';
    const w    = document.getElementById('alert-widget');
    if (!w) return;

    w.querySelector('.widget-msg').textContent  = msg;
    w.querySelector('.widget-sub').textContent  =
      `${p.done}/${p.total} tasks done today · ${p.pct}%`;
    w.querySelector('.widget-prog-fill').style.width = p.pct + '%';
    w.querySelector('.widget-avatar').textContent    = name.charAt(0).toUpperCase();
    w.classList.add('show');

    const cfg      = State.alertCfg || {};
    const hasVoice = cfg.voiceEnabled !== false;
    const hasAlarm = !!cfg.alarmEnabled;

    if (hasAlarm && hasVoice) {
      playAlarm(cfg.alarmVolume || 0.8);
      setTimeout(() => speak(msg), 2200);
    } else if (hasAlarm) {
      playAlarm(cfg.alarmVolume || 0.8);
    } else if (hasVoice) {
      // Small delay so browser considers it user-triggered context
      setTimeout(() => speak(msg), 300);
    }
  };

  const hide = () => {
    document.getElementById('alert-widget')?.classList.remove('show');
    window.speechSynthesis?.cancel();
  };

  const snooze = (minutes) => {
    snoozeUntil = new Date(Date.now() + minutes * 60000);
    hide();
    Toast.warning(`Snoozed for ${minutes} minutes`);
  };

  const snoozeTonight = () => {
    const t = TZ.now(); t.setHours(23, 59, 0, 0);
    snoozeUntil = t; hide();
    Toast.warning('Snoozed until tonight');
  };

  const shouldAlert = () => {
    if (!State.me() || !State.alertCfg?.enabled) return false;
    const p = getProgress();
    if (!p.total || p.pct === 100) return false;
    if (snoozeUntil && new Date() < snoozeUntil) return false;
    const cfg = State.alertCfg;
    const n   = TZ.now();
    const h   = n.getHours(), m = n.getMinutes();
    if (cfg.manualTimes?.length)
      return cfg.manualTimes.some(t => {
        const [th, tm] = t.split(':').map(Number);
        return h === th && m === tm;
      });
    if (cfg.autoDetect) return h >= 12 && p.pct < (cfg.threshold || 50);
    return false;
  };

  /* ── NOTIFICATION API ── */
  const requestNotifPermission = async () => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    const r = await Notification.requestPermission();
    return r === 'granted';
  };

  const sendNotif = (msg) => {
    if (Notification.permission !== 'granted') return;
    try {
      const n = new Notification('LIFEPLAN', {
        body: msg, icon: './icons/icon-192.png', tag: 'lifeplan-alert',
      });
      n.onclick = () => { window.focus(); n.close(); };
      setTimeout(() => n.close(), 8000);
    } catch(e) {}
  };

  /* ── START / STOP ── */
  const start = () => {
    if (checkInterval) clearInterval(checkInterval);
    checkInterval = setInterval(() => {
      if (shouldAlert()) { show(); sendNotif(buildMsg()); }
    }, 60000);
  };

  const stop = () => {
    if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
  };

  const trigger = () => { snoozeUntil = null; _unlockAudio(); show(); };

  /* ── PWA INSTALL ── */
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); _deferredPrompt = e;
    document.getElementById('pwa-banner')?.classList.add('show');
  });
  window.addEventListener('appinstalled', () => {
    document.getElementById('pwa-banner')?.classList.remove('show');
    Toast.success('LIFEPLAN installed!');
    _deferredPrompt = null;
  });
  const installPWA = async () => {
    if (!_deferredPrompt) {
      Toast.warning('Tap "Add to Home Screen" in your browser menu');
      return;
    }
    _deferredPrompt.prompt();
    const { outcome } = await _deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      document.getElementById('pwa-banner')?.classList.remove('show');
      Toast.success('Installing LIFEPLAN…');
    }
    _deferredPrompt = null;
  };
  const dismissPWA = () => document.getElementById('pwa-banner')?.classList.remove('show');

  // Unlock audio on any user interaction
  const _gestureEvents = ['touchstart','mousedown','keydown'];
  const _onGesture = () => {
    _unlockAudio();
    _gestureEvents.forEach(ev => document.removeEventListener(ev, _onGesture));
  };
  _gestureEvents.forEach(ev => document.addEventListener(ev, _onGesture, { once:true, passive:true }));

  return {
    show, hide, snooze, snoozeTonight, start, stop, trigger,
    speak, playAlarm, buildMsg, getProgress,
    requestNotifPermission, sendNotif,
    installPWA, dismissPWA,
  };
})();

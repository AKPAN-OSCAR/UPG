/* ═══════════════════════════════════════
   LIFEPLAN v7 — AUTH SYSTEM
   js/features/auth.js
   - Exactly 2 PINs, each exactly 5 digits
   - Both must be different
   - No collision across users
   - Login / logout / user switcher
   - Failed attempt lockout (3 attempts → 30s)
═══════════════════════════════════════ */
const Auth = (() => {

  // ── REGISTRATION STATE ──
  let _reg = {
    name:'', tz:'Africa/Lagos', timeFmt:'24h',
    theme:'green', aim:'',
    pins:['',''],  // exactly 2 PINs
  };
  let _regStep = 1;

  // ── LOGIN STATE ──
  let _loginUid    = null;
  let _pinEntered  = '';
  let _failCount   = 0;
  let _lockedUntil = null;
  let _lockTimer   = null;

  /* ════════════════════════════
     SETUP FLOW
  ════════════════════════════ */
  const startSetup = () => {
    _reg = { name:'', tz:'Africa/Lagos', timeFmt:'24h', theme:'green', aim:'', pins:['',''] };
    _regStep = 1;
    _showSetupStep(1);
    _showScreen('setup-screen');
  };

  const goStep = (step) => {
    if (step === 2) {
      const name = document.getElementById('inp-name')?.value.trim();
      if (!name) { _shakeEl('inp-name'); Toast.error('Please enter your name'); return; }
      _reg.name = name;
    }
    _regStep = step;
    _showSetupStep(step);
  };

  const _showSetupStep = (step) => {
    for (let i = 1; i <= 5; i++) {
      const el = document.getElementById('ss' + i);
      if (el) el.style.display = i === step ? 'block' : 'none';
    }
    document.querySelectorAll('.step-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === step - 1);
      dot.classList.toggle('done',   i <  step - 1);
    });
    const lbl = document.querySelector('.step-lbl');
    if (lbl) lbl.textContent = `STEP ${step} OF 5`;
    if (step === 1) setTimeout(() => document.getElementById('inp-name')?.focus(), 300);
  };

  const pickTZ      = (tz)  => { _reg.tz = tz; };
  const pickTimeFmt = (fmt) => {
    _reg.timeFmt = fmt;
    document.querySelectorAll('.time-fmt-opt').forEach(el =>
      el.classList.toggle('sel', el.dataset.fmt === fmt));
  };
  const pickTheme = (el) => {
    _reg.theme = el.dataset.t;
    document.querySelectorAll('#ss4 .theme-swatch').forEach(s => s.classList.remove('active'));
    el.classList.add('active');
    App.applyThemeClass(_reg.theme);
    const th = State.THEMES.find(t => t.id === _reg.theme);
    const nm = document.getElementById('setup-theme-name');
    if (nm) nm.textContent = 'Selected: ' + (th?.name || '');
  };

  /* ════════════════════════════
     PIN VALIDATION & CREATION
  ════════════════════════════ */
  const validateAndFinish = () => {
    const p1 = document.getElementById('setup-pin-0')?.value.trim() || '';
    const p2 = document.getElementById('setup-pin-1')?.value.trim() || '';

    // Both must be filled
    if (!p1) { _shakeSlot(0); Toast.error('PIN 1 is empty'); return; }
    if (!p2) { _shakeSlot(1); Toast.error('PIN 2 is empty'); return; }

    // Both must be exactly 5 digits
    if (!/^\d{5}$/.test(p1)) { _shakeSlot(0); Toast.error('PIN 1 must be exactly 5 digits'); return; }
    if (!/^\d{5}$/.test(p2)) { _shakeSlot(1); Toast.error('PIN 2 must be exactly 5 digits'); return; }

    // Both must be different from each other
    if (p1 === p2) {
      _shakeSlot(0); _shakeSlot(1);
      Toast.error('Both PINs must be different from each other');
      return;
    }

    // Check collision with other users
    if (State.isPinTaken(p1)) {
      _shakeSlot(0);
      document.getElementById('setup-pin-0').value = '';
      Toast.error('PIN 1 is already used by another user. Try a different one.');
      return;
    }
    if (State.isPinTaken(p2)) {
      _shakeSlot(1);
      document.getElementById('setup-pin-1').value = '';
      Toast.error('PIN 2 is already used by another user. Try a different one.');
      return;
    }

    _createUser([p1, p2]);
  };

  const _createUser = (pins) => {
    const uid  = State.genUID();
    const user = {
      id:        uid,
      name:      _reg.name,
      theme:     _reg.theme,
      tz:        _reg.tz,
      timeFmt:   _reg.timeFmt,
      aim:       '',
      joinedAt:  new Date().toISOString(),
      pinHashes: pins.map(p => State.hashPin(p)),
    };
    State.users.push(user);
    State.saveGlobal();
    State.loadUser(uid);
    State.alertCfg = {
      enabled:true, voiceEnabled:true, alarmEnabled:false,
      personality:'friendly', volume:0.9, alarmVolume:0.8,
      autoDetect:true, threshold:50, manualTimes:[],
    };
    State.saveAll();
    App.launch(uid);
  };

  /* ════════════════════════════
     USER SWITCHER
  ════════════════════════════ */
  const showSwitcher = () => {
    _renderSwitcher();
    _showScreen('user-switcher');
  };

  const _renderSwitcher = () => {
    const grid = document.getElementById('users-grid');
    if (!grid) return;
    grid.innerHTML = '';
    State.users.forEach(u => {
      const card = document.createElement('div');
      card.className = 'user-card fu';
      card.innerHTML = `
        <div class="user-avatar">${u.name.charAt(0).toUpperCase()}</div>
        <div class="user-card-name">${_esc(u.name)}</div>
        <div class="user-card-sub">${State.MONTH_SHORT[new Date(u.joinedAt).getMonth()]} ${new Date(u.joinedAt).getFullYear()}</div>`;
      card.onclick = () => showLogin(u.id);
      grid.appendChild(card);
    });
    const addCard = document.createElement('div');
    addCard.className = 'add-user-card fu';
    addCard.innerHTML = `<div class="add-user-icon">＋</div><div class="add-user-lbl">NEW USER</div>`;
    addCard.onclick = () => startSetup();
    grid.appendChild(addCard);
  };

  /* ════════════════════════════
     LOGIN
  ════════════════════════════ */
  const showLogin = (uid) => {
    _loginUid    = uid;
    _pinEntered  = '';
    _failCount   = 0;
    _lockedUntil = null;
    if (_lockTimer) { clearInterval(_lockTimer); _lockTimer = null; }
    const user = State.users.find(u => u.id === uid);
    if (!user) return;
    App.applyThemeClass(user.theme || 'green');
    const av = document.getElementById('login-avatar');
    const nm = document.getElementById('login-name');
    const sb = document.getElementById('login-sub');
    const lo = document.getElementById('login-lockout');
    if (av) av.textContent = user.name.charAt(0).toUpperCase();
    if (nm) nm.textContent = user.name.toUpperCase();
    if (sb) sb.textContent = 'ENTER YOUR 5-DIGIT PIN';
    if (lo) lo.style.display = 'none';
    _updatePinDots();
    _showScreen('pin-login');
  };

  const pinKeypress = (val) => {
    if (_lockedUntil && new Date() < _lockedUntil) {
      const secs = Math.ceil((_lockedUntil - new Date()) / 1000);
      const lo = document.getElementById('login-lockout');
      if (lo) { lo.style.display = 'block'; lo.textContent = `Too many attempts. Wait ${secs}s`; }
      return;
    }
    if (val === 'del') {
      _pinEntered = _pinEntered.slice(0, -1);
      _updatePinDots(); return;
    }
    if (_pinEntered.length >= 5) return;
    _pinEntered += val;
    _updatePinDots();
    // Try at exactly 5 digits
    if (_pinEntered.length === 5) setTimeout(_tryLogin, 80);
  };

  const _tryLogin = () => {
    if (State.verifyPin(_loginUid, _pinEntered)) {
      // ✅ SUCCESS
      document.querySelectorAll('#pin-login .pin-dot').forEach(d => {
        d.classList.remove('error'); d.classList.add('filled');
      });
      setTimeout(() => {
        State.loadUser(_loginUid);
        App.launch(_loginUid);
      }, 220);
    } else {
      // ❌ FAIL
      _failCount++;
      document.querySelectorAll('#pin-login .pin-dot').forEach(d => {
        d.classList.remove('filled'); d.classList.add('error');
      });
      setTimeout(() => {
        document.querySelectorAll('#pin-login .pin-dot').forEach(d =>
          d.classList.remove('error', 'filled'));
        _pinEntered = '';
        _updatePinDots();
        const lo = document.getElementById('login-lockout');
        if (_failCount >= 3) {
          _lockedUntil = new Date(Date.now() + 30000);
          if (lo) lo.style.display = 'block';
          _lockTimer = setInterval(() => {
            if (!_lockedUntil || new Date() >= _lockedUntil) {
              if (lo) lo.style.display = 'none';
              _failCount = 0;
              clearInterval(_lockTimer); _lockTimer = null;
            } else {
              const s = Math.ceil((_lockedUntil - new Date()) / 1000);
              if (lo) lo.textContent = `Too many attempts. Wait ${s}s`;
            }
          }, 1000);
        } else {
          Toast.error(`Wrong PIN. ${3 - _failCount} attempt${3-_failCount!==1?'s':''} left.`);
        }
      }, 420);
    }
  };

  const _updatePinDots = () => {
    document.querySelectorAll('#pin-login .pin-dot').forEach((d, i) => {
      d.classList.toggle('filled', i < _pinEntered.length);
      d.classList.remove('error');
    });
  };

  /* ════════════════════════════
     LOGOUT
  ════════════════════════════ */
  const logout = () => {
    State.logoutUser();
    Widget.stop();
    window.speechSynthesis?.cancel();
    showSwitcher();
    Toast.show('Logged out', 'default', 1500);
  };

  /* ════════════════════════════
     MANAGE PINs (settings)
  ════════════════════════════ */
  const renderPinManager = (containerId) => {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `
      <div style="font-family:var(--font-m);font-size:8px;color:var(--tx2);letter-spacing:.5px;line-height:1.7;margin-bottom:16px">
        Enter 2 new PINs — each must be exactly <strong style="color:var(--acc)">5 digits</strong>, different from each other, and not used by another user on this device.
      </div>`;
    for (let i = 0; i < 2; i++) {
      const slot = document.createElement('div');
      slot.className = 'pin-slot';
      slot.id = 'pin-mgr-slot-' + i;
      slot.innerHTML = `
        <div class="pin-slot-num">PIN ${i + 1}</div>
        <input class="pin-slot-input" type="password" maxlength="5"
          inputmode="numeric" pattern="[0-9]*"
          placeholder="•••••" id="mgr-pin-${i}"
          style="font-family:var(--font-m);font-size:16px;color:var(--tx);background:transparent;border:none;outline:none;width:100%;letter-spacing:4px"/>
        <div class="pin-slot-status" id="mgr-pin-st-${i}"></div>`;
      el.appendChild(slot);
    }
  };

  const saveManagedPins = () => {
    const user = State.me(); if (!user) return;
    const p1 = document.getElementById('mgr-pin-0')?.value.trim() || '';
    const p2 = document.getElementById('mgr-pin-1')?.value.trim() || '';

    if (!p1) { Toast.error('PIN 1 is empty'); return; }
    if (!p2) { Toast.error('PIN 2 is empty'); return; }
    if (!/^\d{5}$/.test(p1)) { Toast.error('PIN 1 must be exactly 5 digits'); return; }
    if (!/^\d{5}$/.test(p2)) { Toast.error('PIN 2 must be exactly 5 digits'); return; }
    if (p1 === p2) { Toast.error('Both PINs must be different'); return; }
    if (State.isPinTaken(p1, user.id)) { Toast.error('PIN 1 is already used by another user'); return; }
    if (State.isPinTaken(p2, user.id)) { Toast.error('PIN 2 is already used by another user'); return; }

    user.pinHashes = [State.hashPin(p1), State.hashPin(p2)];
    State.saveGlobal();
    Toast.success('PINs updated successfully!');
    document.getElementById('ov-pin-mgr')?.classList.remove('open');
  };

  /* ════════════════════════════
     SCREEN MANAGER
  ════════════════════════════ */
  const _showScreen = (id) => {
    ['setup-screen','user-switcher','pin-login','app-shell'].forEach(sid => {
      const el = document.getElementById(sid);
      if (!el) return;
      if (sid === id) {
        el.style.display = sid === 'app-shell' ? 'flex' : 'flex';
        el.style.visibility = 'visible';
      } else {
        el.style.display = 'none';
      }
    });
  };

  /* ════════════════════════════
     UTILS
  ════════════════════════════ */
  const _shakeEl = (id) => {
    const el = document.getElementById(id); if (!el) return;
    el.style.animation = 'shake .3s ease';
    setTimeout(() => el.style.animation = '', 400);
    el.focus();
  };
  const _shakeSlot = (i) => {
    const slot = document.querySelectorAll('.pin-slot')[i]; if (!slot) return;
    slot.classList.add('error');
    setTimeout(() => slot.classList.remove('error'), 500);
  };
  const _esc = s => String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  return {
    startSetup, goStep, pickTZ, pickTimeFmt, pickTheme,
    validateAndFinish, showSwitcher, showLogin, pinKeypress,
    logout, renderPinManager, saveManagedPins,
  };
})();

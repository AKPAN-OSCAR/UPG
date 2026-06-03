/* ═══════════════════════════════════════
   LIFEPLAN v6 — MAIN APP CONTROLLER
   js/app.js
═══════════════════════════════════════ */

/* ════════════════════════════════
   CLOCK
════════════════════════════════ */
const Clock = (() => {
  const tick = () => {
    const n  = TZ.now();
    const el = document.getElementById('clk');
    if (el) el.textContent = TZ.formatTime(n);
    const gl = document.getElementById('greet-lbl');
    if (gl) gl.textContent = TZ.greeting();
    const gd = document.getElementById('greet-date');
    if (gd) gd.textContent = TZ.formatFullDate(n);
  };
  const start = () => { tick(); setInterval(tick, 1000); };
  return { start, tick };
})();

/* ════════════════════════════════
   APP
════════════════════════════════ */
const App = (() => {

  /* ── theme ── */
  const applyThemeClass = (t) => {
    const base = document.body.classList.contains('light') ? ' light' : '';
    document.body.className = 'theme-' + (t || 'green') + base;
    document.querySelectorAll('.t-dot').forEach(d =>
      d.classList.toggle('active', d.dataset.t === t));
  };

  const applyTheme = (t) => {
    applyThemeClass(t);
    const u = State.me();
    if (u) { u.theme = t; State.saveGlobal(); }
  };

  const toggleLight = () => {
    document.body.classList.toggle('light');
    document.getElementById('light-toggle')?.classList.toggle('on',
      document.body.classList.contains('light'));
  };

  /* ── launch after login ── */
  const launch = (uid) => {
    State.loadUser(uid);
    const user = State.me();
    if (!user) return;

    // Hide all auth screens, show app
    ['setup-screen','user-switcher','pin-login'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    const shell = document.getElementById('app-shell');
    shell.style.display = 'flex';

    applyThemeClass(user.theme || 'green');
    _refreshGreeting();
    Views.Home.render();
    Clock.start();
    Widget.start();
    Widget.requestNotifPermission();
    _checkStreakAlert();
    setTimeout(() => Badges.check(), 1200);
  };

  /* ── greeting ── */
  const _refreshGreeting = () => {
    const u = State.me(); if (!u) return;
    const name = u.name.toUpperCase();
    _setText('greet-name',      name);
    _setText('greet-aim',       u.aim ? '↳ ' + u.aim : '');
    _setText('menu-name',       u.name);
    _setText('menu-since',      'JOINED ' + _joinDate(u.joinedAt));
    _setText('profile-name',    u.name);
    _setText('profile-joined',  'Joined ' + _joinDate(u.joinedAt));
    _setText('profile-aim-disp',u.aim || '–');
    const av = u.name.charAt(0).toUpperCase();
    _setText('menu-avatar',     av);
    _setText('profile-avatar',  av);
    const tz = State.TZ_LIST.find(t => t.tz === TZ.getTZ()) || State.TZ_LIST[0];
    _setText('prof-tz-sub', tz.name.replace(/^../,'').trim() + ' · ' + tz.off);
    _setText('prof-fmt-sub', u.timeFmt === '12h' ? '12-Hour (AM/PM)' : '24-Hour');
    document.getElementById('pin-status-lbl')
      && (_setText('pin-status-lbl', 'Manage your 5 PINs'));
    // quote
    const q = Quotes.getToday();
    const qel = document.getElementById('quote-card');
    if (qel) qel.innerHTML =
      `<div class="quote-text">"${q.text}"</div><div class="quote-author">— ${q.author}</div>`;
  };

  const _joinDate = (iso) => {
    const d = new Date(iso);
    return State.MONTH_SHORT[d.getMonth()] + ' ' + d.getFullYear();
  };

  /* ── streak alert ── */
  const _checkStreakAlert = () => {
    const atRisk = State.tables.filter(t => {
      if (t.archived || t.type === 'timetable') return false;
      const age = TZ.tableAgeDays(t);
      if (age < 2) return false;
      const s = State.strkState[t.id] || [];
      return s[age-2] === 1 && !s[age-1];
    });
    const el = document.getElementById('streak-alert');
    if (!el) return;
    if (atRisk.length > 0) {
      el.style.display = 'flex';
      _setText('streak-alert-msg',
        `⚠️ Mark today's streak for "${atRisk[0].name}" before midnight!`);
      document.getElementById('badge-dot')?.classList.add('show');
    } else {
      el.style.display = 'none';
    }
  };

  /* ── navigation ── */
  const openView = (id) => {
    document.querySelectorAll('.view').forEach(v => {
      v.classList.toggle('active', v.id === id);
      v.classList.toggle('hidden', v.id !== id);
    });
    const el = document.getElementById(id);
    if (el) el.scrollTop = 0;
  };

  const goHome = () => {
    openView('v-home');
    Views.Home.render();
    _updateTabBar('home');
  };

  const switchTab = (tab) => {
    State.activeTab = tab;
    _updateTabBar(tab);
    const map = { home:'v-home', history:'v-history', badges:'v-badges', profile:'v-profile' };
    if (map[tab]) {
      openView(map[tab]);
      if (tab === 'history') Views.History.render();
      if (tab === 'badges')  Views.Badges.render();
      if (tab === 'profile') _refreshGreeting();
    }
  };

  const _updateTabBar = (tab) => {
    ['home','history','badges','profile'].forEach(t =>
      document.getElementById('tab-'+t)?.classList.toggle('active', t === tab));
  };

  /* ── side menu ── */
  const openMenu  = () => {
    document.getElementById('side-overlay')?.classList.add('open');
    document.getElementById('side-panel')?.classList.add('open');
  };
  const closeMenu = () => {
    document.getElementById('side-overlay')?.classList.remove('open');
    document.getElementById('side-panel')?.classList.remove('open');
  };

  /* ── archived toggle ── */
  const toggleArch = () => {
    State.archOpen = !State.archOpen;
    document.getElementById('arch-section')?.classList.toggle('open', State.archOpen);
    document.getElementById('arch-arrow')?.classList.toggle('open', State.archOpen);
  };

  /* ── open table ── */
  const openTable = (id) => {
    const tbl = State.tables.find(t => t.id === id);
    if (!tbl) return;
    State.activeTbl = tbl;
    if (tbl.type === 'timetable') {
      const { wk, dy } = TZ.getTodayWkDay(tbl);
      State.activeWk = wk; State.activeDy = dy;
      _setText('tt-title', tbl.name.toUpperCase());
      Views.TT.setMode('sched');
      openView('v-timetable');
    } else {
      _setText('st-title', tbl.name.toUpperCase());
      _setText('st-name',  tbl.name);
      const d   = TZ.dateInTZ(new Date(tbl.createdAt), TZ.getTZ());
      const sub = tbl.type === 'stop' ? 'STOP HABIT' : 'BUILD HABIT';
      _setText('st-sub', `${sub} · STARTED ${d.getDate()} ${State.MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`);
      Views.Streak.render();
      openView('v-streak');
    }
  };

  /* ── util ── */
  const _setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  return {
    launch, applyThemeClass, applyTheme, toggleLight,
    goHome, switchTab, openView, openMenu, closeMenu,
    toggleArch, openTable,
  };
})();

/* ════════════════════════════════
   VIEWS
════════════════════════════════ */
const Views = {};

/* ── HOME ── */
Views.Home = (() => {
  const _streak = (id) => {
    const tbl = State.tables.find(t => t.id === id);
    if (!tbl) return 0;
    const age = TZ.tableAgeDays(tbl);
    const s   = State.strkState[id] || [];
    let c = 0;
    for (let i = age-1; i >= 0; i--) { if (s[i]===1) c++; else break; }
    return c;
  };

  const _pill = (t) => {
    if (t.archived) return { cls:'pill-arch', txt:'ARCHIVED' };
    if (t.type === 'timetable') {
      const { wk, dy } = TZ.getTodayWkDay(t);
      const blks = State.blocks[t.id] || [];
      const st   = ((State.schedState[t.id]||{})[wk]||{})[dy] || [];
      const done = st.filter(s=>s===1).length;
      const tot  = blks.length;
      if (!tot)      return { cls:'pill-muted', txt:'NO BLOCKS' };
      if (!done)     return { cls:'pill-muted', txt:'NOT STARTED' };
      if (done===tot)return { cls:'pill-acc',   txt:'✓ COMPLETE' };
      return { cls:'pill-warn', txt:`${done}/${tot} DONE` };
    }
    const s = _streak(t.id);
    return s === 0 ? { cls:'pill-muted', txt:'0 DAYS' } : { cls:'pill-acc', txt:`🔥 ${s} DAYS` };
  };

  const _card = (t, delay) => {
    const meta = State.TYPE_META[t.type] || State.TYPE_META.timetable;
    const pill = _pill(t);
    const c    = document.createElement('div');
    c.className = `t-card fu fu${delay}${t.archived ? ' archived' : ''}`;
    c.innerHTML = `
      <div class="t-card-icon">${meta.icon}</div>
      <div class="t-card-body">
        <div class="t-card-name">${_esc(t.name)}</div>
        <div class="t-card-meta">${meta.label}${t.goal?' · '+_esc(t.goal.slice(0,26)):''}</div>
      </div>
      <div class="pill ${pill.cls}">${pill.txt}</div>
      <div class="t-arrow">›</div>`;
    c.onclick = () => App.openTable(t.id);
    return c;
  };

  const render = () => {
    const active   = State.tables.filter(t => !t.archived);
    const archived = State.tables.filter(t =>  t.archived);
    const al = document.getElementById('active-list');
    if (!al) return;
    al.innerHTML = '';
    if (!active.length) {
      al.innerHTML = '<div style="font-family:var(--font-m);font-size:8px;color:var(--tx3);letter-spacing:1px;padding:4px 0">NO ACTIVE TABLES — CREATE ONE BELOW</div>';
    } else {
      active.forEach((t,i) => { const c=_card(t,Math.min(i+2,6)); al.appendChild(c); });
    }
    const aw = document.getElementById('arch-wrap');
    if (!aw) return;
    if (!archived.length) { aw.style.display='none'; return; }
    aw.style.display = 'block';
    document.getElementById('arch-lbl').textContent = `ARCHIVED TABLES (${archived.length})`;
    const as = document.getElementById('arch-section');
    as.innerHTML = '';
    archived.forEach(t => as.appendChild(_card(t,1)));
  };

  return { render };
})();

/* ── TIMETABLE ── */
Views.TT = (() => {
  const _ens = (id,wk,dy,len) => {
    if (!State.schedState[id]) State.schedState[id]={};
    if (!State.schedState[id][wk]) State.schedState[id][wk]={};
    if (!State.schedState[id][wk][dy]||State.schedState[id][wk][dy].length!==len)
      State.schedState[id][wk][dy]=new Array(len).fill(0);
  };

  const setMode = (mode) => {
    State.activeTTMode = mode;
    document.getElementById('btn-mode-sched')?.classList.toggle('active', mode==='sched');
    document.getElementById('btn-mode-edit')?.classList.toggle('active',  mode==='edit');
    document.getElementById('tt-sched-panel').style.display = mode==='sched'?'block':'none';
    document.getElementById('tt-edit-panel').style.display  = mode==='edit' ?'block':'none';
    const editBtn = document.getElementById('btn-mode-edit');
    if (editBtn) editBtn.style.display = State.activeTbl?.archived ? 'none' : '';
    if (mode==='sched') { _buildWeekStrip(); _buildDayStrip(); _renderSched(); }
    else _renderEditor();
  };

  const _buildWeekStrip = () => {
    const el = document.getElementById('week-strip'); if(!el) return;
    el.innerHTML = '';
    const { wk:tw } = TZ.getTodayWkDay(State.activeTbl);
    for (let w = 0; w <= tw+1; w++) {
      const s = TZ.slotDate(State.activeTbl,w,0);
      const e = TZ.slotDate(State.activeTbl,w,6);
      const b = document.createElement('div');
      b.className = 'wk-btn' + (w===State.activeWk?' active':'');
      b.textContent = `WK ${w+1}  ${s.getDate()} ${State.MONTH_SHORT[s.getMonth()]}–${e.getDate()} ${State.MONTH_SHORT[e.getMonth()]}`;
      b.onclick = (()=>{ const ww=w; return ()=>{ State.activeWk=ww; _buildWeekStrip(); _buildDayStrip(); _renderSched(); }; })();
      el.appendChild(b);
    }
  };

  const _buildDayStrip = () => {
    const el = document.getElementById('day-strip'); if(!el) return;
    el.innerHTML = '';
    const blks = State.blocks[State.activeTbl.id] || [];
    for (let d=0; d<7; d++) {
      const dt  = TZ.slotDate(State.activeTbl, State.activeWk, d);
      const fut = TZ.isFuture(dt), tod = TZ.isToday(dt);
      _ens(State.activeTbl.id, State.activeWk, d, blks.length);
      const st   = State.schedState[State.activeTbl.id][State.activeWk][d];
      const done = st.filter(s=>s===1).length, miss=st.filter(s=>s===2).length;
      let dc = '';
      if (!fut&&done===blks.length&&blks.length>0) dc='d-full';
      else if (!fut&&done+miss>0) dc='d-part';
      const btn = document.createElement('div');
      btn.className = `day-btn ${dc}${d===State.activeDy?' active':''}`;
      btn.style.opacity = fut?'0.35':'1';
      if (tod) btn.style.boxShadow='0 0 0 1px var(--acc)';
      btn.innerHTML = `
        <div class="dbd">${State.DAY_NAMES[d]}</div>
        <div class="dbn">${dt.getDate()}</div>
        <div class="ddt">${State.MONTH_SHORT[dt.getMonth()]}</div>
        <div class="day-dot"></div>`;
      btn.onclick = (()=>{ const dd=d; return ()=>{ State.activeDy=dd; _buildDayStrip(); _renderSched(); }; })();
      el.appendChild(btn);
    }
  };

  const _renderSched = () => {
    const blks = State.blocks[State.activeTbl.id] || [];
    _ens(State.activeTbl.id, State.activeWk, State.activeDy, blks.length);
    const list  = document.getElementById('sched-list'); if(!list) return;
    list.innerHTML = '';
    const state = State.schedState[State.activeTbl.id][State.activeWk][State.activeDy];
    const dt    = TZ.slotDate(State.activeTbl, State.activeWk, State.activeDy);
    const fut   = TZ.isFuture(dt);
    // Day note
    const noteTxt = Notes.get(State.activeTbl.id, State.activeWk, State.activeDy);
    const noteTxtEl = document.getElementById('day-note-txt');
    if (noteTxtEl) noteTxtEl.value = noteTxt;
    if (!blks.length) {
      list.innerHTML='<div class="no-blocks">NO BLOCKS — TAP "EDIT BLOCKS" TO ADD</div>';
      _updateProg(0,0,0); return;
    }
    blks.forEach((blk,i) => {
      const s   = state[i]||0;
      const cls = s===1?'si-done':s===2?'si-miss':'';
      const tick= s===1?'✓':s===2?'✗':'';
      const div = document.createElement('div');
      div.className = `s-item ${cls} fu fu${Math.min(i%6+1,6)}`;
      if (fut) div.style.opacity='0.4';
      div.innerHTML = `
        <div class="s-time-block">
          <div class="s-time-start">${TZ.formatBlockTime(blk.start)}</div>
          <div class="s-time-arrow">↓</div>
          <div class="s-time-end">${TZ.formatBlockTime(blk.end)}</div>
        </div>
        <div class="s-body">
          <div class="s-name">${_esc(blk.label)}</div>
          <div class="s-tag">${_esc(blk.tag||'')}</div>
        </div>
        <div class="s-tick">${tick}</div>`;
      if (!fut && !State.activeTbl.archived) {
        div.onclick = () => {
          state[i] = (state[i]+1)%3;
          State.saveAll();
          _renderSched(); _buildDayStrip();
          _updateProg(state.filter(s=>s===1).length, state.filter(s=>s===2).length, blks.length);
          setTimeout(()=>Badges.check(), 500);
        };
      }
      list.appendChild(div);
    });
    _updateProg(state.filter(s=>s===1).length, state.filter(s=>s===2).length, blks.length);
  };

  const _updateProg = (done,miss,total) => {
    const pct = total>0?Math.round(done/total*100):0;
    document.getElementById('prog-n')    && (document.getElementById('prog-n').textContent = done);
    document.getElementById('prog-fill') && (document.getElementById('prog-fill').style.width = pct+'%');
    document.getElementById('prog-sub')  && (document.getElementById('prog-sub').textContent =
      `${pct}% complete · ${miss} missed · ${total-done-miss} remaining`);
  };

  const _renderEditor = () => {
    const blks = State.blocks[State.activeTbl.id] || [];
    const list = document.getElementById('block-list'); if(!list) return;
    list.innerHTML = '';
    if (!blks.length) { list.innerHTML='<div class="no-blocks">NO BLOCKS YET — ADD YOUR FIRST BLOCK ABOVE</div>'; return; }
    blks.forEach((blk,i) => {
      const row = document.createElement('div');
      row.className = `bl-item fu fu${Math.min(i%6+1,6)}`;
      row.innerHTML = `
        <div class="bl-time-col">${TZ.formatBlockTime(blk.start)}<br>
          <span style="color:var(--tx3)">→${TZ.formatBlockTime(blk.end)}</span></div>
        <div class="bl-info">
          <div class="bl-name">${_esc(blk.label)}</div>
          <div class="bl-tag">${_esc(blk.tag||'')}</div>
        </div>
        <div class="bl-actions">
          <button class="bl-act-btn" onclick="Views.TT.moveBlock(${i},-1)">↑</button>
          <button class="bl-act-btn" onclick="Views.TT.moveBlock(${i},1)">↓</button>
          <button class="bl-act-btn" onclick="Sheets.openEditBlock(${i})">✎</button>
          <button class="bl-act-btn del" onclick="Views.TT.deleteBlock(${i})">✕</button>
        </div>`;
      list.appendChild(row);
    });
  };

  const moveBlock = (i,dir) => {
    const blks=State.blocks[State.activeTbl.id]||[]; const ni=i+dir;
    if(ni<0||ni>=blks.length) return;
    [blks[i],blks[ni]]=[blks[ni],blks[i]];
    State.blocks[State.activeTbl.id]=blks; State.saveAll(); _renderEditor();
  };

  const deleteBlock = (i) => {
    const blks=State.blocks[State.activeTbl.id]||[];
    blks.splice(i,1); State.blocks[State.activeTbl.id]=blks;
    State.saveAll(); _renderEditor(); Toast.success('Block removed');
  };

  return { setMode, moveBlock, deleteBlock };
})();

/* ── STREAK ── */
Views.Streak = (() => {
  const _cur=(id)=>{ const tbl=State.tables.find(t=>t.id===id); if(!tbl)return 0; const age=TZ.tableAgeDays(tbl),s=State.strkState[id]||[]; let c=0; for(let i=age-1;i>=0;i--){if(s[i]===1)c++;else break;} return c; };
  const _lng=(id)=>{ const s=State.strkState[id]||[]; let c=0,b=0; s.forEach(v=>{if(v===1){c++;b=Math.max(b,c);}else c=0;}); return b; };
  const _tot=(id)=>(State.strkState[id]||[]).filter(v=>v===1).length;

  const render = () => {
    if (!State.activeTbl) return;
    const id=State.activeTbl.id, tbl=State.activeTbl;
    document.getElementById('st-count').textContent = _cur(id);
    const sr=document.getElementById('streak-stats-row');
    if(sr) sr.innerHTML=`
      <div class="streak-stat"><div class="streak-stat-val">${_lng(id)}</div><div class="streak-stat-lbl">LONGEST</div></div>
      <div class="streak-stat"><div class="streak-stat-val">${_tot(id)}</div><div class="streak-stat-lbl">TOTAL DAYS</div></div>
      <div class="streak-stat"><div class="streak-stat-val">${TZ.tableAgeDays(tbl)}</div><div class="streak-stat-lbl">AGE (DAYS)</div></div>`;
    _renderGrid();
  };

  const _renderGrid = () => {
    const tbl=State.activeTbl; if(!tbl) return;
    const id=tbl.id;
    if(!State.strkState[id]) State.strkState[id]=[];
    const tz=TZ.getTZ(), created=TZ.dateInTZ(new Date(tbl.createdAt),tz);
    const cm=TZ.midnight(created), age=TZ.tableAgeDays(tbl);
    const crDOW=cm.getDay()===0?6:cm.getDay()-1, lead=crDOW;
    const numRows=Math.ceil((lead+age)/7);
    const el=document.getElementById('sg-grid'); if(!el) return;
    el.innerHTML='';
    for(let r=0;r<numRows;r++){
      const row=document.createElement('div'); row.className='sg-row';
      for(let c=0;c<7;c++){
        const ci=r*7+c, di=ci-lead;
        const cell=document.createElement('div'); cell.className='sg-cell';
        if(di<0||di>=age){ cell.style.cssText='background:transparent;border-color:transparent'; }
        else{
          const cd=new Date(cm); cd.setDate(cm.getDate()+di);
          const isT=TZ.isToday(cd), isF=TZ.isFuture(cd);
          cell.innerHTML=`<span>${cd.getDate()}</span><span class="sg-cell-day">${State.MONTH_SHORT[cd.getMonth()]}</span>`;
          if(isF) cell.classList.add('sg-fut');
          else{
            const sv=State.strkState[id][di]||0;
            if(isT) cell.classList.add('sg-today');
            if(sv===1) cell.classList.add('sg-done'); else if(sv===2) cell.classList.add('sg-miss');
            const dii=di;
            cell.onclick=()=>{
              State.strkState[id][dii]=(State.strkState[id][dii]||0)===0?1:State.strkState[id][dii]===1?2:0;
              State.saveAll(); render(); setTimeout(()=>Badges.check(),500);
            };
          }
        }
        row.appendChild(cell);
      }
      el.appendChild(row);
    }
  };
  return { render };
})();

/* ── HISTORY ── */
Views.History = (() => {
  let _selId=null;
  const render=()=>{
    const score=Stats.getConsistencyScore();
    const sv=document.getElementById('score-val'); if(sv) sv.textContent=score;
    const rf=document.getElementById('score-ring-fill');
    if(rf){ const c=2*Math.PI*32; rf.setAttribute('stroke-dasharray',c.toFixed(1)); rf.setAttribute('stroke-dashoffset',(c-c*score/100).toFixed(1)); }
    const sis=document.getElementById('score-info-sub');
    if(sis) sis.textContent=score>=80?'Excellent consistency! Keep it up.':score>=50?'Good progress. Aim for 80+.':'Build your habit. Every day counts.';
    const tts=State.tables.filter(t=>t.type==='timetable');
    const sel=document.getElementById('history-tbl-select'); if(!sel) return;
    sel.innerHTML='';
    if(!tts.length){ sel.innerHTML='<div style="font-family:var(--font-m);font-size:8px;color:var(--tx3)">No timetables yet</div>'; return; }
    if(!_selId||!tts.find(t=>t.id===_selId)) _selId=tts[0].id;
    tts.forEach(t=>{ const b=document.createElement('div'); b.className='wk-btn'+(t.id===_selId?' active':''); b.textContent=t.name; b.onclick=()=>{_selId=t.id;render();}; sel.appendChild(b); });
    const tbl=tts.find(t=>t.id===_selId); if(!tbl) return;
    _renderWeekly(tbl); _renderHeatmap(tbl); _renderBlockStats(tbl);
  };

  const _renderWeekly=(tbl)=>{
    const wrap=document.getElementById('weekly-review-wrap'); if(!wrap) return;
    wrap.innerHTML='';
    const{wk:tw}=TZ.getTodayWkDay(tbl);
    for(let w=tw;w>=Math.max(0,tw-2);w--){
      const sum=Stats.getWeeklySummary(tbl,w); if(!sum) continue;
      const ins=Stats.generateReviewText(tbl,w);
      const s=TZ.slotDate(tbl,w,0),e=TZ.slotDate(tbl,w,6);
      const card=document.createElement('div'); card.className='review-card fu';
      card.innerHTML=`
        <div class="review-week-lbl">WEEK ${w+1} · ${s.getDate()} ${State.MONTH_SHORT[s.getMonth()]} – ${e.getDate()} ${State.MONTH_SHORT[e.getMonth()]} ${e.getFullYear()}</div>
        <div style="display:flex;align-items:flex-end;gap:12px;margin-bottom:12px">
          <div><div class="review-score">${sum.overallPct}<span style="font-size:20px;color:var(--tx2)">%</span></div><div class="review-score-lbl">WEEKLY SCORE</div></div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;flex:1;align-items:flex-end">
            ${sum.dayPcts.map((p,i)=>{ const h=p!==null?Math.max(4,p*.4):4; const col=p===null?'var(--bg4)':p>=80?'var(--acc)':p>=50?'var(--amber)':'var(--red)';
              return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px">
                <div style="width:100%;height:40px;background:var(--bg4);border-radius:3px;overflow:hidden;display:flex;align-items:flex-end">
                  <div style="width:100%;height:${h}px;background:${col};border-radius:3px"></div>
                </div>
                <div style="font-family:var(--font-m);font-size:7px;color:var(--tx3)">${State.DAY_NAMES[i][0]}</div>
              </div>`; }).join('')}
          </div>
        </div>
        <div class="review-insights">${ins.map(i=>`<div class="review-insight">${i}</div>`).join('')}</div>`;
      wrap.appendChild(card);
    }
  };

  const _renderHeatmap=(tbl)=>{
    const wrap=document.getElementById('heatmap-wrap'); if(!wrap) return;
    wrap.style.display='block';
    document.getElementById('heatmap-title').textContent=tbl.name.toUpperCase()+' · HEATMAP';
    const data=Heatmap.getData(tbl,84);
    const grid=document.getElementById('heatmap-grid'); if(!grid) return;
    grid.innerHTML='';
    data.forEach(d=>{ const c=document.createElement('div'); c.className='hm-cell '+Heatmap.pctToClass(d.pct); c.title=`${d.date.getDate()} ${State.MONTH_SHORT[d.date.getMonth()]}: ${d.pct}%`; grid.appendChild(c); });
  };

  const _renderBlockStats=(tbl)=>{
    const wrap=document.getElementById('block-stats-wrap'),list=document.getElementById('block-stats-list');
    const stats=Stats.getBlockStats(tbl.id);
    if(!stats.length||!wrap){ if(wrap) wrap.style.display='none'; return; }
    wrap.style.display='block'; list.innerHTML='';
    stats.forEach(s=>{ const pct=s.total>0?Math.round(s.done/s.total*100):0; const row=document.createElement('div'); row.className='block-stat-item';
      row.innerHTML=`<div class="bs-name">${_esc(s.label)}</div><div class="bs-bars"><div class="bs-bar bs-done" style="width:${Math.max(4,pct)}px"></div>${s.miss>0?`<div class="bs-bar bs-miss" style="width:${Math.max(2,s.miss/s.total*40)}px"></div>`:''}</div><div class="bs-pct">${pct}%</div>`;
      list.appendChild(row); });
  };
  return{render};
})();

/* ── BADGES ── */
Views.Badges = (() => {
  const render=()=>{
    const all=Badges.getAll(), earned=all.filter(b=>b.earned).length;
    document.getElementById('badges-count').textContent=`${earned} / ${all.length} EARNED`;
    const grid=document.getElementById('badges-grid'); if(!grid) return;
    grid.innerHTML='';
    all.forEach(b=>{ const c=document.createElement('div'); c.className=`badge-card${b.earned?' earned':' locked'}`;
      c.innerHTML=`<div class="badge-icon">${b.icon}</div><div class="badge-name">${b.name}</div><div class="badge-desc">${b.desc}</div>${b.earned&&b.earnedAt?`<div class="badge-earned-date">${_fmtD(b.earnedAt)}</div>`:b.earned?'':'<div style="font-family:var(--font-m);font-size:7px;color:var(--tx3);margin-top:4px">🔒 LOCKED</div>'}`;
      grid.appendChild(c); });
    document.getElementById('badge-dot')?.classList.toggle('show', earned>0);
  };
  const _fmtD=iso=>{ const d=new Date(iso); return `${d.getDate()} ${State.MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`; };
  return{render};
})();

/* ════════════════════════════════
   SHEETS
════════════════════════════════ */
const Sheets = (() => {
  const _open  = id => document.getElementById(id)?.classList.add('open');
  const _close = id => document.getElementById(id)?.classList.remove('open');

  /* ── New Table ── */
  let _newType='timetable', _newSched='default';
  const openNew=()=>{
    _newType='timetable'; _newSched='default';
    ['tt','build','stop'].forEach(k=>document.getElementById('to-'+k)?.classList.remove('sel'));
    document.getElementById('to-tt')?.classList.add('sel');
    ['st-default','st-custom'].forEach(k=>document.getElementById(k)?.classList.remove('sel'));
    document.getElementById('st-default')?.classList.add('sel');
    document.getElementById('sched-type-section').style.display='block';
    document.getElementById('new-name').value='';
    document.getElementById('new-goal').value='';
    _open('ov-new');
  };
  const pickType=(t)=>{
    _newType=t;
    const m={timetable:'tt',build:'build',stop:'stop'};
    ['tt','build','stop'].forEach(k=>document.getElementById('to-'+k)?.classList.remove('sel'));
    document.getElementById('to-'+m[t])?.classList.add('sel');
    document.getElementById('sched-type-section').style.display=t==='timetable'?'block':'none';
  };
  const pickSchedType=(t)=>{
    _newSched=t;
    ['st-default','st-custom'].forEach(k=>document.getElementById(k)?.classList.remove('sel'));
    document.getElementById('st-'+t)?.classList.add('sel');
  };
  const saveNew=()=>{
    const name=document.getElementById('new-name').value.trim();
    if(!name){ document.getElementById('new-name').focus(); return; }
    const id='tbl_'+Date.now();
    // Fix: build new arrays to force reactivity, don't just push
    const newTable = {id,name,type:_newType,
      goal:document.getElementById('new-goal').value.trim(),
      createdAt:new Date().toISOString(),archived:false,
      schedType:_newType==='timetable'?_newSched:'none'};
    State.tables = [...State.tables, newTable];
    if(_newType==='timetable'){
      const blks = _newSched==='default'
        ? State.DEFAULT_BLOCKS.map((b,i)=>({id:'b'+i,label:b.label,tag:b.tag,start:b.start,end:b.end}))
        : [];
      State.blocks = {...State.blocks, [id]: blks};
    }
    // Explicitly write to user storage then save
    State.saveAll();
    _close('ov-new');
    Views.Home.render();
    Toast.success('Table created!');
    setTimeout(()=>Badges.check(),500);
  };

  /* ── Blocks ── */
  let _editIdx=-1;
  const openAddBlock=()=>{ _editIdx=-1; document.getElementById('block-sheet-title').textContent='ADD BLOCK'; ['bl-label','bl-tag','bl-start','bl-end'].forEach(id=>{ const el=document.getElementById(id); if(el)el.value=''; }); _open('ov-block'); };
  const openEditBlock=(i)=>{ _editIdx=i; const blk=(State.blocks[State.activeTbl.id]||[])[i]; if(!blk)return; document.getElementById('block-sheet-title').textContent='EDIT BLOCK'; document.getElementById('bl-label').value=blk.label; document.getElementById('bl-tag').value=blk.tag||''; document.getElementById('bl-start').value=blk.start; document.getElementById('bl-end').value=blk.end; _open('ov-block'); };
  const saveBlock=()=>{
    const label=document.getElementById('bl-label').value.trim(), start=document.getElementById('bl-start').value, end=document.getElementById('bl-end').value;
    if(!label){ document.getElementById('bl-label').focus(); return; }
    if(!start||!end){ document.getElementById('bl-start').focus(); return; }
    const blk={id:'b'+Date.now(),label,tag:document.getElementById('bl-tag').value.trim().toUpperCase(),start,end};
    const blks=State.blocks[State.activeTbl.id]||[];
    if(_editIdx===-1) blks.push(blk); else blks[_editIdx]=blk;
    State.blocks[State.activeTbl.id]=blks; State.saveAll(); _close('ov-block');
    Views.TT.setMode('edit'); Toast.success(_editIdx===-1?'Block added!':'Block updated!');
  };

  /* ── Profile ── */
  const openProfile=()=>{ const u=State.me(); if(!u)return; document.getElementById('p-name').value=u.name; document.getElementById('p-aim').value=u.aim||''; const d=TZ.dateInTZ(new Date(u.joinedAt),TZ.getTZ()); document.getElementById('p-date').value=`${d.getDate()} ${State.MONTH_FULL[d.getMonth()]} ${d.getFullYear()}`; _open('ov-profile'); };
  const saveProfile=()=>{ const name=document.getElementById('p-name').value.trim(); if(!name){document.getElementById('p-name').focus();return;} const u=State.me(); u.name=name; u.aim=document.getElementById('p-aim').value.trim(); State.saveGlobal(); App.applyThemeClass(u.theme); document.getElementById('greet-name').textContent=name.toUpperCase(); document.getElementById('menu-name').textContent=name; document.getElementById('profile-name').textContent=name; document.getElementById('menu-avatar').textContent=name.charAt(0).toUpperCase(); document.getElementById('profile-avatar').textContent=name.charAt(0).toUpperCase(); document.getElementById('profile-aim-disp').textContent=u.aim||'–'; document.getElementById('greet-aim').textContent=u.aim?'↳ '+u.aim:''; _close('ov-profile'); Toast.success('Profile updated!'); };

  /* ── Timezone ── */
  let _tempTZ='';
  const openTZ=()=>{ App.closeMenu(); _tempTZ=TZ.getTZ(); _buildTZGrid('tz-grid-settings',_tempTZ,tz=>{_tempTZ=tz;}); _open('ov-tz'); };
  const saveTZ=()=>{ if(_tempTZ){const u=State.me();if(u){u.tz=_tempTZ;State.saveGlobal();}} _close('ov-tz'); Clock.tick(); Toast.success('Timezone updated!'); };

  /* ── Time Format ── */
  const openTimeFmt=()=>{ const u=State.me(); if(!u)return; document.querySelectorAll('#ov-timefmt .time-fmt-opt').forEach(el=>el.classList.toggle('sel',el.dataset.fmt===u.timeFmt)); _open('ov-timefmt'); };
  const saveTimeFmt=()=>{ const sel=document.querySelector('#ov-timefmt .time-fmt-opt.sel'); if(!sel)return; const u=State.me(); if(u){u.timeFmt=sel.dataset.fmt;State.saveGlobal();} _close('ov-timefmt'); Clock.tick(); document.getElementById('prof-fmt-sub').textContent=sel.dataset.fmt==='12h'?'12-Hour (AM/PM)':'24-Hour'; Toast.success('Time format updated!'); };

  /* ── Alert Settings ── */
  let _alertDraft={};
  const openAlertSettings=()=>{ App.closeMenu(); _alertDraft={...State.alertCfg}; const cfg=_alertDraft; document.getElementById('alert-enabled-toggle')?.classList.toggle('on',!!cfg.enabled); document.getElementById('auto-detect-toggle')?.classList.toggle('on',!!cfg.autoDetect); document.getElementById('voice-toggle')?.classList.toggle('on',cfg.voiceEnabled!==false); document.getElementById('alarm-toggle')?.classList.toggle('on',!!cfg.alarmEnabled); document.getElementById('alert-volume').value=cfg.volume??0.9; document.getElementById('alarm-volume').value=cfg.alarmVolume??0.8; ['strict','friendly','motivational'].forEach(p=>document.getElementById('vp-'+p)?.classList.toggle('sel',cfg.personality===p)); _renderManualTimes(); _open('ov-alert'); };
  const toggleAlertEnabled=()=>{ _alertDraft.enabled=!_alertDraft.enabled; document.getElementById('alert-enabled-toggle')?.classList.toggle('on',_alertDraft.enabled); };
  const toggleAutoDetect=()=>{ _alertDraft.autoDetect=!_alertDraft.autoDetect; document.getElementById('auto-detect-toggle')?.classList.toggle('on',_alertDraft.autoDetect); };
  const toggleVoice=()=>{ _alertDraft.voiceEnabled=!_alertDraft.voiceEnabled; document.getElementById('voice-toggle')?.classList.toggle('on',_alertDraft.voiceEnabled); };
  const toggleAlarm=()=>{ _alertDraft.alarmEnabled=!_alertDraft.alarmEnabled; document.getElementById('alarm-toggle')?.classList.toggle('on',_alertDraft.alarmEnabled); };
  const pickPersonality=(p)=>{ _alertDraft.personality=p; ['strict','friendly','motivational'].forEach(k=>document.getElementById('vp-'+k)?.classList.toggle('sel',k===p)); Widget.speak(State.VOICE_PERSONALITIES[p].messages[0].replace(/{name}/g,State.me()?.name||'Friend')); };
  const addManualTime=()=>{ const val=document.getElementById('manual-time-inp').value; if(!val)return; if(!_alertDraft.manualTimes)_alertDraft.manualTimes=[]; if(!_alertDraft.manualTimes.includes(val)){_alertDraft.manualTimes.push(val);_renderManualTimes();} };
  const _renderManualTimes=()=>{ const el=document.getElementById('manual-times-list'); if(!el)return; el.innerHTML=''; (_alertDraft.manualTimes||[]).forEach(t=>{ const c=document.createElement('div'); c.style.cssText='display:inline-flex;align-items:center;gap:6px;background:var(--bg3);border:1px solid var(--bd2);border-radius:20px;padding:4px 10px;font-family:var(--font-m);font-size:9px;color:var(--tx2);margin:2px'; c.innerHTML=`${t} <span style="cursor:pointer;color:var(--red)" onclick="this.parentElement.remove()">✕</span>`; el.appendChild(c); }); };
  const saveAlertSettings=()=>{ _alertDraft.volume=parseFloat(document.getElementById('alert-volume').value); _alertDraft.alarmVolume=parseFloat(document.getElementById('alarm-volume').value); State.alertCfg=_alertDraft; State.saveAll(); Widget.stop(); Widget.start(); _close('ov-alert'); Toast.success('Alert settings saved!'); };
  const testAlert=()=>{ Widget.trigger(); };

  /* ── Manage Tables ── */
  const openManage=()=>{ App.closeMenu(); const list=document.getElementById('manage-list'); if(!list)return; list.innerHTML=''; if(!State.tables.length){list.innerHTML='<div style="font-family:var(--font-m);font-size:8px;color:var(--tx3);letter-spacing:1px;padding:6px 0">NO TABLES YET</div>';}else{ State.tables.forEach(t=>{ const meta=State.TYPE_META[t.type]||State.TYPE_META.timetable; const row=document.createElement('div'); row.className='manage-item'; row.innerHTML=`<div class="manage-item-icon">${meta.icon}</div><div class="manage-item-name">${_esc(t.name)}</div>${t.archived?`<span class="pill pill-arch" style="margin-right:4px">ARCHIVED</span>`:`<button class="arch-btn" onclick="_archiveTable('${t.id}','${_esc(t.name)}')">📦</button>`}<button class="del-btn" onclick="_deleteTable('${t.id}','${_esc(t.name)}')">✕</button>`; list.appendChild(row); }); } _open('ov-manage'); };

  /* ── PIN Manager ── */
  const openPINMgr=()=>{ Auth.renderPinManager('pin-mgr-slots'); _open('ov-pin-mgr'); };

  return { openNew,pickType,pickSchedType,saveNew, openAddBlock,openEditBlock,saveBlock, openProfile,saveProfile, openTZ,saveTZ, openTimeFmt,saveTimeFmt, openAlertSettings,toggleAlertEnabled,toggleAutoDetect,toggleVoice,toggleAlarm,pickPersonality,addManualTime,saveAlertSettings,testAlert, openManage,openPINMgr };
})();

/* ── TABLE ACTIONS (global for onclick) ── */
async function _archiveTable(id,name){
  const ok=await Confirm.show({icon:'📦',title:'ARCHIVE TABLE?',msg:`"${name}" will be marked as ended. Data is kept.`,confirmLabel:'YES, ARCHIVE',danger:false});
  if(!ok) return;
  const t=State.tables.find(t=>t.id===id); if(t)t.archived=true;
  State.saveAll(); Sheets.openManage(); Views.Home.render(); Toast.success('Table archived');
}
async function _deleteTable(id,name){
  const ok=await Confirm.show({icon:'🗑️',title:'DELETE TABLE?',msg:`"${name}" and ALL data will be permanently removed. This cannot be undone.`,confirmLabel:'YES, DELETE',danger:true});
  if(!ok) return;
  State.tables=State.tables.filter(t=>t.id!==id);
  delete State.schedState[id]; delete State.strkState[id]; delete State.blocks[id];
  State.saveAll(); Sheets.openManage(); Views.Home.render(); Toast.success('Table deleted');
}

/* ════════════════════════════════
   TZ GRID BUILDER
════════════════════════════════ */
function _buildTZGrid(gridId, selectedTZ, onPick) {
  const g=document.getElementById(gridId); if(!g) return;
  g.innerHTML='';
  State.TZ_LIST.forEach(t=>{
    const d=document.createElement('div');
    d.className='tz-opt'+(t.tz===selectedTZ?' sel':'');
    d.innerHTML=`<div class="tz-name">${t.name}</div><div class="tz-off">${t.off}</div>`;
    d.onclick=()=>{ g.querySelectorAll('.tz-opt').forEach(e=>e.classList.remove('sel')); d.classList.add('sel'); onPick(t.tz); };
    g.appendChild(d);
  });
}

/* ════════════════════════════════
   UTIL
════════════════════════════════ */
function _esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ════════════════════════════════
   BOOT
════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  // Load voices for speech synthesis
  window.speechSynthesis?.getVoices();
  window.speechSynthesis?.addEventListener('voiceschanged', ()=>window.speechSynthesis.getVoices());

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  }

  if (State.users.length === 0) {
    // First ever launch — go to setup
    Auth.startSetup();
  } else {
    // Show user switcher
    Auth.showSwitcher();
  }
});

/* ═══════════════════════════════════════
   LIFEPLAN v6 — FEATURES
   js/features/badges.js
   Contains: Badges, Stats, Notes, Heatmap, Quotes, Export
═══════════════════════════════════════ */

/* ════════════════════════════════
   BADGES ENGINE
════════════════════════════════ */
const Badges = (() => {
  const _totalDone = () => {
    let c = 0;
    Object.values(State.schedState).forEach(tbl =>
      Object.values(tbl).forEach(wk =>
        Object.values(wk).forEach(dy =>
          dy.forEach(s => { if (s === 1) c++; }))));
    return c;
  };

  const _perfectDay = () =>
    Object.entries(State.schedState).some(([id, tbl]) => {
      const blks = State.blocks[id] || [];
      if (!blks.length) return false;
      return Object.values(tbl).some(wk =>
        Object.values(wk).some(dy =>
          dy.length === blks.length && dy.every(s => s === 1)));
    });

  const _maxStreak = () => {
    let max = 0;
    State.tables.filter(t => t.type !== 'timetable').forEach(t => {
      const s = State.strkState[t.id] || [];
      let cur = 0, best = 0;
      s.forEach(v => { if (v === 1) { cur++; best = Math.max(best, cur); } else cur = 0; });
      max = Math.max(max, best);
    });
    return max;
  };

  const _fullWeek = () =>
    Object.entries(State.schedState).some(([id, tbl]) => {
      const blks = State.blocks[id] || [];
      if (!blks.length) return false;
      return Object.values(tbl).some(wk => {
        const days = Object.values(wk);
        return days.length >= 5 &&
          days.every(dy => dy.filter(s => s === 1).length >= Math.ceil(blks.length * 0.6));
      });
    });

  const CHECKS = {
    first_tick:   () => _totalDone() >= 1,
    day_complete: () => _perfectDay(),
    streak_3:     () => _maxStreak() >= 3,
    streak_7:     () => _maxStreak() >= 7,
    streak_14:    () => _maxStreak() >= 14,
    streak_30:    () => _maxStreak() >= 30,
    week_done:    () => _fullWeek(),
    tables_3:     () => State.tables.length >= 3,
    consistent:   () => Stats.getConsistencyScore() >= 80,
    early_bird:   () => _totalDone() > 0,
  };

  const check = () => {
    const newBadges = [];
    State.BADGE_DEFS.forEach(def => {
      if (State.badges[def.id]) return;
      try {
        if (CHECKS[def.id] && CHECKS[def.id]()) {
          State.badges[def.id] = { earnedAt: new Date().toISOString() };
          newBadges.push(def);
        }
      } catch(e) {}
    });
    if (newBadges.length) {
      State.saveAll();
      newBadges.forEach(_popup);
    }
    return newBadges;
  };

  const _popup = (b) => {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed', 'top:50%', 'left:50%',
      'transform:translate(-50%,-50%)',
      'z-index:9999', 'background:var(--bg2)',
      'border:1px solid var(--acc-b)',
      'border-radius:16px', 'padding:28px 24px',
      'text-align:center',
      'box-shadow:0 8px 40px rgba(0,0,0,.7)',
      'animation:badgePop .4s cubic-bezier(.34,1.56,.64,1) both',
    ].join(';');
    el.innerHTML = `
      <div style="font-size:52px;margin-bottom:10px">${b.icon}</div>
      <div style="font-family:var(--font-m);font-size:8px;color:var(--acc);letter-spacing:2px;margin-bottom:6px">BADGE UNLOCKED</div>
      <div style="font-size:22px;font-weight:800;letter-spacing:1px;margin-bottom:4px">${b.name}</div>
      <div style="font-family:var(--font-m);font-size:9px;color:var(--tx2);letter-spacing:.5px">${b.desc}</div>`;
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity .3s';
      setTimeout(() => el.remove(), 320);
    }, 2800);
    if (State.alertCfg?.voiceEnabled !== false) {
      setTimeout(() => Widget.speak(`Congratulations! You earned the ${b.name} badge!`), 300);
    }
  };

  const getAll = () => State.BADGE_DEFS.map(def => ({
    ...def,
    earned:   !!State.badges[def.id],
    earnedAt: State.badges[def.id]?.earnedAt || null,
  }));

  return { check, getAll };
})();


/* ════════════════════════════════
   STATS ENGINE
════════════════════════════════ */
const Stats = (() => {
  const getConsistencyScore = () => {
    const tt = State.tables.filter(t => !t.archived && t.type === 'timetable');
    if (!tt.length) return 0;
    let total = 0, days = 0;
    tt.forEach(tbl => {
      const blks = State.blocks[tbl.id] || [];
      if (!blks.length) return;
      const { wk: tw, dy: td } = TZ.getTodayWkDay(tbl);
      for (let w = Math.max(0, tw - 4); w <= tw; w++) {
        for (let d = 0; d < 7; d++) {
          if (w === tw && d > td) continue;
          const dt = TZ.slotDate(tbl, w, d);
          if (TZ.isFuture(dt)) continue;
          const st   = ((State.schedState[tbl.id] || {})[w] || {})[d] || [];
          const done = st.filter(s => s === 1).length;
          total += done / blks.length * 100;
          days++;
        }
      }
    });
    return days > 0 ? Math.round(total / days) : 0;
  };

  const getBlockStats = (id) => {
    const blks = State.blocks[id] || [];
    if (!blks.length) return [];
    const stats = blks.map(b => ({ ...b, done:0, miss:0, total:0 }));
    Object.values(State.schedState[id] || {}).forEach(wk =>
      Object.values(wk).forEach(dy =>
        dy.forEach((s, i) => {
          if (i >= stats.length) return;
          stats[i].total++;
          if (s === 1) stats[i].done++;
          if (s === 2) stats[i].miss++;
        })));
    return stats;
  };

  const getWeeklySummary = (tbl, wk) => {
    const blks = State.blocks[tbl.id] || [];
    if (!blks.length) return null;
    let done = 0, total = 0, bestDay = -1, bestDone = -1;
    const dayPcts = [];
    for (let d = 0; d < 7; d++) {
      const dt = TZ.slotDate(tbl, wk, d);
      if (TZ.isFuture(dt)) { dayPcts.push(null); continue; }
      const st  = ((State.schedState[tbl.id] || {})[wk] || {})[d] || [];
      const dn  = st.filter(s => s === 1).length;
      const pct = Math.round(dn / blks.length * 100);
      dayPcts.push(pct);
      done  += dn;
      total += blks.length;
      if (dn > bestDone) { bestDone = dn; bestDay = d; }
    }
    return {
      overallPct:  total > 0 ? Math.round(done / total * 100) : 0,
      dayPcts, bestDay, totalDone: done, totalBlocks: total,
    };
  };

  const generateReviewText = (tbl, wk) => {
    const s = getWeeklySummary(tbl, wk);
    if (!s) return [];
    const ins = [`You completed ${s.overallPct}% of your schedule this week.`];
    if (s.bestDay >= 0)
      ins.push(`Your best day was ${State.DAY_FULL[s.bestDay]} with ${s.dayPcts[s.bestDay]}% completion.`);
    const missed = s.dayPcts.filter(p => p !== null && p < 50).length;
    if (missed > 0)
      ins.push(`${missed} day${missed > 1 ? 's' : ''} fell below 50%. Focus on consistency next week.`);
    ins.push(s.overallPct >= 80
      ? 'Outstanding week! Keep up this momentum.'
      : s.overallPct >= 50
        ? 'Good effort. Push for 80% next week.'
        : 'Tough week. Small steps forward still count.');
    return ins;
  };

  return { getConsistencyScore, getBlockStats, getWeeklySummary, generateReviewText };
})();


/* ════════════════════════════════
   NOTES
════════════════════════════════ */
const Notes = (() => {
  const key = (id, wk, dy) => `${id}_${wk}_${dy}`;
  const get = (id, wk, dy)       => (State.notes[key(id, wk, dy)] || '');
  const set = (id, wk, dy, text) => { State.notes[key(id, wk, dy)] = text; State.saveAll(); };
  return { get, set };
})();


/* ════════════════════════════════
   HEATMAP
════════════════════════════════ */
const Heatmap = (() => {
  const getData = (tbl, days = 84) => {
    const blks = State.blocks[tbl.id] || [];
    if (!blks.length) return [];
    const result = [];
    const { wk: tw } = TZ.getTodayWkDay(tbl);
    for (let w = 0; w <= tw; w++) {
      for (let d = 0; d < 7; d++) {
        const dt = TZ.slotDate(tbl, w, d);
        if (TZ.isFuture(dt)) continue;
        const st   = ((State.schedState[tbl.id] || {})[w] || {})[d] || [];
        const done = st.filter(s => s === 1).length;
        result.push({ date: dt, pct: Math.round(done / blks.length * 100), done, total: blks.length });
      }
    }
    return result.slice(-days);
  };

  const pctToClass = p =>
    p === 0 ? 'hm-0' : p < 50 ? 'hm-25' : p < 75 ? 'hm-50' : p < 100 ? 'hm-75' : 'hm-100';

  return { getData, pctToClass };
})();


/* ════════════════════════════════
   QUOTES
════════════════════════════════ */
const Quotes = (() => {
  const getToday = () => {
    const d = TZ.now();
    return State.QUOTES[(d.getDate() + d.getMonth() * 31) % State.QUOTES.length];
  };
  const getRandom = () => State.QUOTES[Math.floor(Math.random() * State.QUOTES.length)];
  return { getToday, getRandom };
})();


/* ════════════════════════════════
   EXPORT
════════════════════════════════ */
const Export = (() => {
  const backupData = () => {
    const data = Storage.exportAll();
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url,
      download: `lifeplan_backup_${new Date().toISOString().split('T')[0]}.json`,
    });
    a.click();
    URL.revokeObjectURL(url);
    Toast.success('Backup downloaded');
  };

  const restoreData = (file) => new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const ok = Storage.importAll(e.target.result);
      if (ok) { Toast.success('Data restored! Reloading…'); setTimeout(() => location.reload(), 1200); }
      else    { Toast.error('Invalid backup file'); }
      resolve(ok);
    };
    reader.readAsText(file);
  });

  return { backupData, restoreData };
})();

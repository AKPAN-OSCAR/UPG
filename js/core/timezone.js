/* ═══════════════════════════════════════
   LIFEPLAN v6 — TIMEZONE & DATE
   js/core/timezone.js
═══════════════════════════════════════ */
const TZ = (() => {
  const getTZ  = ()    => State.me()?.tz || 'Africa/Lagos';
  const getFmt = ()    => State.me()?.timeFmt || '24h';
  const nowInTZ= (tz)  => { try{return new Date(new Date().toLocaleString('en-US',{timeZone:tz}))}catch(e){return new Date()} };
  const dateInTZ=(d,tz)=> { try{return new Date(d.toLocaleString('en-US',{timeZone:tz}))}catch(e){return d} };
  const now    = ()    => nowInTZ(getTZ());

  const formatTime = (d, fmt) => {
    const f = fmt || getFmt();
    if (f === '12h') {
      let h=d.getHours(), m=String(d.getMinutes()).padStart(2,'0');
      const ampm = h>=12?'PM':'AM';
      h = h%12||12;
      return `${h}:${m} ${ampm}`;
    }
    return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  };

  const formatBlockTime = (str) => {
    // str is "HH:MM" 24h
    if (getFmt() === '12h') {
      const [hh,mm] = str.split(':').map(Number);
      const ampm = hh>=12?'PM':'AM';
      const h12  = hh%12||12;
      return `${h12}:${String(mm).padStart(2,'0')} ${ampm}`;
    }
    return str;
  };

  const formatFullDate  = d => { const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']; return `${days[d.getDay()]} · ${d.getDate()} ${State.MONTH_FULL[d.getMonth()]} ${d.getFullYear()}`; };
  const formatShortDate = d => `${d.getDate()} ${State.MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  const todayDOW = () => { const d=now().getDay(); return d===0?6:d-1; };
  const midnight = d  => new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const isToday  = d  => { const n=now(); return d.getDate()===n.getDate()&&d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear(); };
  const isFuture = d  => { const nm=midnight(now()),dm=midnight(d); return dm>nm; };
  const isPast   = d  => { const nm=midnight(now()),dm=midnight(d); return dm<nm; };
  const daysBetween=(a,b)=>Math.round((midnight(b)-midnight(a))/86400000);

  const slotDate = (tbl,wk,dy) => {
    const created=dateInTZ(new Date(tbl.createdAt),getTZ());
    const cm=midnight(created);
    const crDOW=cm.getDay()===0?6:cm.getDay()-1;
    const ws=new Date(cm); ws.setDate(cm.getDate()-crDOW+wk*7);
    const d=new Date(ws); d.setDate(ws.getDate()+dy);
    return d;
  };

  const getTodayWkDay = tbl => {
    const n=nowInTZ(getTZ()),created=dateInTZ(new Date(tbl.createdAt),getTZ());
    const nm=midnight(n),cm=midnight(created);
    const diff=Math.max(0,Math.floor((nm-cm)/86400000));
    return {wk:Math.floor(diff/7),dy:todayDOW()};
  };

  const tableAgeDays = tbl => {
    const n=nowInTZ(getTZ()),created=dateInTZ(new Date(tbl.createdAt),getTZ());
    return Math.max(1,Math.floor((midnight(n)-midnight(created))/86400000)+1);
  };

  const greeting = () => { const h=now().getHours(); return h<12?'GOOD MORNING':h<17?'GOOD AFTERNOON':'GOOD EVENING'; };

  return {getTZ,getFmt,nowInTZ,dateInTZ,now,formatTime,formatBlockTime,formatFullDate,
          formatShortDate,todayDOW,midnight,isToday,isFuture,isPast,daysBetween,
          slotDate,getTodayWkDay,tableAgeDays,greeting};
})();


/* ═══════════════════════════════════════
   LIFEPLAN v6 — TOAST
   js/components/toast.js
═══════════════════════════════════════ */
const Toast = (() => {
  const show = (msg, type='default', ms=2600) => {
    const c=document.getElementById('toast-container');
    const t=document.createElement('div');
    t.className=`toast ${type}`; t.textContent=msg;
    c.appendChild(t);
    setTimeout(()=>{ t.style.cssText='opacity:0;transform:translateY(6px);transition:all .25s ease'; setTimeout(()=>t.remove(),260); },ms);
  };
  return { show, success:m=>show(m,'success'), error:m=>show(m,'error'), warning:m=>show(m,'warning') };
})();


/* ═══════════════════════════════════════
   LIFEPLAN v6 — CONFIRM
   js/components/confirm.js
═══════════════════════════════════════ */
const Confirm = (() => {
  let _res=null;
  const show=({icon='⚠️',title,msg,confirmLabel='CONFIRM',danger=true})=>new Promise(resolve=>{
    _res=resolve;
    document.getElementById('conf-icon').textContent=icon;
    document.getElementById('conf-title').textContent=title;
    document.getElementById('conf-msg').textContent=msg;
    const btn=document.getElementById('conf-btn');
    btn.textContent=confirmLabel;
    btn.className=danger?'btn btn-danger':'btn btn-primary';
    document.getElementById('ov-confirm').classList.add('open');
  });
  const resolve=v=>{ document.getElementById('ov-confirm').classList.remove('open'); if(_res){_res(v);_res=null;} };
  return {show,resolve};
})();


/* ═══════════════════════════════════════
   LIFEPLAN v6 — WIDGET + VOICE + ALARM
   js/features/widget.js
═══════════════════════════════════════ */
const Widget = (() => {
  let snoozeUntil=null, checkInterval=null;
  let _audioCtx=null;

  // ── ALARM SOUND (Web Audio API) ──
  const playAlarm = (volume=0.8) => {
    try {
      _audioCtx = _audioCtx || new (window.AudioContext||window.webkitAudioContext)();
      const ctx = _audioCtx;
      const freqs = [880,1100,880,1100];
      let t = ctx.currentTime;
      freqs.forEach(freq => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type='sine'; osc.frequency.value=freq;
        gain.gain.setValueAtTime(0,t);
        gain.gain.linearRampToValueAtTime(volume,t+.05);
        gain.gain.linearRampToValueAtTime(0,t+.3);
        osc.start(t); osc.stop(t+.35);
        t += .4;
      });
    } catch(e) { console.warn('Audio error',e); }
  };

  // ── VOICE ──
  const speak = text => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const cfg=State.alertCfg;
    const p=State.VOICE_PERSONALITIES[cfg.personality||'friendly'];
    const utt=new SpeechSynthesisUtterance(text);
    utt.pitch=p.pitch||1; utt.rate=p.rate||1; utt.volume=cfg.volume??0.9;
    const voices=window.speechSynthesis.getVoices();
    const v=voices.find(v=>v.lang.startsWith('en')&&(v.name.includes('Google')||v.name.includes('Natural')))||voices.find(v=>v.lang.startsWith('en'))||voices[0];
    if(v) utt.voice=v;
    window.speechSynthesis.speak(utt);
  };

  const buildMsg = () => {
    const cfg=State.alertCfg;
    const p=State.VOICE_PERSONALITIES[cfg.personality||'friendly'];
    const msgs=p.messages;
    const msg=msgs[Math.floor(Math.random()*msgs.length)];
    return msg.replace(/{name}/g, State.me()?.name||'Friend');
  };

  // ── PROGRESS ──
  const getProgress = () => {
    const tt=State.tables.filter(t=>!t.archived&&t.type==='timetable');
    if(!tt.length) return {done:0,total:0,pct:0};
    let done=0,total=0;
    tt.forEach(tbl=>{
      const{wk,dy}=TZ.getTodayWkDay(tbl);
      const blks=(State.blocks[tbl.id]||[]);
      const st=((State.schedState[tbl.id]||{})[wk]||{})[dy]||[];
      total+=blks.length; done+=st.filter(s=>s===1).length;
    });
    return {done,total,pct:total>0?Math.round(done/total*100):0};
  };

  // ── SHOW ──
  const show = () => {
    if(snoozeUntil&&new Date()<snoozeUntil) return;
    const p=getProgress();
    if(!p.total||p.pct===100) return;
    const msg=buildMsg();
    const name=State.me()?.name||'?';
    const w=document.getElementById('alert-widget');
    w.querySelector('.widget-msg').textContent=msg;
    w.querySelector('.widget-sub').textContent=`${p.done}/${p.total} tasks done today · ${p.pct}%`;
    w.querySelector('.widget-prog-fill').style.width=p.pct+'%';
    w.querySelector('.widget-avatar').textContent=name.charAt(0).toUpperCase();
    w.classList.add('show');
    const cfg=State.alertCfg;
    if(cfg.voiceEnabled!==false && cfg.alarmEnabled===true) { playAlarm(cfg.alarmVolume??0.8); setTimeout(()=>speak(msg),1800); }
    else if(cfg.voiceEnabled!==false) speak(msg);
    else if(cfg.alarmEnabled===true) playAlarm(cfg.alarmVolume??0.8);
  };

  const hide = () => { document.getElementById('alert-widget').classList.remove('show'); window.speechSynthesis?.cancel(); };
  const snooze = m => { snoozeUntil=new Date(Date.now()+m*60000); hide(); Toast.warning(`Snoozed ${m} minutes`); };
  const snoozeTonight = () => { const t=TZ.now(); t.setHours(23,59,0,0); snoozeUntil=t; hide(); Toast.warning('Snoozed until tonight'); };

  const shouldAlert = () => {
    if(!State.me()||!State.alertCfg.enabled) return false;
    const p=getProgress(); if(!p.total||p.pct===100) return false;
    if(snoozeUntil&&new Date()<snoozeUntil) return false;
    const cfg=State.alertCfg; const n=TZ.now(); const h=n.getHours(),m=n.getMinutes();
    if(cfg.manualTimes?.length)
      return cfg.manualTimes.some(t=>{ const[th,tm]=t.split(':').map(Number); return h===th&&m===tm; });
    if(cfg.autoDetect) return h>=12&&p.pct<(cfg.threshold||50);
    return false;
  };

  // ── NOTIFICATION API ──
  const requestNotifPermission = async () => {
    if(!('Notification' in window)) return false;
    if(Notification.permission==='granted') return true;
    const r = await Notification.requestPermission();
    return r==='granted';
  };

  const sendNotif = (msg) => {
    if(Notification.permission!=='granted') return;
    const n=new Notification('LIFEPLAN', {
      body:msg, icon:'/icon-192.png',
      badge:'/icon-192.png', tag:'lifeplan-alert',
    });
    n.onclick=()=>{ window.focus(); n.close(); };
    setTimeout(()=>n.close(), 8000);
  };

  const start = () => {
    if(checkInterval) clearInterval(checkInterval);
    checkInterval=setInterval(()=>{ if(shouldAlert()){show();sendNotif(buildMsg());} },60000);
  };
  const stop  = () => { if(checkInterval){clearInterval(checkInterval);checkInterval=null;} };
  const trigger=()=>{ snoozeUntil=null; show(); };

  // ── PWA INSTALL ──
  let _deferredPrompt=null;
  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault(); _deferredPrompt=e;
    document.getElementById('pwa-banner')?.classList.add('show');
  });
  const installPWA=async()=>{
    if(!_deferredPrompt){Toast.warning('Open in browser to install');return;}
    _deferredPrompt.prompt();
    const{outcome}=await _deferredPrompt.userChoice;
    if(outcome==='accepted'){Toast.success('LIFEPLAN installed!');document.getElementById('pwa-banner')?.classList.remove('show');}
    _deferredPrompt=null;
  };
  const dismissPWA=()=>document.getElementById('pwa-banner')?.classList.remove('show');

  return {show,hide,snooze,snoozeTonight,start,stop,trigger,speak,playAlarm,buildMsg,getProgress,requestNotifPermission,sendNotif,installPWA,dismissPWA};
})();


/* ═══════════════════════════════════════
   LIFEPLAN v6 — BADGES + STATS + NOTES + EXPORT
   js/features/badges.js
═══════════════════════════════════════ */
const Badges = (() => {
  const _getTotalDone=()=>{ let c=0; Object.values(State.schedState).forEach(t=>Object.values(t).forEach(w=>Object.values(w).forEach(d=>d.forEach(s=>{if(s===1)c++;})))); return c; };
  const _hasPerfectDay=()=>Object.entries(State.schedState).some(([id,t])=>{ const b=State.blocks[id]||[]; if(!b.length)return false; return Object.values(t).some(w=>Object.values(w).some(d=>d.length===b.length&&d.every(s=>s===1))); });
  const _getMaxStreak=()=>{ let max=0; State.tables.filter(t=>t.type!=='timetable').forEach(t=>{ const s=State.strkState[t.id]||[]; let c=0,b=0; s.forEach(v=>{if(v===1){c++;b=Math.max(b,c);}else c=0;}); max=Math.max(max,b); }); return max; };
  const _hasFullWeek=()=>Object.entries(State.schedState).some(([id,t])=>{ const b=State.blocks[id]||[]; if(!b.length)return false; return Object.values(t).some(w=>{ const days=Object.values(w); return days.length>=5&&days.every(d=>d.filter(s=>s===1).length>=Math.ceil(b.length*.6)); }); });

  const check=()=>{
    const checks={
      first_tick:   ()=>_getTotalDone()>=1,
      day_complete: ()=>_hasPerfectDay(),
      streak_3:     ()=>_getMaxStreak()>=3,
      streak_7:     ()=>_getMaxStreak()>=7,
      streak_14:    ()=>_getMaxStreak()>=14,
      streak_30:    ()=>_getMaxStreak()>=30,
      week_done:    ()=>_hasFullWeek(),
      tables_3:     ()=>State.tables.length>=3,
      consistent:   ()=>Stats.getConsistencyScore()>=80,
      early_bird:   ()=>_getTotalDone()>0,
    };
    const newBadges=[];
    State.BADGE_DEFS.forEach(def=>{
      if(State.badges[def.id]) return;
      try{ if(checks[def.id]&&checks[def.id]()){State.badges[def.id]={earnedAt:new Date().toISOString()};newBadges.push(def);} }catch(e){}
    });
    if(newBadges.length){ State.saveAll(); newBadges.forEach(_popup); }
    return newBadges;
  };

  const _popup=b=>{
    const el=document.createElement('div');
    el.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;background:var(--bg2);border:1px solid var(--acc-b);border-radius:16px;padding:28px 24px;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.7);animation:badgePop .4s cubic-bezier(.34,1.56,.64,1) both';
    el.innerHTML=`<div style="font-size:52px;margin-bottom:10px">${b.icon}</div><div style="font-family:var(--font-m);font-size:8px;color:var(--acc);letter-spacing:2px;margin-bottom:6px">BADGE UNLOCKED</div><div style="font-size:22px;font-weight:800;letter-spacing:1px;margin-bottom:4px">${b.name}</div><div style="font-family:var(--font-m);font-size:9px;color:var(--tx2);letter-spacing:.5px">${b.desc}</div>`;
    document.body.appendChild(el);
    setTimeout(()=>{el.style.opacity='0';el.style.transition='opacity .3s';setTimeout(()=>el.remove(),320);},2800);
    if(State.alertCfg?.voiceEnabled!==false) setTimeout(()=>Widget.speak(`Congratulations! You earned the ${b.name} badge!`),300);
  };

  const getAll=()=>State.BADGE_DEFS.map(d=>({...d,earned:!!State.badges[d.id],earnedAt:State.badges[d.id]?.earnedAt||null}));
  return {check,getAll};
})();

const Stats = (() => {
  const getConsistencyScore=()=>{
    const tt=State.tables.filter(t=>!t.archived&&t.type==='timetable');
    if(!tt.length) return 0;
    let total=0,days=0;
    tt.forEach(tbl=>{
      const blks=State.blocks[tbl.id]||[]; if(!blks.length) return;
      const{wk:tw,dy:td}=TZ.getTodayWkDay(tbl);
      for(let w=Math.max(0,tw-4);w<=tw;w++) for(let d=0;d<7;d++){
        if(w===tw&&d>td) continue;
        const dt=TZ.slotDate(tbl,w,d); if(TZ.isFuture(dt)) continue;
        const st=((State.schedState[tbl.id]||{})[w]||{})[d]||[];
        total+=st.filter(s=>s===1).length/blks.length*100; days++;
      }
    });
    return days>0?Math.round(total/days):0;
  };

  const getBlockStats=id=>{
    const blks=State.blocks[id]||[]; if(!blks.length) return [];
    const stats=blks.map(b=>({...b,done:0,miss:0,total:0}));
    Object.values(State.schedState[id]||{}).forEach(w=>Object.values(w).forEach(d=>d.forEach((s,i)=>{ if(i>=stats.length)return; stats[i].total++; if(s===1)stats[i].done++; if(s===2)stats[i].miss++; })));
    return stats;
  };

  const getWeeklySummary=(tbl,wk)=>{
    const blks=State.blocks[tbl.id]||[]; if(!blks.length) return null;
    let done=0,total=0,bestDay=-1,bestDone=-1; const dayPcts=[];
    for(let d=0;d<7;d++){
      const dt=TZ.slotDate(tbl,wk,d);
      if(TZ.isFuture(dt)){dayPcts.push(null);continue;}
      const st=((State.schedState[tbl.id]||{})[wk]||{})[d]||[];
      const dn=st.filter(s=>s===1).length;
      const pct=Math.round(dn/blks.length*100);
      dayPcts.push(pct); done+=dn; total+=blks.length;
      if(dn>bestDone){bestDone=dn;bestDay=d;}
    }
    return{overallPct:total>0?Math.round(done/total*100):0,dayPcts,bestDay,totalDone:done,totalBlocks:total};
  };

  const generateReviewText=(tbl,wk)=>{
    const s=getWeeklySummary(tbl,wk); if(!s) return [];
    const i=[`You completed ${s.overallPct}% of your schedule this week.`];
    if(s.bestDay>=0) i.push(`Your best day was ${State.DAY_FULL[s.bestDay]} with ${s.dayPcts[s.bestDay]}% completion.`);
    const missed=s.dayPcts.filter(p=>p!==null&&p<50).length;
    if(missed>0) i.push(`${missed} day${missed>1?'s':''} fell below 50%. Focus on consistency next week.`);
    i.push(s.overallPct>=80?'Outstanding week! Keep up this momentum.':s.overallPct>=50?'Good effort. Aim for 80% next week.':'Tough week. Small steps forward still count.');
    return i;
  };

  return{getConsistencyScore,getBlockStats,getWeeklySummary,generateReviewText};
})();

const Notes = (() => {
  const key=(id,wk,dy)=>`${id}_${wk}_${dy}`;
  const get=(id,wk,dy)=>State.notes[key(id,wk,dy)]||'';
  const set=(id,wk,dy,text)=>{ State.notes[key(id,wk,dy)]=text; State.saveAll(); };
  return{get,set};
})();

const Heatmap = (() => {
  const getData=(tbl,days=84)=>{
    const blks=State.blocks[tbl.id]||[]; if(!blks.length) return [];
    const res=[]; const{wk:tw}=TZ.getTodayWkDay(tbl);
    for(let w=0;w<=tw;w++) for(let d=0;d<7;d++){
      const dt=TZ.slotDate(tbl,w,d); if(TZ.isFuture(dt)) continue;
      const st=((State.schedState[tbl.id]||{})[w]||{})[d]||[];
      const done=st.filter(s=>s===1).length;
      res.push({date:dt,pct:Math.round(done/blks.length*100),done,total:blks.length});
    }
    return res.slice(-days);
  };
  const pctToClass=p=>p===0?'hm-0':p<50?'hm-25':p<75?'hm-50':p<100?'hm-75':'hm-100';
  return{getData,pctToClass};
})();

const Quotes = (() => {
  const getToday=()=>{ const d=TZ.now(); return State.QUOTES[(d.getDate()+d.getMonth()*31)%State.QUOTES.length]; };
  return{getToday};
})();

const Export = (() => {
  const backupData=()=>{
    const data=Storage.exportAll();
    const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([data],{type:'application/json'})),download:`lifeplan_backup_${new Date().toISOString().split('T')[0]}.json`});
    a.click(); URL.revokeObjectURL(a.href); Toast.success('Backup downloaded');
  };
  const restoreData=file=>new Promise(resolve=>{
    const r=new FileReader();
    r.onload=e=>{ const ok=Storage.importAll(e.target.result); ok?Toast.success('Restored! Reloading…'):Toast.error('Invalid backup file'); if(ok)setTimeout(()=>location.reload(),1200); resolve(ok); };
    r.readAsText(file);
  });
  return{backupData,restoreData};
})();

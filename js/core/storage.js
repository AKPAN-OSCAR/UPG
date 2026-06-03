/* ═══════════════════════════════════════
   LIFEPLAN v6 — STORAGE
   js/core/storage.js
═══════════════════════════════════════ */
const Storage = (() => {
  const PREFIX = 'lp6_';
  const get = k => { try { return JSON.parse(localStorage.getItem(PREFIX+k)); } catch(e) { return null; } };
  const set = (k,v) => { try { localStorage.setItem(PREFIX+k, JSON.stringify(v)); return true; } catch(e) { return false; } };
  const del = k => localStorage.removeItem(PREFIX+k);
  const exportAll = () => {
    const data = {};
    Object.keys(localStorage).filter(k=>k.startsWith(PREFIX))
      .forEach(k => { data[k.replace(PREFIX,'')] = JSON.parse(localStorage.getItem(k)); });
    return JSON.stringify(data, null, 2);
  };
  const importAll = str => {
    try { const d=JSON.parse(str); Object.entries(d).forEach(([k,v])=>set(k,v)); return true; }
    catch(e) { return false; }
  };
  return { get, set, del, exportAll, importAll };
})();

/* ═══════════════════════════════════════
   LIFEPLAN v6 — STATE
   js/core/state.js
═══════════════════════════════════════ */
const State = (() => {
  // ── GLOBAL (not per-user) ──
  let users      = Storage.get('users')      || []; // [{id,name,theme,tz,timeFmt,joinedAt,pinHashes:[],aim}]
  let activeUid  = Storage.get('activeUid')  || null;
  let sessionUid = null; // currently logged-in user (runtime only)

  // ── PER-USER DATA HELPERS ──
  const _uk = (uid, key) => `u_${uid}_${key}`;
  const getUserData  = (uid, key)      => Storage.get(_uk(uid, key));
  const setUserData  = (uid, key, val) => Storage.set(_uk(uid, key), val);
  const delUserData  = (uid, key)      => Storage.del(_uk(uid, key));

  // ── CURRENT USER SHORTCUTS ──
  const me = () => users.find(u => u.id === sessionUid) || null;
  const data = (key, fallback=null) => {
    if (!sessionUid) return fallback;
    const v = getUserData(sessionUid, key);
    return v !== null ? v : fallback;
  };
  const setData = (key, val) => {
    if (!sessionUid) return;
    setUserData(sessionUid, key, val);
  };

  // ── SAVE ──
  const saveGlobal = () => {
    Storage.set('users', users);
    Storage.set('activeUid', activeUid);
  };
  const saveAll = () => {
    saveGlobal();
    if (!sessionUid) return;
    setData('tables',     _tables);
    setData('blocks',     _blocks);
    setData('schedState', _schedState);
    setData('strkState',  _strkState);
    setData('notes',      _notes);
    setData('badges',     _badges);
    setData('alertCfg',   _alertCfg);
  };

  // ── PER-USER RUNTIME STATE ──
  let _tables     = [];
  let _blocks     = {};
  let _schedState = {};
  let _strkState  = {};
  let _notes      = {};
  let _badges     = {};
  let _alertCfg   = {};

  const loadUser = uid => {
    sessionUid  = uid;
    _tables     = getUserData(uid,'tables')     || [];
    _blocks     = getUserData(uid,'blocks')     || {};
    _schedState = getUserData(uid,'schedState') || {};
    _strkState  = getUserData(uid,'strkState')  || {};
    _notes      = getUserData(uid,'notes')      || {};
    _badges     = getUserData(uid,'badges')     || {};
    _alertCfg   = getUserData(uid,'alertCfg')   || {
      enabled:true, voiceEnabled:true, alarmEnabled:false,
      personality:'friendly', volume:.9, alarmVolume:.8,
      autoDetect:true, threshold:50, manualTimes:[]
    };
  };

  const logoutUser = () => { sessionUid = null; };

  // ── UUID ──
  const genUID = () => 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);

  // ── PIN HELPERS ──
  const hashPin = pin => {
    let h = 5381;
    for (let i=0; i<pin.length; i++) h = ((h<<5)+h)+pin.charCodeAt(i);
    return String(Math.abs(h >>> 0));
  };

  // Check if a PIN hash is already used by ANY user
  const isPinTaken = (pin, excludeUid=null) => {
    const h = hashPin(pin);
    return users.some(u => {
      if (excludeUid && u.id === excludeUid) return false;
      return (u.pinHashes||[]).includes(h);
    });
  };

  const verifyPin = (uid, pin) => {
    const u = users.find(u=>u.id===uid);
    if (!u) return false;
    return (u.pinHashes||[]).includes(hashPin(pin));
  };

  // ── CONSTANTS ──
  const DEFAULT_BLOCKS = [
    {id:'d0',label:'Critical Thinking / Planning',tag:'FOCUS',   start:'05:00',end:'05:30'},
    {id:'d1',label:'House Chores',                tag:'HOME',    start:'05:40',end:'06:30'},
    {id:'d2',label:'Cook · Bath · Eat · Get Ready',tag:'MORNING',start:'06:35',end:'07:20'},
    {id:'d3',label:'School Activities',           tag:'SCHOOL',  start:'08:00',end:'17:00'},
    {id:'d4',label:'Software Work',               tag:'WORK',    start:'10:00',end:'14:00'},
    {id:'d5',label:'Have Little Fun',             tag:'LEISURE', start:'14:00',end:'15:00'},
    {id:'d6',label:'Hardware Work',               tag:'WORK',    start:'15:00',end:'19:00'},
    {id:'d7',label:'School Revision',             tag:'STUDY',   start:'20:00',end:'22:00'},
    {id:'d8',label:'Nice Sleep',                  tag:'REST',    start:'22:00',end:'04:00'},
  ];

  const TZ_LIST = [
    {tz:'Africa/Lagos',        name:'🇳🇬 Nigeria',      off:'WAT · UTC+1'},
    {tz:'Africa/Accra',        name:'🇬🇭 Ghana',         off:'GMT · UTC+0'},
    {tz:'Africa/Nairobi',      name:'🇰🇪 Kenya',         off:'EAT · UTC+3'},
    {tz:'Africa/Johannesburg', name:'🇿🇦 South Africa',  off:'SAST · UTC+2'},
    {tz:'Africa/Cairo',        name:'🇪🇬 Egypt',         off:'EET · UTC+2'},
    {tz:'Europe/London',       name:'🇬🇧 London',        off:'GMT/BST'},
    {tz:'Europe/Paris',        name:'🇫🇷 Paris',         off:'CET/CEST'},
    {tz:'America/New_York',    name:'🇺🇸 New York',      off:'EST/EDT'},
    {tz:'America/Los_Angeles', name:'🇺🇸 Los Angeles',   off:'PST/PDT'},
    {tz:'Asia/Dubai',          name:'🇦🇪 Dubai',         off:'GST · UTC+4'},
    {tz:'Asia/Kolkata',        name:'🇮🇳 India',         off:'IST · UTC+5:30'},
    {tz:'Asia/Shanghai',       name:'🇨🇳 China',         off:'CST · UTC+8'},
  ];

  const THEMES = [
    {id:'green',  color:'#00e676', name:'Green'},
    {id:'red',    color:'#ff4757', name:'Red'},
    {id:'blue',   color:'#2196f3', name:'Blue'},
    {id:'yellow', color:'#ffd600', name:'Yellow'},
    {id:'black',  color:'#e0e0e0', name:'White'},
    {id:'orange', color:'#ff6d00', name:'Orange'},
    {id:'purple', color:'#9c27b0', name:'Purple'},
    {id:'brown',  color:'#8d6e63', name:'Brown'},
    {id:'maroon', color:'#880e4f', name:'Maroon'},
    {id:'lemon',  color:'#c6ff00', name:'Lemon'},
  ];

  const MONTH_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const MONTH_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const DAY_NAMES   = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
  const DAY_FULL    = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

  const TYPE_META = {
    timetable:{icon:'📋',label:'Daily Schedule'},
    build:    {icon:'🔥',label:'Build Habit'},
    stop:     {icon:'🚫',label:'Stop Habit'},
  };

  const VOICE_PERSONALITIES = {
    strict:       { name:'Strict 😤',       pitch:.9,  rate:1.0, messages:['{name}! Do your tasks. Now.','{name}, stop procrastinating.','{name}! No excuses. Complete your tasks.','Time is running out, {name}. Move.','{name}, you set this schedule. Follow it.'] },
    friendly:     { name:'Friendly 😊',     pitch:1.1, rate:.95, messages:['Hey {name}! Your tasks are waiting 😊','{name}, you can do it! Let\'s get going.','Time to shine {name}! Schedule is ready.','Don\'t forget your tasks {name}! You got this.','Hey {name}, a little progress goes a long way!'] },
    motivational: { name:'Motivational 💪', pitch:1.2, rate:1.05,messages:['Let\'s GO {name}! Get those tasks DONE!','{name}! Champions don\'t quit. Do your tasks!','RISE UP {name}! Your future self is counting on you!','{name}, every task done is a WIN. Let\'s GO!','NO DAYS OFF {name}! Complete your daily streak!'] },
  };

  const QUOTES = [
    {text:"Discipline is doing what needs to be done, even when you don't want to.",author:"Unknown"},
    {text:"Small disciplines repeated with consistency every day lead to great achievements.",author:"John C. Maxwell"},
    {text:"The secret of your future is hidden in your daily routine.",author:"Mike Murdock"},
    {text:"We are what we repeatedly do. Excellence is not an act but a habit.",author:"Aristotle"},
    {text:"Success is the sum of small efforts repeated day in and day out.",author:"Robert Collier"},
    {text:"Motivation gets you going. Discipline keeps you growing.",author:"John C. Maxwell"},
    {text:"Your daily choices shape your destiny. Choose wisely.",author:"Unknown"},
    {text:"The pain of discipline is far less than the pain of regret.",author:"Unknown"},
    {text:"Don't count the days, make the days count.",author:"Muhammad Ali"},
    {text:"It's not about having time. It's about making time.",author:"Unknown"},
    {text:"Hard work beats talent when talent doesn't work hard.",author:"Tim Notke"},
    {text:"Push yourself because no one else is going to do it for you.",author:"Unknown"},
    {text:"Wake up with determination. Go to bed with satisfaction.",author:"Unknown"},
    {text:"Little by little, a little becomes a lot.",author:"Tanzanian Proverb"},
    {text:"The only way to do great work is to love what you do.",author:"Steve Jobs"},
  ];

  const BADGE_DEFS = [
    {id:'first_tick',   icon:'✅',name:'First Step',      desc:'Mark your first task done'},
    {id:'day_complete', icon:'⭐',name:'Perfect Day',     desc:'Complete all blocks in a day'},
    {id:'streak_3',     icon:'🔥',name:'On Fire',         desc:'3-day streak on any tracker'},
    {id:'streak_7',     icon:'🌟',name:'One Week Strong', desc:'7-day streak on any tracker'},
    {id:'streak_14',    icon:'💎',name:'Two Week Warrior',desc:'14-day streak'},
    {id:'streak_30',    icon:'👑',name:'Monthly Champion',desc:'30-day streak'},
    {id:'week_done',    icon:'🏆',name:'Full Week',       desc:'Complete every day of a full week'},
    {id:'tables_3',     icon:'📚',name:'Planner',         desc:'Create 3 or more tables'},
    {id:'consistent',   icon:'💪',name:'Consistent',      desc:'Consistency score above 80'},
    {id:'early_bird',   icon:'🌅',name:'Early Bird',      desc:'Complete a task before 6AM'},
  ];

  // ── RUNTIME NAV STATE ──
  let activeTab    = 'home';
  let activeTbl    = null;
  let activeWk     = 0;
  let activeDy     = 0;
  let activeTTMode = 'sched';
  let archOpen     = false;

  return {
    // global
    get users()     { return users; },     set users(v)     { users=v; },
    get activeUid() { return activeUid; }, set activeUid(v) { activeUid=v; },
    get sessionUid(){ return sessionUid; },
    // per-user data
    get tables()     { return _tables; },     set tables(v)     { _tables=v; },
    get blocks()     { return _blocks; },     set blocks(v)     { _blocks=v; },
    get schedState() { return _schedState; }, set schedState(v) { _schedState=v; },
    get strkState()  { return _strkState; },  set strkState(v)  { _strkState=v; },
    get notes()      { return _notes; },      set notes(v)      { _notes=v; },
    get badges()     { return _badges; },     set badges(v)     { _badges=v; },
    get alertCfg()   { return _alertCfg; },   set alertCfg(v)   { _alertCfg=v; },
    // nav state
    get activeTab()    { return activeTab; },    set activeTab(v)    { activeTab=v; },
    get activeTbl()    { return activeTbl; },    set activeTbl(v)    { activeTbl=v; },
    get activeWk()     { return activeWk; },     set activeWk(v)     { activeWk=v; },
    get activeDy()     { return activeDy; },     set activeDy(v)     { activeDy=v; },
    get activeTTMode() { return activeTTMode; }, set activeTTMode(v) { activeTTMode=v; },
    get archOpen()     { return archOpen; },     set archOpen(v)     { archOpen=v; },
    // methods
    me, data, setData, loadUser, logoutUser, saveAll, saveGlobal,
    genUID, hashPin, isPinTaken, verifyPin,
    getUserData, setUserData, delUserData,
    // constants
    DEFAULT_BLOCKS, TZ_LIST, THEMES, MONTH_FULL, MONTH_SHORT,
    DAY_NAMES, DAY_FULL, TYPE_META, VOICE_PERSONALITIES, QUOTES, BADGE_DEFS,
  };
})();

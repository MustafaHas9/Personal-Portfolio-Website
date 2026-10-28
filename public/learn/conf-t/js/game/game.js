/* The game: walking, scenes, the slate (terminal), puzzle rooms, defense rooms, the shop. The rules of
   the commands live in ios.js / net.js / the packs; what is in each room is in rooms.js; the words are
   in story.js; this file is the glue that makes them a game. */
(function(){
"use strict";

var T = 16, VW = 20, VH = 12;
var $ = function(id){ return document.getElementById(id); };
var cv = $("cv"), cx = cv.getContext("2d");
cx.imageSmoothingEnabled = false;
var SAVE_KEY = "lastWord-save-v1";
var C = ART.C;

var S;                 // the saved game
var G = { mode: "title", tick: 0, keys: {}, particles: [], flash: 0, rts: {}, intros: {} };
G.player = { x: 0, y: 0, dir: "down", frame: 0, ft: 0 };
G.cam = { x: 0, y: 0 };

/* ====================================================================================
   State and saving
   ==================================================================================== */
function newState(){
  return { name: "Wren", title: "Mister", look: ART.defaultLook(), ep: 0, hub: "prologue", day: 1, marks: 20, hp: 5, hpMax: 5,
    items: { tab: false, help: false, tonic: 1 }, mara: 0, pell: "ok", ledger: null, gate: null,
    evacLost: false, wardsDark: false, lied: false, toldMara: false, metGarrick: false, finalRating: null, slipsTotal: 0, rooms: {} };
}
function save(){ try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch(e){} }
function loadSave(){ try { var v = localStorage.getItem(SAVE_KEY); return v ? JSON.parse(v) : null; } catch(e){ return null; } }
/* a function replacer, so a name like "$&" is not read as a replacement pattern */
function fmt(t){
  var n = S ? S.name : "Wren", ti = S && S.title ? S.title : "Mister";
  return String(t).replace(/\{(name|title)\}/g, function(m, k){ return k === "name" ? n : ti; });
}
function cleanName(v){ v = String(v || "").replace(/[{}<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 14); return v || "Wren"; }

/* ====================================================================================
   Little interface pieces
   ==================================================================================== */
var toastT = 0;
function toast(text, bad){
  var el = $("toast");
  el.textContent = text; el.className = (bad ? "bad " : "") + "on";
  clearTimeout(toastT);
  toastT = setTimeout(function(){ el.className = ""; }, 2600);
}
function renderHud(){
  var box = $("hearts");
  if(box.children.length !== S.hpMax){
    box.innerHTML = "";
    for(var i = 0; i < S.hpMax; i++){ var c = document.createElement("canvas"); c.width = c.height = 16; box.appendChild(c); }
  }
  Array.prototype.forEach.call(box.children, function(c, i){
    var x = c.getContext("2d"); x.clearRect(0, 0, 16, 16); x.drawImage(ART.heart(i < S.hp), 0, 0);
  });
  $("pname").textContent = S.name;
  $("marks").textContent = "◆ " + S.marks + (S.items.tonic ? "   tonic ×" + S.items.tonic : "");
}
/* only "E: ..." prompts are clickable; the rest are plain notes */
function setHint(t){ var h = $("hint"); h.textContent = t || ""; h.hidden = !t; h.classList.toggle("note", !!t && t.indexOf("E:") !== 0); }

/* ====================================================================================
   Maps and the player
   ==================================================================================== */
function tileAt(tx, ty){
  var m = G.map;
  if(tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return null;
  return LEG[m.rows[ty].charAt(tx)] || { t: "void", s: 1 };
}
function objSolid(o){
  if(o.hidden) return false;
  if(o.type === "exit") return !o.open;
  return { npc: 1, console: 1, pc: 1, boss: 1, ledger: 1, ward: 1 }[o.type] === 1;
}
function objCovers(o, tx, ty){
  var w = o.type === "boss" ? 2 : 1;
  return tx >= o.x && tx < o.x + w && ty >= o.y && ty < o.y + w;
}
function objAtTile(tx, ty){
  for(var i = 0; i < G.objs.length; i++) if(!G.objs[i].hidden && objCovers(G.objs[i], tx, ty)) return G.objs[i];
  return null;
}
function blockedAt(tx, ty){
  var t = tileAt(tx, ty);
  if(!t || t.s) return true;
  var o = objAtTile(tx, ty);
  return !!(o && objSolid(o));
}
function boxBlocked(px, py){
  var x0 = Math.floor((px + 4) / T), x1 = Math.floor((px + 11) / T), y0 = Math.floor((py + 9) / T), y1 = Math.floor((py + 15) / T);
  for(var y = y0; y <= y1; y++) for(var x = x0; x <= x1; x++) if(blockedAt(x, y)) return true;
  return false;
}

function loadMap(id, spawn, dir){
  var m = MAPS[id];
  G.map = m; G.mapId = id;
  G.objs = m.objs.map(function(o){ return Object.assign({}, o); });
  var sp = spawn || [m.spawn.x, m.spawn.y];
  G.player.x = sp[0] * T; G.player.y = sp[1] * T - 4; G.player.dir = dir || "down";
  $("place").textContent = m.name;
  updateCamera(true);
}
function updateCamera(snap){
  var m = G.map, tx = G.player.x + 8 - (VW * T) / 2, ty = G.player.y + 8 - (VH * T) / 2;
  tx = Math.max(0, Math.min(m.w * T - VW * T, tx)); ty = Math.max(0, Math.min(m.h * T - VH * T, ty));
  if(m.w <= VW) tx = (m.w * T - VW * T) / 2;
  if(m.h <= VH) ty = (m.h * T - VH * T) / 2;
  if(snap){ G.cam.x = tx; G.cam.y = ty; } else { G.cam.x += (tx - G.cam.x) * 0.2; G.cam.y += (ty - G.cam.y) * 0.2; }
}

function fade(fn){
  var f = document.createElement("div");
  f.style.cssText = "position:absolute;inset:0;background:#000;opacity:0;transition:opacity .22s;pointer-events:none";
  $("stage").appendChild(f);
  void f.offsetWidth; f.style.opacity = 1;
  setTimeout(function(){ fn(); f.style.opacity = 0; setTimeout(function(){ if(f.parentNode) f.parentNode.removeChild(f); }, 260); }, 230);
}

/* ====================================================================================
   The slate: the terminal
   ==================================================================================== */
var Term = { sessions: null, order: [], active: null, logs: null, hist: 0, locked: true };
var tlog = $("tlog"), tin = $("tin");

Term.attach = function(sessions, order, logs, start){
  Term.sessions = sessions; Term.order = order; Term.logs = logs; Term.active = start || order[0];
  Term.render();
};
Term.detach = function(){ Term.sessions = null; Term.order = []; Term.active = null; Term.render(); };
Term.session = function(){ return Term.sessions && Term.sessions[Term.active]; };
Term.setActive = function(name){
  if(!Term.sessions || !Term.sessions[name]) return;
  Term.active = name; Term.render();
};
Term.render = function(){
  var tabs = $("ttabs");
  tabs.innerHTML = "";
  if(!Term.sessions){
    tabs.innerHTML = '<span class="dim" style="color:var(--dim);font-size:.8rem">The slate is quiet. Find a console and press E.</span>';
    tlog.innerHTML = ""; $("tpr").textContent = ""; $("tinrow").className = "tin off"; return;
  }
  Term.order.forEach(function(n){
    var b = document.createElement("button");
    b.type = "button"; b.className = "ttab"; b.textContent = Term.sessions[n].dev.hostname; b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", n === Term.active); b.setAttribute("data-n", n);
    tabs.appendChild(b);
  });
  tlog.innerHTML = "";
  (Term.logs[Term.active] || []).forEach(function(l){ Term.append(l[0], l[1], true); });
  var d = Term.sessions[Term.active].dev;
  (d.notices || []).splice(0).forEach(function(m){ Term.print(m, "sys"); });
  Term.prompt();
  $("tinrow").className = "tin";
};
Term.append = function(text, cls, skipStore){
  var el = document.createElement("div");
  if(cls) el.className = cls;
  el.textContent = text === "" ? " " : text;
  tlog.appendChild(el);
  tlog.scrollTop = tlog.scrollHeight;
};
Term.print = function(text, cls){
  if(!Term.sessions) return;
  var store = Term.logs[Term.active] = Term.logs[Term.active] || [];
  store.push([text, cls || ""]);
  if(store.length > 400) store.shift();
  Term.append(text, cls);
};
Term.block = function(text, cls){ String(text).split("\n").forEach(function(l){ Term.print(l, cls); }); };
Term.prompt = function(){
  var s = Term.session();
  if(!s) return;
  $("tpr").textContent = s.pendingPrompt ? s.pendingPrompt : s.prompt();
  tin.type = s.pendingPrompt ? "password" : "text";
};
Term.focus = function(){ if(Term.sessions) tin.focus({ preventScroll: true }); };

$("ttabs").addEventListener("click", function(e){
  var b = e.target.closest ? e.target.closest(".ttab") : null;
  if(b){ Term.setActive(b.getAttribute("data-n")); Term.focus(); }
});
$("tlog").addEventListener("click", function(){ if(!window.getSelection().toString()) Term.focus(); });

tin.addEventListener("keydown", function(e){
  var s = Term.session();
  if(!s) return;
  var v = this.value;
  if(e.key === "Enter"){ e.preventDefault(); this.value = ""; Term.hist = 0; submitLine(v); return; }
  if(s.pendingPrompt) return;
  if(e.key === "Tab"){
    e.preventDefault();
    if(!S.items.tab){ Term.print("(The Tab Staff isn't in your hands yet. Odo sells one.)", "dim"); return; }
    this.value = s.tab(v); return;
  }
  if(e.key === "?"){
    e.preventDefault();
    if(!S.items.help){ Term.print("(You'd need the Question Staff for that. Odo sells one.)", "dim"); return; }
    Term.print(s.prompt() + v + "?", "in");
    Term.block(s.help(v));
    return;
  }
  if(e.key === "ArrowUp" || e.key === "ArrowDown"){
    e.preventDefault();
    var h = s.history;
    if(!h.length) return;
    Term.hist = e.key === "ArrowUp" ? Math.min(h.length, Term.hist + 1) : Math.max(0, Term.hist - 1);
    this.value = Term.hist ? h[h.length - Term.hist] : "";
    return;
  }
  if(e.ctrlKey && (e.key === "z" || e.key === "Z")){
    e.preventDefault();
    if(s.mode.indexOf("config") === 0){ Term.print(s.prompt() + v + "^Z", "in"); s.exec("end"); this.value = ""; Term.prompt(); }
    return;
  }
  if(e.key === "Escape" && !G.def){ this.blur(); }
});
tin.addEventListener("focus", function(){ setHint("Esc to step away"); });
tin.addEventListener("blur", function(){ if(G.mode === "walk") refreshHint(); });

function submitLine(text){
  if(G.def) return defenseLine(text);
  return puzzleLine(text);
}

/* ====================================================================================
   Scenes: dialogue, choices, the shop
   ==================================================================================== */
var D = { full: "", shown: 0, typing: false, choices: null };

function showSay(who, text, nar){
  $("dlg").hidden = false; $("dchoices").innerHTML = ""; $("dchoices").hidden = true;
  $("dname").textContent = who || ""; $("dname").hidden = !who;
  $("dtext").className = nar ? "nar" : ""; $("dtext").textContent = "";
  D.full = text; D.shown = 0; D.typing = true; D.choices = null;
  $("dnext").hidden = true;
}
function showChoices(opts){
  var box = $("dchoices");
  D.choices = opts; D.typing = false;
  $("dnext").hidden = true;
  box.innerHTML = ""; box.hidden = false;
  opts.forEach(function(o, i){
    var b = document.createElement("button");
    b.type = "button"; b.className = "dc"; b.innerHTML = "<kbd>" + (i + 1) + "</kbd>";
    b.appendChild(document.createTextNode(fmt(o.t)));
    b.addEventListener("click", function(){ pickChoice(i); });
    box.appendChild(b);
  });
  $("dlg").hidden = false; $("dname").hidden = true; $("dtext").textContent = "";
  if(box.firstChild) box.firstChild.focus({ preventScroll: true });
}
function pickChoice(i){
  var o = D.choices && D.choices[i];
  if(!o) return;
  D.choices = null; $("dchoices").hidden = true; $("dchoices").innerHTML = "";
  if(o.do) o.do(S, G);
  if(runPending()) return;
  if(o.then) G.stack.push({ steps: o.then, i: 0 });
  stepScene();
}

function runScene(steps, done){
  if(document.activeElement === tin) tin.blur();
  G.prevMode = G.def ? "defense" : "walk";
  G.mode = "scene"; G.stack = [{ steps: steps, i: 0 }]; G.sceneDone = done || null;
  stepScene();
}
function stepScene(){
  for(;;){
    var fr = G.stack[G.stack.length - 1];
    if(!fr){ endScene(); return; }
    if(fr.i >= fr.steps.length){ G.stack.pop(); continue; }
    var st = fr.steps[fr.i++];
    if(st.n !== undefined){ showSay("", fmt(st.n), true); return; }
    if(st.w !== undefined){ showSay(fmt(st.w), fmt(typeof st.t === "function" ? st.t(S) : st.t), false); return; }
    if(st.c){ showChoices(st.c); return; }
    if(st.shop){ openShop(); return; }
    if(st.do){
      st.do(S, G);
      if(runPending()) return;
      continue;
    }
    if(st.if){ G.stack.push({ steps: (st.if(S) ? st.then : st.else) || [], i: 0 }); continue; }
  }
}
/* Starting an episode from inside a scene has to wait until the scene lets go. */
function runPending(){
  if(!G.pending) return false;
  G.stack = []; $("dlg").hidden = true; G.sceneDone = null; G.mode = "walk";
  var f = G.pending; G.pending = null;
  f();
  return true;
}
function endScene(){
  $("dlg").hidden = true;
  G.mode = G.def ? "defense" : "walk";
  var cb = G.sceneDone; G.sceneDone = null;
  if(cb) cb();
  refreshHint();
}
function advance(){
  if(D.typing){ D.shown = D.full.length; $("dtext").textContent = D.full; D.typing = false; $("dnext").hidden = false; return; }
  if(D.choices) return;
  stepScene();
}

/* ---------- Odo's cart ---------- */
function openShop(){
  G.mode = "shop"; $("shop").hidden = false; renderShop();
}
function renderShop(){
  $("shopmarks").textContent = "You have ◆ " + S.marks;
  var list = $("shoplist");
  list.innerHTML = "";
  Object.keys(STORY.items).forEach(function(k){
    var it = STORY.items[k], owned = (k === "tab" || k === "help") && S.items[k];
    var row = document.createElement("div"); row.className = "row";
    row.innerHTML = "<span>" + it.name + "<small>" + it.desc + "</small></span>";
    var b = document.createElement("button");
    b.type = "button"; b.className = "btn"; b.textContent = owned ? "Owned" : "◆ " + it.price;
    b.disabled = owned || S.marks < it.price;
    b.addEventListener("click", function(){
      S.marks -= it.price;
      if(k === "tonic") S.items.tonic++; else S.items[k] = true;
      renderHud(); renderShop(); save();
    });
    row.appendChild(b); list.appendChild(row);
  });
}
$("shopclose").addEventListener("click", function(){ $("shop").hidden = true; G.mode = "scene"; stepScene(); });

/* ====================================================================================
   Moving between rooms
   ==================================================================================== */
var INTRO = { gate7: "gate7_intro", strays: "strays_intro", corridor: "corridor_intro", warden: "warden_intro", lift4: "lift4_intro",
              office: "office_intro", nightgate: "nightgate_intro", nine: "nine_intro" };

G.startEpisode = function(ep){
  G.pending = function(){
    S.ep = ep; G.epRooms = EPISODES[ep]; G.roomIdx = 0;
    G.rts = {}; G.intros = {};
    fade(function(){ enterRoom(G.epRooms[0], "start"); });
  };
};

function enterRoom(id, from){
  var def = ROOMS[id];
  G.roomId = id; G.def = null; G.rt = null;
  loadMap(def.map, from === "back" ? [17, 8] : [2, 8], from === "back" ? "left" : "right");
  var exit = G.objs.filter(function(o){ return o.type === "exit"; })[0];
  if(def.type === "puzzle"){
    var rt = G.rts[id] || (G.rts[id] = makePuzzle(def));
    G.rt = rt;
    if(rt.solved && exit) exit.open = true;
    Term.attach(rt.sessions, rt.built.order, rt.logs, rt.active);
    renderGoals(rt);
  } else {
    Term.detach();
    renderGoals(null);
    if(def.type === "story" && exit) exit.open = true;
    if(S.rooms[id] && exit) exit.open = true;
  }
  $("sidehead").textContent = def.type === "defense" ? "Hold the line" : def.type === "story" ? "" : "Objectives";
  var first = !G.intros[id];
  G.intros[id] = true;
  var after = function(){ if(def.type === "defense" && !S.rooms[id]) startDefense(def, id); refreshHint(); };
  var intro = STORY.scenes[INTRO[id] || id + "_intro"];
  if(first && intro) runScene(intro, after); else after();
}
function leaveToHub(spawn){
  G.def = null; G.rt = null; clearLabels();
  var lodge = S.ep === 5;
  fade(function(){
    Term.detach(); renderGoals(null); $("sidehead").textContent = "";
    loadMap("hub", spawn || (lodge ? [9, 10] : [28, 13]), "down");
    G.roomId = null; refreshHint();
    if(lodge){ save(); runScene(STORY.scenes.lodge_leave); }
  });
}
function exitRoom(){
  if(G.roomIdx < G.epRooms.length - 1){ G.roomIdx++; fade(function(){ enterRoom(G.epRooms[G.roomIdx], "next"); }); }
  else finishEpisode(S.ep);
}
function backRoom(){
  if(G.roomIdx > 0){ G.roomIdx--; fade(function(){ enterRoom(G.epRooms[G.roomIdx], "back"); }); }
  else leaveToHub();
}
function finishEpisode(ep){
  if(ep === 5){ leaveToHub(); return; }
  G.def = null; G.rt = null; clearLabels();
  fade(function(){
    Term.detach(); renderGoals(null); $("sidehead").textContent = "";
    loadMap("hub", [28, 13], "down"); G.roomId = null;
    save();
    if(ep === 1){ S.hub = "night1"; runScene(STORY.scenes.night1, function(){ runScene(STORY.scenes.day2_alarm, function(){ save(); }); }); }
    else if(ep === 2) runScene(STORY.scenes.night2);
    else if(ep === 3) runScene(STORY.scenes.day3, save);
  });
}

/* ====================================================================================
   Puzzle rooms
   ==================================================================================== */
function makePuzzle(def){
  var built = def.build(), sessions = {}, rt = { def: def, built: built, sessions: sessions, logs: {}, active: built.order[0],
    slips: 0, harm: 0, solved: false, trapState: {}, snapUp: [], done: {} };
  built.order.forEach(function(n){ sessions[n] = new IOS.Session(built.topo.devices[n], built.topo, built.start[n] || "user"); });
  Object.keys(built.topo.devices).forEach(function(n){
    built.topo.devices[n].ifaces.forEach(function(f){ if(NET.isUp(f) && f.dev.kind !== "pc") rt.snapUp.push(f); });
  });
  rt.dev = function(n){ return built.topo.devices[n]; };
  return rt;
}
/* The question or objective in front of you, shown inside the game window so you do not have to
   look away from the action. Only touches the page when the text changes. */
var qShown = "";
function updateQBar(){
  var kind = "", text = "", sub = "", d = G.def, rt = G.rt;
  if(G.mode === "defense" && d && !d.over){
    var e = d.lock, bd = 1e9;
    if(!e) d.enemies.forEach(function(x){
      if(x.prog !== 0) return;
      var dist = Math.abs(x.x - x.target.x) + Math.abs(x.y - x.target.y);
      if(dist < bd){ bd = dist; e = x; }
    });
    if(e){ kind = "Question"; text = e.spec.label; if(e.spec.seq.length > 1) sub = "step " + (e.prog + 1) + " of " + e.spec.seq.length; }
    // the question itself is in the banner, so each stray only says whether it is the one being asked
    d.enemies.forEach(function(x){ var t = x === e ? "answer this" : "waiting"; if(x.el.firstChild.textContent !== t) x.el.firstChild.textContent = t; x.el.classList.toggle("now", x === e); });
  } else if(G.mode === "walk" && rt && !rt.solved){
    var goals = rt.def.goals, left = goals.filter(function(g){ return !rt.done[g.id]; });
    if(left.length){ kind = "Objective"; text = left[0].text; sub = (goals.length - left.length) + " of " + goals.length + " done"; }
  }
  var key = kind + "|" + text + "|" + sub;
  if(key === qShown) return;
  qShown = key;
  $("qbar").hidden = !text;
  $("qk").textContent = kind; $("qt").textContent = text; $("qs").textContent = sub;
}
function renderGoals(rt){
  var ul = $("goals");
  ul.innerHTML = "";
  if(!rt){
    $("slips").textContent = "";
    $("tip").textContent = G.def ? "Type the command that answers each question. Abbreviations work."
      : "E talks to people and uses things. H drinks a tonic.";
    return;
  }
  rt.def.goals.forEach(function(g){
    var li = document.createElement("li");
    li.textContent = g.text; li.className = rt.done[g.id] ? "done" : "";
    ul.appendChild(li);
  });
  $("slips").textContent = "slips this room: " + rt.slips;
  $("tip").textContent = "Walk up to a console and press E. You are not on a clock here.";
}
var SLIP = /^% (Invalid input|Ambiguous command|Incomplete command)/m;

function puzzleLine(text){
  var rt = G.rt, s = Term.session();
  var wasPrompt = !!s.pendingPrompt;
  Term.print((wasPrompt ? s.pendingPrompt + " " : s.prompt()) + (wasPrompt ? "" : text), "in");
  var out = s.exec(text);
  if(out) Term.block(out);
  var d = s.dev;
  (d.notices || []).splice(0).forEach(function(m){ Term.print(m, "sys"); });
  Term.prompt();
  if(!wasPrompt && SLIP.test(out)) slip(rt);
  evalTraps(rt);
  checkGoals(rt);
}
function slip(rt){
  rt.slips++; S.slipsTotal++; G.flash = 0.25;
  if(rt.def.harmsPell) rt.harm++;
  if(rt.def.water) waterHit(rt);
  $("slips").textContent = "slips this room: " + rt.slips;
}
function waterHit(rt){ if(rt.slips % 3 === 0) toast("The water rises.", true); }

function evalTraps(rt){
  var list = rt.def.traps || [];
  list.forEach(function(t){
    if(t === "cut"){
      var cut = rt.snapUp.some(function(f){ return f.adminDown; });
      if(cut && !rt.trapState.cut){ rt.trapState.cut = true; trapHit(rt, "Something above you shifts. Dust comes down.", false); }
      if(!cut) rt.trapState.cut = false;
      return;
    }
    var now = !!t.test(rt);
    if(now && !rt.trapState[t.id]){ rt.trapState[t.id] = true; trapHit(rt, t.msg, true); }
    if(!now) rt.trapState[t.id] = false;
  });
}
function trapHit(rt, msg, scene){
  if(rt.def.harmsPell) rt.harm += 2;
  rt.slips++; S.slipsTotal++;
  if(rt.def.water) waterHit(rt);
  hurt(1, msg);
  if(rt.def.id === "lift4") runScene(STORY.scenes.lift4_hit);
}
function checkGoals(rt){
  var all = true;
  rt.def.goals.forEach(function(g){
    var ok = false;
    try { ok = !!g.test(rt); } catch(e){ ok = false; }
    rt.done[g.id] = ok; if(!ok) all = false;
  });
  renderGoals(rt);
  if(all && !rt.solved) solvePuzzle(rt);
}
function ratingFor(slips, final){
  var lim = final ? [2, 7] : [1, 4];
  return slips <= lim[0] ? "clean" : slips <= lim[1] ? "rough" : "botched";
}
function award(def, rating){
  var n = (def.reward && def.reward[rating]) || 0;
  S.marks += n; renderHud();
  var name = { clean: "Clean", rough: "Rough", botched: "Botched" }[rating];
  if(n) toast(name + " — +" + n + " marks"); else toast(name);
}

function solvePuzzle(rt){
  var def = rt.def, rating = ratingFor(rt.slips, def.final);
  rt.solved = true;
  if(document.activeElement === tin) tin.blur();
  if(def.harmsPell){
    S.pell = rt.harm <= 3 ? "ok" : rt.harm <= 7 ? "hurt" : "dead";
    // Mara notices whether the boy she knows came back whole
    S.mara = Math.max(-3, Math.min(6, S.mara + (S.pell === "ok" ? 1 : S.pell === "dead" ? -1 : 0)));
  }
  if(def.final) S.finalRating = rating;
  var open = function(){
    var exit = G.objs.filter(function(o){ return o.type === "exit"; })[0];
    if(exit) exit.open = true;
    S.rooms[def.id] = rating;
    save(); refreshHint();
  };
  if(def.then){
    S.rooms[def.id + ":puzzle"] = rating;
    runScene(STORY.scenes.warden_puzzle, function(){ startDefense(def.then, def.id, def); });
    return;
  }
  award(def, rating);
  if(def.final){
    open();
    runScene(STORY.scenes.nine_final || [], function(){ finale(); });
    return;
  }
  var scene = { gate7: STORY.scenes.gate7_solved, corridor: STORY.scenes.corridor_solved,
                lift4: STORY.scenes.lift4_solved && STORY.scenes.lift4_solved[S.pell] }[def.id] || STORY.scenes[def.id + "_solved"];
  open();
  if(scene) runScene(scene, refreshHint);
}

function finale(){
  var key = STORY.endingFor(S), meta = {
    redemption: ["Redemption", "The order is cancelled. The seven come home. The town forgives you slowly, and not all at once."],
    quiet: ["A Quiet Redemption", "You did it right, and you carry the rest of it by yourself."],
    bittersweet: ["Bittersweet", "It's finished. It could have been better, and you both know where."],
    heartbreak: ["Heartbreak", "You said it right, once. It wasn't soon enough."],
    exile: ["Exile", "You ran. You are, at least, very good at running."]
  }[key];
  var sceneKey = "end_" + key;
  runScene(STORY.scenes[sceneKey], function(){
    var extra = S.pell === "dead" ? " Pell is not in the story. That's part of it." : "";
    $("endtitle").textContent = meta[0];
    $("endtext").textContent = meta[1] + extra + "  (Slips: " + S.slipsTotal + ")";
    $("endmodal").hidden = false; G.mode = "ended";
    /* The save is left as it was, at the last visit to town (just before Level Nine), so a
       heartbreak can be tried again with Continue. */
  });
}

/* ====================================================================================
   Hurt, tonic, blackout
   ==================================================================================== */
function hurt(n, msg){
  S.hp = Math.max(0, S.hp - n); renderHud(); G.flash = 0.35;
  toast(msg || "That hurt.", true);
  if(S.hp <= 0) setTimeout(blackout, 700);
}
function blackout(){
  var rid = G.roomId;
  runScene([N_("Everything goes black."), N_("You come to on the floor, the slate warm in your hands. You've lost your place, not your progress.")], function(){
    S.hp = S.hpMax; renderHud();
    if(G.rt){ G.rts[rid] = null; var from = "start"; G.rts[rid] = makePuzzle(ROOMS[rid]); enterRoom(rid, from); }
    else if(G.def) startDefense(G.defCfg, G.defId, G.defOwner);
  });
}
function N_(t){ return { n: t }; }
function drinkTonic(){
  if(S.hp >= S.hpMax){ toast("You feel fine."); return; }
  if(!S.items.tonic){ toast("No tonic. Odo has some.", true); return; }
  S.items.tonic--; S.hp = S.hpMax; renderHud(); toast("The tonic is bitter. You feel better.");
}

/* ====================================================================================
   Defense rooms: strays walk toward the target; type what each one wants
   ==================================================================================== */
var SPEED = { mote: 1, crawler: 0.85, hulk: 0.6 };

function startDefense(cfg, id, owner){
  G.defCfg = cfg; G.defId = id; G.defOwner = owner || null;
  clearLabels();
  var topo = cfg.arena(), session = new IOS.Session(topo.devices.Gatewatch, topo, "priv");
  var targets = cfg.targets.map(function(t){
    var o = G.objs.filter(function(x){ return x.type === "target" && x.id === t.id; })[0];
    var hp = t.hp;
    if(cfg.choosesTarget){
      hp += S.gate === t.id ? 1 : -1;
      hp += S.ledger === "shown" ? -1 : 0;
    }
    return { id: t.id, hp: hp, hpMax: hp, x: o ? o.x * T : 150, y: o ? o.y * T : 80, label: o ? o.label : t.id, hit: 0 };
  });
  G.def = { cfg: cfg, id: id, topo: topo, session: session, targets: targets, enemies: [], waves: cfg.waves.slice(), cur: null,
            gap: 0, pause: 1.5, stun: 0, slips: 0, damage: 0, over: false, serial: 0, lock: null, lastLabel: "" };
  var logs = {}; logs.Gatewatch = [];
  G.mode = "defense";
  Term.attach({ Gatewatch: session }, ["Gatewatch"], logs, "Gatewatch");
  Term.print("The slate hums. Whatever comes, you'll answer it.", "dim");
  $("sidehead").textContent = "Hold the line";
  $("slips").textContent = "slips: 0";
  renderGoals(null);
  buildTargetBars();
  Term.focus();
  setHint("Answer each question");
}
function buildTargetBars(){
  var d = G.def;
  d.bars = d.targets.map(function(t){
    var wrap = document.createElement("div"), bar = document.createElement("div"), fill = document.createElement("b"), name = document.createElement("div");
    wrap.className = "tbar"; bar.appendChild(fill);
    wrap.style.cssText = "width:14%;";
    wrap.appendChild(fill); name.className = "tname"; name.textContent = t.label;
    $("labels").appendChild(wrap); $("labels").appendChild(name);
    return { wrap: wrap, fill: fill, name: name };
  });
}
function clearLabels(){ $("labels").innerHTML = ""; }

function pickSpec(pool, d){
  var list = POOLS[pool], spec, tries = 0;
  do { spec = list[Math.floor(Math.random() * list.length)]; } while(spec.label === d.lastLabel && tries++ < 6);
  d.lastLabel = spec.label;
  return spec;
}
function spawnEnemy(d, wave){
  var spec = pickSpec(wave.pool, d), tgt = d.targets[d.serial % d.targets.length];
  var e = { id: ++d.serial, spec: spec, kind: spec.kind, x: 30 + Math.random() * 250, y: 22 + Math.random() * 6, speed: wave.speed * (SPEED[spec.kind] || 1),
            prog: 0, target: tgt, flash: 0, el: null };
  var el = document.createElement("div");
  el.className = "el"; el.innerHTML = "<span></span><i></i>";
  $("labels").appendChild(el);
  e.el = el;
  d.enemies.push(e);
  updateLabel(e);
}
function updateLabel(e){
  var dots = e.spec.seq.length > 1 ? e.spec.seq.map(function(_, i){ return i < e.prog ? "●" : "○"; }).join(" ") : "";
  e.el.lastChild.textContent = dots;
}
function killEnemy(d, e, good){
  if(e.el && e.el.parentNode) e.el.parentNode.removeChild(e.el);
  d.enemies = d.enemies.filter(function(x){ return x !== e; });
  if(good){ burst(e.x + 8, e.y + 8, C.lamp, 12); Term.print("✓ " + e.spec.label, "good"); }
  if(d.lock === e) d.lock = null;
}
function burst(x, y, col, n){
  for(var i = 0; i < n; i++){
    var a = Math.random() * 6.283, sp = 20 + Math.random() * 40;
    G.particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10, life: 0.5 + Math.random() * 0.3, col: col });
  }
}

function defenseLine(text){
  var d = G.def, s = d.session;
  if(!text.trim()) return;
  if(d.stun > 0){ Term.print("(your hands won't answer yet)", "dim"); return; }
  var canon = s.canon(text);
  Term.print(s.prompt() + text, "in");
  var out = s.exec(text);
  if(out) Term.block(out);
  Term.prompt();
  if(SLIP.test(out)){ d.slips++; S.slipsTotal++; d.stun = 0.7; G.flash = 0.25; $("slips").textContent = "slips: " + d.slips; return; }
  if(canon == null) return;
  var hit = null;
  if(d.lock){
    var e = d.lock;
    if(e.spec.seq[e.prog] === canon){ hit = e; }
    else { e.prog = 0; updateLabel(e); d.lock = null; s.mode = "priv"; s.cur = null; Term.print("(the slate forgets where it was)", "dim"); Term.prompt(); return; }
  } else {
    var best = null, bd = 1e9;
    d.enemies.forEach(function(e){
      if(e.prog === 0 && e.spec.seq[0] === canon){
        var dist = Math.abs(e.x - e.target.x) + Math.abs(e.y - e.target.y);
        if(dist < bd){ bd = dist; best = e; }
      }
    });
    hit = best;
  }
  if(!hit){ if(!d.lock) Term.print("(nothing wanted that)", "dim"); return; }
  hit.prog++; hit.flash = 0.15; updateLabel(hit);
  if(hit.prog >= hit.spec.seq.length){ killEnemy(d, hit, true); s.mode = "priv"; s.cur = null; Term.prompt(); }
  else d.lock = hit;
}

function updateDefense(dt){
  var d = G.def;
  if(!d || d.over || G.mode !== "defense") return;
  if(d.stun > 0) d.stun -= dt;
  // spawning
  if(!d.cur){
    if(d.waves.length){ d.pause -= dt; if(d.pause <= 0){ d.cur = { w: d.waves.shift(), n: 0 }; d.gap = 0; } }
  } else {
    d.gap -= dt;
    if(d.cur.n < d.cur.w.n && d.gap <= 0){ spawnEnemy(d, d.cur.w); d.cur.n++; d.gap = d.cur.w.gap; }
    if(d.cur.n >= d.cur.w.n && !d.enemies.length){ d.cur = null; d.pause = 2.5; }
  }
  // walking
  d.enemies.slice().forEach(function(e){
    var tx = e.target.x, ty = e.target.y, dx = tx - e.x, dy = ty - e.y, dist = Math.hypot(dx, dy);
    if(e.flash > 0) e.flash -= dt;
    if(dist < 10){
      e.target.hp = Math.max(0, e.target.hp - (e.kind === "hulk" ? 2 : 1)); e.target.hit = 0.4; d.damage++;
      burst(tx + 8, ty + 8, C.red, 10); G.flash = 0.25;
      killEnemy(d, e, false);
      if(d.lock === e) d.lock = null;
      return;
    }
    e.x += dx / dist * e.speed * dt; e.y += dy / dist * e.speed * dt;
  });
  d.targets.forEach(function(t){ if(t.hit > 0) t.hit -= dt; });
  if(d.targets.some(function(t){ return t.hp <= 0; })) return defenseLost();
  if(!d.cur && !d.waves.length && !d.enemies.length) defenseWon();
}
function defenseLost(){
  var d = G.def; d.over = true;
  d.enemies.forEach(function(e){ if(e.el && e.el.parentNode) e.el.parentNode.removeChild(e.el); });
  toast("The line breaks.", true);
  setTimeout(function(){ if(G.def === d){ Term.print("You steady yourself and start again.", "dim"); startDefense(G.defCfg, G.defId, G.defOwner); } }, 1600);
}
function defenseWon(){
  var d = G.def; d.over = true;
  var rating = d.damage === 0 && d.slips <= 2 ? "clean" : "rough";
  var cfg = G.defCfg, id = G.defId, owner = G.defOwner;
  clearLabels();
  var room = owner || cfg;
  S.rooms[id] = rating;
  award(cfg.reward ? cfg : owner, rating);
  if(G.defId === "nightgate"){
    S.evacLost = d.targets.filter(function(t){ return t.id === "line"; }).some(function(t){ return t.hpMax - t.hp >= 3; });
    S.wardsDark = d.targets.filter(function(t){ return t.id === "wards"; }).some(function(t){ return t.hpMax - t.hp >= 3; });
    if(!S.evacLost) S.mara = Math.min(6, S.mara + 1);
  }
  var exit = G.objs.filter(function(o){ return o.type === "exit"; })[0];
  if(exit) exit.open = true;
  G.def = null; G.mode = "walk";
  Term.print("The last one goes quiet.", "dim");
  var scene = { strays: STORY.scenes.strays_done, warden: STORY.scenes.warden_done, nightgate: STORY.scenes.nightgate_done }[id] || STORY.scenes[id + "_done"];
  save();
  setTimeout(function(){ if(scene) runScene(scene, function(){ Term.detach(); refreshHint(); }); else { Term.detach(); refreshHint(); } }, 700);
}

/* ====================================================================================
   Interaction
   ==================================================================================== */
function facingObj(){
  var p = G.player, cxp = p.x + 8, cyp = p.y + 12, off = 11;
  var vx = p.dir === "left" ? -off : p.dir === "right" ? off : 0, vy = p.dir === "up" ? -off : p.dir === "down" ? off : 0;
  var o = objAtTile(Math.floor((cxp + vx) / T), Math.floor((cyp + vy) / T));
  if(o) return o;
  // the sign and a few tiles are map characters, not objects
  return null;
}
function interact(){
  var o = facingObj();
  if(!o) return;
  if(o.type === "npc"){
    var p = G.player;
    o.dir = p.dir === "left" ? "right" : p.dir === "right" ? "left" : p.dir === "up" ? "down" : "up";
    var steps = STORY.npc[o.id] ? STORY.npc[o.id](S) : [{ n: "..." }];
    runScene(steps, function(){ if(o.id === "gate7" || o.id === "odo") renderHud(); });
    return;
  }
  if(o.type === "board"){ runScene(STORY.npc.board(S)); return; }
  if(o.type === "console"){
    if(!G.rt){ runScene([{ n: "It's dark. Nothing answers." }]); return; }
    var name = G.rt.built.order[o.dev];
    G.rt.active = name; Term.setActive(name); Term.focus(); return;
  }
  if(o.type === "pc"){ runScene([{ n: "A lamp. The Old Tongue can reach it from the console." }]); return; }
  if(o.type === "ledger"){
    if(S.ledger){ runScene([{ n: "You've already made up your mind about the ledger." }]); return; }
    runScene(STORY.scenes.ledger, function(){ save(); });
    return;
  }
  if(o.type === "ward"){ runScene(STORY.scenes.nine_ward); return; }
  if(o.type === "exit" && !o.open){ runScene([{ n: "The gate is shut. Something in this room still needs saying." }]); return; }
}
function refreshHint(){
  if(G.mode !== "walk") return;
  var o = facingObj();
  var t = "";
  if(o){
    if(o.type === "npc") t = "E: talk";
    else if(o.type === "console") t = "E: use the console";
    else if(o.type === "board" || o.type === "ledger" || o.type === "ward") t = "E: look";
  }
  setHint(t);
}

/* ====================================================================================
   Input
   ==================================================================================== */
window.addEventListener("keydown", function(e){
  var k = e.key;
  if(G.mode === "title" || G.mode === "ended") return;
  if(G.mode === "intro"){
    if(k === "Enter" || k === " " || k === "e" || k === "E"){ e.preventDefault(); introNext(); }
    else if(k === "Escape"){ introEnd(); }
    return;
  }
  if(document.activeElement === tin) return;
  if(G.mode === "scene"){
    if(D.choices){ var n = parseInt(k, 10); if(n >= 1 && n <= D.choices.length){ e.preventDefault(); pickChoice(n - 1); } return; }
    if(k === "Enter" || k === " " || k === "e" || k === "E"){ e.preventDefault(); advance(); }
    return;
  }
  if(G.mode === "defense"){ Term.focus(); return; }
  if(G.mode !== "walk") return;
  var map = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
  if(map[k]){ e.preventDefault(); G.keys[map[k]] = true; return; }
  if(k === "e" || k === "E" || k === " " || k === "Enter"){ e.preventDefault(); interact(); return; }
  if(k === "h" || k === "H"){ drinkTonic(); }
});
window.addEventListener("keyup", function(e){
  var map = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
  if(map[e.key]) G.keys[map[e.key]] = false;
});
window.addEventListener("blur", function(){ G.keys = {}; });
$("dlg").addEventListener("click", function(e){ if(e.target.closest(".dc")) return; advance(); });

/* touch controls: held buttons act like held keys, E acts like pressing E */
Array.prototype.forEach.call(document.querySelectorAll("#pad .pk"), function(b){
  var k = b.getAttribute("data-k");
  var down = function(e){ e.preventDefault(); if(G.mode === "walk") G.keys[k] = true; };
  var up = function(){ G.keys[k] = false; };
  b.addEventListener("pointerdown", down);
  ["pointerup", "pointerleave", "pointercancel"].forEach(function(ev){ b.addEventListener(ev, up); });
});
$("hint").addEventListener("click", function(){ if(G.mode === "walk") interact(); });
$("padE").addEventListener("pointerdown", function(e){
  e.preventDefault();
  if(G.mode === "scene" && !D.choices) advance();
  else if(G.mode === "walk") interact();
});

/* ====================================================================================
   Update and draw
   ==================================================================================== */
function updatePlayer(dt){
  var p = G.player, k = G.keys, dx = 0, dy = 0;
  if(k.left) dx -= 1; if(k.right) dx += 1; if(k.up) dy -= 1; if(k.down) dy += 1;
  if(dx && dy){ dx *= 0.7071; dy *= 0.7071; }
  var sp = 62 * dt, moved = false;
  if(dx){ var nx = p.x + dx * sp; if(!boxBlocked(nx, p.y)){ p.x = nx; moved = true; } }
  if(dy){ var ny = p.y + dy * sp; if(!boxBlocked(p.x, ny)){ p.y = ny; moved = true; } }
  if(dx || dy) p.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
  if(moved){ p.ft += dt; if(p.ft > 0.16){ p.ft = 0; p.frame = p.frame ? 0 : 1; } } else p.frame = 0;
  // walking onto an entry or an open exit
  var tx = Math.floor((p.x + 8) / T), ty = Math.floor((p.y + 12) / T), o = objAtTile(tx, ty);
  if(o && G.mapId !== "hub"){
    if(o.type === "exit" && o.open && !G.transit){ G.transit = true; setTimeout(function(){ G.transit = false; }, 600); exitRoom(); }
    else if(o.type === "entry" && !G.transit){ G.transit = true; setTimeout(function(){ G.transit = false; }, 600); backRoom(); }
  }
  if(G.mapId === "hub" && ty >= 16 && tx >= 27 && tx <= 29 && !G.hubMineMsg){ /* the mine mouth is only an image; the gate is the way in */ }
}

function update(dt){
  G.tick += dt * 1000;
  if(D.typing){
    D.shown += dt * 58;
    if(D.shown >= D.full.length){ D.shown = D.full.length; D.typing = false; $("dnext").hidden = false; }
    $("dtext").textContent = D.full.slice(0, Math.floor(D.shown));
  }
  if(G.mode === "walk"){
    updatePlayer(dt);
    if(!document.activeElement || document.activeElement !== tin) refreshHintSoft();
  }
  if(G.mode === "defense" || (G.def && G.mode === "scene")) updateDefense(dt);
  updateQBar();
  G.particles = G.particles.filter(function(p){ p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt; return p.life > 0; });
  if(G.flash > 0) G.flash -= dt;
  if(G.map) updateCamera(false);
}
var lastFacing = null;
function refreshHintSoft(){ var o = facingObj(); if(o !== lastFacing){ lastFacing = o; refreshHint(); } }

function drawObj(o, camX, camY, frame){
  var x = Math.round(o.x * T - camX), y = Math.round(o.y * T - camY), blink = ((G.tick / 1700) | 0) % 5 === 0 && ((G.tick / 110) | 0) % 3 === 0;
  if(o.hidden) return;
  if(o.type === "npc"){
    if(o.sprite === "gate7") cx.drawImage(ART.gateFace(blink), x, y);
    else cx.drawImage(ART.person(o.sprite, o.dir || "down", 0), x, y - 2);
  } else if(o.type === "console") cx.drawImage(ART.tile("console", frame), x, y);
  else if(o.type === "pc" || o.type === "ward"){ cx.drawImage(ART.tile("lampStand", frame), x, y); }
  else if(o.type === "exit") cx.drawImage(ART.tile(o.open ? "gateOpen" : "gate"), x, y);
  else if(o.type === "boss") cx.drawImage(ART.boss(frame), x, y);
  else if(o.type === "ledger"){ cx.fillStyle = C.white; cx.fillRect(x + 3, y + 4, 10, 8); cx.fillStyle = C.red; cx.fillRect(x + 4, y + 5, 2, 6); cx.fillStyle = C.s2; cx.fillRect(x + 7, y + 6, 5, 1); cx.fillRect(x + 7, y + 9, 5, 1); }
  else if(o.type === "target" && G.def){
    var t = G.def.targets.filter(function(q){ return q.id === o.id; })[0];
    if(!t) return;
    var low = t.hp <= 1;
    if(o.id === "gate"){ cx.drawImage(ART.tile("gate"), x, y); }
    else if(o.id === "line"){ cx.drawImage(ART.person("kid", "up", 0), x - 8, y); cx.drawImage(ART.person("elder", "up", 0), x + 8, y + 2); cx.drawImage(ART.person("mara", "up", 0), x + 24, y); }
    else if(o.id === "wards"){ cx.drawImage(ART.tile("lampStand", frame), x - 8, y); cx.drawImage(ART.tile("lampStand", frame), x + 8, y); cx.drawImage(ART.tile("lampStand", frame), x + 24, y); }
    else cx.drawImage(ART.tile("lampStand", frame), x, y);
    if(t.hit > 0){ cx.fillStyle = "rgba(236,111,100,0.35)"; cx.fillRect(x - 10, y - 4, 44, 24); }
    if(low && ((G.tick / 200) | 0) % 2){ cx.fillStyle = "rgba(236,111,100,0.18)"; cx.fillRect(x - 10, y - 4, 44, 24); }
  }
}

function draw(){
  var m = G.map;
  if(!m) return;
  var camX = Math.round(G.cam.x), camY = Math.round(G.cam.y), frame = ((G.tick / 450) | 0) & 1;
  cx.fillStyle = C.ink; cx.fillRect(0, 0, VW * T, VH * T);
  var x0 = Math.max(0, Math.floor(camX / T)), x1 = Math.min(m.w - 1, Math.floor((camX + VW * T) / T));
  var y0 = Math.max(0, Math.floor(camY / T)), y1 = Math.min(m.h - 1, Math.floor((camY + VH * T) / T));
  for(var ty = y0; ty <= y1; ty++) for(var tx = x0; tx <= x1; tx++){
    var leg = LEG[m.rows[ty].charAt(tx)] || LEG["v"];
    cx.drawImage(ART.tile(leg.t, frame), tx * T - camX, ty * T - camY);
  }
  // things, sorted so what's lower on screen is drawn on top
  var list = G.objs.slice();
  var drawn = [];
  list.forEach(function(o){ drawn.push({ y: o.y * T + (o.type === "boss" ? 20 : 0), f: function(){ drawObj(o, camX, camY, frame); } }); });
  var p = G.player;
  drawn.push({ y: p.y + 14, f: function(){ cx.drawImage(ART.hero(S && S.look, p.dir, p.frame), Math.round(p.x - camX), Math.round(p.y - camY)); } });
  if(G.def) G.def.enemies.forEach(function(e){
    drawn.push({ y: e.y + 12, f: function(){
      cx.drawImage(ART.enemy(e.kind, frame), Math.round(e.x - camX), Math.round(e.y - camY));
      if(e.flash > 0){ cx.fillStyle = "rgba(255,255,255,0.7)"; cx.fillRect(Math.round(e.x - camX) + 3, Math.round(e.y - camY) + 3, 10, 10); }
    } });
  });
  drawn.sort(function(a, b){ return a.y - b.y; }).forEach(function(d){ d.f(); });
  // dark rooms and rising water
  if(m.dark){ cx.fillStyle = "rgba(8,6,20,0.38)"; cx.fillRect(0, 0, VW * T, VH * T); }
  if(G.rt && G.rt.def.water){
    var h = Math.min(120, G.rt.slips * 7) + 8;
    cx.fillStyle = "rgba(40,90,150,0.38)"; cx.fillRect(0, VH * T - h, VW * T, h);
    cx.fillStyle = "rgba(140,195,222,0.5)";
    for(var wx = 0; wx < VW * T; wx += 8) cx.fillRect(wx, VH * T - h + (Math.sin(G.tick / 300 + wx / 9) * 1.5 | 0), 5, 1);
  }
  G.particles.forEach(function(q){ cx.fillStyle = q.col; cx.fillRect(Math.round(q.x - camX), Math.round(q.y - camY), 2, 2); });
  if(G.flash > 0){ cx.fillStyle = "rgba(236,111,100," + Math.min(0.28, G.flash) + ")"; cx.fillRect(0, 0, VW * T, VH * T); }
  // outdoor warm vignette and the defense overlays are drawn in the page, not here
  positionLabels(camX, camY);
}
function positionLabels(camX, camY){
  var d = G.def;
  if(!d) return;
  d.enemies.forEach(function(e){
    if(!e.el) return;
    e.el.style.left = ((e.x - camX + 8) / (VW * T) * 100) + "%";
    e.el.style.top = ((e.y - camY - 1) / (VH * T) * 100) + "%";
  });
  if(d.bars) d.targets.forEach(function(t, i){
    var b = d.bars[i];
    var cxp = (t.x - camX + 8) / (VW * T) * 100, cyp = (t.y - camY + 20) / (VH * T) * 100;
    b.wrap.style.left = (cxp - 7) + "%"; b.wrap.style.top = cyp + "%";
    b.fill.style.width = Math.max(0, t.hp / t.hpMax * 100) + "%";
    b.wrap.className = "tbar" + (t.hp <= 1 ? " low" : "");
    b.name.style.left = cxp + "%"; b.name.style.top = "calc(" + cyp + "% + 8px)";
  });
}

var last = 0;
function loop(now){
  var dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  if(S && G.map){ update(dt); draw(); }
  requestAnimationFrame(loop);
}

/* ====================================================================================
   Starting and continuing
   ==================================================================================== */
function enterHubFresh(){
  Term.detach(); renderGoals(null); $("sidehead").textContent = "";
  G.def = null; G.rt = null; G.roomId = null;
  var dock = S.hub === "prologue";
  loadMap("hub", dock ? [11, 15] : [28, 13], "down");
  var mara = G.objs.filter(function(o){ return o.id === "mara"; })[0];
  if(dock && mara){ mara.x = 12; mara.y = 14; mara.dir = "left"; }
  var pell = G.objs.filter(function(o){ return o.id === "pell"; })[0];
  if(pell && S.pell === "dead" && (S.hub === "day3" || S.hub === "gate3")) pell.hidden = true;
  if(pell && S.hub === "prologue") { pell.hidden = false; }
  renderHud();
  $("title").hidden = true; $("endmodal").hidden = true;
  G.mode = "walk";
  if(dock){ runScene(STORY.scenes.prologue, function(){ S.hub = "gate"; save(); if(mara){ mara.x = 4; mara.y = 5; mara.dir = "down"; } refreshHint(); }); }
  refreshHint();
}
$("btnNew").addEventListener("click", openCreator);
$("btnCont").addEventListener("click", function(){
  S = loadSave() || newState();
  S.look = S.look || ART.defaultLook(); S.title = S.title || "Mister";   // saves from before the character screen
  TITLE.stop(); G.rts = {}; G.intros = {}; enterHubFresh();
});

/* ====================================================================================
   Character screen: name, how people address you, and a handful of swatches
   ==================================================================================== */
var draft = null, pvTimer = 0;
var LOOK_ROWS = [["skin", "Skin", "color"], ["hair", "Hair", "color"], ["style", "Hair style", "text"], ["coat", "Coat", "color"], ["scarf", "Scarf", "color"]];
function drawPreview(frame){
  var c = $("pvcv").getContext("2d");
  c.imageSmoothingEnabled = false; c.clearRect(0, 0, 16, 16);
  c.drawImage(ART.hero(draft.look, "down", frame), 0, 0);
}
function markPressed(group, test){
  Array.prototype.forEach.call(group.querySelectorAll("[role=radio]"), function(b){
    var on = test(b); b.setAttribute("aria-checked", on ? "true" : "false");
  });
}
function buildSwatches(){
  var box = $("swatches"); box.innerHTML = "";
  LOOK_ROWS.forEach(function(r){
    var key = r[0], row = document.createElement("div"), lab = document.createElement("span"), grp = document.createElement("div");
    row.className = "swrow"; lab.className = "swl"; lab.textContent = r[1];
    grp.className = "swgrp"; grp.setAttribute("role", "radiogroup"); grp.setAttribute("aria-label", r[1]);
    ART.LOOK[key].forEach(function(v, i){
      var b = document.createElement("button");
      b.type = "button"; b.setAttribute("role", "radio"); b.dataset.i = i;
      b.setAttribute("aria-label", ART.LOOK.names[key][i]); b.title = ART.LOOK.names[key][i];
      if(r[2] === "color"){ b.className = "sw"; b.style.background = v; } else { b.className = "swt"; b.textContent = ART.LOOK.names[key][i]; }
      b.addEventListener("click", function(){ draft.look[key] = i; markPressed(grp, function(x){ return +x.dataset.i === i; }); drawPreview(0); });
      grp.appendChild(b);
    });
    markPressed(grp, function(b){ return +b.dataset.i === draft.look[key]; });
    row.appendChild(lab); row.appendChild(grp); box.appendChild(row);
  });
}
function openCreator(){
  draft = { title: "Mister", look: ART.defaultLook() };
  buildSwatches();
  markPressed($("segTitle"), function(b){ return b.dataset.v === draft.title; });
  drawPreview(0);
  var f = 0; clearInterval(pvTimer); pvTimer = setInterval(function(){ f ^= 1; drawPreview(f); }, 420);
  $("create").hidden = false; $("nameIn").focus();
}
function closeCreator(){ clearInterval(pvTimer); $("create").hidden = true; }
Array.prototype.forEach.call(document.querySelectorAll("#segTitle [role=radio]"), function(b){
  b.addEventListener("click", function(){ draft.title = b.dataset.v; markPressed($("segTitle"), function(x){ return x === b; }); });
});
$("crBack").addEventListener("click", closeCreator);
$("crGo").addEventListener("click", function(){
  S = newState(); S.name = cleanName($("nameIn").value); S.title = draft.title; S.look = JSON.parse(JSON.stringify(draft.look));
  closeCreator(); TITLE.stop(); G.rts = {}; G.intros = {};
  startIntro(enterHubFresh);
});

/* ====================================================================================
   Opening cards
   ==================================================================================== */
var intro = null;
function showIntroCard(){
  var c = STORY.intro[intro.i];
  TITLE.introStart($("icv"), c.art);
  var box = $("itext"); box.innerHTML = "";
  c.text.forEach(function(t){ var p = document.createElement("p"); p.textContent = fmt(t); box.appendChild(p); });
  var w = $("iwords"); w.innerHTML = ""; w.hidden = !c.words;
  if(c.words) c.words.forEach(function(pair, k){
    var d = document.createElement("div"), s = document.createElement("small"), b = document.createElement("b");
    s.textContent = pair[0]; b.textContent = pair[1]; if(k === 1) d.className = "bad";
    d.appendChild(s); d.appendChild(b); w.appendChild(d);
  });
}
function startIntro(done){
  intro = { i: 0, done: done };
  G.mode = "intro";
  $("title").hidden = true; $("intro").hidden = false;
  showIntroCard();
}
function introNext(){
  if(!intro) return;
  intro.i++;
  if(intro.i >= STORY.intro.length) introEnd(); else showIntroCard();
}
function introEnd(){
  var done = intro && intro.done; intro = null;
  TITLE.introStop(); $("intro").hidden = true;
  if(done) done();
}
$("intro").addEventListener("click", function(e){ if(e.target.id === "iskip") introEnd(); else introNext(); });
$("btnAgain").addEventListener("click", function(){ $("endmodal").hidden = true; $("title").hidden = false; G.mode = "title"; S = null; showTitle(); });

function showTitle(){
  var sv = loadSave();
  $("btnCont").hidden = !sv;
  TITLE.start($("tcv"), sv && sv.look);
  $("hearts").innerHTML = ""; $("marks").textContent = ""; $("pname").textContent = "";
  Term.detach(); renderGoals(null); clearLabels(); setHint("");
}
showTitle();
requestAnimationFrame(loop);

/* Embedded on mustafahasnain.com: report our height so the frame grows to fit. */
if(window.parent !== window){
  document.body.style.paddingBottom = "18px";
  document.documentElement.style.overflow = "hidden";
  var reportHeight = function(){ parent.postMessage({ type: "tool-height", height: document.body.offsetHeight }, location.origin); };
  if(window.ResizeObserver) new ResizeObserver(reportHeight).observe(document.body);
  reportHeight();
} else {
  document.documentElement.classList.add("solo");
}

/* Handy for testing from the console. */
window.__lw = { get S(){ return S; }, get G(){ return G; }, Term: Term, enterRoom: enterRoom };

})();

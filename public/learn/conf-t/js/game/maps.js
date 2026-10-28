/* Maps. Each is a grid of characters (see LEG for what each one is) plus a list of objects:
   people, consoles, gates, signs. Rooms are all 20 x 12 tiles, one screen. The town is larger
   and the camera follows the player. */
(function(root){
"use strict";

var MAPS = root.MAPS = {};

/* char -> { tile name, solid }. Anything not listed is solid void. */
var LEG = root.LEG = {
  "#": { t: "wall", s: 1 }, "*": { t: "wallLamp", s: 1 }, ".": { t: "floor" }, "p": { t: "planks" }, ",": { t: "grass" },
  "_": { t: "path" }, "o": { t: "cobble" }, "~": { t: "water", s: 1 }, "=": { t: "bridge" }, "H": { t: "house", s: 1 },
  "W": { t: "houseWin", s: 1 }, "R": { t: "roof", s: 1 }, "D": { t: "houseDoor", s: 1 }, "T": { t: "tree", s: 1 },
  "L": { t: "lampPost", s: 1 }, "f": { t: "fence", s: 1 }, "c": { t: "crate", s: 1 }, "b": { t: "barrel", s: 1 },
  "m": { t: "mine" }, "s": { t: "shelf", s: 1 }, "k": { t: "desk", s: 1 }, "g": { t: "rug" }, "r": { t: "rubble", s: 1 },
  "F": { t: "flood", s: 1 }, "S": { t: "stairs" }, "v": { t: "void", s: 1 }, "n": { t: "sign", s: 1 }
};

function grid(w, h, ch){ var g = [], x, y; for(y = 0; y < h; y++){ g.push([]); for(x = 0; x < w; x++) g[y].push(ch); } return g; }
function rect(g, ch, x, y, w, h){ for(var j = y; j < y + h; j++) for(var i = x; i < x + w; i++) if(g[j] && g[j][i] !== undefined) g[j][i] = ch; }
function put(g, ch, x, y){ if(g[y] && g[y][x] !== undefined) g[y][x] = ch; }
function rows(g){ return g.map(function(r){ return r.join(""); }); }

/* ---------- a one-screen dungeon room ---------- */
function room(o){
  var g = grid(20, 12, o.floor || "."), objs = [];
  rect(g, "#", 0, 0, 20, 1); rect(g, "#", 0, 11, 20, 1); rect(g, "#", 0, 0, 1, 12); rect(g, "#", 19, 0, 1, 12);
  (o.lamps || [1, 8, 15]).forEach(function(x){ put(g, "*", x, 0); });
  (o.decor || []).forEach(function(d){ put(g, d[0], d[1], d[2]); });
  (o.consoles || []).forEach(function(c, i){ objs.push({ type: "console", x: c[0], y: c[1], dev: i }); });
  (o.pcs || []).forEach(function(p){ objs.push({ type: "pc", x: p[0], y: p[1], name: p[2] }); });
  (o.people || []).forEach(function(p){ objs.push({ type: "npc", id: p[0], sprite: p[0], x: p[1], y: p[2], dir: p[3] || "down" }); });
  if(o.entry){ put(g, "S", o.entry[0], o.entry[1]); objs.push({ type: "entry", x: o.entry[0], y: o.entry[1] }); }
  if(o.exit){ put(g, ".", o.exit[0], o.exit[1]); objs.push({ type: "exit", x: o.exit[0], y: o.exit[1] }); }
  (o.objs || []).forEach(function(x){ objs.push(x); });
  return { name: o.name, w: 20, h: 12, rows: rows(g), objs: objs, spawn: { x: o.spawn[0], y: o.spawn[1] }, dark: !!o.dark };
}

/* ====================================================================================
   Karrow, the town
   ==================================================================================== */
function house(g, x, y, w, doorAt){
  rect(g, "R", x, y, w, 1);
  rect(g, "H", x, y + 1, w, 2);
  var i;
  for(i = 1; i < w - 1; i++) if(i !== doorAt) put(g, "W", x + i, y + 1);
  put(g, "D", x + doorAt, y + 2);
  put(g, "_", x + doorAt, y + 3);
}
(function(){
  var g = grid(32, 20, ",");
  rect(g, "T", 0, 0, 32, 1); rect(g, "T", 0, 19, 32, 1); rect(g, "T", 0, 0, 1, 20); rect(g, "T", 31, 0, 1, 20);
  rect(g, "o", 1, 6, 30, 3);
  house(g, 2, 2, 4, 1);          // Mara's shop: door at x=3
  house(g, 11, 2, 7, 3);         // the Overseer's hall: door at x=14
  house(g, 22, 2, 4, 2);         // a house: door at x=24
  put(g, "_", 3, 5); put(g, "_", 14, 5); put(g, "_", 24, 5);
  rect(g, "~", 1, 11, 9, 8);     // the river
  rect(g, "_", 12, 9, 1, 7);     // the path down to the dock
  rect(g, "p", 9, 15, 4, 2);     // the dock
  rect(g, "_", 15, 9, 4, 1);
  put(g, "s", 15, 11); put(g, "s", 16, 11); put(g, "s", 17, 11); put(g, "b", 14, 12); put(g, "b", 18, 12); put(g, "c", 14, 11);
  rect(g, "_", 15, 10, 4, 3);
  put(g, "s", 15, 11); put(g, "s", 16, 11); put(g, "s", 17, 11); put(g, "b", 14, 12); put(g, "b", 18, 12);
  put(g, "n", 22, 9);            // the board
  rect(g, "_", 27, 9, 3, 7);     // down to the mine
  put(g, "m", 27, 16); put(g, "m", 28, 16); put(g, "m", 29, 16);
  rect(g, "T", 25, 15, 1, 3); rect(g, "T", 30, 15, 1, 3); rect(g, "T", 26, 17, 5, 1);
  put(g, "L", 6, 9); put(g, "L", 20, 9); put(g, "L", 8, 5); put(g, "L", 20, 5); put(g, "L", 30, 9);
  put(g, "T", 24, 12); put(g, "T", 22, 14); put(g, "T", 15, 16); put(g, "T", 18, 15);
  MAPS.hub = {
    name: "Karrow", w: 32, h: 20, rows: rows(g), spawn: { x: 11, y: 15 }, outdoor: true,
    objs: [
      { type: "npc", id: "mara", sprite: "mara", x: 4, y: 5, dir: "down" },
      { type: "npc", id: "odo", sprite: "odo", x: 16, y: 12, dir: "up" },
      { type: "npc", id: "garrick", sprite: "garrick", x: 15, y: 5, dir: "down" },
      { type: "npc", id: "pell", sprite: "pell", x: 19, y: 7, dir: "down" },
      { type: "npc", id: "kid", sprite: "kid", x: 26, y: 6, dir: "left" },
      { type: "npc", id: "elder", sprite: "elder", x: 8, y: 9, dir: "right" },
      { type: "npc", id: "gate7", sprite: "gate7", x: 28, y: 15 },
      { type: "board", x: 22, y: 9 }
    ]
  };
})();

/* ====================================================================================
   Dungeon rooms
   ==================================================================================== */
MAPS.gate7 = room({
  name: "Gate Seven", entry: [0, 8], exit: [19, 8], spawn: [2, 8],
  consoles: [[8, 4]], pcs: [[15, 4, "Lamp"]],
  decor: [["c", 2, 2], ["c", 3, 2], ["b", 16, 9], ["b", 17, 9], ["c", 17, 2]]
});
MAPS.strays = room({
  name: "The Strays", entry: [0, 8], exit: [19, 8], spawn: [10, 8], lamps: [3, 10, 16],
  decor: [["c", 2, 2], ["b", 3, 2], ["b", 16, 2], ["c", 17, 2], ["c", 2, 9], ["b", 17, 9]],
  objs: [{ type: "target", id: "ward", x: 10, y: 5, label: "the lamp" }]
});
MAPS.corridor = room({
  name: "The Long Corridor", entry: [0, 8], exit: [19, 8], spawn: [2, 8],
  consoles: [[6, 4], [13, 4]], pcs: [[3, 5, "Lamp A"], [16, 5, "Lamp B"]],
  decor: [["F", 9, 8], ["F", 10, 8], ["F", 9, 9], ["F", 10, 9], ["F", 9, 10], ["F", 10, 10], ["c", 5, 9], ["b", 14, 9]]
});
MAPS.warden = room({
  name: "The Gatewarden", entry: [0, 8], exit: [19, 8], spawn: [2, 8],
  consoles: [[10, 6]], pcs: [[6, 7, "Lamp One"], [14, 7, "Lamp Two"]],
  lamps: [3, 8, 16],
  decor: [["c", 2, 2], ["c", 17, 2], ["b", 2, 9], ["b", 17, 9]],
  objs: [{ type: "boss", x: 9, y: 2 }, { type: "target", id: "gate", x: 10, y: 8, label: "the gate" }]
});
MAPS.lift4 = room({
  name: "Level Four", entry: [0, 8], exit: [19, 8], spawn: [2, 8],
  consoles: [[5, 3], [14, 3]], pcs: [[2, 4, "Winch"]],
  decor: [["r", 9, 7], ["r", 10, 7], ["r", 11, 7], ["r", 9, 8], ["r", 11, 8], ["r", 9, 9], ["r", 11, 9], ["r", 10, 10], ["b", 16, 9], ["c", 17, 9]],
  people: [["pell", 10, 9, "up"]]
});
MAPS.office = room({
  name: "The Foreman's Office", floor: "p", entry: [0, 8], exit: [19, 8], spawn: [2, 8], lamps: [4, 10, 15],
  decor: [["s", 2, 1], ["s", 3, 1], ["s", 16, 1], ["s", 17, 1], ["k", 9, 3], ["k", 10, 3], ["g", 8, 6], ["g", 9, 6], ["g", 10, 6], ["g", 11, 6], ["g", 8, 7], ["g", 9, 7], ["g", 10, 7], ["g", 11, 7]],
  objs: [{ type: "ledger", x: 10, y: 3 }]
});
MAPS.nightgate = room({
  name: "The Gate", entry: [0, 8], exit: [19, 8], spawn: [10, 9], lamps: [3, 10, 16],
  decor: [["c", 2, 2], ["b", 3, 2], ["b", 16, 2], ["c", 17, 2]],
  objs: [{ type: "target", id: "wards", x: 4, y: 5, label: "the town lamps" }, { type: "target", id: "line", x: 15, y: 5, label: "the line" }]
});
MAPS.nine = room({
  name: "Level Nine", entry: [0, 8], exit: [19, 8], spawn: [2, 8], dark: true, lamps: [8],
  consoles: [[4, 3], [8, 3], [12, 3], [16, 3]], pcs: [[2, 5, "Lamp A"], [17, 5, "Lamp B"]],
  decor: [["F", 6, 9], ["F", 7, 9], ["F", 8, 9], ["F", 9, 9], ["F", 10, 9], ["F", 11, 9], ["F", 12, 9], ["F", 13, 9], ["F", 6, 10], ["F", 7, 10], ["F", 8, 10], ["F", 9, 10], ["F", 10, 10], ["F", 11, 10], ["F", 12, 10], ["F", 13, 10], ["r", 3, 8]],
  objs: [{ type: "ward", x: 10, y: 6 }]
});


/* ---------- the practice lodge ---------- */
MAPS.p1 = room({ name: "The Two Doors", entry: [0, 8], exit: [19, 8], spawn: [2, 8], consoles: [[5, 4], [14, 4]], pcs: [[2, 4, "West"], [17, 4, "East"]],
  decor: [["c", 2, 9], ["b", 3, 9], ["b", 16, 9], ["c", 17, 9]] });
MAPS.p2 = room({ name: "The Ledger Room", floor: "p", entry: [0, 8], exit: [19, 8], spawn: [2, 8], consoles: [[5, 4], [14, 4]],
  decor: [["s", 2, 1], ["s", 3, 1], ["s", 16, 1], ["s", 17, 1], ["g", 9, 6], ["g", 10, 6], ["g", 9, 7], ["g", 10, 7]] });
MAPS.p3 = room({ name: "The Rope Ring", entry: [0, 8], exit: [19, 8], spawn: [2, 8], consoles: [[4, 4], [9, 4], [14, 4]],
  decor: [["c", 2, 9], ["b", 17, 9], ["b", 16, 2], ["c", 3, 2]] });
MAPS.p4 = room({ name: "The Quiet Ports", entry: [0, 8], exit: [19, 8], spawn: [2, 8], consoles: [[9, 4]], pcs: [[5, 6, "Clerk"], [14, 6, "Porter"]],
  decor: [["b", 2, 2], ["c", 3, 2], ["c", 17, 9], ["b", 16, 9]] });
MAPS.p5 = room({ name: "The Drill Yard", entry: [0, 8], exit: [19, 8], spawn: [10, 8], lamps: [3, 10, 16],
  decor: [["c", 2, 2], ["b", 3, 2], ["b", 16, 2], ["c", 17, 2], ["c", 2, 9], ["b", 17, 9]],
  objs: [{ type: "target", id: "ward", x: 10, y: 5, label: "the lamp" }] });

/* sanity: every map is the size it says */
Object.keys(MAPS).forEach(function(k){
  var m = MAPS[k];
  if(m.rows.length !== m.h) throw new Error("map " + k + " has " + m.rows.length + " rows, expected " + m.h);
  m.rows.forEach(function(r, i){ if(r.length !== m.w) throw new Error("map " + k + " row " + i + " is " + r.length + " wide, expected " + m.w); });
});

})(typeof window !== "undefined" ? window : globalThis);

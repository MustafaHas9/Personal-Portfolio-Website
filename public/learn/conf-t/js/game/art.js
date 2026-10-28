/* Pixel art, drawn in code. Everything is a 16 x 16 cell painted with a small shared palette,
   cached on first use, and scaled up with nearest-neighbour so it stays crisp. No image files. */
(function(root){
"use strict";

var ART = root.ART = {};
var C = ART.C = {
  ink: "#120f18", night: "#1b1828", s1: "#2a2838", s2: "#3a384e", s3: "#55526b", s4: "#7b778f", s5: "#a29eb2",
  w1: "#43291e", w2: "#6a4430", w3: "#8f6040", w4: "#b4825a",
  g1: "#2a4429", g2: "#3b6236", g3: "#54833f", g4: "#7aa856",
  d1: "#4d3f2c", d2: "#6b5a3e", d3: "#8a7752",
  a1: "#1b3a60", a2: "#2b5b8e", a3: "#4d8fbd", a4: "#8cc3de",
  f1: "#16283f", f2: "#1f3a58",
  lamp: "#ffd36a", lamp2: "#e9a23c", fire: "#f0813a",
  skin: "#e2b48c", skin2: "#b8845e",
  red: "#c4473a", red2: "#8f2f2a", blue: "#4a6fb0", green: "#4f9a5a", purple: "#7a5aa8", white: "#ece8dc", teal: "#4fd1c0", teal2: "#2a8c84"
};

var cache = {};
function make(w, h, fn){
  var c = document.createElement("canvas");
  c.width = w; c.height = h;
  var x = c.getContext("2d");
  x.imageSmoothingEnabled = false;
  fn(x);
  return c;
}
function R(x, col, a, b, w, h){ x.fillStyle = col; x.fillRect(a, b, w, h); }
function rng(seed){ var s = seed >>> 0; return function(){ s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function specks(x, seed, cols, n){
  var r = rng(seed);
  for(var i = 0; i < n; i++) R(x, cols[Math.floor(r() * cols.length)], Math.floor(r() * 16), Math.floor(r() * 16), 1, 1);
}

/* ---------- tiles ---------- */
var TILES = {
  void: function(x){ R(x, C.ink, 0, 0, 16, 16); },
  floor: function(x){
    R(x, C.s2, 0, 0, 16, 16); specks(x, 11, [C.s1, C.s3], 14);
    R(x, C.s1, 0, 15, 16, 1); R(x, C.s1, 15, 0, 1, 16); R(x, C.s3, 0, 0, 16, 1);
  },
  planks: function(x){
    R(x, C.w2, 0, 0, 16, 16);
    for(var i = 0; i < 4; i++){ R(x, C.w1, 0, i * 4 + 3, 16, 1); R(x, C.w3, 0, i * 4, 16, 1); }
    R(x, C.w1, 5, 0, 1, 3); R(x, C.w1, 11, 4, 1, 3); R(x, C.w1, 3, 8, 1, 3); R(x, C.w1, 9, 12, 1, 3);
  },
  wall: function(x){
    R(x, C.s3, 0, 0, 16, 16); R(x, C.s4, 0, 0, 16, 3); R(x, C.s1, 0, 13, 16, 3);
    for(var r = 0; r < 3; r++){
      R(x, C.s2, 0, 3 + r * 4 + 3, 16, 1);
      var off = r % 2 ? 4 : 0;
      R(x, C.s2, off + 4, 3 + r * 4, 1, 3); R(x, C.s2, off + 12, 3 + r * 4, 1, 3);
    }
  },
  wallLamp: function(x, f){
    TILES.wall(x);
    R(x, C.s1, 6, 4, 4, 7); R(x, f ? C.lamp : C.lamp2, 7, 5, 2, 4); R(x, C.lamp, 7, 6, 2, 2);
  },
  grass: function(x){
    R(x, C.g2, 0, 0, 16, 16); specks(x, 5, [C.g1, C.g3, C.g3], 20);
    R(x, C.g4, 3, 4, 1, 2); R(x, C.g4, 11, 10, 1, 2);
  },
  path: function(x){ R(x, C.d2, 0, 0, 16, 16); specks(x, 7, [C.d1, C.d3, C.d3], 22); },
  cobble: function(x){
    R(x, C.s3, 0, 0, 16, 16);
    for(var r = 0; r < 4; r++) for(var c = 0; c < 4; c++){
      var ox = (r % 2) * 2; R(x, C.s4, c * 4 + ox, r * 4, 3, 3); R(x, C.s2, c * 4 + ox, r * 4 + 3, 4, 1);
    }
  },
  water: function(x, f){
    R(x, C.a2, 0, 0, 16, 16);
    for(var i = 0; i < 3; i++){ var o = (f ? 4 : 0) + i * 5; R(x, C.a3, (o + 2) % 14, 3 + i * 5, 4, 1); R(x, C.a4, (o + 8) % 14, 5 + i * 5, 2, 1); }
  },
  flood: function(x, f){
    R(x, C.f1, 0, 0, 16, 16);
    for(var i = 0; i < 3; i++){ var o = (f ? 5 : 0) + i * 4; R(x, C.f2, (o + 1) % 13, 2 + i * 5, 5, 1); R(x, C.a1, (o + 7) % 13, 4 + i * 5, 3, 1); }
  },
  house: function(x){
    R(x, C.w2, 0, 0, 16, 16);
    for(var i = 0; i < 4; i++){ R(x, C.w1, 0, i * 4 + 3, 16, 1); R(x, C.w3, 0, i * 4, 16, 1); }
    R(x, C.w1, 0, 15, 16, 1);
  },
  houseWin: function(x){ TILES.house(x); R(x, C.w1, 4, 4, 8, 8); R(x, C.lamp2, 5, 5, 6, 6); R(x, C.w1, 7, 5, 2, 6); R(x, C.w1, 5, 8, 6, 1); },
  roof: function(x){
    R(x, C.red2, 0, 0, 16, 16);
    for(var r = 0; r < 4; r++){ R(x, C.red, 0, r * 4, 16, 3); R(x, C.w1, 0, r * 4 + 3, 16, 1); }
    R(x, "#d86a52", 0, 0, 16, 1);
  },
  houseDoor: function(x){ TILES.house(x); R(x, C.w1, 4, 3, 8, 13); R(x, C.w3, 5, 4, 6, 12); R(x, C.lamp2, 9, 10, 1, 1); },
  tree: function(x){
    TILES.grass(x);
    R(x, C.w1, 7, 10, 3, 5); R(x, C.g1, 2, 1, 12, 11); R(x, C.g2, 3, 1, 10, 9); R(x, C.g3, 4, 2, 4, 3); R(x, C.g1, 2, 10, 12, 2);
  },
  lampPost: function(x, f){
    TILES.grass(x);
    R(x, C.s1, 7, 6, 2, 9); R(x, C.s1, 5, 4, 6, 3); R(x, f ? C.lamp : C.lamp2, 6, 4, 4, 2);
  },
  fence: function(x){
    TILES.grass(x);
    R(x, C.w3, 0, 6, 16, 2); R(x, C.w3, 0, 10, 16, 2); R(x, C.w2, 1, 4, 2, 10); R(x, C.w2, 7, 4, 2, 10); R(x, C.w2, 13, 4, 2, 10);
  },
  crate: function(x){
    TILES.floor(x);
    R(x, C.w1, 2, 3, 12, 12); R(x, C.w3, 3, 4, 10, 10); R(x, C.w1, 3, 8, 10, 1); R(x, C.w1, 7, 4, 2, 10); R(x, C.w4, 3, 4, 10, 1);
  },
  barrel: function(x){
    TILES.floor(x);
    R(x, C.w1, 3, 2, 10, 13); R(x, C.w2, 4, 3, 8, 11); R(x, C.s3, 3, 5, 10, 1); R(x, C.s3, 3, 11, 10, 1); R(x, C.w3, 5, 3, 2, 11);
  },
  lampStand: function(x, f){
    TILES.floor(x);
    R(x, C.s1, 5, 13, 6, 2); R(x, C.s2, 7, 8, 2, 6); R(x, C.s1, 4, 3, 8, 6); R(x, f ? C.lamp : C.lamp2, 5, 4, 6, 4); R(x, C.white, 7, 5, 2, 2);
  },
  console: function(x, f){
    TILES.floor(x);
    R(x, C.s1, 2, 5, 12, 10); R(x, C.s3, 3, 6, 10, 8); R(x, C.s1, 4, 7, 8, 5);
    R(x, f ? C.teal : C.teal2, 5, 8, 6, 3); R(x, C.white, 5, 8, 2, 1); R(x, C.s1, 5, 13, 6, 1);
  },
  gate: function(x){
    TILES.floor(x);
    R(x, C.s1, 0, 0, 16, 16);
    for(var i = 0; i < 4; i++) R(x, C.s4, 1 + i * 4, 1, 2, 14);
    R(x, C.s3, 0, 4, 16, 2); R(x, C.s3, 0, 10, 16, 2); R(x, C.red, 6, 6, 4, 4); R(x, C.ink, 7, 7, 2, 2);
  },
  gateOpen: function(x){
    TILES.floor(x);
    R(x, C.s1, 0, 0, 2, 16); R(x, C.s1, 14, 0, 2, 16); R(x, C.s4, 1, 1, 1, 14); R(x, C.s4, 14, 1, 1, 14);
    R(x, C.green, 6, 6, 4, 4);
  },
  mine: function(x){
    R(x, C.s3, 0, 0, 16, 16); R(x, C.ink, 2, 3, 12, 13); R(x, C.s1, 1, 2, 14, 2); R(x, C.w2, 1, 3, 2, 13); R(x, C.w2, 13, 3, 2, 13);
    R(x, C.s1, 4, 6, 8, 10); R(x, C.night, 5, 8, 6, 8);
  },
  stairs: function(x){
    TILES.floor(x);
    for(var i = 0; i < 4; i++) R(x, i % 2 ? C.s4 : C.s3, 1, 2 + i * 3, 14, 3);
  },
  sign: function(x){
    TILES.path(x);
    R(x, C.w1, 7, 8, 2, 7); R(x, C.w3, 2, 2, 12, 7); R(x, C.w2, 3, 3, 10, 5); R(x, C.w1, 4, 4, 8, 1); R(x, C.w1, 4, 6, 6, 1);
  },
  rubble: function(x){
    TILES.floor(x);
    R(x, C.s4, 2, 6, 6, 6); R(x, C.s3, 5, 3, 7, 7); R(x, C.s2, 9, 8, 5, 6); R(x, C.s5, 3, 6, 3, 1); R(x, C.s5, 6, 3, 4, 1); R(x, C.s1, 2, 12, 12, 2);
  },
  bridge: function(x){ R(x, C.a2, 0, 0, 16, 16); R(x, C.w2, 0, 2, 16, 12); for(var i = 0; i < 4; i++) R(x, C.w1, 0, 2 + i * 3, 16, 1); R(x, C.w4, 0, 2, 16, 1); },
  shelf: function(x){
    TILES.floor(x);
    R(x, C.w1, 1, 2, 14, 13); R(x, C.w2, 2, 3, 12, 5); R(x, C.w2, 2, 9, 12, 5);
    R(x, C.red, 3, 4, 2, 3); R(x, C.blue, 6, 5, 2, 2); R(x, C.green, 9, 4, 2, 3); R(x, C.lamp, 4, 10, 2, 3); R(x, C.purple, 8, 11, 3, 2);
  },
  desk: function(x){
    TILES.planks(x);
    R(x, C.w1, 1, 3, 14, 10); R(x, C.w3, 2, 4, 12, 8); R(x, C.white, 4, 5, 5, 4); R(x, C.s2, 5, 6, 3, 1); R(x, C.s2, 5, 8, 3, 1); R(x, C.red, 11, 6, 2, 3);
  },
  /* no border: rugs are laid several tiles wide, and a border would draw a grid across them */
  rug: function(x){ R(x, C.red, 0, 0, 16, 16); R(x, C.red2, 0, 0, 16, 1); R(x, C.red2, 0, 15, 16, 1); R(x, C.lamp2, 7, 4, 2, 8); R(x, C.lamp2, 4, 7, 8, 2); R(x, C.red2, 7, 7, 2, 2); }
};
var ANIMATED = { water: 1, flood: 1, wallLamp: 1, lampPost: 1, console: 1, lampStand: 1 };

ART.tile = function(name, frame){
  var f = ANIMATED[name] ? (frame ? 1 : 0) : 0, key = "t:" + name + ":" + f;
  if(!cache[key]) cache[key] = make(16, 16, function(x){ (TILES[name] || TILES.void)(x, f); });
  return cache[key];
};

/* ---------- people ---------- */
var PEOPLE = {
  wren:    { skin: C.skin, hair: "#3a2a22", shirt: "#4a5a7a", pants: "#2a2a3a", scarf: "#d9822b", coat: true },
  mara:    { skin: C.skin, hair: "#8a3a22", shirt: "#b8473a", pants: "#3a2f2a", apron: "#d8c8a0" },
  garrick: { skin: C.skin2, hair: "#b8b8c0", shirt: "#3d6a4a", pants: "#2a2a30", beard: "#b8b8c0", coat: true },
  pell:    { skin: C.skin, hair: "#7a5a32", shirt: "#6a8ab8", pants: "#4a3a30", cap: "#a04a3a", short: true },
  odo:     { skin: C.skin2, hair: null, shirt: "#e0d6b8", pants: "#4a3a30", apron: "#6a4430", pack: true },
  guard:   { skin: C.skin2, hair: "#2a2a2a", shirt: "#55526b", pants: "#2a2838", cap: "#7b778f" },
  elder:   { skin: C.skin, hair: "#d8d4cc", shirt: "#7a5a8a", pants: "#3a3040", beard: "#d8d4cc" },
  kid:     { skin: C.skin, hair: "#2a2020", shirt: "#c8a03a", pants: "#3a4a60", short: true }
};

function person(x, o, dir, frame){
  var dy = o.short ? 2 : 0, step = frame ? 1 : 0;
  var side = dir === "left" || dir === "right";
  R(x, "rgba(0,0,0,0.28)", 3, 14, 10, 2);
  // legs
  var lx = side ? [6, 8] : [5, 9];
  R(x, o.pants, lx[0], 11 + dy, 3, 4 - dy - (step && !side ? 1 : 0));
  R(x, o.pants, lx[1], 11 + dy, 3, 4 - dy - (!step && !side ? 1 : 0));
  if(side && step){ R(x, o.pants, 5, 12 + dy, 3, 3 - dy); R(x, o.pants, 9, 12 + dy, 3, 3 - dy); }
  // body
  var bh = o.coat ? 7 : 5;
  R(x, o.shirt, 4, 6 + dy, 8, bh - dy);
  if(o.apron) R(x, o.apron, 6, 8 + dy, 4, 4 - dy);
  if(o.scarf) R(x, o.scarf, 4, 6 + dy, 8, 2);
  R(x, "rgba(0,0,0,0.18)", 4, 6 + dy + bh - dy - 1, 8, 1);
  // arms
  if(!side){ R(x, o.skin, 3, 7 + dy, 1, 4 - dy); R(x, o.skin, 12, 7 + dy, 1, 4 - dy); }
  else R(x, o.shirt, 7, 7 + dy, 3, 4 - dy);
  // pack on the back
  if(o.pack && dir === "up") R(x, C.w2, 4, 5 + dy, 8, 6);
  if(o.pack && side) R(x, C.w2, dir === "right" ? 3 : 10, 6 + dy, 3, 6);
  if(o.pack){ R(x, C.w3, dir === "right" ? 4 : 11, 2, 1, 8); R(x, C.w3, dir === "right" ? 12 : 3, 3, 1, 8); }
  // head
  var hx = 5, hy = 1 + dy;
  R(x, o.skin, hx, hy, 6, 6);
  if(o.hair){
    var st = o.style || "short";
    if(dir === "up") R(x, o.hair, hx, hy, 6, st === "cropped" ? 3 : 6);
    else if(st === "cropped") R(x, o.hair, hx, hy, 6, 1);
    else { R(x, o.hair, hx, hy, 6, 2); if(side){ R(x, o.hair, dir === "right" ? hx : hx + 4, hy, 2, 5); } else { R(x, o.hair, hx, hy, 1, 3); R(x, o.hair, hx + 5, hy, 1, 3); } }
    var back = dir === "right" ? hx - 1 : hx + 6;
    if(st === "long"){
      if(dir === "up") R(x, o.hair, hx - 1, hy, 8, 7);
      else if(side) R(x, o.hair, back, hy, 1, 7);
      else { R(x, o.hair, hx - 1, hy, 1, 7); R(x, o.hair, hx + 6, hy, 1, 7); }
    }
    if(st === "tied"){
      if(dir === "up") R(x, o.hair, hx + 2, hy + 5, 2, 4);
      else if(side) R(x, o.hair, back, hy + 1, 1, 4);
      else R(x, o.hair, hx + 2, hy - 1, 2, 1);
    }
  }
  if(o.cap){ R(x, o.cap, hx - 1, hy - 1, 8, 3); if(side) R(x, o.cap, dir === "right" ? hx + 4 : hx - 3, hy + 1, 4, 1); }
  if(dir === "down"){ R(x, C.ink, hx + 1, hy + 3, 1, 1); R(x, C.ink, hx + 4, hy + 3, 1, 1); }
  if(side) R(x, C.ink, dir === "right" ? hx + 4 : hx + 1, hy + 3, 1, 1);
  if(o.beard && dir !== "up") R(x, o.beard, hx + 1, hy + 4, 4, 2);
}
ART.person = function(name, dir, frame){
  var key = "p:" + name + ":" + dir + ":" + (frame ? 1 : 0);
  if(!cache[key]) cache[key] = make(16, 16, function(x){ person(x, PEOPLE[name] || PEOPLE.wren, dir, frame); });
  return cache[key];
};

/* The player's look. Every option is a plain swatch so the character screen is a row of buttons. */
ART.LOOK = {
  skin:  ["#f1c9a5", C.skin, "#c98f62", C.skin2, "#8a5a3c", "#5e3b28"],
  hair:  ["#1e1815", "#3a2a22", "#7a5a32", "#c9a15a", "#8a3a22", "#b8b8c0", "#4a6fb0"],
  style: ["short", "long", "cropped", "tied"],
  coat:  ["#4a5a7a", "#5a7a5a", "#7a4a4a", "#6a5a8a", "#8a7a4a", "#3a3a4a"],
  scarf: ["#d9822b", "#c4473a", "#4fd1c0", "#e9d48a", "#7a5aa8", "#ece8dc"],
  names: {
    skin:  ["Fair", "Light", "Tan", "Brown", "Deep", "Dark"],
    hair:  ["Black", "Brown", "Auburn", "Blond", "Red", "Grey", "Blue"],
    style: ["Short", "Long", "Cropped", "Tied"],
    coat:  ["Slate", "Moss", "Brick", "Plum", "Ochre", "Charcoal"],
    scarf: ["Amber", "Red", "Teal", "Cream", "Violet", "White"]
  }
};
/* indexes into the lists above; the first look matches the original Wren */
ART.defaultLook = function(){ return { skin: 1, hair: 1, style: 0, coat: 0, scarf: 0 }; };
function heroSpec(l){
  var L = ART.LOOK, d = ART.defaultLook();
  var pick = function(k){ var a = L[k], i = l && typeof l[k] === "number" ? l[k] : d[k]; return a[Math.min(Math.max(i, 0), a.length - 1)]; };
  return { skin: pick("skin"), hair: pick("hair"), style: pick("style"), shirt: pick("coat"), scarf: pick("scarf"), pants: "#2a2a3a", coat: true };
}
ART.hero = function(look, dir, frame){
  var o = heroSpec(look), key = "h:" + [o.skin, o.hair, o.style, o.shirt, o.scarf, dir, frame ? 1 : 0].join("|");
  if(!cache[key]) cache[key] = make(16, 16, function(x){ person(x, o, dir, frame); });
  return cache[key];
};

/* ---------- things with faces ---------- */
ART.gateFace = function(frame){
  var key = "gf:" + (frame ? 1 : 0);
  if(!cache[key]) cache[key] = make(16, 16, function(x){
    TILES.floor(x);
    R(x, C.s1, 1, 0, 14, 16); R(x, C.w2, 2, 1, 12, 14); R(x, C.w3, 3, 2, 10, 12);
    R(x, C.w1, 7, 1, 2, 14); R(x, C.lamp2, 3, 8, 2, 2);
    R(x, C.white, 4, 4, 3, frame ? 1 : 3); R(x, C.white, 9, 4, 3, frame ? 1 : 3);
    if(!frame){ R(x, C.ink, 5, 5, 1, 2); R(x, C.ink, 10, 5, 1, 2); }
    R(x, C.w1, 4, 3, 3, 1); R(x, C.w1, 9, 3, 3, 1);   // heavy brows
    R(x, C.w1, 5, 10, 6, 1); R(x, C.w1, 4, 11, 1, 1); R(x, C.w1, 11, 11, 1, 1);
  });
  return cache[key];
};

var ENEMIES = {
  mote: function(x, f){
    R(x, "rgba(255,211,106,0.16)", 4, 2, 8, 12); R(x, "rgba(255,211,106,0.16)", 2, 4, 12, 8); R(x, "rgba(255,211,106,0.16)", 3, 3, 10, 10);
    R(x, C.lamp2, 5, 5, 6, 6); R(x, C.lamp, 6, 6, 4, 4); R(x, C.white, 7, 7, 2, 2);
    R(x, C.lamp, f ? 4 : 11, f ? 9 : 4, 1, 1); R(x, C.lamp, f ? 11 : 3, f ? 3 : 10, 1, 1);
  },
  crawler: function(x, f){
    R(x, "rgba(0,0,0,0.3)", 2, 13, 12, 2); R(x, C.s2, 3, 6, 10, 7); R(x, C.s4, 4, 5, 8, 3); R(x, C.s5, 5, 5, 3, 1);
    R(x, C.red, 5, 8, 2, 2); R(x, C.red, 9, 8, 2, 2);
    R(x, C.s1, 2, f ? 12 : 13, 2, 2); R(x, C.s1, 12, f ? 13 : 12, 2, 2); R(x, C.s1, 6, f ? 13 : 12, 2, 2); R(x, C.s1, 9, f ? 12 : 13, 2, 2);
  },
  hulk: function(x, f){
    R(x, "rgba(0,0,0,0.3)", 1, 14, 14, 2); R(x, C.s2, 3, 5, 10, 9); R(x, C.s3, 2, 6, 12, 4); R(x, C.s4, 4, 1, 8, 6);
    R(x, C.s1, 3, 12, 4, f ? 3 : 2); R(x, C.s1, 9, 12, 4, f ? 2 : 3);
    R(x, C.red, 5, 3, 2, 2); R(x, C.red, 9, 3, 2, 2); R(x, C.s1, 6, 6, 4, 1); R(x, C.s5, 4, 1, 8, 1);
    R(x, C.s3, 0, 7, 2, 5); R(x, C.s3, 14, 7, 2, 5);
  }
};
ART.enemy = function(kind, frame){
  var key = "e:" + kind + ":" + (frame ? 1 : 0);
  if(!cache[key]) cache[key] = make(16, 16, function(x){ (ENEMIES[kind] || ENEMIES.mote)(x, frame ? 1 : 0); });
  return cache[key];
};

/* The Gatewarden: a 32 x 32 stone figure built from rectangles. */
ART.boss = function(frame){
  var key = "boss:" + (frame ? 1 : 0);
  if(!cache[key]) cache[key] = make(32, 32, function(x){
    R(x, "rgba(0,0,0,0.3)", 3, 29, 26, 3);
    R(x, C.s2, 7, 12, 18, 16); R(x, C.s3, 5, 14, 22, 6); R(x, C.s4, 9, 4, 14, 11); R(x, C.s5, 9, 4, 14, 2);
    R(x, C.s1, 8, 24, 6, frame ? 7 : 6); R(x, C.s1, 18, 24, 6, frame ? 6 : 7);
    R(x, C.red, 12, 8, 3, 3); R(x, C.red, 18, 8, 3, 3); R(x, C.ink, 14, 12, 5, 1);
    R(x, C.s3, 0, 14, 5, 10); R(x, C.s3, 27, 14, 5, 10); R(x, C.s4, 1, 14, 3, 2); R(x, C.s4, 28, 14, 3, 2);
    R(x, C.lamp2, 14, 16, 5, 4); R(x, C.lamp, 15, 17, 3, 2);
  });
  return cache[key];
};

/* The player's slate cursor and little icons used by the interface. */
ART.heart = function(full){
  var key = "heart:" + (full ? 1 : 0);
  if(!cache[key]) cache[key] = make(16, 16, function(x){
    var col = full ? C.red : C.s2;
    R(x, col, 2, 3, 5, 5); R(x, col, 9, 3, 5, 5); R(x, col, 3, 8, 10, 2); R(x, col, 5, 10, 6, 2); R(x, col, 7, 12, 2, 1);
    if(full) R(x, "#e87a6a", 3, 4, 2, 2);
  });
  return cache[key];
};

})(typeof window !== "undefined" ? window : globalThis);

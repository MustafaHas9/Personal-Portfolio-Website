/* The title screen: a night road with waystones along it, and the hero walking from one to the next.
   Each stone lights as the hero reaches it and a little light travels back along the road to the
   last one. Drawn on a 320 x 192 canvas like the game, so it scales the same way. */
(function(root){
"use strict";

var W = 320, H = 192;
var C = root.ART.C;
var TITLE = root.TITLE = {};

/* the road, as a polyline; the stones sit on some of its points */
var PATH = [[-12, 172], [34, 160], [76, 170], [124, 150], [170, 160], [214, 136], [262, 146], [332, 120]];
var STONES = [1, 3, 5, 6];
var SPEED = 24, PAUSE = 1.2;

var len = [0], total = 0;
for(var i = 1; i < PATH.length; i++){
  total += Math.hypot(PATH[i][0] - PATH[i - 1][0], PATH[i][1] - PATH[i - 1][1]);
  len.push(total);
}
function at(s){
  s = Math.max(0, Math.min(total, s));
  for(var i = 1; i < PATH.length; i++){
    if(s <= len[i]){
      var f = (s - len[i - 1]) / (len[i] - len[i - 1]), a = PATH[i - 1], b = PATH[i];
      return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, dx: b[0] - a[0] };
    }
  }
  var e = PATH[PATH.length - 1];
  return { x: e[0], y: e[1], dx: 1 };
}

function rng(seed){ var s = seed >>> 0; return function(){ s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
var stars = (function(){ var r = rng(7), a = []; for(var i = 0; i < 70; i++) a.push({ x: Math.floor(r() * W), y: Math.floor(r() * 96), p: r() * 6.28, b: r() }); return a; })();
var motes = (function(){ var r = rng(21), a = []; for(var i = 0; i < 14; i++) a.push({ x: r() * W, y: 104 + r() * 76, p: r() * 6.28, s: 0.4 + r() * 0.8 }); return a; })();

var SKY = ["#0c0a1b", "#120f27", "#1a1534", "#241b42", "#34234d", "#4d2c55", "#74385a", "#a24b57", "#d9822b"];
function sky(x){
  for(var i = 0; i < SKY.length; i++){ x.fillStyle = SKY[i]; x.fillRect(0, i * 14, W, i === SKY.length - 1 ? 40 : 14); }
}
function ridge(x, col, base, amp, off, f1, f2){
  x.fillStyle = col;
  for(var px = 0; px < W; px++){
    var h = base - amp * (0.55 * Math.sin((px + off) * f1) + 0.3 * Math.sin((px + off) * f2 + 1.7) + 0.15 * Math.sin((px + off) * f1 * 3.1));
    x.fillRect(px, Math.round(h), 1, H - Math.round(h));
  }
}
function pine(x, px, py, h, col){
  x.fillStyle = col;
  for(var i = 0; i < h; i += 2){ var w = 2 + Math.floor(i * 0.7); x.fillRect(Math.round(px - w / 2), py - h + i, w, 2); }
  x.fillRect(px, py, 1, 3);
}
function road(x){
  var edge = C.d1, fill = C.d2, top = C.d3;
  for(var pass = 0; pass < 3; pass++){
    for(var s = 0; s <= total; s += 1){
      var p = at(s), px = Math.round(p.x), py = Math.round(p.y);
      if(pass === 0){ x.fillStyle = edge; x.fillRect(px - 4, py - 2, 9, 5); }
      else if(pass === 1){ x.fillStyle = fill; x.fillRect(px - 3, py - 1, 7, 3); }
      else if(s % 5 === 0){ x.fillStyle = top; x.fillRect(px - 2, py - 1, 2, 1); }
    }
  }
}
function stone(x, px, py, lit, t, k){
  x.fillStyle = "rgba(0,0,0,0.3)"; x.fillRect(px - 6, py - 1, 13, 3);
  x.fillStyle = C.s2; x.fillRect(px - 4, py - 12, 9, 13);
  x.fillStyle = C.s3; x.fillRect(px - 4, py - 12, 9, 2); x.fillRect(px - 4, py - 12, 1, 13);
  x.fillStyle = C.s1; x.fillRect(px + 4, py - 11, 1, 12); x.fillRect(px - 5, py - 2, 11, 2);
  // two small aerials on the cap
  x.fillStyle = C.s4; x.fillRect(px - 3, py - 17, 1, 5); x.fillRect(px + 3, py - 16, 1, 4);
  var on = lit ? 1 : 0.0;
  x.fillStyle = lit ? C.lamp : C.s4; x.fillRect(px - 3, py - 17, 1, 1); x.fillRect(px + 3, py - 16, 1, 1);
  // three status lamps
  for(var j = 0; j < 3; j++){
    var blink = lit && Math.sin(t * 3 + j * 2 + k) > 0;
    x.fillStyle = lit ? (blink ? C.lamp : C.lamp2) : C.s1; x.fillRect(px - 2 + j * 2, py - 7, 1, 2);
  }
  if(on){
    var g = 0.10 + 0.04 * Math.sin(t * 2 + k);
    x.fillStyle = "rgba(255,211,106," + (g / 2).toFixed(3) + ")";
    x.fillRect(px - 13, py - 22, 27, 22); x.fillRect(px - 9, py - 26, 19, 30); x.fillRect(px - 6, py - 28, 13, 34);
  }
}

var run = null;
function frame(now){
  var st = run;
  if(!st) return;
  var dt = Math.min(0.05, (now - st.last) / 1000); st.last = now; st.t += dt;
  var t = st.t, x = st.x;

  // the hero's journey: walk, pause at each stone, light it, then fade out and start again
  if(st.state === "walk"){
    st.s += SPEED * dt;
    var hit = st.nextStone;
    if(hit < STONES.length && st.s >= len[STONES[hit]]){ st.s = len[STONES[hit]]; st.state = "pause"; st.wait = PAUSE; st.lit[hit] = true; st.nextStone++; st.pulse = 0; }
    if(st.s >= total){ st.state = "fade"; st.wait = 1.4; }
  } else if(st.state === "pause"){
    st.wait -= dt; if(st.wait <= 0) st.state = "walk";
  } else if(st.state === "fade"){
    st.wait -= dt;
    if(st.wait <= 0){ st.s = 0; st.nextStone = 0; st.lit = [false, false, false, false]; st.state = "walk"; }
  }

  sky(x);
  stars.forEach(function(s){
    var a = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.8 + s.p));
    x.fillStyle = "rgba(236,232,220," + (a * (0.4 + s.b * 0.6)).toFixed(2) + ")"; x.fillRect(s.x, s.y, 1, 1);
  });
  // moon
  x.fillStyle = "rgba(255,240,200,0.10)"; x.fillRect(238, 22, 28, 28); x.fillRect(236, 25, 32, 22);
  x.fillStyle = "#efe6c8"; x.fillRect(244, 26, 16, 16); x.fillRect(242, 28, 20, 12);
  x.fillStyle = "#d4c8a2"; x.fillRect(248, 30, 3, 3); x.fillRect(254, 36, 2, 2);

  var drift = t * 1.4;
  ridge(x, "#2a1f48", 112, 26, drift * 0.3, 0.021, 0.047);
  ridge(x, "#1c1536", 124, 22, drift * 0.6 + 40, 0.028, 0.061);
  ridge(x, "#12102a", 140, 16, drift + 90, 0.034, 0.071);
  // ground
  x.fillStyle = "#17262a"; x.fillRect(0, 150, W, H - 150);
  x.fillStyle = "#1c3030"; x.fillRect(0, 150, W, 2);
  for(var gx = 0; gx < W; gx += 7){ x.fillStyle = "#1f3a33"; x.fillRect(gx + (gx * 13 % 5), 156 + (gx * 7 % 30), 2, 1); }
  [[18, 150, 22], [52, 146, 16], [96, 152, 26], [150, 144, 18], [196, 150, 24], [240, 140, 16], [300, 142, 22]].forEach(function(p){ pine(x, p[0], p[1], p[2], "#0f1b22"); });

  road(x);

  // light travelling back along each stretch that is already lit
  for(var i = 1; i < STONES.length; i++){
    if(!st.lit[i]) continue;
    var a = len[STONES[i - 1]], b = len[STONES[i]];
    for(var d = 0; d < 3; d++){
      var f = ((t * 0.45 + d / 3) % 1), p = at(b - (b - a) * f);
      x.fillStyle = "rgba(255,211,106,0.9)"; x.fillRect(Math.round(p.x), Math.round(p.y) - 1, 2, 2);
      x.fillStyle = "rgba(255,211,106,0.25)"; x.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 2, 4, 4);
    }
  }
  STONES.forEach(function(si, k){ var p = PATH[si]; stone(x, Math.round(p[0]), Math.round(p[1]) - 2, st.lit[k], t, k); });

  // the hero
  var pos = at(st.s), moving = st.state === "walk";
  var dir = pos.dx < 0 ? "left" : "right";
  var alpha = st.state === "fade" ? Math.max(0, st.wait / 1.4) : 1;
  x.globalAlpha = alpha;
  x.drawImage(root.ART.hero(st.look, dir, moving ? Math.floor(t * 5) % 2 : 0), Math.round(pos.x - 8), Math.round(pos.y - 14));
  x.globalAlpha = 1;

  // fireflies
  motes.forEach(function(m){
    var mx = (m.x + Math.sin(t * 0.5 * m.s + m.p) * 10) % W, my = m.y + Math.cos(t * 0.7 * m.s + m.p) * 5;
    x.fillStyle = "rgba(255,211,106," + (0.25 + 0.5 * Math.abs(Math.sin(t * 1.3 + m.p))).toFixed(2) + ")"; x.fillRect(Math.round(mx), Math.round(my), 1, 1);
  });

  if(!st.still) st.raf = requestAnimationFrame(frame);
}

TITLE.start = function(canvas, look){
  TITLE.stop();
  var x = canvas.getContext("2d");
  x.imageSmoothingEnabled = false;
  var still = !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
  run = { x: x, look: look, last: performance.now(), t: 0, s: still ? len[3] : 0, state: "walk", wait: 0, nextStone: still ? 2 : 0, lit: still ? [true, true, false, false] : [false, false, false, false], still: still, raf: 0 };
  frame(run.last);
};
TITLE.stop = function(){ if(run){ cancelAnimationFrame(run.raf); run = null; } };

/* ---------- opening cards: one small animated picture each ---------- */
var iRun = null;
function houses(x, t){
  var r = rng(5);
  for(var i = 0; i < 11; i++){
    var hx = 10 + i * 27 + Math.floor(r() * 8), hw = 12 + Math.floor(r() * 6), hh = 8 + Math.floor(r() * 8), hy = 150 - hh;
    x.fillStyle = "#0e0c1c"; x.fillRect(hx, hy, hw, hh + 20);
    x.fillStyle = "#16122a"; x.fillRect(hx - 1, hy - 3, hw + 2, 3);
    for(var w = 0; w < 2; w++) if(r() > 0.35){ x.fillStyle = Math.sin(t * 0.6 + i + w) > -0.6 ? C.lamp2 : "#6a5528"; x.fillRect(hx + 3 + w * 5, hy + 3, 2, 3); }
  }
}
function mouth(x, t){
  // glow first, so the opening itself stays dark against it
  x.fillStyle = "rgba(79,209,192," + (0.08 + 0.04 * Math.sin(t * 1.5)).toFixed(3) + ")";
  x.fillRect(226, 104, 64, 58); x.fillRect(230, 100, 56, 6);
  x.fillStyle = "#0a0814"; x.fillRect(236, 118, 44, 40); x.fillRect(240, 112, 36, 6); x.fillRect(246, 108, 24, 4);
  x.fillStyle = C.s2; x.fillRect(234, 116, 3, 42); x.fillRect(279, 116, 3, 42); x.fillRect(238, 108, 36, 3);
  x.fillStyle = "rgba(79,209,192,0.55)"; x.fillRect(250, 150, 16, 1);
}
var ART_KIND = {
  town: function(x, t){
    sky(x);
    stars.forEach(function(s){ x.fillStyle = "rgba(236,232,220," + (0.3 + 0.5 * Math.abs(Math.sin(t * 0.8 + s.p))).toFixed(2) + ")"; x.fillRect(s.x, s.y, 1, 1); });
    ridge(x, "#1c1536", 118, 24, 40, 0.028, 0.061);
    ridge(x, "#12102a", 136, 16, 90, 0.034, 0.071);
    x.fillStyle = "#0b0a17"; x.fillRect(0, 150, W, H - 150);
    houses(x, t); mouth(x, t);
  },
  deep: function(x, t){
    x.fillStyle = "#0a0814"; x.fillRect(0, 0, W, H);
    for(var i = 0; i < 6; i++){ x.fillStyle = "rgba(255,255,255,0.025)"; x.fillRect(20 + i * 56, 0, 16, H); }
    motes.forEach(function(m, i){
      var mx = (m.x + Math.sin(t * 0.4 * m.s + m.p) * 14) % W, my = (m.y * 0.9 + Math.cos(t * 0.5 * m.s + m.p) * 8) % H;
      x.fillStyle = "rgba(255,211,106," + (0.2 + 0.5 * Math.abs(Math.sin(t + m.p))).toFixed(2) + ")"; x.fillRect(Math.round(mx), Math.round(my), 1, 1);
    });
    x.fillStyle = "rgba(43,91,142,0.35)"; x.fillRect(0, 166, W, H - 166);
    x.fillStyle = "rgba(140,195,222,0.25)"; for(var wv = 0; wv < W; wv += 12) x.fillRect(wv + Math.round(Math.sin(t + wv) * 3), 166, 6, 1);
  },
  words: function(x, t){
    x.fillStyle = "#0a0814"; x.fillRect(0, 0, W, H);
    var g = 0.05 + 0.02 * Math.sin(t);
    x.fillStyle = "rgba(255,211,106," + g.toFixed(3) + ")"; x.fillRect(60, 30, 200, 100); x.fillRect(90, 15, 140, 130);
  },
  ferry: function(x, t){
    sky(x);
    stars.forEach(function(s){ x.fillStyle = "rgba(236,232,220," + (0.3 + 0.5 * Math.abs(Math.sin(t * 0.8 + s.p))).toFixed(2) + ")"; x.fillRect(s.x, s.y, 1, 1); });
    ridge(x, "#1c1536", 112, 20, 130, 0.03, 0.06);
    x.fillStyle = "#14243e"; x.fillRect(0, 116, W, H - 116);
    for(var r = 0; r < 14; r++){ x.fillStyle = "rgba(140,195,222,0.18)"; x.fillRect((r * 29 + Math.round(t * 8 * (1 + (r % 3) * 0.3))) % W, 122 + r * 5, 14, 1); }
    var bx = 120 + Math.round(Math.sin(t * 0.4) * 6), by = 118 + Math.round(Math.sin(t * 1.1) * 1);
    x.fillStyle = "#1c1208"; x.fillRect(bx, by, 46, 7); x.fillRect(bx + 4, by + 7, 38, 2); x.fillRect(bx + 20, by - 18, 2, 18);
    x.fillStyle = C.lamp2; x.fillRect(bx + 22, by - 16, 3, 4);
    x.fillStyle = "rgba(255,211,106,0.12)"; x.fillRect(bx + 14, by - 22, 22, 18);
  }
};
TITLE.introStart = function(canvas, kind){
  TITLE.introStop();
  var x = canvas.getContext("2d");
  x.imageSmoothingEnabled = false;
  var fn = ART_KIND[kind] || ART_KIND.deep, still = !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
  iRun = { raf: 0, t: 0, last: performance.now() };
  var step = function(now){
    if(!iRun) return;
    iRun.t += Math.min(0.05, (now - iRun.last) / 1000); iRun.last = now;
    fn(x, iRun.t);
    if(!still) iRun.raf = requestAnimationFrame(step);
  };
  step(iRun.last);
};
TITLE.introStop = function(){ if(iRun){ cancelAnimationFrame(iRun.raf); iRun = null; } };

})(typeof window !== "undefined" ? window : globalThis);

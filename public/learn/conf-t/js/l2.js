/* Layer-2 control protocols: spanning tree and VTP.
   These run on the same devices and cables as everything else. After every command a hook
   recomputes them, so changing a priority really moves the root, a blocking port really takes no
   traffic, and a client really learns its VLANs from the server. Loaded after net.js. */
(function(root){
"use strict";

var NET = root.NET, IOS = root.IOS;

var ver = 0;
/* Bump this whenever anything a result depends on may have changed. Cached answers are only good
   for one version. */
NET.touch = function(){ ver++; };

/* ====================================================================================
   Spanning tree (one instance per VLAN)
   ==================================================================================== */
function pad5(n){ return ("00000" + n).slice(-5); }
function portNum(f){
  var n = 0, i;
  for(i = 0; i < f.dev.ifaces.length; i++){ if(f.dev.ifaces[i].sw){ n++; if(f.dev.ifaces[i] === f) return n; } }
  return n;
}
NET.portNum = portNum;
function baseMac(d){ return d.ifaces[0].mac; }
function basePrio(d, v){ return d.stp.prio[v] !== undefined ? d.stp.prio[v] : 32768; }
function bridgeId(d, v){ return pad5(basePrio(d, v) + v) + baseMac(d); }
function portPrio(f, v){ return f.stp.prioVlan[v] !== undefined ? f.stp.prioVlan[v] : f.stp.prio; }
function portId(f, v){ return ("000" + portPrio(f, v)).slice(-3) + "." + ("000" + portNum(f)).slice(-3); }

function speedOf(f){
  var s = f.speed === "auto" ? (f.type === "GigabitEthernet" ? 1000 : 100) : +f.speed;
  if(f.peer && f.peer.sw){
    var o = f.peer.speed === "auto" ? (f.peer.type === "GigabitEthernet" ? 1000 : 100) : +f.peer.speed;
    s = Math.min(s, o);
  }
  return s;
}
function portCost(f, v){
  var q = f.stp;
  if(q.costVlan[v]) return q.costVlan[v];
  if(q.cost) return q.cost;
  var s = speedOf(f);
  return s >= 1000 ? 4 : s >= 100 ? 19 : 100;
}
function effPortfast(f){ return f.stp.portfast || (f.dev.stp.portfastDefault && NET.opMode(f) === "access"); }
function effGuard(f){
  var g = f.stp.bpduguard;
  if(g === true) return true;
  if(g === false) return false;
  return f.dev.stp.bpduguardDefault && effPortfast(f);
}
function filtered(f){ return f.stp.bpdufilter === true; }
NET.effPortfast = effPortfast; NET.effBpduGuard = effGuard;

function carries(f, v){
  if(!f.sw || !NET.linkUp(f)) return false;
  var m = NET.opMode(f);
  return (m === "access" && f.sw.accessVlan === v) || (m === "trunk" && NET.allowedOn(f, v));
}
function edgeKey(a, b){ return [a.dev.hostname + a.name, b.dev.hostname + b.name].sort().join("~"); }

function solve(devs, edges, v){
  var id = {}, cost = {}, INF = 1e9, i, k, rootDev = devs[0];
  devs.forEach(function(d){ id[d.hostname] = bridgeId(d, v); if(id[d.hostname] < id[rootDev.hostname]) rootDev = d; cost[d.hostname] = INF; });
  cost[rootDev.hostname] = 0;
  for(i = 0; i < devs.length + 1; i++){
    edges.forEach(function(e){
      [[e.a, e.b], [e.b, e.a]].forEach(function(p){
        var from = p[0].dev.hostname, to = p[1].dev.hostname, c = cost[from] + portCost(p[1], v);
        if(cost[from] < INF && c < cost[to]) cost[to] = c;
      });
    });
  }
  // each non-root switch picks its root port
  var rootPort = {};
  devs.forEach(function(d){
    if(d === rootDev) return;
    var best = null;
    edges.forEach(function(e){
      var mine = e.a.dev === d ? e.a : e.b.dev === d ? e.b : null;
      if(!mine) return;
      var theirs = mine === e.a ? e.b : e.a;
      var total = cost[theirs.dev.hostname] + portCost(mine, v);
      var key = [pad5(total), id[theirs.dev.hostname], portId(theirs, v), portId(mine, v)].join("|");
      if(!best || key < best.key) best = { key: key, port: mine };
    });
    if(best) rootPort[d.hostname] = best.port;
  });
  // on every segment, the end with the better offer is designated
  var role = {};
  edges.forEach(function(e){
    var ka = [pad5(cost[e.a.dev.hostname]), id[e.a.dev.hostname], portId(e.a, v)].join("|");
    var kb = [pad5(cost[e.b.dev.hostname]), id[e.b.dev.hostname], portId(e.b, v)].join("|");
    var aWins = ka < kb;
    [[e.a, aWins], [e.b, !aWins]].forEach(function(p){
      var f = p[0];
      role[f.dev.hostname + f.name] = p[1] ? { role: "Desg", state: "FWD" }
        : rootPort[f.dev.hostname] === f ? { role: "Root", state: "FWD" } : { role: "Altn", state: "BLK" };
    });
  });
  return { id: id, cost: cost, rootDev: rootDev, rootPort: rootPort, role: role };
}

function compute(start, v){
  var devs = [start], seen = {}, edges = [], edgeSeen = {}, i;
  seen[start.hostname] = true;
  for(i = 0; i < devs.length; i++){
    var d = devs[i];
    d.ifaces.forEach(function(f){
      if(!f.sw || !carries(f, v)) return;
      var q = f.peer;
      if(!q || !q.sw || !carries(q, v) || !q.dev.vlans[v] || filtered(f) || filtered(q)) return;
      var k = edgeKey(f, q);
      if(!edgeSeen[k]){ edgeSeen[k] = true; edges.push({ a: f, b: q, key: k }); }
      if(!seen[q.dev.hostname]){ seen[q.dev.hostname] = true; devs.push(q.dev); }
    });
  }
  // root guard: a guarded port that would become a root port is held back instead, which can
  // split off part of the tree, so who is still connected has to be worked out again each time
  var banned = {}, inconsistent = {}, res, round;
  for(round = 0; round < 6; round++){
    var live = edges.filter(function(e){ return !banned[e.key]; }), group = [start], gseen = {}, gi;
    gseen[start.hostname] = true;
    for(gi = 0; gi < group.length; gi++) live.forEach(function(e){
      [[e.a, e.b], [e.b, e.a]].forEach(function(p){
        if(p[0].dev === group[gi] && !gseen[p[1].dev.hostname]){ gseen[p[1].dev.hostname] = true; group.push(p[1].dev); }
      });
    });
    devs = group;
    res = solve(devs, live.filter(function(e){ return gseen[e.a.dev.hostname] && gseen[e.b.dev.hostname]; }), v);
    var again = false;
    devs.forEach(function(d){
      var rp = res.rootPort[d.hostname];
      if(rp && rp.stp.guardRoot){ banned[edgeKey(rp, rp.peer)] = true; inconsistent[rp.dev.hostname + rp.name] = true; again = true; }
    });
    if(!again) break;
  }
  var out = {};
  devs.forEach(function(d){
    var rootD = res.rootDev, ports = [];
    d.ifaces.forEach(function(f){
      if(!f.sw || !carries(f, v)) return;
      var key = d.hostname + f.name, r = res.role[key], inc = !!inconsistent[key];
      if(inc) r = { role: "Desg", state: "BKN" };
      if(!r) r = { role: "Desg", state: "FWD" };
      if(d === rootD && !inc) r = { role: "Desg", state: "FWD" };
      var shared = f.stp.linkType === "shared" || (f.stp.linkType === "auto" && f.duplex === "half");
      ports.push({ f: f, role: r.role, state: r.state, cost: portCost(f, v), pid: portPrio(f, v) + "." + portNum(f),
        type: (shared ? "Shr" : "P2p") + (effPortfast(f) ? " Edge" : ""), inconsistent: inc });
    });
    out[d.hostname] = { vlan: v, dev: d, isRoot: d === rootD, rootDev: rootD, rootCost: res.cost[d.hostname],
      rootPort: res.rootPort[d.hostname] || null, ports: ports };
  });
  return out;
}

/* The spanning tree result for one switch in one VLAN, or null if it is not in that VLAN. */
NET.stp = function(dev, v){
  if(dev.kind !== "switch" || !dev.vlans[v]) return null;
  var c = dev._stp;
  if(!c || c.ver !== ver){ c = dev._stp = { ver: ver, byVlan: {} }; }
  if(c.byVlan[v] !== undefined) return c.byVlan[v];
  var all = compute(dev, v);
  Object.keys(all).forEach(function(h){
    var d = all[h].dev;
    if(!d._stp || d._stp.ver !== ver) d._stp = { ver: ver, byVlan: {} };
    d._stp.byVlan[v] = all[h];
  });
  return all[dev.hostname] || null;
};
NET.stpBlocked = function(f, v){
  var e = NET.stp(f.dev, v);
  if(!e) return false;
  for(var i = 0; i < e.ports.length; i++) if(e.ports[i].f === f) return e.ports[i].state === "BLK" || e.ports[i].state === "BKN";
  return false;
};
NET.bridgeInfo = function(d, v){
  var base = basePrio(d, v);
  return { base: base, total: base + v, mac: baseMac(d) };
};
NET.rootPriorityOthers = function(d, v){
  /* the best (lowest) priority among the other switches in this VLAN's tree */
  var e = NET.stp(d, v), best = null;
  if(!e) return null;
  var seen = {}, queue = [d];
  seen[d.hostname] = 1;
  while(queue.length){
    var x = queue.shift();
    x.ifaces.forEach(function(f){
      if(!f.sw || !carries(f, v) || !f.peer || !f.peer.sw || !carries(f.peer, v)) return;
      var q = f.peer.dev;
      if(seen[q.hostname]) return;
      seen[q.hostname] = 1; queue.push(q);
      var b = basePrio(q, v);
      if(best === null || b < best) best = b;
    });
  }
  return best;
};

/* BPDU guard: a PortFast port that hears a BPDU is shut down (error-disabled). */
function pushNote(d, msgs){ d.notices = d.notices || []; msgs.forEach(function(m){ d.notices.push(m); }); }
NET.stpSync = function(devs){
  var changed = false;
  devs.forEach(function(d){
    if(d.kind !== "switch") return;
    d.ifaces.forEach(function(f){
      if(!f.sw || f.errdisabled || !NET.linkUp(f)) return;
      var q = f.peer;
      if(!q || !q.sw) return;
      if(effPortfast(f) && effGuard(f) && !filtered(f) && !filtered(q)){
        f.errdisabled = true; changed = true;
        pushNote(d, ["%SPANTREE-2-BLOCK_BPDUGUARD: Received BPDU on port " + f.name + " with BPDU Guard enabled. Disabling port.",
                     "%PM-4-ERR_DISABLE: bpduguard error detected on " + f.shortName + ", putting " + f.shortName + " in err-disable state",
                     "%LINEPROTO-5-UPDOWN: Line protocol on Interface " + f.name + ", changed state to down",
                     "%LINK-3-UPDOWN: Interface " + f.name + ", changed state to down"]);
        pushNote(q.dev, ["%LINK-3-UPDOWN: Interface " + q.name + ", changed state to down", "%LINEPROTO-5-UPDOWN: Line protocol on Interface " + q.name + ", changed state to down"]);
      }
    });
  });
  if(changed) NET.touch();
};

/* ====================================================================================
   VTP: VLANs spread from servers to clients along trunks
   ==================================================================================== */
function vsig(d){
  return Object.keys(d.vlans).map(Number).sort(function(a, b){ return a - b; }).map(function(v){ return v + ":" + d.vlans[v].name; }).join("|");
}
NET.vtpSig = vsig;
NET.vtpSync = function(devs){
  var sw = devs.filter(function(d){ return d.kind === "switch"; }), round, moved;
  // a server that changed its own VLANs bumps its revision
  sw.forEach(function(d){
    var s = vsig(d);
    if(s !== d.vtp.sig){ d.vtp.sig = s; if(d.vtp.mode === "server") d.vtp.revision++; }
  });
  for(round = 0; round < sw.length + 1; round++){
    moved = false;
    sw.forEach(function(a){
      if(a.vtp.mode !== "server" && a.vtp.mode !== "client") return;
      if(!a.vtp.domain) return;
      // everything reachable over trunks, passing through transparent switches
      var seen = {}, queue = [a], reach = [];
      seen[a.hostname] = 1;
      while(queue.length){
        var x = queue.shift();
        x.ifaces.forEach(function(f){
          if(!f.sw || !NET.linkUp(f) || NET.opMode(f) !== "trunk") return;
          var q = f.peer;
          if(!q || !q.sw || NET.opMode(q) !== "trunk" || !NET.allowedOn(f, 1) || !NET.allowedOn(q, 1)) return;
          var y = q.dev;
          if(seen[y.hostname]) return;
          seen[y.hostname] = 1;
          if(y.vtp.mode === "transparent"){ queue.push(y); return; }
          if(y.vtp.mode === "off") return;
          reach.push(y);
          queue.push(y);
        });
      }
      reach.forEach(function(b){
        if(b.vtp.domain && b.vtp.domain !== a.vtp.domain) return;
        if((b.vtp.password || null) !== (a.vtp.password || null)) return;
        if(b.vtp.mode === "server" && a.vtp.revision <= b.vtp.revision) return;
        if(a.vtp.revision <= b.vtp.revision) return;
        if(!b.vtp.domain) b.vtp.domain = a.vtp.domain;
        b.vlans = {};
        Object.keys(a.vlans).forEach(function(v){ b.vlans[v] = { name: a.vlans[v].name }; });
        b.vtp.revision = a.vtp.revision; b.vtp.sig = vsig(b);
        moved = true;
      });
    });
    if(!moved) break;
  }
  if(moved || round > 0) NET.touch();
};

/* ====================================================================================
   Run both after every command
   ==================================================================================== */
function everyone(c){
  if(c.topo) return Object.keys(c.topo.devices).map(function(n){ return c.topo.devices[n]; });
  var seen = {}, list = [c.dev], i;
  seen[c.dev.hostname] = 1;
  for(i = 0; i < list.length; i++) list[i].ifaces.forEach(function(f){
    var p = f.peer && f.peer.dev;
    if(p && !seen[p.hostname]){ seen[p.hostname] = 1; list.push(p); }
  });
  return list;
}
IOS.hooks = IOS.hooks || [];
IOS.hooks.push(function(c){
  NET.touch();
  var devs = everyone(c);
  NET.vtpSync(devs);
  NET.stpSync(devs);
});

})(typeof window !== "undefined" ? window : globalThis);

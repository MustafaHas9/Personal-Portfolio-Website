/* Devices, cables and a small network simulator. Nothing here is faked per command: ping works by
   walking the real topology (links, VLANs, trunks, routes, ARP), so a wrong command breaks
   exactly what it would break on real gear. */
(function(root){
"use strict";

var NET = root.NET = {};
var ipTools = root.IOS;

/* ---------- address helpers ---------- */
var ip2n = NET.ip2n = function(s){ return s.split(".").reduce(function(a, b){ return a * 256 + (+b); }, 0); };
var n2ip = NET.n2ip = function(n){ return [Math.floor(n / 16777216) % 256, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join("."); };
var maskN = NET.maskN = function(p){ return p === 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0; };
var prefixOf = NET.prefixOf = function(mask){ var n = ip2n(mask), c = 0; while(n){ c += n % 2; n = Math.floor(n / 2); } return c; };
var netOf = NET.netOf = function(ip, p){ return (ip2n(ip) & maskN(p)) >>> 0; };
var inNet = NET.inNet = function(ip, net, p){ return netOf(ip, p) === net; };
var maskStr = NET.maskStr = function(p){ return n2ip(maskN(p)); };

/* ---------- interface names ---------- */
var SHORT = { FastEthernet: "Fa", GigabitEthernet: "Gi", Vlan: "Vl", Loopback: "Lo" };

function parseIfName(text){
  var m = /^([a-z]+)\s*(\d[\d\/\.]*)$/i.exec(text.trim());
  if(!m) return null;
  var p = m[1].toLowerCase(), type = null;
  if(p.charAt(0) === "f" && "fastethernet".indexOf(p) === 0) type = "FastEthernet";
  else if(p.charAt(0) === "g" && "gigabitethernet".indexOf(p) === 0) type = "GigabitEthernet";
  else if(p.length >= 2 && "vlan".indexOf(p) === 0) type = "Vlan";
  else if(p.length >= 2 && "loopback".indexOf(p) === 0) type = "Loopback";
  return type ? { type: type, num: m[2] } : null;
}

var macCounter = 0;
function nextMac(){
  macCounter++;
  var h = function(n, w){ var s = n.toString(16); while(s.length < w) s = "0" + s; return s; };
  return "0001." + h(0x4200 + Math.floor(macCounter / 256), 4) + "." + h((macCounter % 256) * 256 + 0x01, 4);
}

function Iface(dev, type, num){
  this.dev = dev; this.type = type; this.num = String(num);
  this.name = type + this.num; this.shortName = SHORT[type] + this.num;
  this.mac = nextMac();
  this.ip = null; this.prefix = null; this.description = "";
  this.adminDown = (dev.kind === "router" && (type === "GigabitEthernet" || type === "FastEthernet")) || type === "Vlan";
  this.speed = "auto"; this.duplex = "auto";
  this.peer = null;
  this.sub = false; this.parent = null; this.encap = null; this.encapNative = false;
  this.sw = null;
  if(dev.kind === "switch" && (type === "FastEthernet" || type === "GigabitEthernet")){
    this.sw = { mode: "dynamic auto", accessVlan: 1, nativeVlan: 1, allowed: null, nonegotiate: false, encap: "dot1q" };
    this.stp = { cost: null, costVlan: {}, prio: 128, prioVlan: {}, portfast: false, bpduguard: null, bpdufilter: null, guardRoot: false, guardLoop: false, linkType: "auto" };
    this.errdisabled = false;
  }
}
NET.Iface = Iface;

/* ---------- devices ---------- */
function Device(kind, hostname){
  this.kind = kind; this.hostname = hostname;
  this.ifaces = [];
  this.vlans = {}; this.routes = []; this.arp = {}; this.macTable = {};
  this.enablePassword = null; this.enableSecret = null; this.passEnc = false;
  this.domainName = null; this.domainLookup = true; this.banner = null; this.users = [];
  this.lines = { con: { password: null, login: false, logSync: false, execTimeout: null },
                 vty: { password: null, login: false, transport: "all", logSync: false, execTimeout: null } };
  this.defaultGateway = null; this.startup = null;
  this.gw = null;          // pcs
  if(kind === "switch"){
    this.vlans[1] = { name: "default" };
    this.vtp = { mode: "server", domain: null, password: null, version: 1, revision: 0, sig: "1:default" };
    this.stp = { mode: "pvst", prio: {}, portfastDefault: false, bpduguardDefault: false, bpdufilterDefault: false, loopguardDefault: false, errdisableRecovery: false };
  }
  this.notices = [];
}
NET.Device = Device;
var D = Device.prototype;

D.findIface = function(text){
  var p = parseIfName(text);
  if(!p) return null;
  for(var i = 0; i < this.ifaces.length; i++)
    if(this.ifaces[i].type === p.type && this.ifaces[i].num === p.num) return this.ifaces[i];
  return null;
};
/* An interface that does not exist yet but could be created: a VLAN interface on a switch, a
   loopback, or a router subinterface of an existing port. */
D.creatable = function(text){
  var p = parseIfName(text);
  if(!p || this.findIface(text)) return null;
  if(p.type === "Vlan" && this.kind === "switch" && /^\d+$/.test(p.num) && +p.num >= 1 && +p.num <= 4094) return p;
  if(p.type === "Loopback" && /^\d+$/.test(p.num) && this.kind === "router") return p;
  var m = /^(\d+\/\d+)\.(\d+)$/.exec(p.num);
  if(m && this.kind === "router" && p.type !== "Vlan" && p.type !== "Loopback"){
    var par = this.findIface(p.type + m[1]);
    if(par && !par.sub && +m[2] >= 1 && +m[2] <= 4094) return p;
  }
  return null;
};
D.create = function(p){
  var f = new Iface(this, p.type, p.num);
  var m = /^(\d+\/\d+)\.(\d+)$/.exec(p.num);
  if(m){ f.sub = true; f.parent = this.findIface(p.type + m[1]); f.adminDown = false; }
  if(p.type === "Loopback" || p.type === "Vlan") f.adminDown = false;
  this.ifaces.push(f);
  return f;
};
/* "fa0/1 - 4", "fa0/1 - fa0/4", "fa0/1 , fa0/3" */
D.parseRange = function(text){
  var self = this, out = [], ok = true;
  text.split(",").forEach(function(part){
    part = part.trim();
    if(!part) { ok = false; return; }
    var m = /^(.+?)\s*-\s*(.+)$/.exec(part);
    if(!m){ var f = self.findIface(part); if(f) out.push(f); else ok = false; return; }
    var a = self.findIface(m[1]);
    if(!a){ ok = false; return; }
    var bTxt = m[2].trim(), hi;
    if(/^\d+$/.test(bTxt)) hi = +bTxt;
    else { var b = self.findIface(bTxt); if(!b || b.type !== a.type){ ok = false; return; } hi = +b.num.split("/").pop(); }
    var slot = a.num.split("/")[0], lo = +a.num.split("/").pop();
    if(hi < lo){ ok = false; return; }
    for(var n = lo; n <= hi; n++){
      var g = self.findIface(a.type + slot + "/" + n);
      if(!g){ ok = false; return; }
      out.push(g);
    }
  });
  return ok && out.length ? out : null;
};

NET.makeRouter = function(name, gigs){
  var d = new Device("router", name), n = gigs || 3;
  for(var i = 0; i < n; i++) d.ifaces.push(new Iface(d, "GigabitEthernet", "0/" + i));
  return d;
};
NET.makeSwitch = function(name, fa, gi){
  var d = new Device("switch", name);
  for(var i = 1; i <= (fa == null ? 24 : fa); i++) d.ifaces.push(new Iface(d, "FastEthernet", "0/" + i));
  for(var j = 1; j <= (gi == null ? 2 : gi); j++) d.ifaces.push(new Iface(d, "GigabitEthernet", "0/" + j));
  var v = new Iface(d, "Vlan", 1); d.ifaces.push(v);
  return d;
};
NET.makePC = function(name, ip, prefix, gw){
  var d = new Device("pc", name), f = new Iface(d, "FastEthernet", "0");
  f.adminDown = false; f.ip = ip; f.prefix = prefix; d.gw = gw || null;
  d.ifaces.push(f);
  return d;
};

/* ---------- topology ---------- */
NET.Topo = function(){ this.devices = {}; };
var T = NET.Topo.prototype;
T.add = function(d){ this.devices[d.hostname] = d; return d; };
T.link = function(aName, aIf, bName, bIf){
  var a = this.devices[aName].findIface(aIf), b = this.devices[bName].findIface(bIf);
  if(!a || !b) throw new Error("cannot link " + aName + " " + aIf + " <-> " + bName + " " + bIf);
  a.peer = b; b.peer = a;
  if(NET.touch) NET.touch();
};

/* ---------- state ---------- */
var phys = function(f){ return f.parent || f; };
/* A port that spanning tree has shut down (BPDU guard) is down until someone resets it. */
function linkUp(f){
  var p = phys(f);
  return !!(p.peer && !p.adminDown && !p.peer.adminDown && !p.errdisabled && !p.peer.errdisabled);
}
NET.linkUp = linkUp; NET.phys = phys;
function active(dev, vlan){
  /* An SVI is up only while some port in that VLAN is up. */
  for(var i = 0; i < dev.ifaces.length; i++){
    var q = dev.ifaces[i];
    if(!q.sw || !linkUp(q)) continue;
    var m = opMode(q);
    if(m === "access" && q.sw.accessVlan === vlan) return true;
    if(m === "trunk" && allowedOn(q, vlan)) return true;
  }
  return false;
}
var isUp = NET.isUp = function(f){
  if(f.adminDown) return false;
  if(f.type === "Loopback") return true;
  if(f.type === "Vlan") return !!f.dev.vlans[+f.num] && active(f.dev, +f.num);
  if(f.sub) return isUp(f.parent);
  if(f.dev.kind === "pc") return true;
  return linkUp(f);
};
NET.status = function(f){
  if(f.adminDown) return { status: "administratively down", proto: "down" };
  return isUp(f) ? { status: "up", proto: "up" } : { status: "down", proto: "down" };
};

function allowedOn(p, vlan){ return p.sw.allowed === null || p.sw.allowed.indexOf(vlan) > -1; }
NET.allowedOn = allowedOn;

/* What a switch port actually ends up doing, including DTP negotiation with the other end. */
var opMode = NET.opMode = function(p){
  var m = p.sw.mode;
  if(m === "access" || m === "trunk") return m;
  var q = p.peer;
  if(!q || !q.sw || q.dev.kind !== "switch") return "access";
  var qm = q.sw.mode;
  if(qm.indexOf("dynamic") === 0 && q.sw.nonegotiate) return "access";
  if(m === "dynamic desirable") return (qm === "trunk" || qm === "dynamic desirable" || qm === "dynamic auto") ? "trunk" : "access";
  return (qm === "trunk" || qm === "dynamic desirable") ? "trunk" : "access";   // dynamic auto
};

/* ---------- routing ---------- */
var routeTable = NET.routeTable = function(dev){
  var out = [];
  dev.ifaces.forEach(function(f){
    if(!f.ip || !isUp(f)) return;
    out.push({ code: "C", net: netOf(f.ip, f.prefix), prefix: f.prefix, ad: 0, metric: 0, via: null, iface: f });
    out.push({ code: "L", net: ip2n(f.ip), prefix: 32, ad: 0, metric: 0, via: null, iface: f });
  });
  var connected = out.filter(function(r){ return r.code === "C"; });
  dev.routes.forEach(function(r){
    var iface = null;
    if(r.exit){ iface = dev.findIface(r.exit); if(!iface || !isUp(iface)) return; }
    else {
      var best = null;
      connected.forEach(function(c){ if(inNet(r.via, c.net, c.prefix) && (!best || c.prefix > best.prefix)) best = c; });
      if(!best) return;            // next hop is not reachable, so the route is not installed
      iface = best.iface;
    }
    out.push({ code: "S", net: r.net, prefix: r.prefix, ad: r.ad, metric: 0, via: r.exit ? null : r.via, iface: iface, def: r.prefix === 0 });
  });
  return out;
};

function lookupEgress(dev, dstIp){
  var table = routeTable(dev), best = null, n = ip2n(dstIp);
  table.forEach(function(r){
    if(r.code === "L"){ if(r.net === n && (!best || best.prefix < 32)) best = r; return; }
    if(inNet(dstIp, r.net, r.prefix) && (!best || r.prefix > best.prefix || (r.prefix === best.prefix && r.ad < best.ad))) best = r;
  });
  if(best && best.code === "L") return { local: true };
  if(best) return { iface: best.iface, nextHop: best.via || dstIp };
  if(dev.kind === "pc"){
    var f = dev.ifaces[0];
    if(dev.gw && isUp(f) && inNet(dev.gw, netOf(f.ip, f.prefix), f.prefix)) return { iface: f, nextHop: dev.gw };
  }
  if(dev.kind === "switch" && dev.defaultGateway){
    for(var i = 0; i < dev.ifaces.length; i++){
      var s = dev.ifaces[i];
      if(s.ip && isUp(s) && inNet(dev.defaultGateway, netOf(s.ip, s.prefix), s.prefix)) return { iface: s, nextHop: dev.defaultGateway };
    }
  }
  return null;
}
NET.lookupEgress = lookupEgress;

/* ---------- layer 2 ---------- */
var pure = false;     // set while a goal check runs, so checking never changes ARP or MAC tables
function learn(dev, vlan, mac, port){
  if(pure) return;
  dev.macTable[vlan + "|" + mac] = { vlan: vlan, mac: mac, port: port.name, type: "DYNAMIC" };
}

/* Every device interface a frame from `src` can reach, flooding through switches by VLAN. */
function domain(src, tag, srcMac){
  var leaves = [], seen = {}, p0 = phys(src);
  function enter(p, tg){
    var d = p.dev;
    if(d.kind !== "switch"){ leaves.push({ iface: p, tag: tg }); return; }
    if(!p.sw) return;
    var mode = opMode(p), vlan;
    if(mode === "access"){ if(tg != null) return; vlan = p.sw.accessVlan; }
    else { vlan = tg == null ? p.sw.nativeVlan : tg; if(!allowedOn(p, vlan)) return; }
    if(!d.vlans[vlan]) return;
    if(NET.stpBlocked && NET.stpBlocked(p, vlan)) return;      // a blocking port takes no frames
    var key = d.hostname + "|" + vlan;
    if(seen[key]) return;
    seen[key] = 1;
    learn(d, vlan, srcMac, p);
    d.ifaces.forEach(function(q){
      if(q.type === "Vlan" && +q.num === vlan && q.ip && isUp(q)) leaves.push({ iface: q, tag: null });
    });
    d.ifaces.forEach(function(q){
      if(q === p || !q.sw || !linkUp(q)) return;
      var qm = opMode(q);
      if(NET.stpBlocked && NET.stpBlocked(q, vlan)) return;     // ...and sends none
      if(qm === "access" && q.sw.accessVlan === vlan) enter(q.peer, null);
      else if(qm === "trunk" && allowedOn(q, vlan)) enter(q.peer, vlan === q.sw.nativeVlan ? null : vlan);
    });
  }
  if(!linkUp(p0)) return leaves;
  enter(p0.peer, tag);
  return leaves;
}

/* Who owns `ip` on the same broadcast domain as the egress interface? */
function l2owner(egress, ip){
  var tag = egress.sub && !egress.encapNative ? egress.encap : null;
  var leaves = domain(egress, tag, egress.mac);
  for(var i = 0; i < leaves.length; i++){
    var l = leaves[i], f = l.iface;
    if(f.type === "Vlan"){ if(f.ip === ip) return f; continue; }
    if(f.dev.kind === "pc"){ if(f.ip === ip && l.tag == null) return f; continue; }
    // a router port: untagged traffic goes to the port itself, tagged to the matching subinterface
    var cand = null;
    f.dev.ifaces.forEach(function(g){
      if(!g.ip || !isUp(g) || g.ip !== ip) return;
      if(g === f && l.tag == null) cand = g;
      else if(g.sub && g.parent === f && ((l.tag != null && g.encap === l.tag && !g.encapNative) || (l.tag == null && g.encapNative))) cand = g;
    });
    if(cand) return cand;
  }
  return null;
}

/* ---------- layer 3: one echo, one way ---------- */
function ownsIp(dev, ip){
  return dev.ifaces.some(function(f){ return f.ip === ip && isUp(f); });
}

function deliver(start, dstIp){
  var dev = start, hops = 0;
  for(;;){
    if(ownsIp(dev, dstIp)) return { ok: true, dev: dev };
    if(hops > 20) return { ok: false, code: "." };
    var eg = lookupEgress(dev, dstIp);
    if(!eg || eg.local) return { ok: false, code: hops === 0 ? "." : "U" };
    var owner = l2owner(eg.iface, eg.nextHop);
    if(!owner) return { ok: false, code: hops === 0 ? "." : "U" };
    if(!pure && !dev.arp[eg.nextHop]){
      /* Both ends remember each other after an ARP exchange. The sender loses its first packet
         waiting for the reply (the classic ".!!!!"); a router in the middle holds the packet
         until ARP finishes, so nothing is lost there. */
      dev.arp[eg.nextHop] = { mac: owner.mac, iface: eg.iface.name };
      owner.dev.arp[eg.iface.ip] = { mac: eg.iface.mac, iface: owner.name };
      if(hops === 0) return { ok: false, code: "." };
    }
    dev = owner.dev; hops++;
  }
}

/* Would a ping from src to dstIp get through, both ways? Changes nothing, so a game can ask it
   after every command without giving away what the player has not typed yet. */
NET.canReach = function(src, dstIp){
  pure = true;
  try {
    var eg = lookupEgress(src, dstIp), srcIp = eg && eg.iface ? eg.iface.ip : null;
    if(eg && eg.local) return true;
    var f = deliver(src, dstIp);
    if(!f.ok || !srcIp) return false;
    return deliver(f.dev, srcIp).ok;
  } finally { pure = false; }
};

NET.ping = function(src, dstIp, count){
  var n = count || 5, line = "", ok = 0, sent = 0;
  var eg = lookupEgress(src, dstIp), srcIp = eg && eg.iface ? eg.iface.ip : null;
  if(eg && eg.local){ return { line: new Array(n + 1).join("!"), ok: n, n: n }; }
  for(var i = 0; i < n; i++){
    var f = deliver(src, dstIp);
    if(!f.ok){ line += f.code; continue; }
    var r = srcIp ? deliver(f.dev, srcIp) : { ok: false };
    if(r.ok){ line += "!"; ok++; } else line += ".";
  }
  return { line: line, ok: ok, n: n };
};

/* ---------- configuration text ---------- */
function rangeText(list){
  if(!list.length) return "none";
  var s = list.slice().sort(function(a, b){ return a - b; }), out = [], i = 0;
  while(i < s.length){
    var j = i;
    while(j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    out.push(j > i ? s[i] + "-" + s[j] : String(s[i]));
    i = j + 1;
  }
  return out.join(",");
}
NET.rangeText = rangeText;

NET.parseVlanList = function(text){
  var out = [];
  text.split(",").forEach(function(part){
    var m = /^(\d+)(?:-(\d+))?$/.exec(part);
    if(!m) return;
    var a = +m[1], b = m[2] ? +m[2] : a;
    for(var v = a; v <= b && v <= 4094; v++) if(v >= 1) out.push(v);
  });
  return out;
};

function encryptDummy(pw){
  var key = [0x64, 0x73, 0x66, 0x64, 0x3b, 0x6b, 0x66, 0x6f, 0x41, 0x2c], out = "00", i;
  for(i = 0; i < pw.length; i++){ var h = (pw.charCodeAt(i) ^ key[i % key.length]).toString(16).toUpperCase(); out += (h.length < 2 ? "0" : "") + h; }
  return out.replace(/^00/, "07");
}

NET.configLines = function(dev){
  var L = [], enc = dev.passEnc;
  var pw = function(p){ return enc ? "7 " + encryptDummy(p) : p; };
  L.push("version 15.0", "no service timestamps log datetime msec", "no service timestamps debug datetime msec");
  L.push(enc ? "service password-encryption" : "no service password-encryption", "!");
  L.push("hostname " + dev.hostname, "!");
  if(dev.enableSecret) L.push("enable secret 5 $1$mERr$hx5rVt7rPNoS4wqbXKX7m0");
  if(dev.enablePassword) L.push("enable password " + pw(dev.enablePassword));
  if(dev.enableSecret || dev.enablePassword) L.push("!");
  if(!dev.domainLookup) L.push("no ip domain-lookup");
  if(dev.domainName) L.push("ip domain-name " + dev.domainName);
  if(!dev.domainLookup || dev.domainName) L.push("!");
  dev.users.forEach(function(u){ L.push("username " + u.name + " " + (u.secret ? "secret 5 $1$mERr$hx5rVt7rPNoS4wqbXKX7m0" : "password " + pw(u.password))); });
  if(dev.users.length) L.push("!");
  if(dev.kind === "switch"){
    var vt = dev.vtp, st = dev.stp, before = L.length;
    if(vt.mode !== "server") L.push("vtp mode " + vt.mode);
    if(vt.domain) L.push("vtp domain " + vt.domain);
    if(vt.password) L.push("vtp password " + vt.password);
    if(vt.version !== 1) L.push("vtp version " + vt.version);
    if(st.mode !== "pvst") L.push("spanning-tree mode " + st.mode);
    if(st.portfastDefault) L.push("spanning-tree portfast default");
    if(st.bpduguardDefault) L.push("spanning-tree portfast bpduguard default");
    if(st.bpdufilterDefault) L.push("spanning-tree portfast bpdufilter default");
    if(st.loopguardDefault) L.push("spanning-tree loopguard default");
    Object.keys(st.prio).map(Number).sort(function(a, b){ return a - b; }).forEach(function(v){ L.push("spanning-tree vlan " + v + " priority " + st.prio[v]); });
    if(L.length > before) L.push("!");
    Object.keys(dev.vlans).map(Number).sort(function(a, b){ return a - b; }).forEach(function(v){
      if(v === 1) return;
      L.push("vlan " + v, " name " + dev.vlans[v].name, "!");
    });
  }
  dev.ifaces.forEach(function(f){
    L.push("interface " + f.name);
    if(f.sub){ L.push(" encapsulation dot1Q " + f.encap + (f.encapNative ? " native" : "")); }
    if(f.description) L.push(" description " + f.description);
    if(f.sw){
      var s = f.sw;
      if(s.mode === "trunk" || s.mode === "access" || s.mode.indexOf("dynamic") === 0 && s.mode !== "dynamic auto") L.push(" switchport mode " + s.mode);
      if(s.accessVlan !== 1) L.push(" switchport access vlan " + s.accessVlan);
      if(s.nativeVlan !== 1) L.push(" switchport trunk native vlan " + s.nativeVlan);
      if(s.allowed !== null) L.push(" switchport trunk allowed vlan " + rangeText(s.allowed));
      if(s.nonegotiate) L.push(" switchport nonegotiate");
      var q = f.stp;
      if(q){
        if(q.portfast) L.push(" spanning-tree portfast");
        if(q.bpduguard === true) L.push(" spanning-tree bpduguard enable"); else if(q.bpduguard === false) L.push(" spanning-tree bpduguard disable");
        if(q.bpdufilter === true) L.push(" spanning-tree bpdufilter enable"); else if(q.bpdufilter === false) L.push(" spanning-tree bpdufilter disable");
        if(q.guardRoot) L.push(" spanning-tree guard root");
        if(q.guardLoop) L.push(" spanning-tree guard loop");
        if(q.cost) L.push(" spanning-tree cost " + q.cost);
        Object.keys(q.costVlan).forEach(function(v){ L.push(" spanning-tree vlan " + v + " cost " + q.costVlan[v]); });
        if(q.prio !== 128) L.push(" spanning-tree port-priority " + q.prio);
        Object.keys(q.prioVlan).forEach(function(v){ L.push(" spanning-tree vlan " + v + " port-priority " + q.prioVlan[v]); });
        if(q.linkType !== "auto") L.push(" spanning-tree link-type " + q.linkType);
      }
    } else if(f.type !== "Loopback" || f.ip){
      L.push(f.ip ? " ip address " + f.ip + " " + maskStr(f.prefix) : " no ip address");
    }
    if(f.type === "Loopback" && !f.ip) L.push(" no ip address");
    if(f.speed !== "auto") L.push(" speed " + f.speed);
    if(f.duplex !== "auto") L.push(" duplex " + f.duplex);
    if(dev.kind === "router" && !f.sub && f.type !== "Loopback"){
      if(f.speed === "auto") L.push(" duplex auto"); if(f.speed === "auto") L.push(" speed auto");
    }
    if(f.adminDown && f.type !== "Vlan" || (f.type === "Vlan" && f.adminDown)) L.push(" shutdown");
    L.push("!");
  });
  if(dev.defaultGateway) L.push("ip default-gateway " + dev.defaultGateway, "!");
  dev.routes.forEach(function(r){
    L.push("ip route " + n2ip(r.net) + " " + maskStr(r.prefix) + " " + (r.exit ? dev.findIface(r.exit).name : r.via) + (r.ad !== 1 ? " " + r.ad : ""));
  });
  if(dev.routes.length) L.push("!");
  if(dev.banner) L.push("banner motd ^C" + dev.banner + "^C", "!");
  var con = dev.lines.con, vty = dev.lines.vty;
  var lineBlock = function(title, l){
    L.push(title);
    if(l.execTimeout) L.push(" exec-timeout " + l.execTimeout);
    if(l.password) L.push(" password " + pw(l.password));
    if(l.logSync) L.push(" logging synchronous");
    if(l.transport && l.transport !== "all") L.push(" transport input " + l.transport);
    if(l.loginLocal) L.push(" login local"); else if(l.login) L.push(" login");
  };
  lineBlock("line con 0", con);
  lineBlock("line vty 0 4", vty);
  if(dev.kind === "switch") lineBlock("line vty 5 15", vty);
  L.push("!", "end");
  return L;
};

NET.saveStartup = function(dev){ dev.startup = NET.configLines(dev).join("\n"); };

/* ---------- a ready-made lab, for trying things ---------- */
NET.sampleLab = function(){
  var t = new NET.Topo();
  t.add(NET.makePC("PC-A", "192.168.10.10", 24, "192.168.10.1"));
  t.add(NET.makePC("PC-B", "192.168.20.10", 24, "192.168.20.1"));
  t.add(NET.makeSwitch("SW1")); t.add(NET.makeSwitch("SW2"));
  t.add(NET.makeRouter("R1", 3)); t.add(NET.makeRouter("R2", 3));
  t.link("PC-A", "Fa0", "SW1", "Fa0/1");
  t.link("SW1", "Fa0/24", "R1", "Gi0/0");
  t.link("R1", "Gi0/1", "R2", "Gi0/1");
  t.link("R2", "Gi0/0", "SW2", "Fa0/24");
  t.link("SW2", "Fa0/1", "PC-B", "Fa0");
  return t;
};

})(typeof window !== "undefined" ? window : globalThis);

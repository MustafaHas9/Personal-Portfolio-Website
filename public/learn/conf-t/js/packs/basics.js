/* Pack 1: the basics.
   Jeremy's IT Lab days 1-12 and 16-18: IOS modes and basic security, interfaces and IP addresses,
   switch interfaces, static routing, VLANs and trunking, plus the show commands for them.
   Later packs add DTP/VTP and spanning tree on top of the same engine. */
(function(root){
"use strict";

var IOS = root.IOS, NET = root.NET, define = IOS.define, W = IOS.WORDHELP;

var USER = ["user"], PRIV = ["priv"], EXEC = ["user", "priv"], CFG = ["config"];
var IFACE = ["config-if", "config-if-range"];
var isSwitch = function(c){ return c.dev.kind === "switch"; };
var isRouter = function(c){ return c.dev.kind === "router"; };
var curL2 = function(c){ return c.cur && c.cur.length && c.cur.every(function(f){ return !!f.sw; }); };
var curL3 = function(c){ return c.cur && c.cur.length && c.cur.every(function(f){ return !f.sw; }); };
var curSub = function(c){ return c.cur && c.cur.length === 1 && c.cur[0].sub; };

/* ---------- words that show up in "?" before the last word of a command ---------- */
[["show", "Show running system information"], ["ip", "IP configuration commands"], ["no", "Negate a command or set its defaults"],
 ["interfaces", "Interface status and configuration"], ["interface", "Select an interface to configure"],
 ["vlan", "VLAN information"], ["switchport", "Set switching mode characteristics"], ["mode", "Set trunking mode"],
 ["trunk", "Set trunking characteristics of the interface"], ["access", "Set access mode characteristics of the interface"],
 ["allowed", "Set allowed VLAN characteristics when interface is in trunking mode"], ["native", "Set trunking native characteristics when interface is in trunking mode"],
 ["enable", "Modify enable password parameters"], ["service", "Modify use of network based services"],
 ["line", "Configure a terminal line"], ["banner", "Define a login banner"], ["username", "Establish User Name Authentication"],
 ["domain-lookup", "Enable IP Domain Name System hostname translation"], ["address", "Set the IP address of an interface"],
 ["mac", "MAC configuration commands"], ["address-table", "MAC forwarding table"], ["copy", "Copy from one file to another"],
 ["running-config", "Current operating configuration"], ["startup-config", "Contents of startup configuration"],
 ["transport", "Define transport protocols for line"], ["input", "Define which protocols to use when connecting to the terminal server"],
 ["logging", "Modify message logging facilities"], ["clear", "Reset functions"], ["configure", "Enter configuration mode"],
 ["encapsulation", "Set encapsulation type for an interface"], ["voice", "Voice"],
 ["speed", "Configure speed operation"], ["duplex", "Configure duplex operation"]].forEach(function(p){ W[p[0]] = p[1]; });

/* ---------- small helpers ---------- */
function pad(s, n){ s = String(s); while(s.length < n) s += " "; return s; }
function padL(s, n){ s = String(s); while(s.length < n) s = " " + s; return s; }
function each(c, fn){ c.cur.forEach(fn); }
function vlanNums(dev){ return Object.keys(dev.vlans).map(Number).sort(function(a, b){ return a - b; }); }
function dotted(mac){ return mac; }

/* Console messages for link state changes: printed on this device, queued on the others. */
function linkMsgs(f, up){
  var n = f.name, sviLike = f.type === "Vlan" || f.type === "Loopback";
  if(!up && f.adminDown) return ["%LINK-5-CHANGED: Interface " + n + ", changed state to administratively down",
                                  "%LINEPROTO-5-UPDOWN: Line protocol on Interface " + n + ", changed state to down"];
  if(up) return [sviLike ? "%LINK-5-CHANGED: Interface " + n + ", changed state to up" : "%LINK-3-UPDOWN: Interface " + n + ", changed state to up",
                 "%LINEPROTO-5-UPDOWN: Line protocol on Interface " + n + ", changed state to up"];
  return ["%LINK-3-UPDOWN: Interface " + n + ", changed state to down", "%LINEPROTO-5-UPDOWN: Line protocol on Interface " + n + ", changed state to down"];
}
function watch(c, fn){
  if(!c.topo){ fn(); return; }
  var all = [];
  Object.keys(c.topo.devices).forEach(function(n){ c.topo.devices[n].ifaces.forEach(function(f){ all.push(f); }); });
  var before = all.map(NET.isUp);
  fn();
  all.forEach(function(f, i){
    var now = NET.isUp(f);
    if(now === before[i]) return;
    var msgs = linkMsgs(f, now);
    if(f.dev === c.dev) msgs.forEach(function(m){ c.print(m); });
    else { f.dev.notices = f.dev.notices || []; msgs.forEach(function(m){ f.dev.notices.push(m); }); }
  });
}

/* Interfaces in the order IOS lists them: a port, then its subinterfaces. */
function ordered(dev){
  var out = [];
  dev.ifaces.filter(function(f){ return !f.sub; }).forEach(function(f){
    out.push(f);
    dev.ifaces.filter(function(s){ return s.parent === f; }).sort(function(a, b){ return a.encapOrder - b.encapOrder; }).forEach(function(s){ out.push(s); });
  });
  return out;
}

/* ====================================================================================
   Moving around: modes
   ==================================================================================== */
define({ modes: USER, syntax: "enable", help: "Turn on privileged commands", run: function(c){
  var d = c.dev, secret = d.enableSecret || d.enablePassword;
  if(!secret){ c.enter("priv"); return; }
  var tries = 0, s = c.session;
  var ask = function(){
    s.pendingPrompt = "Password:";
    s.pending = function(text){
      if(text === secret){ s.mode = "priv"; return ""; }
      tries++;
      if(tries >= 3) return "% Bad secrets";
      ask();
      return "Password: ";
    };
  };
  ask();
} });
define({ modes: PRIV, syntax: "disable", help: "Turn off privileged commands", run: function(c){ c.enter("user"); } });
define({ modes: PRIV, syntax: "configure terminal", help: "Configuration from the terminal", run: function(c){
  c.print("Enter configuration commands, one per line.  End with CNTL/Z.");
  c.enter("config");
} });
define({ modes: ["user", "priv", "config", "config-if", "config-if-range", "config-line", "config-vlan", "config-subif"], syntax: "exit",
  help: "Exit from the EXEC", run: function(c){ c.session.up(); } });
define({ modes: ["config", "config-if", "config-if-range", "config-line", "config-vlan", "config-subif"], syntax: "end",
  help: "Exit from configure mode", run: function(c){ c.enter("priv"); } });
define({ modes: ["config", "config-if", "config-if-range", "config-line", "config-vlan", "config-subif"], syntax: "do <cmd:rest>",
  help: "To run exec commands in config mode", paramHelp: { cmd: "Exec command" }, run: function(c){
    var s = c.session, saved = s.mode, savedCur = s.cur;
    s.mode = "priv";
    var out = s.exec(c.args.cmd, c.line.indexOf(c.args.cmd));
    s.mode = saved; s.cur = savedCur;
    if(out) c.print(out);
  } });

/* ====================================================================================
   Global configuration: day 4 (CLI and basic security)
   ==================================================================================== */
define({ modes: CFG, syntax: "hostname <name:word>", help: "Set system's network name", paramHelp: { name: "This system's network name" }, run: function(c){
  c.dev.hostname = c.args.name;
} });
define({ modes: CFG, syntax: "enable password <pw:word>", help: "Assign the privileged level password (unencrypted)", paramHelp: { pw: "The UNENCRYPTED (cleartext) 'enable' password" },
  run: function(c){ c.dev.enablePassword = c.args.pw; } });
define({ modes: CFG, syntax: "enable secret <pw:word>", help: "Assign the privileged level secret", paramHelp: { pw: "The UNENCRYPTED (cleartext) 'enable' secret" },
  run: function(c){ c.dev.enableSecret = c.args.pw; } });
define({ modes: CFG, syntax: "no enable password", help: "Assign the privileged level password (unencrypted)", run: function(c){ c.dev.enablePassword = null; } });
define({ modes: CFG, syntax: "no enable secret", help: "Assign the privileged level secret", run: function(c){ c.dev.enableSecret = null; } });
define({ modes: CFG, syntax: "service password-encryption", help: "Encrypt system passwords", run: function(c){ c.dev.passEnc = true; } });
define({ modes: CFG, syntax: "no service password-encryption", help: "Encrypt system passwords", run: function(c){ c.dev.passEnc = false; } });
define({ modes: CFG, syntax: "ip domain-name <n:word>", help: "Define the default domain name", paramHelp: { n: "Default domain name" }, run: function(c){ c.dev.domainName = c.args.n; } });
define({ modes: CFG, syntax: "no ip domain-lookup", help: "Enable IP Domain Name System hostname translation", run: function(c){ c.dev.domainLookup = false; } });
define({ modes: CFG, syntax: "ip domain-lookup", help: "Enable IP Domain Name System hostname translation", run: function(c){ c.dev.domainLookup = true; } });
define({ modes: CFG, syntax: "username <name:word> secret <pw:word>", help: "Specify the password for the user", paramHelp: { name: "User name", pw: "The UNENCRYPTED (cleartext) user secret" },
  run: function(c){ c.dev.users.push({ name: c.args.name, secret: true, password: c.args.pw }); } });
define({ modes: CFG, syntax: "username <name:word> password <pw:word>", help: "Specify the password for the user", paramHelp: { name: "User name", pw: "The UNENCRYPTED (cleartext) user password" },
  run: function(c){ c.dev.users.push({ name: c.args.name, secret: false, password: c.args.pw }); } });
define({ modes: CFG, syntax: "banner motd <text:rest>", help: "Set Message of the Day banner", paramHelp: { text: "c banner-text c, where 'c' is a delimiting character" },
  run: function(c){
    var t = c.args.text, d = t.charAt(0), end = t.lastIndexOf(d);
    c.dev.banner = end > 0 ? t.slice(1, end) : t.slice(1);
  } });

define({ modes: CFG, syntax: "line console <n:int:0-0>", help: "Primary terminal line", run: function(c){ c.enter("config-line", [{ line: "con" }]); } });
define({ modes: CFG, syntax: "line vty <a:int:0-15> <b:int:0-15>", help: "Virtual terminal", run: function(c){ c.enter("config-line", [{ line: "vty" }]); } });

/* lines: console and vty */
var LN = ["config-line"];
var lineOf = function(c){ return c.dev.lines[c.cur[0].line]; };
define({ modes: LN, syntax: "password <pw:word>", help: "Set a password", paramHelp: { pw: "The UNENCRYPTED (cleartext) line password" }, run: function(c){ lineOf(c).password = c.args.pw; } });
define({ modes: LN, syntax: "no password", help: "Set a password", run: function(c){ lineOf(c).password = null; } });
define({ modes: LN, syntax: "login", help: "Enable password checking", run: function(c){ var l = lineOf(c); l.login = true; l.loginLocal = false; } });
define({ modes: LN, syntax: "login local", help: "Local password checking", run: function(c){ var l = lineOf(c); l.login = true; l.loginLocal = true; } });
define({ modes: LN, syntax: "no login", help: "Enable password checking", run: function(c){ var l = lineOf(c); l.login = false; l.loginLocal = false; } });
define({ modes: LN, syntax: ["exec-timeout <m:int:0-35791>", "exec-timeout <m:int:0-35791> <s:int:0-2147483>"], help: "Set the EXEC timeout", paramHelp: { m: "Timeout in minutes", s: "Timeout in seconds" },
  run: function(c){ lineOf(c).execTimeout = c.args.m + " " + (c.args.s || 0); } });
define({ modes: LN, syntax: "logging synchronous", help: "Synchronized message output", run: function(c){ lineOf(c).logSync = true; } });
define({ modes: LN, syntax: "transport input ssh|telnet|all|none", help: "Define which protocols to use when connecting to the terminal server",
  run: function(c){ lineOf(c).transport = c.line.trim().split(/\s+/).pop().toLowerCase(); } });

/* ====================================================================================
   Entering interface and VLAN modes
   ==================================================================================== */
define({ modes: CFG, syntax: "interface <i:ifacec>", help: "Select an interface to configure", run: function(c){
  var f = c.args.i;
  if(f.create){ f = c.dev.create(f.create); if(f.sub) f.encapOrder = parseInt(f.num.split(".")[1], 10); }
  c.enter(f.sub ? "config-subif" : "config-if", [f]);
} });
define({ modes: CFG, syntax: "interface range <r:ifrange>", help: "interface range command", run: function(c){ c.enter("config-if-range", c.args.r); } });
var CLIENT_MSG = "VTP VLAN configuration not allowed when device is in CLIENT mode.";
define({ modes: CFG, syntax: "vlan <id:int:1-4094>", help: "VLAN commands", when: isSwitch, paramHelp: { id: "ISL VLAN IDs 1-4094" }, run: function(c){
  var v = c.args.id;
  if(c.dev.vtp.mode === "client"){ c.print(CLIENT_MSG); return; }
  if(!c.dev.vlans[v]) c.dev.vlans[v] = { name: "VLAN" + ("0000" + v).slice(-4) };
  c.enter("config-vlan", [{ vlan: v }]);
} });
define({ modes: CFG, syntax: "no vlan <ids:vlanlist>", help: "VLAN commands", when: isSwitch, run: function(c){
  if(c.dev.vtp.mode === "client"){ c.print(CLIENT_MSG); return; }
  NET.parseVlanList(c.args.ids).forEach(function(v){
    if(v === 1 || (v >= 1002 && v <= 1005)) c.print("%Default VLAN " + v + " may not be deleted.");
    else delete c.dev.vlans[v];
  });
} });
define({ modes: ["config-vlan"], syntax: "name <n:word>", help: "Ascii name of the VLAN", paramHelp: { n: "The ascii name for the VLAN" }, run: function(c){
  c.dev.vlans[c.cur[0].vlan].name = c.args.n;
} });

/* ====================================================================================
   Interface commands (days 8, 9, 16-18)
   ==================================================================================== */
define({ modes: IFACE, syntax: "shutdown", help: "Shutdown the selected interface", run: function(c){
  /* shutting a port is also how you reset one that spanning tree error-disabled */
  watch(c, function(){ each(c, function(f){ f.adminDown = true; f.errdisabled = false; }); });
} });
define({ modes: IFACE, syntax: "no shutdown", help: "Shutdown the selected interface", run: function(c){
  watch(c, function(){ each(c, function(f){ f.adminDown = false; }); });
} });
define({ modes: IFACE.concat(["config-subif"]), syntax: "description <d:rest>", help: "Interface specific description", paramHelp: { d: "Up to 240 characters describing this interface" },
  run: function(c){ each(c, function(f){ f.description = c.args.d; }); } });
define({ modes: IFACE.concat(["config-subif"]), syntax: "no description", help: "Interface specific description", run: function(c){ each(c, function(f){ f.description = ""; }); } });
define({ modes: IFACE, syntax: "speed 10|100|1000|auto", help: "Configure speed operation", run: function(c){
  var s = c.line.trim().split(/\s+/).pop().toLowerCase();
  each(c, function(f){ f.speed = s; });
} });
define({ modes: IFACE, syntax: "duplex auto|full|half", help: "Configure duplex operation", run: function(c){
  var s = c.line.trim().split(/\s+/).pop().toLowerCase();
  each(c, function(f){ f.duplex = s; });
} });

/* IP addresses: routers, SVIs, loopbacks and router subinterfaces */
function setIp(c, f, ip, mask){
  var prefix = NET.prefixOf(mask), net = NET.netOf(ip, prefix), size = Math.pow(2, 32 - prefix);
  if(prefix < 31 && (NET.ip2n(ip) === net || NET.ip2n(ip) === net + size - 1)){
    c.print("Bad mask /" + prefix + " for address " + ip);
    return false;
  }
  var clash = null;
  c.dev.ifaces.forEach(function(g){
    if(g !== f && g.ip && NET.netOf(g.ip, Math.min(g.prefix, prefix)) === NET.netOf(ip, Math.min(g.prefix, prefix)) && !clash) clash = g;
  });
  if(clash){ c.print("% " + NET.n2ip(net) + " overlaps with " + clash.name); return false; }
  f.ip = ip; f.prefix = prefix;
  return true;
}
define({ modes: ["config-if", "config-subif"], syntax: "ip address <ip:ip> <mask:mask>", help: "Set the IP address of an interface", when: function(c){ return curL3(c); },
  paramHelp: { ip: "IP address", mask: "IP subnet mask" }, run: function(c){
    var f = c.cur[0];
    if(f.sub && f.encap == null){
      c.print("% Configuring IP routing on a LAN subinterface is only allowed if that");
      c.print("  subinterface is already configured as part of an IEEE 802.10, IEEE 802.1Q,");
      c.print("  or ISL vLAN.");
      return;
    }
    watch(c, function(){ setIp(c, f, c.args.ip, c.args.mask); });
  } });
define({ modes: ["config-if", "config-subif"], syntax: "no ip address", help: "Set the IP address of an interface", when: function(c){ return curL3(c); },
  run: function(c){ watch(c, function(){ c.cur[0].ip = null; c.cur[0].prefix = null; }); } });
define({ modes: ["config-subif"], syntax: "encapsulation dot1q <v:int:1-4094>", help: "IEEE 802.1Q Virtual LAN", paramHelp: { v: "IEEE 802.1Q VLAN ID" },
  run: function(c){ c.cur[0].encap = c.args.v; c.cur[0].encapNative = false; } });
define({ modes: ["config-subif"], syntax: "encapsulation dot1q <v:int:1-4094> native", help: "IEEE 802.1Q Virtual LAN", paramHelp: { v: "IEEE 802.1Q VLAN ID" },
  run: function(c){ c.cur[0].encap = c.args.v; c.cur[0].encapNative = true; } });

/* Switchports */
var L2 = { when: curL2 };
function sw(c, fn){ each(c, function(f){ fn(f.sw, f); }); }
define({ modes: IFACE, syntax: "switchport mode access", help: "Set trunking mode to ACCESS unconditionally", when: curL2, run: function(c){ watch(c, function(){ sw(c, function(s){ s.mode = "access"; }); }); } });
define({ modes: IFACE, syntax: "switchport mode trunk", help: "Set trunking mode to TRUNK unconditionally", when: curL2, run: function(c){ watch(c, function(){ sw(c, function(s){ s.mode = "trunk"; }); }); } });
define({ modes: IFACE, syntax: "switchport mode dynamic auto", help: "Set trunking mode dynamic negotiation parameter to AUTO", when: curL2, run: function(c){ watch(c, function(){ sw(c, function(s){ s.mode = "dynamic auto"; }); }); } });
define({ modes: IFACE, syntax: "switchport mode dynamic desirable", help: "Set trunking mode dynamic negotiation parameter to DESIRABLE", when: curL2, run: function(c){ watch(c, function(){ sw(c, function(s){ s.mode = "dynamic desirable"; }); }); } });
define({ modes: IFACE, syntax: "no switchport mode", help: "Set trunking mode", when: curL2, run: function(c){ watch(c, function(){ sw(c, function(s){ s.mode = "dynamic auto"; }); }); } });
define({ modes: IFACE, syntax: "switchport access vlan <v:int:1-4094>", help: "Set VLAN when interface is in access mode", when: curL2, paramHelp: { v: "VLAN ID of the VLAN when this port is in access mode" },
  run: function(c){
    var v = c.args.v;
    if(!c.dev.vlans[v]){
      c.print("% Access VLAN does not exist. Creating vlan " + v);
      if(c.dev.vtp.mode === "client"){ c.print(CLIENT_MSG); return; }
      c.dev.vlans[v] = { name: "VLAN" + ("0000" + v).slice(-4) };
    }
    watch(c, function(){ sw(c, function(s){ s.accessVlan = v; }); });
  } });
define({ modes: IFACE, syntax: "no switchport access vlan", help: "Set VLAN when interface is in access mode", when: curL2, run: function(c){ watch(c, function(){ sw(c, function(s){ s.accessVlan = 1; }); }); } });
define({ modes: IFACE, syntax: "switchport trunk encapsulation dot1q", help: "Set trunking encapsulation to 802.1Q", when: curL2, run: function(c){ sw(c, function(s){ s.encap = "dot1q"; }); } });
define({ modes: IFACE, syntax: "switchport trunk native vlan <v:int:1-4094>", help: "Set native VLAN when interface is in trunking mode", when: curL2, paramHelp: { v: "VLAN ID of the native VLAN when this port is in trunking mode" },
  run: function(c){ watch(c, function(){ sw(c, function(s){ s.nativeVlan = c.args.v; }); }); } });
define({ modes: IFACE, syntax: "no switchport trunk native vlan", help: "Set native VLAN when interface is in trunking mode", when: curL2, run: function(c){ watch(c, function(){ sw(c, function(s){ s.nativeVlan = 1; }); }); } });
define({ modes: IFACE, syntax: "switchport nonegotiate", help: "Device will not engage in negotiation protocol on this interface", when: curL2, run: function(c){
  var bad = c.cur.some(function(f){ return f.sw.mode.indexOf("dynamic") === 0; });
  if(bad){ c.print("Command rejected: Conflict between 'nonegotiate' and 'dynamic' status."); return; }
  watch(c, function(){ sw(c, function(s){ s.nonegotiate = true; }); });
} });
define({ modes: IFACE, syntax: "no switchport nonegotiate", help: "Device will not engage in negotiation protocol on this interface", when: curL2, run: function(c){ watch(c, function(){ sw(c, function(s){ s.nonegotiate = false; }); }); } });

function allVlans(){ var a = [], v; for(v = 1; v <= 4094; v++) a.push(v); return a; }
function setAllowed(s, list){ s.allowed = list.length === 4094 ? null : list.slice().sort(function(a, b){ return a - b; }); }
function curAllowed(s){ return s.allowed === null ? allVlans() : s.allowed.slice(); }
var TRK = { modes: IFACE, when: curL2 };
define({ modes: IFACE, when: curL2, syntax: "switchport trunk allowed vlan <l:vlanlist>", help: "Set allowed VLAN characteristics when interface is in trunking mode",
  paramHelp: { l: "VLAN IDs of the allowed VLANs when this port is in trunking mode" },
  run: function(c){ watch(c, function(){ sw(c, function(s){ setAllowed(s, NET.parseVlanList(c.args.l)); }); }); } });
define({ modes: IFACE, when: curL2, syntax: "switchport trunk allowed vlan add <l:vlanlist>", help: "add VLANs to the current list", paramHelp: { l: "VLAN IDs of the allowed VLANs when this port is in trunking mode" },
  run: function(c){ watch(c, function(){ sw(c, function(s){ var cur = curAllowed(s); NET.parseVlanList(c.args.l).forEach(function(v){ if(cur.indexOf(v) < 0) cur.push(v); }); setAllowed(s, cur); }); }); } });
define({ modes: IFACE, when: curL2, syntax: "switchport trunk allowed vlan remove <l:vlanlist>", help: "remove VLANs from the current list", paramHelp: { l: "VLAN IDs of disallowed VLANs when this port is in trunking mode" },
  run: function(c){ watch(c, function(){ sw(c, function(s){ var rm = NET.parseVlanList(c.args.l); setAllowed(s, curAllowed(s).filter(function(v){ return rm.indexOf(v) < 0; })); }); }); } });
define({ modes: IFACE, when: curL2, syntax: "switchport trunk allowed vlan except <l:vlanlist>", help: "all VLANs except the following", paramHelp: { l: "VLAN IDs of disallowed VLANs when this port is in trunking mode" },
  run: function(c){ watch(c, function(){ sw(c, function(s){ var rm = NET.parseVlanList(c.args.l); setAllowed(s, allVlans().filter(function(v){ return rm.indexOf(v) < 0; })); }); }); } });
define({ modes: IFACE, when: curL2, syntax: "switchport trunk allowed vlan all", help: "all VLANs", run: function(c){ watch(c, function(){ sw(c, function(s){ s.allowed = null; }); }); } });
define({ modes: IFACE, when: curL2, syntax: "switchport trunk allowed vlan none", help: "no VLANs", run: function(c){ watch(c, function(){ sw(c, function(s){ s.allowed = []; }); }); } });
define({ modes: IFACE, when: curL2, syntax: "no switchport trunk allowed vlan", help: "Set allowed VLAN characteristics when interface is in trunking mode", run: function(c){ watch(c, function(){ sw(c, function(s){ s.allowed = null; }); }); } });

/* ====================================================================================
   Static routes and the switch's default gateway (days 11 and 12)
   ==================================================================================== */
function addRoute(c, net, mask, via, exit, ad){
  var prefix = NET.prefixOf(mask), n = NET.netOf(net, prefix), dev = c.dev;
  if(NET.ip2n(net) !== n){ c.print("%Inconsistent address and mask"); return; }
  dev.routes = dev.routes.filter(function(r){ return !(r.net === n && r.prefix === prefix && r.via === via && r.exit === exit); });
  dev.routes.push({ net: n, prefix: prefix, via: via, exit: exit ? exit.name : null, ad: ad || 1 });
}
function delRoute(c, net, mask, via, exit){
  var prefix = NET.prefixOf(mask), n = NET.netOf(net, prefix), name = exit ? exit.name : null;
  c.dev.routes = c.dev.routes.filter(function(r){ return !(r.net === n && r.prefix === prefix && (via ? r.via === via : r.exit === name)); });
}
var ROUTE_HELP = { net: "Destination prefix", mask: "Destination prefix mask", nh: "Forwarding router's address", i: "Forward to this interface", ad: "Distance metric for this route" };
define({ modes: CFG, when: isRouter, syntax: ["ip route <net:ip> <mask:mask> <nh:ip>", "ip route <net:ip> <mask:mask> <nh:ip> <ad:int:1-255>"], help: "Establish static routes", paramHelp: ROUTE_HELP,
  run: function(c){ addRoute(c, c.args.net, c.args.mask, c.args.nh, null, c.args.ad); } });
define({ modes: CFG, when: isRouter, syntax: ["ip route <net:ip> <mask:mask> <i:iface>", "ip route <net:ip> <mask:mask> <i:iface> <ad:int:1-255>"], help: "Establish static routes", paramHelp: ROUTE_HELP,
  run: function(c){ addRoute(c, c.args.net, c.args.mask, null, c.args.i, c.args.ad); } });
define({ modes: CFG, when: isRouter, syntax: "no ip route <net:ip> <mask:mask> <nh:ip>", help: "Establish static routes", paramHelp: ROUTE_HELP,
  run: function(c){ delRoute(c, c.args.net, c.args.mask, c.args.nh, null); } });
define({ modes: CFG, when: isRouter, syntax: "no ip route <net:ip> <mask:mask> <i:iface>", help: "Establish static routes", paramHelp: ROUTE_HELP,
  run: function(c){ delRoute(c, c.args.net, c.args.mask, null, c.args.i); } });
define({ modes: CFG, when: isSwitch, syntax: "ip default-gateway <ip:ip>", help: "Specify default gateway (if not routing IP)", paramHelp: { ip: "IP address of default gateway" },
  run: function(c){ c.dev.defaultGateway = c.args.ip; } });
define({ modes: CFG, when: isSwitch, syntax: "no ip default-gateway", help: "Specify default gateway (if not routing IP)", run: function(c){ c.dev.defaultGateway = null; } });

/* ====================================================================================
   Saving, clearing, testing
   ==================================================================================== */
define({ modes: PRIV, syntax: "copy running-config startup-config", help: "Copy to startup-config", run: function(c){
  NET.saveStartup(c.dev);
  c.print("Destination filename [startup-config]?");
  c.print("Building configuration...");
  c.print("[OK]");
} });
define({ modes: PRIV, syntax: ["write memory", "write"], help: "Write to NV memory", run: function(c){
  NET.saveStartup(c.dev);
  c.print("Building configuration...");
  c.print("[OK]");
} });
define({ modes: PRIV, syntax: "clear mac address-table dynamic", help: "Clear dynamic entries", when: isSwitch, run: function(c){ c.dev.macTable = {}; } });
define({ modes: PRIV, syntax: ["clear arp-cache", "clear ip arp"], help: "Clear the entire ARP cache", when: function(c){ return !isSwitch(c) || true; }, run: function(c){ c.dev.arp = {}; } });

function doPing(c, ip, count){
  var r = NET.ping(c.dev, ip, count), pct = Math.round(r.ok * 100 / r.n);
  c.print("Type escape sequence to abort.");
  c.print("Sending " + r.n + ", 100-byte ICMP Echos to " + ip + ", timeout is 2 seconds:");
  c.print(r.line);
  c.print("Success rate is " + pct + " percent (" + r.ok + "/" + r.n + ")" + (r.ok ? ", round-trip min/avg/max = 1/2/4 ms" : ""));
}
define({ modes: EXEC, syntax: "ping <ip:ip>", help: "Send echo messages", paramHelp: { ip: "Ping destination address or hostname" }, run: function(c){ doPing(c, c.args.ip, 5); } });
define({ modes: EXEC, syntax: "ping <ip:ip> repeat <n:int:1-2147483647>", help: "Send echo messages", paramHelp: { ip: "Ping destination address or hostname", n: "Repeat count" },
  run: function(c){ doPing(c, c.args.ip, Math.min(c.args.n, 100)); } });
W.repeat = "specify repeat count";

/* ====================================================================================
   show commands (days 1-12, 16-18)
   ==================================================================================== */
function showIpIntBrief(c){
  c.print(pad("Interface", 23) + pad("IP-Address", 16) + pad("OK?", 4) + pad("Method", 7) + pad("Status", 22) + "Protocol");
  ordered(c.dev).forEach(function(f){
    var st = NET.status(f);
    c.print(pad(f.name, 23) + pad(f.ip || "unassigned", 16) + pad("YES", 4) + pad(f.ip ? "manual" : "unset", 7) + pad(st.status, 22) + st.proto);
  });
}
function bw(f){ return f.type === "GigabitEthernet" ? "1000000 Kbit" : "100000 Kbit"; }
function showInterface(c, f){
  var st = NET.status(f), dev = c.dev, up = NET.isUp(f);
  var why = f.adminDown ? "(disabled)" : up ? "(connected)" : "(notconnect)";
  var phys = f.type === "Vlan" ? "Ethernet SVI" : f.type === "Loopback" ? "Loopback" : f.type === "GigabitEthernet" ? "CN Gigabit Ethernet" : "Lance";
  c.print(f.name + " is " + st.status + ", line protocol is " + st.proto + (f.type === "Loopback" || f.sub ? "" : " " + why));
  c.print("  Hardware is " + phys + ", address is " + f.mac + " (bia " + f.mac + ")");
  if(f.description) c.print("  Description: " + f.description);
  if(f.ip) c.print("  Internet address is " + f.ip + "/" + f.prefix);
  c.print("  MTU 1500 bytes, BW " + (f.type === "Loopback" ? "8000000 Kbit" : bw(f)) + ", DLY 10 usec,");
  c.print("     reliability 255/255, txload 1/255, rxload 1/255");
  c.print("  Encapsulation " + (f.sub ? "802.1Q Virtual LAN, Vlan ID  " + f.encap + "." : f.type === "Loopback" ? "LOOPBACK" : "ARPA") + ", loopback not set");
  if(f.type !== "Loopback" && f.type !== "Vlan" && !f.sub){
    var sp = f.speed === "auto" ? (f.type === "GigabitEthernet" ? "1000" : "100") : f.speed;
    var dx = f.duplex === "auto" ? "Full" : f.duplex === "full" ? "Full" : "Half";
    c.print("  Keepalive set (10 sec)");
    c.print(up ? "  " + dx + "-duplex, " + sp + "Mb/s, media type is RJ45" : "  Auto-duplex, Auto Speed, media type is RJ45");
    c.print("  ARP type: ARPA, ARP Timeout 04:00:00");
    c.print("  Last input never, output never, output hang never");
    c.print("  Last clearing of \"show interface\" counters never");
    c.print("  Input queue: 0/75/0/0 (size/max/drops/flushes); Total output drops: 0");
    c.print("  5 minute input rate 0 bits/sec, 0 packets/sec");
    c.print("  5 minute output rate 0 bits/sec, 0 packets/sec");
    c.print("     0 packets input, 0 bytes, 0 no buffer");
    c.print("     0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored");
    c.print("     0 packets output, 0 bytes, 0 underruns");
    c.print("     0 output errors, 0 collisions, 1 interface resets");
  }
}
define({ modes: EXEC, syntax: "show interfaces", help: "Interface status and configuration", run: function(c){
  ordered(c.dev).forEach(function(f){ showInterface(c, f); });
} });
define({ modes: EXEC, syntax: "show interfaces <i:iface>", help: "Interface status and configuration", run: function(c){ showInterface(c, c.args.i); } });
define({ modes: EXEC, syntax: "show ip interface brief", help: "Brief summary of IP status and configuration", run: showIpIntBrief });

define({ modes: EXEC, syntax: "show interfaces description", help: "Interface description", run: function(c){
  c.print(pad("Interface", 31) + pad("Status", 15) + pad("Protocol", 9) + "Description");
  ordered(c.dev).forEach(function(f){
    var st = NET.status(f), s = st.status === "administratively down" ? "admin down" : st.status;
    c.print(pad(f.shortName, 31) + pad(s, 15) + pad(st.proto, 9) + f.description);
  });
} });

define({ modes: EXEC, syntax: "show interfaces status", help: "Interface line status", when: isSwitch, run: function(c){
  c.print(pad("Port", 10) + pad("Name", 19) + pad("Status", 13) + pad("Vlan", 11) + pad("Duplex", 8) + pad("Speed", 7) + "Type");
  c.dev.ifaces.filter(function(f){ return f.sw; }).forEach(function(f){
    var up = NET.isUp(f), st = f.errdisabled ? "err-disabled" : f.adminDown ? "disabled" : up ? "connected" : "notconnect";
    var vlan = NET.opMode(f) === "trunk" ? "trunk" : String(f.sw.accessVlan);
    var dx = f.duplex === "auto" ? (up ? "a-full" : "auto") : f.duplex;
    var sp = f.speed === "auto" ? (up ? "a-" + (f.type === "GigabitEthernet" ? "1000" : "100") : "auto") : f.speed;
    c.print(pad(f.shortName, 10) + pad(f.description.slice(0, 18), 19) + pad(st, 13) + pad(vlan, 11) + pad(dx, 8) + pad(sp, 7) + (f.type === "GigabitEthernet" ? "10/100/1000BaseTX" : "10/100BaseTX"));
  });
} });

function showVlanBrief(c){
  var dev = c.dev, ports = {};
  dev.ifaces.forEach(function(f){
    if(f.sw && NET.opMode(f) === "access" && dev.vlans[f.sw.accessVlan]){ (ports[f.sw.accessVlan] = ports[f.sw.accessVlan] || []).push(f.shortName); }
  });
  c.print("VLAN Name                             Status    Ports");
  c.print("---- -------------------------------- --------- -------------------------------");
  var rows = vlanNums(dev).map(function(v){ return [v, dev.vlans[v].name, "active", ports[v] || []]; });
  [[1002, "fddi-default"], [1003, "token-ring-default"], [1004, "fddinet-default"], [1005, "trnet-default"]].forEach(function(x){
    if(!dev.vlans[x[0]]) rows.push([x[0], x[1], "act/unsup", []]);
  });
  rows.forEach(function(r){
    var lines = [], cur = "";
    r[3].forEach(function(p){
      var next = cur ? cur + ", " + p : p;
      if(next.length > 31 && cur){ lines.push(cur + ","); cur = p; } else cur = next;
    });
    if(cur) lines.push(cur);
    c.print(pad(r[0], 5) + pad(r[1], 33) + pad(r[2], 10) + (lines[0] || ""));
    for(var i = 1; i < lines.length; i++) c.print(pad("", 48) + lines[i]);
  });
}
define({ modes: EXEC, syntax: ["show vlan brief", "show vlan"], help: "VLAN Brief status", when: isSwitch, run: showVlanBrief });

function trunkPorts(dev){
  return dev.ifaces.filter(function(f){ return f.sw && !f.adminDown && NET.isUp(f) && NET.opMode(f) === "trunk"; });
}
define({ modes: EXEC, syntax: "show interfaces trunk", help: "Interface trunk information", when: isSwitch, run: function(c){
  var list = trunkPorts(c.dev);
  if(!list.length) return;
  var active = vlanNums(c.dev).filter(function(v){ return v < 1002; });
  c.print(pad("Port", 12) + pad("Mode", 13) + pad("Encapsulation", 15) + pad("Status", 14) + "Native vlan");
  list.forEach(function(f){
    var neg = f.sw.mode !== "trunk", mode = neg ? f.sw.mode.replace("dynamic ", "") : "on";
    c.print(pad(f.shortName, 12) + pad(mode, 13) + pad(neg ? "n-802.1q" : "802.1q", 15) + pad("trunking", 14) + f.sw.nativeVlan);
  });
  c.print("");
  c.print(pad("Port", 12) + "Vlans allowed on trunk");
  list.forEach(function(f){ c.print(pad(f.shortName, 12) + (f.sw.allowed === null ? "1-4094" : NET.rangeText(f.sw.allowed))); });
  c.print("");
  c.print(pad("Port", 12) + "Vlans allowed and active in management domain");
  list.forEach(function(f){ c.print(pad(f.shortName, 12) + NET.rangeText(active.filter(function(v){ return NET.allowedOn(f, v); }))); });
  c.print("");
  c.print(pad("Port", 12) + "Vlans in spanning tree forwarding state and not pruned");
  list.forEach(function(f){ c.print(pad(f.shortName, 12) + NET.rangeText(active.filter(function(v){ return NET.allowedOn(f, v); }))); });
} });

function showSwitchport(c, f){
  var s = f.sw, op = NET.opMode(f), v = c.dev.vlans;
  c.print("Name: " + f.shortName);
  c.print("Switchport: Enabled");
  c.print("Administrative Mode: " + (s.mode === "access" ? "static access" : s.mode === "trunk" ? "trunk" : s.mode));
  c.print("Operational Mode: " + (op === "trunk" ? "trunk" : "static access"));
  c.print("Administrative Trunking Encapsulation: dot1q");
  c.print("Operational Trunking Encapsulation: " + (op === "trunk" ? "dot1q" : "native"));
  c.print("Negotiation of Trunking: " + (s.nonegotiate ? "Off" : s.mode === "access" || s.mode === "trunk" ? "Off" : "On"));
  c.print("Access Mode VLAN: " + s.accessVlan + " (" + (v[s.accessVlan] ? v[s.accessVlan].name : "inactive") + ")");
  c.print("Trunking Native Mode VLAN: " + s.nativeVlan + " (" + (v[s.nativeVlan] ? v[s.nativeVlan].name : "Inactive") + ")");
  c.print("Voice VLAN: none");
  c.print("Trunking VLANs Enabled: " + (s.allowed === null ? "ALL" : NET.rangeText(s.allowed)));
}
define({ modes: EXEC, syntax: "show interfaces <i:iface> switchport", help: "Show interface switchport information", when: isSwitch, run: function(c){
  if(!c.args.i.sw){ c.print("% Interface does not exist or is not a switchport"); return; }
  showSwitchport(c, c.args.i);
} });
define({ modes: EXEC, syntax: "show interfaces switchport", help: "Show interface switchport information", when: isSwitch, run: function(c){
  c.dev.ifaces.filter(function(f){ return f.sw; }).forEach(function(f){ showSwitchport(c, f); c.print(""); });
} });

define({ modes: EXEC, syntax: ["show mac address-table", "show mac address-table dynamic"], help: "MAC forwarding table", when: isSwitch, run: function(c){
  var rows = Object.keys(c.dev.macTable).map(function(k){ return c.dev.macTable[k]; })
    .sort(function(a, b){ return a.vlan - b.vlan || (a.mac < b.mac ? -1 : 1); });
  c.print("          Mac Address Table");
  c.print("-------------------------------------------");
  c.print("");
  c.print("Vlan    Mac Address       Type        Ports");
  c.print("----    -----------       --------    -----");
  rows.forEach(function(r){
    var f = c.dev.findIface(r.port);
    c.print(padL(r.vlan, 4) + "    " + pad(r.mac, 18) + pad(r.type, 12) + (f ? f.shortName : r.port));
  });
  c.print("Total Mac Addresses for this criterion: " + rows.length);
} });
W.dynamic = "dynamic entries only";

define({ modes: EXEC, syntax: ["show arp", "show ip arp"], help: "ARP table", run: function(c){
  c.print("Protocol  Address          Age (min)  Hardware Addr   Type   Interface");
  var dev = c.dev;
  dev.ifaces.forEach(function(f){
    if(f.ip && NET.isUp(f)) c.print("Internet  " + pad(f.ip, 17) + pad("-", 11) + pad(f.mac.replace(/\./g, "."), 16) + "ARPA   " + f.name);
  });
  Object.keys(dev.arp).forEach(function(ip){
    c.print("Internet  " + pad(ip, 17) + pad("0", 11) + pad(dev.arp[ip].mac, 16) + "ARPA   " + dev.arp[ip].iface);
  });
} });

function codeLine(r){
  var code = pad(r.code === "S" && r.def ? "S*" : r.code, 5);
  var cidr = NET.n2ip(r.net) + "/" + r.prefix;
  if(r.code === "S") return code + cidr + " [" + r.ad + "/0] " + (r.via ? "via " + r.via : "is directly connected, " + r.iface.name);
  return code + cidr + " is directly connected, " + r.iface.name;
}
define({ modes: EXEC, syntax: "show ip route", help: "IP routing table", run: function(c){
  var table = NET.routeTable(c.dev);
  c.print("Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP");
  c.print("       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area");
  c.print("       N1 - OSPF NSSA external type 1, N2 - OSPF NSSA external type 2");
  c.print("       E1 - OSPF external type 1, E2 - OSPF external type 2, E - EGP");
  c.print("       i - IS-IS, L1 - IS-IS level-1, L2 - IS-IS level-2, ia - IS-IS inter area");
  c.print("       * - candidate default, U - per-user static route, o - ODR");
  c.print("       P - periodic downloaded static route");
  c.print("");
  var def = table.filter(function(r){ return r.def; })[0];
  c.print(def ? "Gateway of last resort is " + def.via + " to network 0.0.0.0" : "Gateway of last resort is not set");
  c.print("");
  var groups = {}, order = [];
  table.sort(function(a, b){ return a.net - b.net || a.prefix - b.prefix; }).forEach(function(r){
    var first = Math.floor(r.net / 16777216), cls = first < 128 ? 8 : first < 192 ? 16 : 24;
    if(r.prefix === 0) cls = 0;
    var key = r.prefix === 0 ? "default" : NET.n2ip(NET.netOf(NET.n2ip(r.net), cls)) + "/" + cls;
    if(!groups[key]){ groups[key] = []; order.push(key); }
    groups[key].push(r);
  });
  order.forEach(function(k){
    var g = groups[k];
    if(k === "default" || (g.length === 1 && g[0].prefix === +k.split("/")[1])){ g.forEach(function(r){ c.print(codeLine(r)); }); return; }
    var masks = {};
    g.forEach(function(r){ masks[r.prefix] = 1; });
    var nm = Object.keys(masks).length;
    c.print("      " + k + " is " + (nm > 1 ? "variably subnetted, " + g.length + " subnets, " + nm + " masks" : "subnetted, " + g.length + " subnets"));
    g.forEach(function(r){ c.print(codeLine(r)); });
  });
} });

define({ modes: PRIV, syntax: "show running-config", help: "Current operating configuration", run: function(c){
  var lines = NET.configLines(c.dev);
  c.print("Building configuration...");
  c.print("");
  c.print("Current configuration : " + (lines.join("\n").length + 40) + " bytes");
  c.print("!");
  lines.forEach(function(l){ c.print(l); });
} });
define({ modes: PRIV, syntax: "show startup-config", help: "Contents of startup configuration", run: function(c){
  if(!c.dev.startup){ c.print("startup-config is not present"); return; }
  c.print("Using " + (c.dev.startup.length + 40) + " out of 65536 bytes");
  c.print("!");
  c.print(c.dev.startup);
} });
define({ modes: EXEC, syntax: "show version", help: "System hardware and software status", run: function(c){
  var sw_ = c.dev.kind === "switch";
  c.print(sw_ ? "Cisco IOS Software, C2960 Software (C2960-LANBASEK9-M), Version 15.0(2)SE4, RELEASE SOFTWARE (fc1)"
              : "Cisco IOS Software, C2900 Software (C2900-UNIVERSALK9-M), Version 15.1(4)M4, RELEASE SOFTWARE (fc2)");
  c.print("ROM: Bootstrap program is " + (sw_ ? "C2960 boot loader" : "C2900 boot loader"));
  c.print("");
  c.print(c.dev.hostname + " uptime is 1 hour, 12 minutes");
  c.print("System image file is \"flash:" + (sw_ ? "c2960-lanbasek9-mz.150-2.SE4.bin" : "c2900-universalk9-mz.SPA.151-4.M4.bin") + "\"");
  c.print("");
  var fa = c.dev.ifaces.filter(function(f){ return f.type === "FastEthernet"; }).length, gi = c.dev.ifaces.filter(function(f){ return f.type === "GigabitEthernet"; }).length;
  if(fa) c.print(fa + " FastEthernet interfaces");
  if(gi) c.print(gi + " Gigabit Ethernet interfaces");
  c.print("");
  c.print("Configuration register is 0x2102");
} });
define({ modes: EXEC, syntax: "show history", help: "Display the session command history", run: function(c){
  c.session.history.forEach(function(h){ c.print("  " + h); });
} });
W.history = "Display the session command history";

})(typeof window !== "undefined" ? window : globalThis);

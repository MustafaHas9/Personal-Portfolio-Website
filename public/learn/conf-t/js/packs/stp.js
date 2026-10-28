/* Pack 3: spanning tree (Jeremy's IT Lab days 20 and 21).
   Modes, priorities and root bridges, port cost and priority, the show commands, and the STP toolkit:
   PortFast, BPDU guard, BPDU filter, root guard and loop guard. */
(function(root){
"use strict";

var IOS = root.IOS, NET = root.NET, define = IOS.define, W = IOS.WORDHELP;
var CFG = ["config"], EXEC = ["user", "priv"], IFACE = ["config-if", "config-if-range"];
var isSwitch = function(c){ return c.dev.kind === "switch"; };
var curL2 = function(c){ return c.dev.kind === "switch" && c.cur && c.cur.length && c.cur.every(function(f){ return !!f.sw; }); };

[["spanning-tree", "Spanning Tree Subsystem"], ["priority", "Set the bridge priority for the spanning tree"], ["root", "Configure switch as root"],
 ["portfast", "Enable an interface to move directly to forwarding on link up"], ["bpduguard", "Don't accept BPDUs on this interface"],
 ["bpdufilter", "Don't send or receive BPDUs on this interface"], ["guard", "Change an interface's spanning tree guard mode"],
 ["loopguard", "Spanning tree loopguard options"], ["cost", "Change an interface's spanning tree port path cost"],
 ["port-priority", "Change an interface's spanning tree port priority"], ["link-type", "Specify a link type for spanning tree protocol use"],
 ["errdisable", "Error disable"], ["recovery", "Configure errdisable recovery"], ["cause", "Enable timer to recover from specific error disable cause"],
 ["inconsistentports", "Show inconsistent ports"], ["summary", "Summary of port states"], ["mode", "Spanning tree operating mode"],
 ["primary", "Configure this switch as primary root for this spanning tree"], ["secondary", "Configure switch as secondary root"]].forEach(function(p){ if(!W[p[0]]) W[p[0]] = p[1]; });

function pad(s, n){ s = String(s); while(s.length < n) s += " "; return s; }
function pad4(n){ return ("0000" + n).slice(-4); }
function last(c){ return c.line.trim().split(/\s+/).pop().toLowerCase(); }
function vlansOf(text){ return NET.parseVlanList(text); }

/* ====================================================================================
   Global configuration
   ==================================================================================== */
define({ modes: CFG, when: isSwitch, syntax: "spanning-tree mode pvst|rapid-pvst|mst", help: "Spanning tree operating mode", run: function(c){ c.dev.stp.mode = last(c); } });
define({ modes: CFG, when: isSwitch, syntax: "spanning-tree vlan <ids:vlanlist> priority <p:int:0-61440>", help: "Set the bridge priority for the spanning tree",
  paramHelp: { ids: "VLAN IDs, like 10,20,30-40", p: "Bridge priority in increments of 4096" }, run: function(c){
    if(c.args.p % 4096){
      c.print("% Bridge Priority must be in increments of 4096.");
      c.print("% Allowed values are:");
      c.print("  0     4096  8192  12288 16384 20480 24576 28672");
      c.print("  32768 36864 40960 45056 49152 53248 57344 61440");
      return;
    }
    vlansOf(c.args.ids).forEach(function(v){ c.dev.stp.prio[v] = c.args.p; });
  } });
define({ modes: CFG, when: isSwitch, syntax: "spanning-tree vlan <ids:vlanlist> root primary|secondary", help: "Configure switch as root",
  paramHelp: { ids: "VLAN IDs, like 10,20,30-40" }, run: function(c){
    var secondary = last(c) === "secondary";
    vlansOf(c.args.ids).forEach(function(v){
      var other = NET.rootPriorityOthers(c.dev, v);
      if(secondary) c.dev.stp.prio[v] = 28672;
      else if(other === null || other > 24576) c.dev.stp.prio[v] = 24576;
      else c.dev.stp.prio[v] = Math.max(0, other - 4096);
    });
  } });
define({ modes: CFG, when: isSwitch, syntax: "no spanning-tree vlan <ids:vlanlist> priority", help: "Set the bridge priority for the spanning tree",
  run: function(c){ vlansOf(c.args.ids).forEach(function(v){ delete c.dev.stp.prio[v]; }); } });
define({ modes: CFG, when: isSwitch, syntax: "spanning-tree portfast default", help: "Enable portfast by default on all access ports", run: function(c){ c.dev.stp.portfastDefault = true; } });
define({ modes: CFG, when: isSwitch, syntax: "no spanning-tree portfast default", help: "Enable portfast by default on all access ports", run: function(c){ c.dev.stp.portfastDefault = false; } });
define({ modes: CFG, when: isSwitch, syntax: "spanning-tree portfast bpduguard default", help: "Enable bpdu guard by default on all portfast ports", run: function(c){ c.dev.stp.bpduguardDefault = true; } });
define({ modes: CFG, when: isSwitch, syntax: "no spanning-tree portfast bpduguard default", help: "Enable bpdu guard by default on all portfast ports", run: function(c){ c.dev.stp.bpduguardDefault = false; } });
define({ modes: CFG, when: isSwitch, syntax: "spanning-tree portfast bpdufilter default", help: "Enable bpdu filter by default on all portfast ports", run: function(c){ c.dev.stp.bpdufilterDefault = true; } });
define({ modes: CFG, when: isSwitch, syntax: "no spanning-tree portfast bpdufilter default", help: "Enable bpdu filter by default on all portfast ports", run: function(c){ c.dev.stp.bpdufilterDefault = false; } });
define({ modes: CFG, when: isSwitch, syntax: "spanning-tree loopguard default", help: "Enable loopguard by default on all ports", run: function(c){ c.dev.stp.loopguardDefault = true; } });
define({ modes: CFG, when: isSwitch, syntax: "no spanning-tree loopguard default", help: "Enable loopguard by default on all ports", run: function(c){ c.dev.stp.loopguardDefault = false; } });
define({ modes: CFG, when: isSwitch, syntax: "errdisable recovery cause bpduguard", help: "Enable timer to recover from bpduguard error disable state", run: function(c){ c.dev.stp.errdisableRecovery = true; } });
define({ modes: CFG, when: isSwitch, syntax: "errdisable recovery interval <n:int:30-86400>", help: "Error disable recovery timer value", run: function(c){ c.dev.stp.recoveryInterval = c.args.n; } });
W.interval = W.interval || "Error disable recovery timer value";

/* ====================================================================================
   Interface configuration: the toolkit
   ==================================================================================== */
function each(c, fn){ c.cur.forEach(function(f){ fn(f.stp, f); }); }
define({ modes: IFACE, when: curL2, syntax: "spanning-tree portfast", help: "Enable an interface to move directly to forwarding on link up", run: function(c){
  c.print("%Warning: portfast should only be enabled on ports connected to a single");
  c.print(" host. Connecting hubs, concentrators, switches, bridges, etc... to this");
  c.print(" interface  when portfast is enabled, can cause temporary bridging loops.");
  c.print(" Use with CAUTION");
  c.print("");
  c.print("%Portfast has been configured on " + c.cur[0].name + " but will only");
  c.print(" have effect when the interface is in a non-trunking mode.");
  each(c, function(q){ q.portfast = true; });
} });
define({ modes: IFACE, when: curL2, syntax: "no spanning-tree portfast", help: "Enable an interface to move directly to forwarding on link up", run: function(c){ each(c, function(q){ q.portfast = false; }); } });
define({ modes: IFACE, when: curL2, syntax: "spanning-tree bpduguard enable", help: "Enable BPDU guard for this interface", run: function(c){ each(c, function(q){ q.bpduguard = true; }); } });
define({ modes: IFACE, when: curL2, syntax: "spanning-tree bpduguard disable", help: "Disable BPDU guard for this interface", run: function(c){ each(c, function(q){ q.bpduguard = false; }); } });
define({ modes: IFACE, when: curL2, syntax: "no spanning-tree bpduguard", help: "Don't accept BPDUs on this interface", run: function(c){ each(c, function(q){ q.bpduguard = null; }); } });
define({ modes: IFACE, when: curL2, syntax: "spanning-tree bpdufilter enable", help: "Enable BPDU filtering for this interface", run: function(c){ each(c, function(q){ q.bpdufilter = true; }); } });
define({ modes: IFACE, when: curL2, syntax: "spanning-tree bpdufilter disable", help: "Disable BPDU filtering for this interface", run: function(c){ each(c, function(q){ q.bpdufilter = false; }); } });
define({ modes: IFACE, when: curL2, syntax: "no spanning-tree bpdufilter", help: "Don't send or receive BPDUs on this interface", run: function(c){ each(c, function(q){ q.bpdufilter = null; }); } });
define({ modes: IFACE, when: curL2, syntax: "spanning-tree guard root", help: "Change an interface's spanning tree guard mode to root guard", run: function(c){ each(c, function(q){ q.guardRoot = true; q.guardLoop = false; }); } });
define({ modes: IFACE, when: curL2, syntax: "spanning-tree guard loop", help: "Change an interface's spanning tree guard mode to loop guard", run: function(c){ each(c, function(q){ q.guardLoop = true; q.guardRoot = false; }); } });
define({ modes: IFACE, when: curL2, syntax: "spanning-tree guard none", help: "Set guard mode to none", run: function(c){ each(c, function(q){ q.guardRoot = false; q.guardLoop = false; }); } });
define({ modes: IFACE, when: curL2, syntax: "no spanning-tree guard", help: "Change an interface's spanning tree guard mode", run: function(c){ each(c, function(q){ q.guardRoot = false; q.guardLoop = false; }); } });
define({ modes: IFACE, when: curL2, syntax: "spanning-tree cost <n:int:1-200000000>", help: "Change an interface's spanning tree port path cost", paramHelp: { n: "Change an interface's spanning tree port path cost" },
  run: function(c){ each(c, function(q){ q.cost = c.args.n; }); } });
define({ modes: IFACE, when: curL2, syntax: "no spanning-tree cost", help: "Change an interface's spanning tree port path cost", run: function(c){ each(c, function(q){ q.cost = null; }); } });
define({ modes: IFACE, when: curL2, syntax: "spanning-tree vlan <ids:vlanlist> cost <n:int:1-200000000>", help: "Change an interface's spanning tree port path cost", paramHelp: { ids: "VLAN IDs, like 10,20,30-40" },
  run: function(c){ vlansOf(c.args.ids).forEach(function(v){ each(c, function(q){ q.costVlan[v] = c.args.n; }); }); } });
define({ modes: IFACE, when: curL2, syntax: "spanning-tree port-priority <n:int:0-240>", help: "Change an interface's spanning tree port priority", paramHelp: { n: "Port priority in increments of 16" },
  run: function(c){
    if(c.args.n % 16){ c.print("% Port priority must be in increments of 16."); return; }
    each(c, function(q){ q.prio = c.args.n; });
  } });
define({ modes: IFACE, when: curL2, syntax: "spanning-tree vlan <ids:vlanlist> port-priority <n:int:0-240>", help: "Change an interface's spanning tree port priority", paramHelp: { ids: "VLAN IDs, like 10,20,30-40" },
  run: function(c){
    if(c.args.n % 16){ c.print("% Port priority must be in increments of 16."); return; }
    vlansOf(c.args.ids).forEach(function(v){ each(c, function(q){ q.prioVlan[v] = c.args.n; }); });
  } });
define({ modes: IFACE, when: curL2, syntax: "spanning-tree link-type point-to-point|shared", help: "Specify a link type for spanning tree protocol use", run: function(c){
  each(c, function(q){ q.linkType = last(c) === "shared" ? "shared" : "point-to-point"; });
} });

/* ====================================================================================
   show commands
   ==================================================================================== */
function stpBlock(c, d, v){
  var e = NET.stp(d, v);
  if(!e) return false;
  var mode = d.stp.mode === "rapid-pvst" ? "rstp" : d.stp.mode === "mst" ? "mstp" : "ieee";
  var rb = NET.bridgeInfo(e.rootDev, v), me = NET.bridgeInfo(d, v);
  c.print("VLAN" + pad4(v));
  c.print("  Spanning tree enabled protocol " + mode);
  c.print("  Root ID    Priority    " + rb.total);
  c.print("             Address     " + rb.mac);
  if(e.isRoot) c.print("             This bridge is the root");
  else { c.print("             Cost        " + e.rootCost); c.print("             Port        " + NET.portNum(e.rootPort) + "(" + e.rootPort.name + ")"); }
  c.print("             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec");
  c.print("");
  c.print("  Bridge ID  Priority    " + me.total + "  (priority " + me.base + " sys-id-ext " + v + ")");
  c.print("             Address     " + me.mac);
  c.print("             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec");
  c.print("             Aging Time  300 sec");
  c.print("");
  c.print("Interface           Role Sts Cost      Prio.Nbr Type");
  c.print("------------------- ---- --- --------- -------- --------------------------------");
  e.ports.forEach(function(p){
    c.print(pad(p.f.shortName, 20) + pad(p.role, 5) + pad(p.state, 4) + pad(p.cost, 10) + pad(p.pid, 9) + p.type + (p.inconsistent ? " *ROOT_Inc" : ""));
  });
  return true;
}
function activeVlans(d){
  return Object.keys(d.vlans).map(Number).sort(function(a, b){ return a - b; }).filter(function(v){ var e = NET.stp(d, v); return e && e.ports.length; });
}
define({ modes: EXEC, when: isSwitch, syntax: "show spanning-tree", help: "Spanning tree subsystem", run: function(c){
  var list = activeVlans(c.dev);
  list.forEach(function(v, i){ if(i) c.print(""); stpBlock(c, c.dev, v); });
} });
define({ modes: EXEC, when: isSwitch, syntax: "show spanning-tree vlan <ids:vlanlist>", help: "VLAN Switch Spanning Trees", paramHelp: { ids: "VLAN IDs, like 10,20,30-40" }, run: function(c){
  var any = false;
  vlansOf(c.args.ids).forEach(function(v, i){
    if(!NET.stp(c.dev, v)){ c.print("Spanning tree instance(s) for vlan " + v + " does not exist."); return; }
    if(any) c.print("");
    any = stpBlock(c, c.dev, v) || any;
  });
} });
define({ modes: EXEC, when: isSwitch, syntax: "show spanning-tree root", help: "Status and configuration of the root bridge", run: function(c){
  c.print("                                        Root    Hello Max Fwd");
  c.print("Vlan                   Root ID          Cost    Time  Age Dly  Root Port");
  c.print("---------------- -------------------- --------- ----- --- ---  ------------");
  activeVlans(c.dev).forEach(function(v){
    var e = NET.stp(c.dev, v), rb = NET.bridgeInfo(e.rootDev, v);
    c.print(pad("VLAN" + pad4(v), 17) + pad(rb.total + " " + rb.mac, 21) + pad(e.rootCost, 10) + "    2   20  15  " + (e.rootPort ? e.rootPort.shortName : ""));
  });
} });
define({ modes: EXEC, when: isSwitch, syntax: "show spanning-tree summary", help: "Summary of port states", run: function(c){
  var d = c.dev, on = function(x){ return x ? "is enabled" : "is disabled"; };
  var roots = activeVlans(d).filter(function(v){ return NET.stp(d, v).isRoot; }).map(function(v){ return "VLAN" + pad4(v); });
  c.print("Switch is in " + d.stp.mode + " mode");
  c.print("Root bridge for: " + (roots.length ? roots.join(", ") : "none"));
  c.print("Extended system ID           is enabled");
  c.print("Portfast Default             " + on(d.stp.portfastDefault));
  c.print("PortFast BPDU Guard Default  " + on(d.stp.bpduguardDefault));
  c.print("Portfast BPDU Filter Default " + on(d.stp.bpdufilterDefault));
  c.print("Loopguard Default            " + on(d.stp.loopguardDefault));
  c.print("EtherChannel misconfig guard is enabled");
  c.print("UplinkFast                   is disabled");
  c.print("BackboneFast                 is disabled");
  c.print("Configured Pathcost method used is short");
  c.print("");
  c.print("Name                   Blocking Listening Learning Forwarding STP Active");
  c.print("---------------------- -------- --------- -------- ---------- ----------");
  var totals = [0, 0, 0, 0, 0];
  activeVlans(d).forEach(function(v){
    var e = NET.stp(d, v), blk = 0, fwd = 0;
    e.ports.forEach(function(p){ if(p.state === "BLK" || p.state === "BKN") blk++; else fwd++; });
    c.print(pad("VLAN" + pad4(v), 23) + ("        " + blk).slice(-8) + "         0        0 " + ("          " + fwd).slice(-10) + " " + ("          " + e.ports.length).slice(-10));
    totals[0]++; totals[1] += blk; totals[4] += fwd;
  });
  c.print("---------------------- -------- --------- -------- ---------- ----------");
  c.print(pad(totals[0] + " vlans", 23) + ("        " + totals[1]).slice(-8) + "         0        0 " + ("          " + totals[4]).slice(-10) + " " + ("          " + (totals[1] + totals[4])).slice(-10));
} });
define({ modes: EXEC, when: isSwitch, syntax: "show spanning-tree inconsistentports", help: "Show inconsistent ports", run: function(c){
  c.print("Name                 Interface              Inconsistency");
  c.print("-------------------- ---------------------- ------------------");
  var n = 0;
  activeVlans(c.dev).forEach(function(v){
    NET.stp(c.dev, v).ports.forEach(function(p){ if(p.inconsistent){ n++; c.print(pad("VLAN" + pad4(v), 21) + pad(p.f.shortName, 23) + "Root Inconsistent"); } });
  });
  c.print("Number of inconsistent ports (segments) in the system :" + n);
} });

})(typeof window !== "undefined" ? window : globalThis);

/* The rooms. A puzzle room builds a small broken network and lists what counts as fixed; a defense
   room lists the enemies that come at you and the exact commands that stop them.
   Everything uses commands from the packs, so a room can only ask for what the engine knows. */
(function(root){
"use strict";

var ROOMS = root.ROOMS = {};
var EPISODES = root.EPISODES = { 1: ["gate7", "strays", "corridor", "warden"], 2: ["lift4", "office"], 3: ["nightgate"], 4: ["nine"],
  5: ["p_trunk", "p_vtp", "p_root", "p_guard", "p_drill"] };

/* ---------- builders ---------- */
function pc(t, name, ip, gw){ return t.add(NET.makePC(name, ip, 24, gw || null)); }
function up(f){ return !!f && !f.adminDown; }
function addr(dev, ifname, ip, prefix){
  var f = dev.findIface(ifname);
  return !!f && f.ip === ip && f.prefix === prefix && !f.adminDown;
}
function hasRoute(dev, net, prefix){
  return NET.routeTable(dev).some(function(r){ return r.code === "S" && NET.n2ip(r.net) === net && r.prefix === prefix; }) ||
         NET.routeTable(dev).some(function(r){ return r.code === "S" && r.prefix === 0; });
}
function setup(dev, lines){
  /* Put a device in a starting state by typing at it, exactly as a player would. */
  var s = new IOS.Session(dev, null, "priv");
  lines.forEach(function(l){ s.exec(l); });
}
function saved(dev){ return !!dev.startup && dev.startup === NET.configLines(dev).join("\n"); }

/* ====================================================================================
   Episode 1: the Upper Levels
   ==================================================================================== */
ROOMS.gate7 = {
  id: "gate7", ep: 1, map: "gate7", type: "puzzle", name: "Gate Seven",
  build: function(){
    var t = new NET.Topo();
    t.add(NET.makeRouter("Gate7", 2));
    pc(t, "Lamp", "10.7.0.10", "10.7.0.1");
    t.link("Gate7", "Gi0/0", "Lamp", "Fa0");
    return { topo: t, order: ["Gate7"], start: { Gate7: "user" } };
  },
  goals: [
    { id: "ip", text: "Give Gate Seven's first face (GigabitEthernet0/0) the address 10.7.0.1 with the mask 255.255.255.0",
      test: function(rt){ var f = rt.dev("Gate7").findIface("g0/0"); return !!f && f.ip === "10.7.0.1" && f.prefix === 24; } },
    { id: "up", text: "Wake that face. It is switched off.", test: function(rt){ return up(rt.dev("Gate7").findIface("g0/0")); } },
    { id: "see", text: "Make Gate Seven able to see the lamp at 10.7.0.10", test: function(rt){ return NET.canReach(rt.dev("Gate7"), "10.7.0.10"); } }
  ],
  traps: [],
  reward: { clean: 40, rough: 25, botched: 10 }
};

ROOMS.strays = {
  id: "strays", ep: 1, map: "strays", type: "defense", name: "The Strays",
  arena: function(){
    var t = new NET.Topo();
    t.add(NET.makeRouter("Gatewatch", 3)); pc(t, "Post", "10.1.0.2", "10.1.0.1");
    t.link("Gatewatch", "Gi0/0", "Post", "Fa0");
    setup(t.devices.Gatewatch, ["conf t", "int g0/0", "ip address 10.1.0.1 255.255.255.0", "no shutdown", "end"]);
    return t;
  },
  targets: [{ id: "ward", hp: 4 }],
  waves: [{ n: 3, pool: "A", gap: 7, speed: 9 }, { n: 4, pool: "A", gap: 6, speed: 10 }, { n: 2, pool: "B", gap: 9, speed: 8 }],
  reward: { clean: 45, rough: 28, botched: 10 }
};

ROOMS.corridor = {
  id: "corridor", ep: 1, map: "corridor", type: "puzzle", name: "The Long Corridor",
  build: function(){
    var t = new NET.Topo();
    t.add(NET.makeRouter("Near", 2)); t.add(NET.makeRouter("Far", 2));
    pc(t, "Lamp A", "10.1.1.10", "10.1.1.1"); pc(t, "Lamp B", "10.1.2.10", "10.1.2.1");
    t.link("Lamp A", "Fa0", "Near", "Gi0/0"); t.link("Near", "Gi0/1", "Far", "Gi0/1"); t.link("Far", "Gi0/0", "Lamp B", "Fa0");
    setup(t.devices.Near, ["conf t", "int g0/0", "ip address 10.1.1.1 255.255.255.0", "no shutdown", "int g0/1", "ip address 10.9.0.1 255.255.255.252", "no shutdown", "end"]);
    setup(t.devices.Far, ["conf t", "int g0/1", "ip address 10.9.0.2 255.255.255.252", "no shutdown", "int g0/0", "ip address 10.1.2.1 255.255.255.0", "no shutdown", "end"]);
    return { topo: t, order: ["Near", "Far"], start: { Near: "priv", Far: "priv" } };
  },
  goals: [
    { id: "near", text: "Near must know the road to 10.1.2.0/24", test: function(rt){ return hasRoute(rt.dev("Near"), "10.1.2.0", 24); } },
    { id: "far", text: "Far must know the road back to 10.1.1.0/24", test: function(rt){ return hasRoute(rt.dev("Far"), "10.1.1.0", 24); } },
    { id: "talk", text: "Lamp A and Lamp B must be able to reach each other", test: function(rt){ return NET.canReach(rt.dev("Lamp A"), "10.1.2.10"); } }
  ],
  traps: ["cut"],
  reward: { clean: 50, rough: 32, botched: 12 }
};

ROOMS.warden = {
  id: "warden", ep: 1, map: "warden", type: "puzzle", name: "The Gatewarden",
  build: function(){
    var t = new NET.Topo();
    t.add(NET.makeSwitch("Ward")); pc(t, "Lamp One", "10.9.1.10"); pc(t, "Lamp Two", "10.9.1.11");
    t.link("Lamp One", "Fa0", "Ward", "Fa0/1"); t.link("Lamp Two", "Fa0", "Ward", "Fa0/2");
    setup(t.devices.Ward, ["conf t", "vlan 10", "vlan 20", "int fa0/1", "switchport mode access", "switchport access vlan 10", "int fa0/2", "switchport mode access", "switchport access vlan 20", "end"]);
    return { topo: t, order: ["Ward"], start: { Ward: "priv" } };
  },
  goals: [
    { id: "name", text: "Name VLAN 10 \"warden\"", test: function(rt){ var v = rt.dev("Ward").vlans[10]; return !!v && v.name.toLowerCase() === "warden"; } },
    { id: "same", text: "Move Lamp Two's port (FastEthernet0/2) into VLAN 10, beside Lamp One", test: function(rt){ var f = rt.dev("Ward").findIface("fa0/2"); return !!f && f.sw.accessVlan === 10 && f.sw.mode === "access"; } },
    { id: "talk", text: "Lamp One and Lamp Two must be able to reach each other", test: function(rt){ return NET.canReach(rt.dev("Lamp One"), "10.9.1.11"); } }
  ],
  traps: [],
  then: { type: "defense", targets: [{ id: "gate", hp: 5 }], waves: [{ n: 4, pool: "A", gap: 6, speed: 11 }, { n: 3, pool: "B", gap: 8, speed: 10 }, { n: 1, pool: "C", gap: 10, speed: 7 }],
          arena: function(){
            var t = new NET.Topo();
            t.add(NET.makeRouter("Gatewatch", 3)); pc(t, "Post", "10.1.0.2", "10.1.0.1");
            t.link("Gatewatch", "Gi0/0", "Post", "Fa0");
            setup(t.devices.Gatewatch, ["conf t", "int g0/0", "ip address 10.1.0.1 255.255.255.0", "no shutdown", "end"]);
            return t;
          } },
  reward: { clean: 70, rough: 45, botched: 20 }
};

/* ====================================================================================
   Episode 2: Level Four
   ==================================================================================== */
ROOMS.lift4 = {
  id: "lift4", ep: 2, map: "lift4", type: "puzzle", name: "Level Four", harmsPell: true,
  build: function(){
    var t = new NET.Topo();
    t.add(NET.makeSwitch("Hoist")); t.add(NET.makeSwitch("Cage"));
    pc(t, "Winch", "10.4.0.10"); pc(t, "Lift", "10.4.0.20");
    t.link("Winch", "Fa0", "Hoist", "Fa0/1"); t.link("Lift", "Fa0", "Cage", "Fa0/1"); t.link("Hoist", "Gi0/1", "Cage", "Gi0/1");
    setup(t.devices.Hoist, ["conf t", "vlan 10", "name lift", "int fa0/1", "switchport mode access", "switchport access vlan 10", "end"]);
    // the Cage side has its port set to VLAN 10 but never had the VLAN made
    var cage = t.devices.Cage, f = cage.findIface("fa0/1");
    f.sw.mode = "access"; f.sw.accessVlan = 10;
    return { topo: t, order: ["Hoist", "Cage"], start: { Hoist: "priv", Cage: "priv" } };
  },
  goals: [
    { id: "vlan", text: "The Cage has no VLAN 10. Make it.", test: function(rt){ return !!rt.dev("Cage").vlans[10]; } },
    { id: "trunk", text: "Hoist and Cage are joined by GigabitEthernet0/1 on each. Make that link carry more than one VLAN.", test: function(rt){ var f = rt.dev("Hoist").findIface("gi0/1"); return NET.isUp(f) && NET.opMode(f) === "trunk"; } },
    { id: "talk", text: "The Winch must be able to reach the Lift (10.4.0.20)", test: function(rt){ return NET.canReach(rt.dev("Winch"), "10.4.0.20"); } }
  ],
  traps: [
    { id: "cut", msg: "Something above you shifts. Rock comes down.", test: function(rt){
        var a = rt.dev("Hoist").findIface("gi0/1"), b = rt.dev("Cage").findIface("gi0/1"); return a.adminDown || b.adminDown; } },
    { id: "strip", msg: "The lift cable jerks. More rock.", test: function(rt){
        var a = rt.dev("Hoist").findIface("gi0/1"), b = rt.dev("Cage").findIface("gi0/1");
        return [a, b].some(function(f){ return f.sw.allowed !== null && f.sw.allowed.indexOf(10) < 0; }); } }
  ],
  reward: { clean: 60, rough: 38, botched: 15 }
};

ROOMS.office = { id: "office", ep: 2, map: "office", type: "story", name: "The Foreman's Office", reward: { clean: 0, rough: 0, botched: 0 } };

/* ====================================================================================
   Episode 3: the Gate at night
   ==================================================================================== */
ROOMS.nightgate = {
  id: "nightgate", ep: 3, map: "nightgate", type: "defense", name: "The Gate", choosesTarget: true,
  arena: function(){
    var t = new NET.Topo();
    t.add(NET.makeRouter("Gatewatch", 3)); pc(t, "Post", "10.1.0.2", "10.1.0.1");
    t.link("Gatewatch", "Gi0/0", "Post", "Fa0");
    setup(t.devices.Gatewatch, ["conf t", "int g0/0", "ip address 10.1.0.1 255.255.255.0", "no shutdown", "end"]);
    return t;
  },
  targets: [{ id: "wards", hp: 4 }, { id: "line", hp: 4 }],
  waves: [{ n: 4, pool: "A", gap: 5, speed: 12 }, { n: 4, pool: "B", gap: 6, speed: 11 }, { n: 3, pool: "B", gap: 5, speed: 12 }, { n: 2, pool: "C", gap: 9, speed: 8 }],
  reward: { clean: 80, rough: 50, botched: 20 }
};

/* ====================================================================================
   Episode 4: Level Nine
   ==================================================================================== */
ROOMS.nine = {
  id: "nine", ep: 4, map: "nine", type: "puzzle", name: "Level Nine", final: true, water: true,
  build: function(){
    var t = new NET.Topo();
    pc(t, "Lamp A", "192.168.10.10", "192.168.10.1"); pc(t, "Lamp B", "192.168.20.10", "192.168.20.1");
    t.add(NET.makeSwitch("West")); t.add(NET.makeSwitch("East")); t.add(NET.makeRouter("R-West", 3)); t.add(NET.makeRouter("R-East", 3));
    t.link("Lamp A", "Fa0", "West", "Fa0/1"); t.link("West", "Fa0/24", "R-West", "Gi0/0");
    t.link("R-West", "Gi0/1", "R-East", "Gi0/1"); t.link("R-East", "Gi0/0", "East", "Fa0/24"); t.link("East", "Fa0/1", "Lamp B", "Fa0");
    setup(t.devices.West, ["conf t", "vlan 10", "int fa0/1", "switchport mode access", "switchport access vlan 10", "end"]);
    return { topo: t, order: ["R-West", "R-East", "West", "East"], start: { "R-West": "user", "R-East": "user", "West": "user", "East": "user" } };
  },
  goals: [
    { id: "w", text: "R-West: GigabitEthernet0/0 is 192.168.10.1/24 and GigabitEthernet0/1 is 10.0.0.1/30, both awake",
      test: function(rt){ var d = rt.dev("R-West"); return addr(d, "g0/0", "192.168.10.1", 24) && addr(d, "g0/1", "10.0.0.1", 30); } },
    { id: "e", text: "R-East: GigabitEthernet0/1 is 10.0.0.2/30 and GigabitEthernet0/0 is 192.168.20.1/24, both awake",
      test: function(rt){ var d = rt.dev("R-East"); return addr(d, "g0/1", "10.0.0.2", 30) && addr(d, "g0/0", "192.168.20.1", 24); } },
    { id: "roads", text: "Each router needs the road to the other side's lamp network",
      test: function(rt){ return hasRoute(rt.dev("R-West"), "192.168.20.0", 24) && hasRoute(rt.dev("R-East"), "192.168.10.0", 24); } },
    { id: "gate", text: "Lamp A cannot even reach its own door (192.168.10.1). Something about its port is wrong.",
      test: function(rt){ return NET.canReach(rt.dev("Lamp A"), "192.168.10.1"); } },
    { id: "talk", text: "Lamp A and Lamp B must be able to reach each other", test: function(rt){ return NET.canReach(rt.dev("Lamp A"), "192.168.20.10"); } },
    { id: "write", text: "Write it down. Save the running orders to the startup orders on both routers.",
      test: function(rt){ return saved(rt.dev("R-West")) && saved(rt.dev("R-East")); } }
  ],
  traps: ["cut"],
  reward: { clean: 150, rough: 100, botched: 40 }
};

/* ====================================================================================
   What the strays want. Each is a short job: the label is the problem, `seq` is the exact
   command (or commands, in order) that ends it.
   ==================================================================================== */
root.POOLS = {
  A: [
    { kind: "mote", seq: ["show ip interface brief"], label: "Which command gives a brief summary of every interface?" },
    { kind: "mote", seq: ["show version"], label: "Which command shows the IOS version and uptime?" },
    { kind: "mote", seq: ["show running-config"], label: "Which command shows the current running configuration?" },
    { kind: "mote", seq: ["show ip route"], label: "Which command shows the routing table?" },
    { kind: "mote", seq: ["show arp"], label: "Which command shows the ARP table?" },
    { kind: "mote", seq: ["show startup-config"], label: "Which command shows the saved startup configuration?" },
    { kind: "mote", seq: ["ping 10.1.0.2"], label: "Test whether 10.1.0.2 is reachable" },
    { kind: "mote", seq: ["show history"], label: "Which command lists the commands you typed recently?" },
    { kind: "mote", seq: ["show interfaces description"], label: "Which command shows each interface's description?" },
    { kind: "mote", seq: ["show interfaces gigabitethernet0/0"], label: "Which command shows detailed status and counters for Gi0/0?" }
  ],
  B: [
    { kind: "crawler", seq: ["configure terminal", "hostname karrow", "end"], label: "Set the hostname to karrow" },
    { kind: "crawler", seq: ["configure terminal", "interface gigabitethernet0/1", "no shutdown", "end"], label: "Bring interface Gi0/1 up" },
    { kind: "crawler", seq: ["configure terminal", "interface gigabitethernet0/0", "description gate", "end"], label: "Give Gi0/0 the description gate" },
    { kind: "crawler", seq: ["configure terminal", "interface gigabitethernet0/2", "ip address 10.2.0.1 255.255.255.0", "end"], label: "Give Gi0/2 the address 10.2.0.1 255.255.255.0" },
    { kind: "crawler", seq: ["configure terminal", "ip route 10.5.0.0 255.255.255.0 10.1.0.2", "end"], label: "Add a static route to 10.5.0.0/24 via 10.1.0.2" },
    { kind: "crawler", seq: ["configure terminal", "no ip domain-lookup", "end"], label: "Turn off DNS lookup so typos don't hang the console" },
    { kind: "crawler", seq: ["configure terminal", "service password-encryption", "end"], label: "Encrypt the plain-text passwords in the config" }
  ],
  C: [
    { kind: "hulk", seq: ["configure terminal", "interface gigabitethernet0/1", "ip address 10.3.0.1 255.255.255.252", "no shutdown", "end"], label: "Give Gi0/1 the address 10.3.0.1/30 and bring it up" },
    { kind: "hulk", seq: ["configure terminal", "line vty 0 4", "password hold", "login", "end"], label: "Set the VTY lines 0-4 to password hold and require login" },
    { kind: "hulk", seq: ["configure terminal", "enable secret keep", "service password-encryption", "end"], label: "Set the enable secret to keep and encrypt plain-text passwords" }
  ]
};


/* ====================================================================================
   The practice lodge: optional rooms for DTP, VTP and spanning tree (Jeremy's days 19-21).
   They pay marks and teach; the story does not depend on them.
   ==================================================================================== */
function sw2(t, names){ names.forEach(function(n){ t.add(NET.makeSwitch(n)); }); }

ROOMS.p_trunk = {
  id: "p_trunk", ep: 5, map: "p1", type: "puzzle", name: "The Two Doors",
  build: function(){
    var t = new NET.Topo();
    sw2(t, ["Left", "Right"]); pc(t, "West", "10.20.0.10"); pc(t, "East", "10.20.0.20");
    t.link("West", "Fa0", "Left", "Fa0/1"); t.link("East", "Fa0", "Right", "Fa0/1"); t.link("Left", "Gi0/1", "Right", "Gi0/1");
    ["Left", "Right"].forEach(function(n){ setup(t.devices[n], ["conf t", "vlan 20", "int fa0/1", "switchport mode access", "switchport access vlan 20", "end"]); });
    return { topo: t, order: ["Left", "Right"], start: { Left: "priv", Right: "priv" } };
  },
  goals: [
    { id: "trunk", text: "The cable between the doors (GigabitEthernet0/1 on each) is waiting for the other to ask first. Make it carry more than one VLAN.",
      test: function(rt){ var f = rt.dev("Left").findIface("gi0/1"); return NET.isUp(f) && NET.opMode(f) === "trunk"; } },
    { id: "talk", text: "West and East (10.20.0.20) must be able to reach each other", test: function(rt){ return NET.canReach(rt.dev("West"), "10.20.0.20"); } }
  ],
  traps: [], reward: { clean: 30, rough: 20, botched: 8 }
};

ROOMS.p_vtp = {
  id: "p_vtp", ep: 5, map: "p2", type: "puzzle", name: "The Ledger Room",
  build: function(){
    var t = new NET.Topo();
    sw2(t, ["Keeper", "Copyist"]);
    t.link("Keeper", "Gi0/1", "Copyist", "Gi0/1");
    /* The Copyist is set up first, under its wrong name, so it never hears the Keeper's ledger. */
    setup(t.devices.Copyist, ["conf t", "vtp domain karroww", "int gi0/1", "switchport mode trunk", "end"]);
    setup(t.devices.Keeper, ["conf t", "vtp domain karrow", "int gi0/1", "switchport mode trunk", "exit", "vlan 10", "name mill", "vlan 20", "name store", "vlan 30", "name archive", "end"]);
    return { topo: t, order: ["Keeper", "Copyist"], start: { Keeper: "priv", Copyist: "priv" } };
  },
  goals: [
    { id: "dom", text: "The Copyist is listening under the wrong name. The Keeper's VTP domain is \"karrow\". Fix the Copyist's.", test: function(rt){ return rt.dev("Copyist").vtp.domain === "karrow"; } },
    { id: "client", text: "The Copyist should only copy, never write. Make it a VTP client.", test: function(rt){ return rt.dev("Copyist").vtp.mode === "client"; } },
    { id: "copied", text: "The Copyist must end up holding VLAN 30, named \"archive\", without being told about it directly.",
      test: function(rt){ var v = rt.dev("Copyist").vlans[30]; return !!v && v.name === "archive"; } }
  ],
  traps: [], reward: { clean: 35, rough: 22, botched: 8 }
};

ROOMS.p_root = {
  id: "p_root", ep: 5, map: "p3", type: "puzzle", name: "The Rope Ring",
  build: function(){
    var t = new NET.Topo();
    sw2(t, ["Keystone", "Rim", "Sill"]);
    t.link("Keystone", "Fa0/1", "Rim", "Fa0/1"); t.link("Rim", "Fa0/2", "Sill", "Fa0/1"); t.link("Sill", "Fa0/2", "Keystone", "Fa0/2");
    ["Keystone", "Rim", "Sill"].forEach(function(n){ setup(t.devices[n], ["conf t", "int range fa0/1 - 2", "switchport mode trunk", "end"]); });
    setup(t.devices.Sill, ["conf t", "spanning-tree vlan 1 priority 4096", "end"]);
    return { topo: t, order: ["Keystone", "Rim", "Sill"], start: { Keystone: "priv", Rim: "priv", Sill: "priv" } };
  },
  goals: [
    { id: "root", text: "Sill is carrying the weight of VLAN 1. Make Keystone the root bridge instead.", test: function(rt){ var e = NET.stp(rt.dev("Keystone"), 1); return !!e && e.isRoot; } },
    { id: "rapid", text: "Switch all three posts to rapid spanning tree (rapid-pvst)", test: function(rt){ return ["Keystone", "Rim", "Sill"].every(function(n){ return rt.dev(n).stp.mode === "rapid-pvst"; }); } }
  ],
  traps: [], reward: { clean: 35, rough: 22, botched: 8 }
};

ROOMS.p_guard = {
  id: "p_guard", ep: 5, map: "p4", type: "puzzle", name: "The Quiet Ports",
  build: function(){
    var t = new NET.Topo();
    sw2(t, ["Gate", "Over", "Stray"]); pc(t, "Clerk", "10.30.0.10"); pc(t, "Porter", "10.30.0.11");
    t.link("Clerk", "Fa0", "Gate", "Fa0/1"); t.link("Porter", "Fa0", "Gate", "Fa0/2"); t.link("Stray", "Fa0/1", "Gate", "Fa0/3"); t.link("Gate", "Gi0/1", "Over", "Gi0/1");
    setup(t.devices.Gate, ["conf t", "int range fa0/1 - 4", "switchport mode access", "exit", "int gi0/1", "switchport mode trunk", "end"]);
    return { topo: t, order: ["Gate"], start: { Gate: "priv" } };
  },
  goals: [
    { id: "fast", text: "Fa0/1 through Fa0/4 are where ordinary people plug in. Let them skip the wait (PortFast).",
      test: function(rt){ var d = rt.dev("Gate"); return [1, 2, 3, 4].every(function(n){ return d.findIface("fa0/" + n).stp.portfast; }); } },
    { id: "guard", text: "...and shut any of them the moment something that speaks spanning tree is plugged in (BPDU guard on those four)",
      test: function(rt){ var d = rt.dev("Gate"); return [1, 2, 3, 4].every(function(n){ return d.findIface("fa0/" + n).stp.bpduguard === true; }); } },
    { id: "caught", text: "Something that is not a person is already plugged into Fa0/3. It should now be caught.",
      test: function(rt){ return rt.dev("Gate").findIface("fa0/3").errdisabled; } },
    { id: "clerk", keep: true, text: "The Clerk and the Porter must still be able to reach each other", test: function(rt){ return NET.canReach(rt.dev("Clerk"), "10.30.0.11"); } }
  ],
  traps: [
    { id: "uplink", msg: "The uplink goes quiet.", test: function(rt){ var f = rt.dev("Gate").findIface("gi0/1"); return f.errdisabled || f.adminDown; } }
  ],
  reward: { clean: 40, rough: 25, botched: 10 }
};

ROOMS.p_drill = {
  id: "p_drill", ep: 5, map: "p5", type: "defense", name: "The Drill Yard",
  arena: function(){
    var t = new NET.Topo();
    sw2(t, ["Gatewatch", "Far"]);
    t.link("Gatewatch", "Gi0/1", "Far", "Gi0/1");
    setup(t.devices.Gatewatch, ["conf t", "vlan 10", "name mill", "vlan 20", "name store", "int gi0/1", "switchport mode trunk", "end"]);
    return t;
  },
  targets: [{ id: "ward", hp: 4 }],
  waves: [{ n: 4, pool: "D", gap: 6, speed: 10 }, { n: 4, pool: "E", gap: 7, speed: 9 }, { n: 2, pool: "F", gap: 10, speed: 7 }],
  reward: { clean: 60, rough: 38, botched: 15 }
};

root.POOLS.D = [
  { kind: "mote", seq: ["show vlan brief"], label: "Which command shows every VLAN and its ports, in brief?" },
  { kind: "mote", seq: ["show interfaces trunk"], label: "Which command shows the trunk ports and the VLANs they carry?" },
  { kind: "mote", seq: ["show spanning-tree"], label: "Which command shows spanning-tree status for every VLAN?" },
  { kind: "mote", seq: ["show vtp status"], label: "Which command shows the VTP mode, domain and revision?" },
  { kind: "mote", seq: ["show mac address-table"], label: "Which command shows the MAC address table?" },
  { kind: "mote", seq: ["show interfaces status"], label: "Which command shows every port's status, VLAN and speed?" },
  { kind: "mote", seq: ["show spanning-tree summary"], label: "Which command gives a short spanning-tree summary?" },
  { kind: "mote", seq: ["show spanning-tree root"], label: "Which command shows the root bridge for each VLAN?" }
];
root.POOLS.E = [
  { kind: "crawler", seq: ["configure terminal", "vlan 50", "name mill", "end"], label: "Create VLAN 50 and name it mill" },
  { kind: "crawler", seq: ["configure terminal", "spanning-tree vlan 10 priority 4096", "end"], label: "Set VLAN 10's spanning-tree priority to 4096" },
  { kind: "crawler", seq: ["configure terminal", "interface fastethernet0/5", "spanning-tree portfast", "end"], label: "Enable PortFast on Fa0/5" },
  { kind: "crawler", seq: ["configure terminal", "interface fastethernet0/6", "switchport mode access", "end"], label: "Make Fa0/6 an access port" },
  { kind: "crawler", seq: ["configure terminal", "interface fastethernet0/7", "switchport access vlan 10", "end"], label: "Put Fa0/7 in VLAN 10" },
  { kind: "crawler", seq: ["configure terminal", "spanning-tree mode rapid-pvst", "end"], label: "Switch spanning tree to rapid PVST" },
  { kind: "crawler", seq: ["configure terminal", "vtp mode transparent", "end"], label: "Set the VTP mode to transparent" }
];
root.POOLS.F = [
  { kind: "hulk", seq: ["configure terminal", "interface gigabitethernet0/1", "switchport mode trunk", "switchport trunk allowed vlan 10,20", "end"], label: "Make Gi0/1 a trunk allowing only VLANs 10 and 20" },
  { kind: "hulk", seq: ["configure terminal", "interface fastethernet0/8", "switchport mode access", "switchport access vlan 20", "spanning-tree portfast", "end"], label: "Make Fa0/8 an access port in VLAN 20 with PortFast" },
  { kind: "hulk", seq: ["configure terminal", "vtp domain gate", "vtp mode transparent", "end"], label: "Set the VTP domain to gate and the mode to transparent" }
];

})(typeof window !== "undefined" ? window : globalThis);

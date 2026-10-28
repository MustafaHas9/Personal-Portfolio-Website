/* Pack 2: DTP and VTP (Jeremy's IT Lab day 19).
   DTP is already in the switchport commands of pack 1 (dynamic auto / desirable / nonegotiate); this
   adds the VTP commands and the show commands that let you see what was negotiated. */
(function(root){
"use strict";

var IOS = root.IOS, NET = root.NET, define = IOS.define, W = IOS.WORDHELP;
var CFG = ["config"], EXEC = ["user", "priv"];
var isSwitch = function(c){ return c.dev.kind === "switch"; };

[["vtp", "Configure VLAN Trunking Protocol"], ["domain", "Set the name of the VTP administrative domain"], ["pruning", "Set the administrative domain to permit pruning"],
 ["dtp", "Show DTP information"], ["status", "VTP domain status"]].forEach(function(p){ if(!W[p[0]]) W[p[0]] = p[1]; });

function pad(s, n){ s = String(s); while(s.length < n) s += " "; return s; }
var MODE_NAME = { server: "SERVER", client: "CLIENT", transparent: "TRANSPARENT", off: "OFF" };

define({ modes: CFG, when: isSwitch, syntax: "vtp mode server|client|transparent|off", help: "Set the device to client, server, transparent or off mode", run: function(c){
  var m = c.line.trim().split(/\s+/).pop().toLowerCase();
  c.dev.vtp.mode = m;
  c.print("Setting device to VTP " + MODE_NAME[m] + " mode" + (m === "off" ? "." : " for VLANS."));
} });
define({ modes: CFG, when: isSwitch, syntax: "vtp domain <n:word>", help: "Set the name of the VTP administrative domain", paramHelp: { n: "The ascii name for the VTP administrative domain" }, run: function(c){
  var v = c.dev.vtp;
  if(v.domain !== c.args.n){
    c.print("Changing VTP domain name from " + (v.domain || "NULL") + " to " + c.args.n);
    v.domain = c.args.n; v.revision = 0;
  }
} });
define({ modes: CFG, when: isSwitch, syntax: "vtp password <pw:word>", help: "Set the password for the VTP administrative domain", paramHelp: { pw: "The ascii name for the VTP administrative domain" }, run: function(c){
  c.dev.vtp.password = c.args.pw;
  c.print("Setting device VLAN database password to " + c.args.pw);
} });
define({ modes: CFG, when: isSwitch, syntax: "no vtp password", help: "Set the password for the VTP administrative domain", run: function(c){
  c.dev.vtp.password = null;
  c.print("Clearing device VLAN database password.");
} });
define({ modes: CFG, when: isSwitch, syntax: "vtp version 1|2|3", help: "Set the administrative domain VTP version", run: function(c){
  c.dev.vtp.version = +c.line.trim().split(/\s+/).pop();
} });
define({ modes: CFG, when: isSwitch, syntax: "vtp pruning", help: "Set the administrative domain to permit pruning", run: function(c){ c.dev.vtp.pruning = true; } });
W.version = W.version || "Set the administrative domain VTP version";

define({ modes: EXEC, when: isSwitch, syntax: "show vtp status", help: "VTP domain status", run: function(c){
  var d = c.dev, v = d.vtp, count = Object.keys(d.vlans).length + [1002, 1003, 1004, 1005].filter(function(x){ return !d.vlans[x]; }).length;
  c.print("VTP Version capable             : 1 to 3");
  c.print("VTP version running             : " + v.version);
  c.print("VTP Domain Name                 : " + (v.domain || ""));
  c.print("VTP Pruning Mode                : " + (v.pruning ? "Enabled" : "Disabled"));
  c.print("VTP Traps Generation            : Disabled");
  c.print("Device ID                       : " + d.ifaces[0].mac);
  c.print("Configuration last modified by 0.0.0.0 at 3-1-93 00:00:00");
  c.print("");
  c.print("Feature VLAN:");
  c.print("--------------");
  c.print("VTP Operating Mode                : " + { server: "Server", client: "Client", transparent: "Transparent", off: "Off" }[v.mode]);
  c.print("Maximum VLANs supported locally   : 255");
  c.print("Number of existing VLANs          : " + count);
  c.print("Configuration Revision            : " + v.revision);
  c.print("MD5 digest                        : 0x57 0xCD 0x40 0x65 0x63 0x59 0x47 0xBD");
} });

function dtpInfo(c, f){
  var op = NET.opMode(f), mode = f.sw.mode;
  var admin = mode === "trunk" ? "ON" : mode === "access" ? "OFF" : mode === "dynamic auto" ? "AUTO" : "DESIRABLE";
  var tos = op === "trunk" ? "TRUNK" : "ACCESS", tns = op === "trunk" ? "TRUNK" : "ACCESS";
  var neg = f.sw.nonegotiate ? "no" : "yes";
  c.print("DTP information for " + f.name + ":");
  c.print("  TOS/TAS/TNS:                                " + tos + "/" + admin + "/" + tns);
  c.print("  TOT/TAT/TNT:                                " + (op === "trunk" ? "802.1Q" : "NATIVE") + "/" + (op === "trunk" ? "802.1Q" : "NATIVE") + "/" + (op === "trunk" ? "802.1Q" : "NATIVE"));
  c.print("  Neighbor address 1:                         " + (f.peer && f.peer.sw ? f.peer.mac : "000000000000"));
  c.print("  Enabled:                                    " + neg);
  c.print("  In STP:                                     no");
}
define({ modes: EXEC, when: isSwitch, syntax: "show dtp interface <i:iface>", help: "DTP interface information", paramHelp: { i: "Interface" }, run: function(c){
  if(!c.args.i.sw){ c.print("% Interface does not exist or is not a switchport"); return; }
  dtpInfo(c, c.args.i);
} });
define({ modes: EXEC, when: isSwitch, syntax: "show dtp", help: "DTP information", run: function(c){
  c.print("Global DTP information");
  c.print("    Sending DTP Hello packets every 30 seconds");
  c.print("    Dynamic Trunk timeout is 300 seconds");
  var n = c.dev.ifaces.filter(function(f){ return f.sw && NET.opMode(f) === "trunk" && NET.linkUp(f); }).length;
  c.print("    " + n + " interfaces using DTP");
} });

})(typeof window !== "undefined" ? window : globalThis);

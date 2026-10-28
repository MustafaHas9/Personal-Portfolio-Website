/* The IOS command engine: modes, a command tree, abbreviations, Tab completion, "?" help and
   the real error messages. Commands are data (a syntax string plus a function), so adding one
   never means touching the parser, and "?" and Tab come for free from the same tree.

   Works in the browser and in Node (the tests load it with no DOM). */
(function(root){
"use strict";

var IOS = root.IOS = {};

/* One-line help for a keyword when it is not the last word of a command. A command's own
   `help` is used for its last word. */
var WORDHELP = IOS.WORDHELP = {};

/* ---------- parameter types ---------- */
function isIp(s){
  var p = s.split(".");
  if(p.length !== 4) return false;
  return p.every(function(x){ return /^\d{1,3}$/.test(x) && +x <= 255; });
}
function ip2n(s){ return s.split(".").reduce(function(a, b){ return a * 256 + (+b); }, 0); }
function isMask(s){
  if(!isIp(s)) return false;
  var n = ip2n(s), seenZero = false;
  for(var i = 31; i >= 0; i--){
    var bit = Math.floor(n / Math.pow(2, i)) % 2;
    if(bit === 0) seenZero = true; else if(seenZero) return false;
  }
  return true;
}
IOS.isIp = isIp;
IOS.isMask = isMask;

var TYPES = {
  ip:   { label: "A.B.C.D", help: "IP address",
          match: function(t){ return isIp(t.text) ? { used: 1, value: t.text } : null; } },
  mask: { label: "A.B.C.D", help: "IP subnet mask",
          match: function(t){ return isMask(t.text) ? { used: 1, value: t.text } : null; } },
  int:  { label: "<n>", help: "Number",
          match: function(t, toks, i, ctx, p){
            if(!/^\d+$/.test(t.text)) return null;
            var n = +t.text, r = p.arg ? p.arg.split("-") : null;
            if(r && (n < +r[0] || n > +r[1])) return null;
            return { used: 1, value: n };
          } },
  word: { label: "WORD", help: "Text",
          match: function(t){ return { used: 1, value: t.text }; } },
  rest: { label: "LINE", help: "Text",
          match: function(t, toks, i, ctx, p, line){
            return { used: toks.length - i, value: line.slice(t.start).trim() };
          } },
  vlanlist: { label: "WORD", help: "VLAN IDs, like 10,20,30-40",
          match: function(t){ return /^\d+([-,]\d+)*$/.test(t.text) ? { used: 1, value: t.text } : null; } },
  iface: { label: "<interface>", help: "Interface",
          match: function(t, toks, i, ctx){
            if(!ctx.dev) return null;
            var f = ctx.dev.findIface(t.text);
            if(f) return { used: 1, value: f };
            if(toks[i + 1]){ f = ctx.dev.findIface(t.text + toks[i + 1].text); if(f) return { used: 2, value: f }; }
            return null;
          } },
  /* Like iface, but also accepts one that can be created (a VLAN interface, a loopback, a
     subinterface). Parsing never creates anything; the command that runs does. */
  ifacec: { label: "<interface>", help: "Interface",
          match: function(t, toks, i, ctx){
            if(!ctx.dev) return null;
            var f = ctx.dev.findIface(t.text), c;
            if(f) return { used: 1, value: f };
            c = ctx.dev.creatable(t.text);
            if(c) return { used: 1, value: { create: c } };
            if(toks[i + 1]){
              var j = t.text + toks[i + 1].text;
              f = ctx.dev.findIface(j);
              if(f) return { used: 2, value: f };
              c = ctx.dev.creatable(j);
              if(c) return { used: 2, value: { create: c } };
            }
            return null;
          } },
  ifrange: { label: "<interface range>", help: "Interface range",
          match: function(t, toks, i, ctx, p, line){
            if(!ctx.dev) return null;
            var list = ctx.dev.parseRange(line.slice(t.start).trim());
            return list ? { used: toks.length - i, value: list } : null;
          } }
};

/* ---------- the command tree ---------- */
var trees = IOS.trees = {};
function newNode(){ return { lit: {}, params: [], cmds: [], help: "" }; }

function expand(syntax){
  /* "switchport mode access|trunk" becomes one syntax per alternative. */
  var words = syntax.split(/\s+/), out = [[]];
  words.forEach(function(w){
    if(w.charAt(0) !== "<" && w.indexOf("|") > -1){
      var next = [];
      w.split("|").forEach(function(alt){ out.forEach(function(p){ next.push(p.concat([alt])); }); });
      out = next;
    } else out = out.map(function(p){ return p.concat([w]); });
  });
  return out;
}

/* spec: { modes: [..], syntax: "show ip route" | [..], help, when(ctx), run(c) }
   Parameters are written <name:type> or <name:type:arg>, like <vlan:int:1-4094>. */
IOS.define = function(spec){
  var syntaxes = [].concat(spec.syntax);
  syntaxes.forEach(function(s){
    expand(s).forEach(function(words){
      spec.modes.forEach(function(mode){
        var node = trees[mode] || (trees[mode] = newNode()), lastLit = null;
        words.forEach(function(w, idx){
          var last = idx === words.length - 1;
          if(w.charAt(0) === "<"){
            var parts = w.slice(1, -1).split(":"), name = parts[0], type = parts[1], arg = parts[2] || "";
            if(!TYPES[type]) throw new Error("unknown parameter type " + type + " in: " + s);
            var found = null;
            node.params.forEach(function(p){ if(p.param.name === name && p.param.type === type && p.param.arg === arg) found = p; });
            if(!found){
              found = newNode();
              found.param = { name: name, type: type, arg: arg,
                label: type === "int" && arg ? "<" + arg + ">" : TYPES[type].label,
                help: (spec.paramHelp && spec.paramHelp[name]) || TYPES[type].help };
              node.params.push(found);
            }
            if(last && spec.paramHelp && spec.paramHelp[name]) found.param.help = spec.paramHelp[name];
            node = found;
          } else {
            var key = w.toLowerCase();
            if(!node.lit[key]){ node.lit[key] = newNode(); node.lit[key].word = key; }
            node = node.lit[key]; lastLit = node;
            if(last) node.help = spec.help || node.help;
            else if(!node.help) node.help = WORDHELP[key] || "";
          }
        });
        /* A command that ends in a value ("ping <A.B.C.D>") still describes its last keyword. */
        if(lastLit && !lastLit.help && spec.help) lastLit.help = spec.help;
        node.cmds.push({ run: spec.run, when: spec.when || null, help: spec.help || "" });
      });
    });
  });
};

function usable(cmd, ctx){ return !cmd.when || cmd.when(ctx); }
function reachable(node, ctx){
  var i, k;
  for(i = 0; i < node.cmds.length; i++) if(usable(node.cmds[i], ctx)) return true;
  for(k in node.lit) if(reachable(node.lit[k], ctx)) return true;
  for(i = 0; i < node.params.length; i++) if(reachable(node.params[i], ctx)) return true;
  return false;
}

function tokenize(line){
  var re = /\S+/g, m, out = [];
  while((m = re.exec(line))) out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  return out;
}

/* Walk typed words down the tree. Returns { ok, cmd, args } or { err, at } where `at` is the
   index of the word that failed. */
function walk(rootNode, toks, line, ctx, stopAfter){
  var node = rootNode, args = {}, i = 0, end = stopAfter == null ? toks.length : stopAfter, path = [];
  while(i < end){
    var t = toks[i], low = t.text.toLowerCase();
    var lits = Object.keys(node.lit).filter(function(k){ return reachable(node.lit[k], ctx); });
    var cands = lits.indexOf(low) > -1 ? [low] : lits.filter(function(k){ return k.indexOf(low) === 0; });
    if(cands.length === 1){ node = node.lit[cands[0]]; path.push(cands[0]); i++; continue; }
    if(cands.length > 1) return { err: "ambiguous", at: i };
    var hit = false;
    for(var j = 0; j < node.params.length; j++){
      var pn = node.params[j];
      if(!reachable(pn, ctx)) continue;
      var m = TYPES[pn.param.type].match(t, toks, i, ctx, pn.param, line);
      if(m){
        args[pn.param.name] = m.value;
        /* interfaces are spelled out in full so "g0/1" and "GigabitEthernet0/1" compare equal */
        var v = m.value;
        path.push(v && v.name ? v.name : v && v.create ? v.create.type + v.create.num : toks.slice(i, i + m.used).map(function(x){ return x.text; }).join(" "));
        node = pn; i += m.used; hit = true; break;
      }
    }
    if(!hit) return { err: "invalid", at: i };
  }
  if(stopAfter != null) return { ok: true, node: node, args: args, path: path };
  var cmd = null;
  node.cmds.forEach(function(c){ if(!cmd && usable(c, ctx)) cmd = c; });
  if(!cmd) return { err: "incomplete", node: node };
  return { ok: true, cmd: cmd, args: args, node: node, path: path };
}

/* Everything that can come next after `node`, as [word, help] pairs. */
function options(node, ctx){
  var out = [];
  Object.keys(node.lit).sort().forEach(function(k){
    if(reachable(node.lit[k], ctx)) out.push([k, node.lit[k].help || WORDHELP[k] || ""]);
  });
  node.params.forEach(function(p){ if(reachable(p, ctx)) out.push([p.param.label, p.param.help]); });
  if(node.cmds.some(function(c){ return usable(c, ctx); })) out.push(["<cr>", ""]);
  return out;
}

/* ---------- sessions ---------- */
var SUFFIX = {
  "user": ">", "priv": "#", "config": "(config)#", "config-if": "(config-if)#",
  "config-if-range": "(config-if-range)#", "config-line": "(config-line)#",
  "config-vlan": "(config-vlan)#", "config-subif": "(config-subif)#", "config-router": "(config-router)#"
};

IOS.Session = function(dev, topo, startMode){
  this.dev = dev; this.topo = topo || null;
  this.mode = startMode || "user";
  this.cur = null;        // what a config submode is editing: interfaces, a vlan, a line
  this.history = [];
};
var S = IOS.Session.prototype;

S.prompt = function(){ return this.dev.hostname + SUFFIX[this.mode]; };
S.ctx = function(){ return { dev: this.dev, topo: this.topo, session: this, mode: this.mode, cur: this.cur }; };

/* Global config commands also work from inside a submode, and move you back to (config). */
S._trees = function(){
  var list = [this.mode];
  if(this.mode.indexOf("config-") === 0) list.push("config");
  return list;
};

/* A command can ask for a hidden line (a password) by setting session.pending to a function that
   receives it and returns text to print. session.pendingPrompt is what the terminal shows. */
S.exec = function(line, base){
  var self = this, toks = tokenize(line);
  base = base || 0;
  if(this.pending){
    var h = this.pending;
    this.pending = null; this.pendingPrompt = "";
    return h(line) || "";
  }
  if(!toks.length) return "";
  if(base === 0) this.history.push(line.trim());
  var ctx = this.ctx(), trees_ = this._trees(), first = null, used = null, i, res;
  for(i = 0; i < trees_.length; i++){
    var tree = trees[trees_[i]];
    if(!tree) continue;
    res = walk(tree, toks, line, ctx);
    if(!first) first = res;
    if(res.ok){ used = { r: res, mode: trees_[i] }; break; }
    if(!(res.err === "invalid" && res.at === 0)) break;   // only fall back when the very first word is unknown
  }
  if(used){
    if(used.mode !== this.mode){ this.mode = used.mode; this.cur = null; }
    var out = [];
    var c = {
      dev: this.dev, topo: this.topo, session: this, args: used.r.args, line: line,
      cur: this.cur, mode: this.mode,
      print: function(s){ out.push(s); },
      enter: function(mode, cur){ self.mode = mode; self.cur = cur || null; c.cur = self.cur; c.mode = mode; }
    };
    used.r.cmd.run(c);
    /* things that react to a change on any device (spanning tree, VTP) hook in here */
    if(IOS.hooks) IOS.hooks.forEach(function(h){ h(c); });
    return out.join("\n");
  }
  var pad = function(n){ return new Array(n + 1).join(" "); };
  var promptLen = this.prompt().length + base;
  if(first.err === "invalid")
    return pad(promptLen + toks[first.at].start) + "^\n% Invalid input detected at '^' marker.";
  if(first.err === "ambiguous")
    return "% Ambiguous command:  \"" + line.slice(0, toks[first.at].end).trim() + "\"";
  return "% Incomplete command.";
};

/* The full, unabbreviated form of a typed line ("sh ip int br" becomes "show ip interface brief"),
   or null if it is not a valid command in the current mode. The game uses this to match what
   the player typed against the command a room or an enemy is asking for. */
S.canon = function(line){
  var toks = tokenize(line);
  if(!toks.length) return null;
  var ctx = this.ctx(), list = this._trees();
  for(var i = 0; i < list.length; i++){
    if(!trees[list[i]]) continue;
    var r = walk(trees[list[i]], toks, line, ctx);
    if(r.ok) return r.path.join(" ").toLowerCase();
  }
  return null;
};

/* Tab: finish the word under the cursor if only one command starts that way. */
S.tab = function(line){
  if(!line || /\s$/.test(line)) return line;
  var toks = tokenize(line), last = toks[toks.length - 1], ctx = this.ctx(), trees_ = this._trees();
  for(var i = 0; i < trees_.length; i++){
    var r = walk(trees[trees_[i]], toks, line, ctx, toks.length - 1);
    if(!r.ok) continue;
    var low = last.text.toLowerCase();
    var cands = Object.keys(r.node.lit).filter(function(k){ return k.indexOf(low) === 0 && reachable(r.node.lit[k], ctx); });
    if(cands.length === 1) return line.slice(0, last.start) + cands[0] + " ";
  }
  return line;
};

/* "?": with a space before it, list what can come next; right after a word, list the words that
   start that way. */
S.help = function(line){
  var ctx = this.ctx(), trees_ = this._trees(), i;
  var toks = tokenize(line), partial = line.length > 0 && !/\s$/.test(line);
  var stop = partial ? toks.length - 1 : toks.length, node = null, seen = {}, opts = [];
  var anyWalk = false;
  for(i = 0; i < trees_.length; i++){
    var r = walk(trees[trees_[i]], toks, line, ctx, stop);
    if(!r.ok) continue;
    anyWalk = true;
    if(partial){
      var low = toks[toks.length - 1].text.toLowerCase();
      Object.keys(r.node.lit).sort().forEach(function(k){
        if(k.indexOf(low) === 0 && reachable(r.node.lit[k], ctx) && !seen[k]){ seen[k] = 1; opts.push([k, ""]); }
      });
    } else {
      options(r.node, ctx).forEach(function(o){ if(!seen[o[0]]){ seen[o[0]] = 1; opts.push(o); } });
    }
  }
  if(!anyWalk || !opts.length) return "% Unrecognized command";
  if(partial) return opts.map(function(o){ return o[0]; }).join("  ");
  var w = Math.max.apply(null, opts.map(function(o){ return o[0].length; })) + 2;
  return opts.map(function(o){ return "  " + o[0] + new Array(Math.max(1, w - o[0].length) + 1).join(" ") + o[1]; })
    .map(function(l){ return l.replace(/\s+$/, ""); }).join("\n");
};

/* Leave the current mode one level, the way "exit" does. */
S.up = function(){
  var m = this.mode;
  if(m === "priv") this.mode = "user";
  else if(m === "config") this.mode = "priv";
  else if(m.indexOf("config-") === 0) this.mode = "config";
  this.cur = null;
};

})(typeof window !== "undefined" ? window : globalThis);

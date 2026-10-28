/* Tests for the game's rooms: each puzzle starts unsolved and the intended solution solves it, each
   trap fires on the thing it guards against, and every enemy's commands are ones the engine
   really accepts. Run with `npm run test:cli`. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const base = fileURLToPath(new URL('../../public/learn/conf-t/js/', import.meta.url));
for (const f of ['ios.js', 'net.js', 'l2.js', 'packs/basics.js', 'packs/vtp.js', 'packs/stp.js', 'game/maps.js', 'game/rooms.js']) vm.runInThisContext(readFileSync(base + f, 'utf8'), { filename: f });

let fails = 0, checks = 0;
const ok = (cond, msg, extra) => { checks++; if (!cond) { fails++; console.log('FAIL:', msg, extra !== undefined ? '\n' + extra : ''); } };

function open(id) {
  const room = ROOMS[id], built = room.build();
  const sessions = {};
  built.order.forEach((n) => { sessions[n] = new IOS.Session(built.topo.devices[n], built.topo, built.start[n] || 'user'); });
  const rt = { topo: built.topo, dev: (n) => built.topo.devices[n] };
  const type = (name, lines) => lines.forEach((l) => { const out = sessions[name].exec(l); if (/^% (Invalid|Ambiguous|Incomplete)/m.test(out)) throw new Error(`${id}/${name}: "${l}" -> ${out}`); });
  const goals = () => room.goals.map((g) => [g.id, !!g.test(rt)]);
  return { room, rt, type, goals, sessions };
}
const allDone = (g) => g.every((x) => x[1]);

const SOLUTIONS = {
  gate7: (o) => o.type('Gate7', ['en', 'conf t', 'int g0/0', 'ip address 10.7.0.1 255.255.255.0', 'no shutdown', 'end']),
  corridor: (o) => { o.type('Near', ['conf t', 'ip route 10.1.2.0 255.255.255.0 10.9.0.2', 'end']); o.type('Far', ['conf t', 'ip route 10.1.1.0 255.255.255.0 10.9.0.1', 'end']); },
  warden: (o) => o.type('Ward', ['conf t', 'vlan 10', 'name warden', 'int fa0/2', 'switchport access vlan 10', 'end']),
  lift4: (o) => o.type('Cage', ['conf t', 'vlan 10', 'int gi0/1', 'switchport mode trunk', 'end']),
  nine: (o) => {
    o.type('R-West', ['en', 'conf t', 'int g0/0', 'ip address 192.168.10.1 255.255.255.0', 'no shut', 'int g0/1', 'ip address 10.0.0.1 255.255.255.252', 'no shut', 'exit', 'ip route 192.168.20.0 255.255.255.0 10.0.0.2', 'end', 'copy running-config startup-config']);
    o.type('R-East', ['en', 'conf t', 'int g0/1', 'ip address 10.0.0.2 255.255.255.252', 'no shut', 'int g0/0', 'ip address 192.168.20.1 255.255.255.0', 'no shut', 'exit', 'ip route 192.168.10.0 255.255.255.0 10.0.0.1', 'end', 'copy running-config startup-config']);
    o.type('West', ['en', 'conf t', 'int fa0/1', 'switchport access vlan 1', 'end']);
  }
};

Object.assign(SOLUTIONS, {
  p_trunk: (o) => o.type('Left', ['conf t', 'int gi0/1', 'switchport mode dynamic desirable', 'end']),
  p_vtp: (o) => o.type('Copyist', ['conf t', 'vtp domain karrow', 'vtp mode client', 'end']),
  p_root: (o) => {
    o.type('Keystone', ['conf t', 'spanning-tree vlan 1 root primary', 'spanning-tree mode rapid-pvst', 'end']);
    o.type('Rim', ['conf t', 'spanning-tree mode rapid-pvst', 'end']);
    o.type('Sill', ['conf t', 'spanning-tree mode rapid-pvst', 'end']);
  },
  p_guard: (o) => o.type('Gate', ['conf t', 'int range fa0/1 - 4', 'spanning-tree portfast', 'spanning-tree bpduguard enable', 'end'])
});

for (const id of Object.keys(SOLUTIONS)) {
  const o = open(id);
  ok(!allDone(o.goals()), `${id}: starts unsolved`, JSON.stringify(o.goals()));
  SOLUTIONS[id](o);
  ok(allDone(o.goals()), `${id}: the intended solution solves it`, JSON.stringify(o.goals()));
}

// no goal may be met before the player has typed anything, or it teaches nothing
for (const id of Object.keys(SOLUTIONS)) {
  const o = open(id);
  const keeps = o.room.goals.filter((g) => g.keep).map((g) => g.id);       // "must still work" goals are met from the start on purpose
  ok(o.goals().every((g) => keeps.includes(g[0]) || !g[1]), `${id}: every task goal starts unmet`, JSON.stringify(o.goals()));
}

// goal checks must not change anything the player can see
{
  const o = open('gate7');
  o.type('Gate7', ['en', 'conf t', 'int g0/0', 'ip address 10.7.0.1 255.255.255.0', 'no shutdown', 'end']);
  o.goals(); o.goals();
  ok(Object.keys(o.rt.dev('Gate7').arp).length === 0, 'goal checks leave the ARP table alone');
  ok(/\.!!!!/.test(o.sessions.Gate7.exec('ping 10.7.0.10')), 'the first real ping still shows the lost first echo');
}

// each fix has to be the right one: a partial solution is not a solution
{
  const o = open('corridor');
  o.type('Near', ['conf t', 'ip route 10.1.2.0 255.255.255.0 10.9.0.2', 'end']);
  ok(!allDone(o.goals()), 'corridor: one route is not enough');
  const w = open('warden');
  w.type('Ward', ['conf t', 'int fa0/2', 'switchport access vlan 10', 'end']);
  ok(w.goals().find((g) => g[0] === 'talk')[1] && !w.goals().find((g) => g[0] === 'name')[1], 'warden: lamps talk but the VLAN is still unnamed');
  const l = open('lift4');
  l.type('Cage', ['conf t', 'vlan 10', 'end']);
  ok(!l.goals().find((g) => g[0] === 'talk')[1], 'lift4: VLAN alone does not connect them without the trunk');
  l.type('Cage', ['conf t', 'int gi0/1', 'switchport mode trunk', 'switchport trunk allowed vlan 20', 'end']);
  ok(!l.goals().find((g) => g[0] === 'talk')[1], 'lift4: a trunk that does not carry VLAN 10 breaks it again');
  const trap = ROOMS.lift4.traps.find((t) => t.id === 'strip');
  ok(trap.test(l.rt), 'lift4: stripping VLAN 10 off the trunk trips the rockfall trap');
  const l2 = open('lift4');
  l2.type('Cage', ['conf t', 'int gi0/1', 'shutdown', 'end']);
  ok(ROOMS.lift4.traps.find((t) => t.id === 'cut').test(l2.rt), 'lift4: shutting the trunk trips the cut trap');
  const n = open('nine');
  ok(!n.goals().find((g) => g[0] === 'write')[1], 'nine: not saved at the start');
}

// enemies: every command is accepted, in order, and the sequence ends back in privileged mode
{
  for (const pool of Object.keys(POOLS)) {
    POOLS[pool].forEach((e, i) => {
      const built = (pool < 'D' ? ROOMS.strays : ROOMS.p_drill).arena();     // A-C use a router, D-F a switch
      const s = new IOS.Session(built.devices.Gatewatch, built, 'priv');
      let good = true, why = '';
      e.seq.forEach((line) => {
        const canon = s.canon(line);
        if (canon !== line.toLowerCase()) { good = false; why += `"${line}" canon=${canon}; `; }
        s.exec(line);
      });
      ok(good, `pool ${pool}[${i}] "${e.label}" is accepted as written`, why);
      ok(s.mode === 'priv', `pool ${pool}[${i}] leaves the slate in privileged mode`, s.mode);
    });
  }
}

// abbreviations an enemy would accept
{
  const built = ROOMS.strays.arena();
  const s = new IOS.Session(built.devices.Gatewatch, built, 'priv');
  ok(s.canon('sh ip int br') === 'show ip interface brief', 'sh ip int br matches the full command');
  ok(s.canon('SHOW   VERSION') === 'show version', 'case and spacing do not matter');
  s.exec('conf t');
  ok(s.canon('int g0/1') === 'interface gigabitethernet0/1', 'int g0/1 matches interface gigabitethernet0/1');
  ok(s.canon('int gi 0/1') === 'interface gigabitethernet0/1', 'int gi 0/1 (with a space) matches too');
}

// maps
{
  for (const k of Object.keys(ROOMS)) ok(!!MAPS[ROOMS[k].map], `${k}: its map exists`);
  for (const ep of Object.values(EPISODES)) ep.forEach((id) => ok(!!ROOMS[id], `episode room ${id} exists`));
  ok(Object.values(MAPS).every((m) => m.spawn && m.rows[m.spawn.y][m.spawn.x] && !LEG[m.rows[m.spawn.y][m.spawn.x]].s), 'every spawn point is walkable');
}

console.log(`\n${checks - fails}/${checks} checks passed${fails ? `, ${fails} FAILED` : ''}`);
process.exit(fails ? 1 : 0);

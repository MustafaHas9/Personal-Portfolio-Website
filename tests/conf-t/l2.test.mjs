/* Tests for spanning tree (pack 3) and DTP/VTP (pack 2). Run with `npm run test:cli`. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const base = fileURLToPath(new URL('../../public/learn/conf-t/js/', import.meta.url));
for (const f of ['ios.js', 'net.js', 'l2.js', 'packs/basics.js', 'packs/vtp.js', 'packs/stp.js']) vm.runInThisContext(readFileSync(base + f, 'utf8'), { filename: f });

let fails = 0, checks = 0;
const ok = (cond, msg, extra) => { checks++; if (!cond) { fails++; console.log('FAIL:', msg, extra !== undefined ? '\n' + extra : ''); } };
const has = (out, s) => out.indexOf(s) > -1;

function net(names, links, pcs = []) {
  const topo = new NET.Topo(), s = {};
  names.forEach((n) => topo.add(NET.makeSwitch(n)));
  pcs.forEach(([n, ip]) => topo.add(NET.makePC(n, ip, 24, null)));
  links.forEach((l) => topo.link(...l));
  names.forEach((n) => { s[n] = new IOS.Session(topo.devices[n], topo, 'priv'); });
  const run = (n, lines) => lines.map((l) => s[n].exec(l)).join('\n');
  return { topo, s, run, dev: (n) => topo.devices[n] };
}
const role = (t, sw, port, v = 1) => { const e = NET.stp(t.dev(sw), v); const p = e.ports.find((x) => x.f.shortName === port); return p ? p.role + '/' + p.state : null; };

// ---------- a ring of three switches ----------
function ring() {
  const t = net(['S1', 'S2', 'S3'], [['S1', 'Fa0/1', 'S2', 'Fa0/1'], ['S2', 'Fa0/2', 'S3', 'Fa0/1'], ['S3', 'Fa0/2', 'S1', 'Fa0/2']], [['A', '10.0.0.1'], ['B', '10.0.0.2']]);
  t.topo.link('A', 'Fa0', 'S1', 'Fa0/10'); t.topo.link('B', 'Fa0', 'S3', 'Fa0/10');
  ['S1', 'S2', 'S3'].forEach((n) => t.run(n, ['conf t', 'int range fa0/1 - 2', 'switchport mode trunk', 'end']));
  return t;
}
{
  const t = ring();
  ok(NET.stp(t.dev('S1'), 1).isRoot, 'S1 has the lowest MAC, so it is the root bridge');
  ok(role(t, 'S1', 'Fa0/1') === 'Desg/FWD' && role(t, 'S1', 'Fa0/2') === 'Desg/FWD', 'the root bridge has only designated ports');
  ok(role(t, 'S2', 'Fa0/1') === 'Root/FWD', 'S2 reaches the root straight through Fa0/1');
  ok(role(t, 'S3', 'Fa0/2') === 'Root/FWD', 'S3 reaches the root straight through Fa0/2');
  ok(role(t, 'S2', 'Fa0/2') === 'Desg/FWD' && role(t, 'S3', 'Fa0/1') === 'Altn/BLK', 'the loop is broken on the S3 side of the S2-S3 link (S2 has the lower bridge ID)');
  const out = t.run('S2', ['show spanning-tree vlan 1']);
  ok(has(out, 'VLAN0001') && has(out, 'Spanning tree enabled protocol ieee') && has(out, 'Root ID    Priority    32769') && has(out, 'Cost        19') && has(out, 'Port        1(FastEthernet0/1)'), 'show spanning-tree vlan 1 on a non-root', out);
  ok(has(out, 'Fa0/1               Root FWD 19        128.1    P2p') && has(out, 'Fa0/2               Desg FWD 19        128.2    P2p'), 'port table rows', out);
  ok(has(t.run('S1', ['show spanning-tree vlan 1']), 'This bridge is the root'), 'the root says so');
  t.run('A', []);
  NET.ping(t.dev('A'), '10.0.0.2'); // PCs have no sessions; just ping to learn
  ok(NET.canReach(t.dev('A'), '10.0.0.2'), 'the blocked port does not cut A off from B');

  // lowering S3's priority moves the root there
  t.run('S3', ['conf t', 'spanning-tree vlan 1 priority 4096', 'end']);
  ok(NET.stp(t.dev('S3'), 1).isRoot, 'priority 4096 makes S3 the root');
  ok(!NET.stp(t.dev('S1'), 1).isRoot, 'S1 is no longer the root');
  ok(has(t.run('S3', ['show spanning-tree vlan 1']), 'Priority    4097  (priority 4096 sys-id-ext 1)'), 'bridge priority line shows the extended system ID');
  // root primary takes the lowest priority in reach
  t.run('S2', ['conf t', 'spanning-tree vlan 1 root primary', 'end']);
  ok(t.dev('S2').stp.prio[1] === 0, 'root primary goes 4096 below the current root', String(t.dev('S2').stp.prio[1]));
  ok(NET.stp(t.dev('S2'), 1).isRoot, 'and S2 takes over');
  t.run('S2', ['conf t', 'spanning-tree vlan 1 root secondary', 'end']);
  ok(t.dev('S2').stp.prio[1] === 28672, 'root secondary is 28672');
  ok(has(t.run('S2', ['conf t', 'spanning-tree vlan 1 priority 5000']), 'must be in increments of 4096'), 'a priority that is not a multiple of 4096 is rejected');
  t.run('S2', ['end']);
}
{
  // cost decides the root port
  const t = ring();
  t.run('S2', ['conf t', 'int fa0/1', 'spanning-tree cost 100', 'end']);
  ok(role(t, 'S2', 'Fa0/2') === 'Root/FWD', 'with Fa0/1 made expensive, S2 goes to the root through S3 instead', role(t, 'S2', 'Fa0/2'));
  t.run('S2', ['conf t', 'int fa0/1', 'no spanning-tree cost', 'end']);
  ok(role(t, 'S2', 'Fa0/1') === 'Root/FWD', 'removing the cost puts it back');
  ok(has(t.run('S2', ['show spanning-tree summary']), 'Switch is in pvst mode') && has(t.run('S1', ['show spanning-tree summary']), 'Root bridge for: VLAN0001'), 'show spanning-tree summary');
  ok(has(t.run('S1', ['show spanning-tree root']), '32769 '), 'show spanning-tree root');
  t.run('S1', ['conf t', 'spanning-tree mode rapid-pvst', 'end']);
  ok(has(t.run('S1', ['show spanning-tree vlan 1']), 'protocol rstp'), 'rapid-pvst shows as rstp');
}

// ---------- the toolkit ----------
{
  const t = net(['S1', 'S2'], [['S1', 'Fa0/1', 'S2', 'Fa0/1'], ['S1', 'Fa0/10', 'S2', 'Fa0/10']]);
  const msg = t.run('S1', ['conf t', 'int fa0/10', 'spanning-tree portfast']);
  ok(has(msg, '%Warning: portfast should only be enabled on ports connected to a single'), 'portfast warning is shown');
  t.run('S1', ['spanning-tree bpduguard enable']);
  const f = t.dev('S1').findIface('fa0/10');
  ok(f.errdisabled, 'BPDU guard error-disables a PortFast port that hears a BPDU');
  ok((t.dev('S1').notices || []).some((m) => has(m, '%SPANTREE-2-BLOCK_BPDUGUARD')) && (t.dev('S1').notices || []).some((m) => has(m, 'err-disable state')), 'the console messages appear');
  t.run('S1', ['end']);
  ok(has(t.run('S1', ['show interfaces status']), 'err-disabled'), 'show interfaces status reports err-disabled');
  ok(!NET.isUp(f), 'the port is down');
  t.run('S1', ['conf t', 'int fa0/10', 'spanning-tree bpdufilter enable', 'shutdown', 'no shutdown', 'end']);
  ok(!f.errdisabled && NET.isUp(f), 'with BPDU filter on, shut/no shut brings it back and it stays up');
  ok(has(t.run('S1', ['show running-config']), 'spanning-tree bpdufilter enable') && has(t.run('S1', ['show running-config']), 'spanning-tree portfast'), 'config lines appear in running-config');
}
{
  const t = net(['S1', 'S2'], [['S1', 'Fa0/10', 'S2', 'Fa0/10']]);
  t.run('S1', ['conf t', 'spanning-tree portfast default', 'spanning-tree portfast bpduguard default', 'int fa0/10', 'switchport mode access', 'end']);
  ok(t.dev('S1').findIface('fa0/10').errdisabled, 'the global default does the same for access ports');
  ok(has(t.run('S1', ['show spanning-tree summary']), 'PortFast BPDU Guard Default  is enabled'), 'summary shows the default');
}
{
  // root guard: a better bridge behind a guarded port is ignored
  const t = net(['S1', 'S2', 'S3'], [['S1', 'Fa0/1', 'S2', 'Fa0/1'], ['S2', 'Fa0/2', 'S3', 'Fa0/1']]);
  ['S1', 'S2', 'S3'].forEach((n) => t.run(n, ['conf t', 'int range fa0/1 - 2', 'switchport mode trunk', 'end']));
  t.run('S2', ['conf t', 'int fa0/2', 'spanning-tree guard root', 'end']);
  t.run('S3', ['conf t', 'spanning-tree vlan 1 priority 0', 'end']);
  ok(NET.stp(t.dev('S1'), 1).isRoot, 'root guard keeps S1 as the root even though S3 is better');
  const p = NET.stp(t.dev('S2'), 1).ports.find((x) => x.f.shortName === 'Fa0/2');
  ok(p.inconsistent && p.state === 'BKN', 'the guarded port goes root-inconsistent');
  ok(has(t.run('S2', ['show spanning-tree vlan 1']), '*ROOT_Inc'), 'the port table flags it');
  ok(has(t.run('S2', ['show spanning-tree inconsistentports']), 'Root Inconsistent'), 'show spanning-tree inconsistentports');
  t.run('S2', ['conf t', 'int fa0/2', 'no spanning-tree guard', 'end']);
  ok(NET.stp(t.dev('S3'), 1).isRoot, 'without the guard, S3 does take over');
}

// ---------- DTP ----------
{
  const t = net(['S1', 'S2'], [['S1', 'Gi0/1', 'S2', 'Gi0/1']]);
  ok(NET.opMode(t.dev('S1').findIface('gi0/1')) === 'access', 'auto + auto stays access');
  t.run('S1', ['conf t', 'int gi0/1', 'switchport mode dynamic desirable', 'end']);
  ok(NET.opMode(t.dev('S2').findIface('gi0/1')) === 'trunk', 'desirable + auto forms a trunk');
  const d = t.run('S1', ['show dtp interface gi0/1']);
  ok(has(d, 'TOS/TAS/TNS:                                TRUNK/DESIRABLE/TRUNK'), 'show dtp interface', d);
  t.run('S2', ['conf t', 'int gi0/1', 'switchport mode access', 'end']);
  ok(NET.opMode(t.dev('S1').findIface('gi0/1')) === 'access', 'desirable + access falls back to access');
}

// ---------- VTP ----------
{
  const t = net(['S1', 'S2', 'S3'], [['S1', 'Gi0/1', 'S2', 'Gi0/1'], ['S2', 'Gi0/2', 'S3', 'Gi0/1']]);
  ['S1', 'S2'].forEach((n) => t.run(n, ['conf t', 'int range gi0/1 - 2', 'switchport mode trunk', 'end']));
  t.run('S3', ['conf t', 'int gi0/1', 'switchport mode trunk', 'end']);
  t.run('S1', ['conf t', 'vtp domain lab', 'vlan 10', 'name sales', 'vlan 20', 'name eng', 'end']);
  ok(t.dev('S1').vtp.revision >= 2, 'a server bumps its revision on every change', String(t.dev('S1').vtp.revision));
  t.run('S2', ['conf t', 'vtp mode client', 'end']);
  ok(t.dev('S2').vlans[10] && t.dev('S2').vlans[10].name === 'sales', 'a client learns VLANs from the server');
  ok(t.dev('S2').vtp.domain === 'lab', 'a client with no domain adopts the server\'s');
  ok(has(t.run('S2', ['show vtp status']), 'VTP Operating Mode                : Client') && has(t.run('S2', ['show vtp status']), 'VTP Domain Name                 : lab'), 'show vtp status');
  ok(has(t.run('S2', ['conf t', 'vlan 30']), 'VTP VLAN configuration not allowed when device is in CLIENT mode.'), 'a client cannot make VLANs');
  t.run('S2', ['end']);
  t.run('S3', ['conf t', 'vtp mode client', 'end']);
  ok(t.dev('S3').vlans[20], 'a second client further down the chain learns them too');
  t.run('S1', ['conf t', 'no vlan 20', 'end']);
  ok(!t.dev('S2').vlans[20] && !t.dev('S3').vlans[20], 'a VLAN deleted on the server disappears everywhere');
  ok(has(t.run('S1', ['show vlan brief']), 'sales'), 'show vlan brief still shows the rest');

  // password and domain have to match
  t.run('S1', ['conf t', 'vtp password secret1', 'vlan 40', 'end']);
  ok(!t.dev('S2').vlans[40], 'a server with a password does not update clients without it');
  t.run('S2', ['conf t', 'vtp password secret1', 'end']);
  t.run('S1', ['conf t', 'vlan 41', 'end']);
  ok(t.dev('S2').vlans[41], 'once the passwords match, updates flow again');
  t.run('S2', ['conf t', 'vtp domain other', 'end']);
  ok(t.dev('S2').vtp.revision === 0, 'changing the domain resets the revision to 0');
  t.run('S1', ['conf t', 'vlan 42', 'end']);
  ok(!t.dev('S2').vlans[42], 'a different domain is ignored');

  // transparent keeps its own and relays
  t.run('S3', ['conf t', 'vtp password secret1', 'end']);
  t.run('S2', ['conf t', 'vtp domain lab', 'vtp mode transparent', 'vlan 77', 'end']);
  t.run('S1', ['conf t', 'vlan 50', 'end']);
  ok(t.dev('S2').vlans[77] && !t.dev('S2').vlans[50], 'a transparent switch keeps its own VLANs and does not take the server\'s');
  ok(t.dev('S3').vlans[50], 'but it relays them on to the next switch');
}
{
  // the revision trap: a switch with a higher revision wins, even with an empty database
  const t = net(['S1', 'S2'], [['S1', 'Gi0/1', 'S2', 'Gi0/1']]);
  ['S1', 'S2'].forEach((n) => t.run(n, ['conf t', 'int gi0/1', 'switchport mode trunk', 'vtp domain lab', 'end']));
  t.run('S1', ['conf t', 'vlan 10', 'vlan 20', 'vlan 30', 'end']);
  ok(t.dev('S2').vlans[30], 'the second server gets the VLANs');
  const r = t.dev('S1').vtp.revision;
  t.run('S2', ['conf t', 'vlan 99', 'no vlan 99', 'no vlan 10', 'no vlan 20', 'no vlan 30', 'vlan 98', 'vlan 97', 'vlan 96', 'end']);
  ok(t.dev('S2').vtp.revision > r, 'S2 now has the higher revision', t.dev('S2').vtp.revision + ' vs ' + r);
  ok(!t.dev('S1').vlans[10] && t.dev('S1').vlans[98], 'and its database overwrites S1\'s');
}

console.log(`\n${checks - fails}/${checks} checks passed${fails ? `, ${fails} FAILED` : ''}`);
process.exit(fails ? 1 : 0);

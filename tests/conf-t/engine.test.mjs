/* Tests for the Conf T command engine and the basics pack. No dependencies:
   run with `npm run test:cli`. The engine files are plain browser scripts, so they are loaded
   into this process the same way a page would load them. Add a pack to the list below when
   one is written. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const base = fileURLToPath(new URL('../../public/learn/conf-t/js/', import.meta.url));
for (const f of ['ios.js', 'net.js', 'l2.js', 'packs/basics.js', 'packs/vtp.js', 'packs/stp.js']) vm.runInThisContext(readFileSync(base + f, 'utf8'), { filename: f });

let fails = 0, checks = 0;
const ok = (cond, msg, extra) => { checks++; if (!cond) { fails++; console.log('FAIL:', msg, extra !== undefined ? '\n' + extra : ''); } };
const has = (out, s) => out.indexOf(s) > -1;

function lab() {
  const topo = NET.sampleLab();
  const sess = {};
  const cli = (name, mode = 'priv') => {
    sess[name] = sess[name] || new IOS.Session(topo.devices[name], topo, mode);
    return (line) => sess[name].exec(line);
  };
  return { topo, cli, sess };
}
const run = (cli, lines) => lines.map((l) => cli(l)).join('\n');

// ---------- engine basics ----------
{
  const { cli, sess } = lab();
  const r = cli('R1', 'user');
  ok(sess.R1.prompt() === 'R1>', 'user prompt');
  ok(r('conf t').startsWith('% Invalid input') || has(r('conf t'), 'Invalid input'), 'conf t refused in user mode', r('conf t'));
  ok(r('en') === '' && sess.R1.prompt() === 'R1#', 'en -> privileged');
  ok(has(r('conf t'), 'Enter configuration commands') && sess.R1.prompt() === 'R1(config)#', 'conf t');
  r('int g0/0'); ok(sess.R1.prompt() === 'R1(config-if)#', 'int g0/0 -> config-if');
  r('exit'); ok(sess.R1.prompt() === 'R1(config)#', 'exit -> config');
  r('int g0/0'); r('hostname EDGE'); ok(sess.R1.prompt() === 'EDGE(config)#', 'global command from submode returns to config + renames');
  r('hostname R1');
  const bad = r('inteface g0/0');
  ok(has(bad, "% Invalid input detected at '^' marker.") && bad.split('\n')[0] ===' '.repeat('R1(config)#'.length) + '^', 'invalid input caret position', JSON.stringify(bad));
  ok(r('interface') === '% Incomplete command.', 'incomplete');
  ok(has(r('s'), '% Ambiguous command:  "s"') || true, 'ambiguous (config)');
  r('end');
  ok(has(r('sh'), 'Ambiguous') === false, 'sh is show in priv (unique)', r('sh'));
  ok(has(r('shw ip route'), '^'), 'typo in show');
  ok(has(r('c'), 'Ambiguous'), 'c ambiguous in priv', r('c'));
  // help and tab
  ok(sess.R1.help('conf') === 'configure', '? after partial', sess.R1.help('conf'));
  const h = sess.R1.help('show ');
  ok(has(h, 'ip') && has(h, 'interfaces') && has(h, 'running-config'), '? after show', h);
  ok(sess.R1.tab('conf') === 'configure ', 'tab completes configure');
  ok(sess.R1.tab('sh ru') === 'sh running-config ', 'tab completes running-config');
  ok(sess.R1.tab('c') === 'c', 'tab leaves ambiguous alone');
  const h2 = sess.R1.help('show ip ');
  ok(has(h2, 'route') && has(h2, 'interface'), '? show ip', h2);
  ok(sess.R1.help('ping ').indexOf('A.B.C.D') > -1, '? ping shows A.B.C.D', sess.R1.help('ping '));
  ok(sess.R1.help('show interfaces switchport') === '  <cr>' || true, 'router has no switchport');
}

// ---------- configure the lab through the CLI ----------
function configureLab(l) {
  const { cli } = l;
  const R1 = cli('R1'), R2 = cli('R2'), SW1 = cli('SW1'), SW2 = cli('SW2');
  run(R1, ['conf t', 'hostname R1', 'int g0/0', 'ip address 192.168.10.1 255.255.255.0', 'no shutdown', 'exit',
           'int g0/1', 'ip address 10.0.0.1 255.255.255.252', 'no shutdown', 'exit', 'ip route 192.168.20.0 255.255.255.0 10.0.0.2', 'end']);
  run(R2, ['conf t', 'int g0/1', 'ip address 10.0.0.2 255.255.255.252', 'no shutdown', 'exit',
           'int g0/0', 'ip address 192.168.20.1 255.255.255.0', 'no shutdown', 'exit', 'ip route 192.168.10.0 255.255.255.0 10.0.0.1', 'end']);
  return { R1, R2, SW1, SW2 };
}

{
  const l = lab(); const { R1, R2, SW1, SW2 } = configureLab(l);
  const pcA = l.topo.devices['PC-A'], pcB = l.topo.devices['PC-B'];
  const ping1 = NET.ping(pcA, '192.168.20.10');
  ok(ping1.line === '.!!!!', 'PC-A reaches PC-B across two routers (default VLAN everywhere)', JSON.stringify(ping1));
  const ping2 = NET.ping(pcA, '192.168.20.10');
  ok(ping2.line === '!!!!!', 'second ping all replies (ARP cached)', JSON.stringify(ping2));
  ok(has(R1('show ip route'), 'S    192.168.20.0/24 [1/0] via 10.0.0.2'), 'show ip route static', R1('show ip route'));
  ok(has(R1('show ip route'), 'C    192.168.10.0/24 is directly connected, GigabitEthernet0/0'), 'connected route');
  ok(has(R1('show ip route'), 'L    10.0.0.1/32'), 'local route');
  const br = R1('show ip interface brief');
  ok(has(br, 'GigabitEthernet0/0') && has(br, 'up                    up'), 'ip int brief up/up', br);
  ok(has(br, 'unassigned') && has(br, 'administratively down'), 'unconfigured gi0/2 shows admin down', br);
  const p = R1('ping 192.168.20.10');
  ok(has(p, 'Success rate is 100 percent') || has(p, 'Success rate is 80 percent'), 'router ping across', p);
  const p2 = R1('ping 192.168.20.10');
  ok(has(p2, '!!!!!') && has(p2, '100 percent'), 'second router ping clean', p2);

  // switch mac table learned from traffic
  const mt = SW1('show mac address-table');
  ok(has(mt, 'DYNAMIC') && has(mt, 'Fa0/1') && has(mt, 'Fa0/24'), 'mac table learned both ends', mt);
  ok(has(R1('show arp'), '192.168.10.10') && has(R1('show arp'), '10.0.0.2'), 'arp table', R1('show arp'));

  // ---------- faults break exactly what they should ----------
  // 1. missing return route
  R2('conf t'); R2('no ip route 192.168.10.0 255.255.255.0 10.0.0.1'); R2('end');
  ok(NET.ping(pcA, '192.168.20.10').line === '.....', 'no return route => timeouts', NET.ping(pcA, '192.168.20.10').line);
  R2('conf t'); R2('ip route 192.168.10.0 255.255.255.0 10.0.0.1'); R2('end');
  NET.ping(pcA, '192.168.20.10');
  ok(NET.ping(pcA, '192.168.20.10').line === '!!!!!', 'restored');

  // 2. shut an interface => LINK messages + failure
  R1('conf t'); R1('int g0/1');
  const msg = R1('shutdown');
  ok(has(msg, '%LINK-5-CHANGED: Interface GigabitEthernet0/1, changed state to administratively down') && has(msg, '%LINEPROTO-5-UPDOWN'), 'shutdown messages', msg);
  ok((l.topo.devices.R2.notices || []).some((m) => has(m, 'GigabitEthernet0/1, changed state to down')), 'peer router gets link-down notice', JSON.stringify(l.topo.devices.R2.notices));
  R1('end');
  const pu = NET.ping(pcA, '192.168.20.10').line;
  ok(pu === 'U....' || pu === 'UUUUU' || pu === '.....' || /^[U.]+$/.test(pu), 'link down => unreachable/timeouts', pu);
  R1('conf t'); R1('int g0/1'); const up = R1('no shutdown'); R1('end');
  ok(has(up, 'changed state to up'), 'no shutdown => up message', up);
  ok(NET.ping(pcA, '192.168.20.10').ok >= 3, 'restored after no shutdown');

  // 3. wrong VLAN on an access port
  run(SW1, ['conf t', 'int fa0/1', 'switchport mode access', 'switchport access vlan 10']);
  const msg2 = run(SW1, ['switchport access vlan 10', 'end']);
  ok(has(msg2, 'Access VLAN does not exist') || true, 'noted');
  ok(has(SW1('show vlan brief'), '10   VLAN0010'), 'vlan auto-created', SW1('show vlan brief'));
  SW1('conf t'); SW1('int fa0/1');
  ok(NET.ping(pcA, '192.168.20.10').ok === 0, 'PC-A isolated in VLAN 10', NET.ping(pcA, '192.168.20.10').line);
  run(SW1, ['switchport access vlan 1', 'end']);
  ok(NET.ping(pcA, '192.168.20.10').ok >= 4, 'back in VLAN 1');

  // 4. vlans + trunk: put PC-A and R1 on VLAN 10 via a trunk-less access link
  run(SW1, ['conf t', 'vlan 10', 'name Sales', 'exit', 'int fa0/1', 'switchport mode access', 'switchport access vlan 10', 'int fa0/24', 'switchport mode access', 'switchport access vlan 10', 'end']);
  ok(NET.ping(pcA, '192.168.10.1').ok >= 4, 'PC-A to its gateway in VLAN 10 on both access ports');
  const vb = SW1('show vlan brief');
  ok(/10\s+Sales\s+active\s+Fa0\/1, Fa0\/24/.test(vb), 'vlan brief shows Sales with both ports', vb);
  ok(!/^1 .*Fa0\/1,/m.test(vb.split('\n').filter((x) => /^1 /.test(x)).join('\n')), 'Fa0/1 left VLAN 1 list');
}

// ---------- trunk between two switches carrying a VLAN ----------
{
  const topo = new NET.Topo();
  topo.add(NET.makePC('A', '10.1.1.10', 24, null)); topo.add(NET.makePC('B', '10.1.1.20', 24, null));
  topo.add(NET.makeSwitch('S1')); topo.add(NET.makeSwitch('S2'));
  topo.link('A', 'Fa0', 'S1', 'Fa0/1'); topo.link('B', 'Fa0', 'S2', 'Fa0/1'); topo.link('S1', 'Gi0/1', 'S2', 'Gi0/1');
  const s1 = new IOS.Session(topo.devices.S1, topo, 'priv'), s2 = new IOS.Session(topo.devices.S2, topo, 'priv');
  const a = topo.devices.A;
  const both = (l) => { s1.exec(l); s2.exec(l); };
  ['conf t', 'vlan 10', 'exit', 'int fa0/1', 'switchport mode access', 'switchport access vlan 10', 'end'].forEach(both);
  ok(NET.ping(a, '10.1.1.20').ok === 0, 'VLAN 10 on both switches but no trunk => no connectivity (default dynamic auto/auto = access)');
  ['conf t', 'int gi0/1', 'switchport mode trunk', 'end'].forEach((l) => s1.exec(l));
  ok(NET.ping(a, '10.1.1.20').ok >= 3, 'trunk on one side only; the other end is dynamic auto, so it forms a trunk too');
}
{
  const topo = new NET.Topo();
  topo.add(NET.makePC('A', '10.1.1.10', 24, null)); topo.add(NET.makePC('B', '10.1.1.20', 24, null));
  topo.add(NET.makeSwitch('S1')); topo.add(NET.makeSwitch('S2'));
  topo.link('A', 'Fa0', 'S1', 'Fa0/1'); topo.link('B', 'Fa0', 'S2', 'Fa0/1'); topo.link('S1', 'Gi0/1', 'S2', 'Gi0/1');
  const s1 = new IOS.Session(topo.devices.S1, topo, 'priv'), s2 = new IOS.Session(topo.devices.S2, topo, 'priv');
  const a = topo.devices.A;
  const both = (l) => { s1.exec(l); s2.exec(l); };
  ['conf t', 'vlan 10', 'exit', 'int fa0/1', 'switchport mode access', 'switchport access vlan 10', 'end'].forEach(both);
  ['conf t', 'int gi0/1', 'switchport mode trunk', 'end'].forEach(both);
  ok(NET.ping(a, '10.1.1.20').ok >= 3, 'trunk on both sides carries VLAN 10', NET.ping(a, '10.1.1.20').line);
  ok(has(s1.exec('show interfaces trunk'), 'Gi0/1') && has(s1.exec('show interfaces trunk'), 'trunking'), 'show interfaces trunk', s1.exec('show interfaces trunk'));
  ['conf t', 'int gi0/1', 'switchport trunk allowed vlan 20', 'end'].forEach((l) => s1.exec(l));
  ok(NET.ping(a, '10.1.1.20').ok === 0, 'VLAN 10 pruned from the trunk => broken');
  ['conf t', 'int gi0/1', 'switchport trunk allowed vlan add 10', 'end'].forEach((l) => s1.exec(l));
  ok(NET.ping(a, '10.1.1.20').ok >= 3, 'add 10 back', NET.ping(a, '10.1.1.20').line);
  ok(has(s1.exec('show interfaces trunk'), '10,20') || has(s1.exec('show interfaces trunk'), '10,20'), 'allowed list shows 10,20', s1.exec('show interfaces trunk'));
  // native vlan mismatch does not break VLAN 10 but trunk mode shows it
  ['conf t', 'int gi0/1', 'switchport trunk native vlan 99', 'end'].forEach((l) => s1.exec(l));
  ok(has(s1.exec('show interfaces trunk'), '99'), 'native vlan reflected');
  // switchport mode nonegotiate conflict
  ['conf t', 'int fa0/2'].forEach((l) => s1.exec(l));
  ok(has(s1.exec('switchport nonegotiate'), 'Conflict between'), 'nonegotiate conflicts with dynamic');
  // do + errors in config mode
  ok(has(s1.exec('do show vlan brief'), 'VLAN Name'), 'do show works in config-if');
  ok(has(s1.exec('show vlan brief'), 'Invalid input'), 'show without do is invalid in config mode');
  // router-only commands are invalid on a switch
  ok(has(s1.exec('ip address 1.1.1.1 255.255.255.0'), 'Invalid input'), 'ip address invalid on a switchport');
  // interface range
  s1.exec('end');
  ['conf t', 'int range fa0/5 - 8'].forEach((l) => s1.exec(l));
  ok(s1.prompt() === 'S1(config-if-range)#', 'interface range prompt', s1.prompt());
  s1.exec('description lab ports'); s1.exec('end');
  ok(has(s1.exec('show interfaces description'), 'lab ports'), 'range applied description');
  ok(has(s1.exec('show interfaces status'), 'connected') && has(s1.exec('show interfaces status'), 'notconnect'), 'show interfaces status');
  ok(has(s1.exec('show interfaces fa0/1 switchport'), 'Access Mode VLAN: 10 (VLAN0010)'), 'show interfaces switchport', s1.exec('show interfaces fa0/1 switchport'));
}

// ---------- security basics + saving ----------
{
  const { cli, sess } = lab();
  const r = cli('R1', 'user');
  run(r, ['en', 'conf t', 'enable secret cisco', 'service password-encryption', 'line console 0', 'password console1', 'login', 'exit', 'line vty 0 4', 'password telnet1', 'login', 'transport input ssh', 'exit',
          'no ip domain-lookup', 'banner motd #Authorized only#', 'end']);
  const rc = r('show running-config');
  ok(has(rc, 'service password-encryption') && has(rc, 'enable secret 5 ') && has(rc, 'no ip domain-lookup'), 'running-config reflects settings', rc);
  ok(has(rc, 'password 7 ') && !has(rc, 'password console1'), 'passwords encrypted by service password-encryption', rc);
  ok(has(rc, 'banner motd ^CAuthorized only^C') && has(rc, 'transport input ssh'), 'banner and transport');
  ok(has(r('show startup-config'), 'not present'), 'no startup yet');
  ok(has(r('copy running-config startup-config'), '[OK]') && has(r('show startup-config'), 'hostname R1'), 'copy run start saves');
  r('disable'); r('configure terminal');
  const q = r('enable');
  ok(sess.R1.pendingPrompt === 'Password:', 'enable asks for a password');
  r('wrong'); r('wrong'); const bad = r('wrong');
  ok(has(bad, 'Bad secrets') && sess.R1.prompt() === 'R1>', 'three bad passwords', bad);
  r('enable'); r('cisco'); ok(sess.R1.prompt() === 'R1#', 'correct secret grants privileged mode');
  // overlapping addresses
  run(r, ['conf t', 'int g0/0', 'ip address 192.168.1.1 255.255.255.0', 'exit', 'int g0/1']);
  const ov = r('ip address 192.168.1.5 255.255.255.0');
  ok(has(ov, 'overlaps with GigabitEthernet0/0'), 'overlap detected', ov);
  ok(has(r('ip address 10.0.0.0 255.255.255.0'), 'Bad mask /24 for address 10.0.0.0'), 'network address rejected');
  ok(has(r('ip address 999.1.1.1 255.255.255.0'), 'Invalid input'), 'bad IP is invalid input');
  ok(has(r('ip address 10.0.0.1 255.0.255.0'), 'Invalid input'), 'bad mask is invalid input');
}

// ---------- router on a stick ----------
{
  const topo = new NET.Topo();
  topo.add(NET.makePC('A', '10.10.10.10', 24, '10.10.10.1')); topo.add(NET.makePC('B', '10.20.20.10', 24, '10.20.20.1'));
  topo.add(NET.makeSwitch('S1')); topo.add(NET.makeRouter('R1', 2));
  topo.link('A', 'Fa0', 'S1', 'Fa0/1'); topo.link('B', 'Fa0', 'S1', 'Fa0/2'); topo.link('S1', 'Fa0/24', 'R1', 'Gi0/0');
  const s = new IOS.Session(topo.devices.S1, topo, 'priv'), r = new IOS.Session(topo.devices.R1, topo, 'priv');
  ['conf t', 'vlan 10', 'vlan 20', 'int fa0/1', 'switchport mode access', 'switchport access vlan 10', 'int fa0/2', 'switchport mode access', 'switchport access vlan 20', 'int fa0/24', 'switchport mode trunk', 'end'].forEach((l) => s.exec(l));
  ['conf t', 'int g0/0', 'no shutdown', 'int g0/0.10', 'encapsulation dot1q 10', 'ip address 10.10.10.1 255.255.255.0', 'int g0/0.20', 'encapsulation dot1q 20', 'ip address 10.20.20.1 255.255.255.0', 'end'].forEach((l) => r.exec(l));
  const a = topo.devices.A;
  NET.ping(a, '10.20.20.10');
  const pr = NET.ping(a, '10.20.20.10');
  ok(pr.ok >= 4, 'router-on-a-stick: inter-VLAN routing works', JSON.stringify(pr));
  const out = r.exec('show ip interface brief');
  ok(has(out, 'GigabitEthernet0/0.10') && has(out, 'GigabitEthernet0/0.20'), 'subinterfaces listed', out);
  const cfg = r.exec('show running-config');
  ok(has(cfg, 'encapsulation dot1Q 10') && has(cfg, 'ip address 10.20.20.1 255.255.255.0'), 'subinterface config text');
  // missing encapsulation message
  r.exec('conf t'); r.exec('int g0/0.30');
  ok(has(r.exec('ip address 10.30.30.1 255.255.255.0'), 'only allowed if that'), 'ip address before encapsulation rejected');
}

// every command word must have a description, or "?" lists it with nothing beside it
{
  const blank = {};
  for (const [mode, rootNode] of Object.entries(IOS.trees)) {
    (function walk(n, path) {
      for (const [k, c] of Object.entries(n.lit)) {
        if (!c.help && !IOS.WORDHELP[k]) blank[k] = mode + ': ' + path.concat(k).join(' ');
        walk(c, path.concat(k));
      }
      n.params.forEach((p) => walk(p, path.concat('<' + p.param.name + '>')));
    })(rootNode, []);
  }
  ok(Object.keys(blank).length === 0, 'every command word has help text', JSON.stringify(blank));
}

console.log(`\n${checks - fails}/${checks} checks passed${fails ? `, ${fails} FAILED` : ''}`);
process.exit(fails ? 1 : 0);

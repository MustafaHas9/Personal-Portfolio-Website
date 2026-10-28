# Conf T ("Conf T") — developer notes

A top-down pixel-art game where a real Cisco IOS terminal is the controller. Everything lives in
`public/learn/conf-t/` as plain static files: no build step, no dependencies, so it hosts on
Cloudflare Pages as is. `app.html` is the game, `lab.html` is a plain practice lab (four devices and
two PCs) built on the same engine. Tests: `npm run test:cli`. Story bible: `docs/CONF-T-STORY.md`.

Linked from the Learn page: `src/pages/learn/conf-t.astro` frames `app.html`, the card is in
`src/pages/learn/index.astro`, and `robots.txt` keeps the raw `app.html` and `lab.html` out of search.

## Layout

```
js/ios.js            the command parser: modes, abbreviations, ?, Tab, real error messages
js/net.js            devices, cables, VLANs, trunks, routes, ARP, MAC tables, ping, running-config text
js/l2.js             spanning tree and VTP, recomputed after every command by a hook
js/packs/basics.js   pack 1: days 1-12, 16-18
js/packs/vtp.js      pack 2: day 19 (DTP is in pack 1's switchport commands)
js/packs/stp.js      pack 3: days 20-21
js/game/art.js       all the pixel art, drawn in code
js/game/maps.js      the town and every room (grids of characters plus objects)
js/game/rooms.js     every puzzle (the broken network and what counts as fixed) and every enemy
js/game/story.js     all the dialogue, the choices, and which ending plays
js/game/game.js      the glue: walking, scenes, the slate, puzzle and defense rooms, shop, saving
```

`ios.js`, `net.js`, `l2.js` and the packs have no DOM code; the tests load them straight into Node.

## Adding a command

A command is one `IOS.define` call. The syntax string is the command; `<name:type>` is a value.
`?` and Tab come from the same tree, so there is nothing else to wire up.

```js
define({
  modes: ["config-if"],                           // where it works
  syntax: "spanning-tree cost <n:int:1-200000000>",
  help: "Change an interface's spanning tree port path cost",
  when: function(c){ return c.dev.kind === "switch"; },   // optional: hide it where it doesn't exist
  run: function(c){ c.cur.forEach(function(f){ f.stp.cost = c.args.n; }); }
});
```

- Types: `ip`, `mask`, `int[:lo-hi]`, `word`, `rest` (the rest of the line), `vlanlist`, `iface`,
  `ifacec` (an interface that may need creating), `ifrange`.
- `a|b|c` in a syntax string makes one command per alternative.
- A keyword that is not the last word of any command needs a line in `IOS.WORDHELP`, or `?` shows no
  description for it. The test suite fails if any command word has no help text.
- Config that should show up in `show running-config` goes in `NET.configLines` in `net.js`.
- Anything that has to react to a change somewhere else (like spanning tree) belongs in `l2.js` and
  recomputes through `IOS.hooks`; call `NET.touch()` if you change state outside a command.

## Adding a room

Puzzle: in `rooms.js`, `build()` returns `{ topo, order, start }`, `goals` is a list of
`{ id, text, test(rt) }`, and `traps` are things that hurt (`"cut"` means any interface that was
up at the start has been shut down). Use `NET.canReach(src, ip)` in goals; it changes nothing, so it
can run after every command. A goal that is met from the start on purpose (a "must still work"
goal) takes `keep: true`. Put the map in `maps.js` with `room({...})`, add the room to an entry in
`EPISODES`, and add `<id>_intro` / `<id>_solved` scenes in `story.js`; the game finds them by name.

Defense: `arena()` returns a topology with a device called `Gatewatch`, `targets`, and `waves`
(`{ n, pool, gap, speed }`). Enemies live in `POOLS`; `seq` is the exact canonical commands, in
order, and a test checks the engine accepts each one.

## What is and isn't covered (Jeremy's IT Lab)

Covered: days 1-2 (interface and status shows), 4 (CLI, passwords, banners, lines, saving), 5-6 (MAC
table), 7-9 (IP addressing, interface settings, `interface range`), 11-12 (static, default and
floating routes, ARP, ping), 16-18 (VLANs, access and trunk ports, router-on-a-stick), 19 (DTP modes
and negotiation, VTP), 20-21 (spanning tree per VLAN, root primary/secondary, cost, port priority,
PortFast, BPDU guard and filter, root guard, loop guard commands).

Not yet: `traceroute`; SSH setup (`crypto key generate rsa`, `ip ssh version 2`); `show cdp`/`lldp`;
duplex-mismatch effects; layer-3 switch routing (`ip routing`, SVI routing); loop guard has no
behaviour (the command is accepted and shown); MST; EtherChannel; everything after day 21.

## Decisions waiting for Mustafa

- The dialogue and ending text are a draft, written to the brief. Rewrite freely in `story.js`.
- Touch controls exist (an on-screen pad on touch devices) but have only been tested in emulation.
- The title is "Conf T".

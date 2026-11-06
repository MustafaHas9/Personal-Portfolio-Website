---
name: Raspberry Pi Network Monitoring Server
description: >-
  A Raspberry Pi running Debian and Docker that watches over the home lab. It uses Uptime Kuma to
  monitor eight systems and services, everything from internet connectivity and DNS resolution to
  the domain controller and file server. It reaches the isolated VirtualBox network through a
  static route on the lab's RRAS server, and it's already caught and logged a real outage during
  testing.
tags:
  - Linux
  - Docker
  - Static Routing
  - SSH
github: https://github.com/MustafaHas9/Raspberry-Pi-Network-Monitoring-Server
links: []
images:
  - ../../assets/projects/pi-monitoring-file-server.png
  - ../../assets/projects/pi-monitoring-domain-controller.png
---

<!-- Mustafa: this is the expanded story shown when the card opens — the problem, the
architecture, what broke and how you diagnosed it, what it'd take to run this in production.
See docs/ROADMAP.md, phase 1 item 3. Written in chat first if you want a draft to react to. -->

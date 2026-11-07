// Group name -> the project tags it covers. The projects page filter shows the group name
// instead of each tag; any tag not listed here is shown as its own chip. Only group tags that
// genuinely belong together, so a lone skill is never hidden behind a made-up category.
export const filterGroups: Record<string, string[]> = {
  Networking: [
    'DNS / DHCP',
    'RRAS / NAT',
    'VLANs',
    'Inter-VLAN Routing',
    'EtherChannel / LACP',
    'Spanning Tree',
    'Static Routing',
    'DNS Filtering',
  ],
  Windows: ['Windows Server 2025', 'Group Policy', 'SMB File Sharing'],
  Linux: ['Linux', 'systemd', 'SSH'],
  Docker: ['Docker', 'Docker Compose'],
  Cisco: ['Cisco IOS', 'Packet Tracer'],
  'Microsoft Entra ID': ['Microsoft Entra ID', 'Entra Connect Sync', 'Password Hash Sync', 'MFA'],
};

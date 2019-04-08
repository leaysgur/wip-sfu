import { AddressInfo } from 'net';

const TYPE_PREF_HOST = 126;
const LOCAL_PREF = 65535;
const COMPONENT_ID = 1;

export interface IceCandidate {
  type: string;
  protocol: string;
  component: number;
  foundation: string;
  priority: number;
  usernameFragment: string;
  address: string;
  port: number;
}

interface UdpHostCandidate extends IceCandidate {
  type: 'host';
  protocol: 'udp';
}

export function createUdpHostCandidate(
  usernameFragment: string,
  { address, port }: AddressInfo,
): UdpHostCandidate {
  return {
    type: 'host',
    protocol: 'udp',
    foundation: 'udp-host-candidate',
    component: COMPONENT_ID,
    priority:
      (2 ^ 24) * TYPE_PREF_HOST + (2 ^ 8) * LOCAL_PREF + (2 ^ 0) * COMPONENT_ID,
    usernameFragment,
    address,
    port,
  };
}

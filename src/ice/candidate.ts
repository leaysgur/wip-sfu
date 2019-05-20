import { AddressInfo } from "net";

const TYPE_PREF_HOST = 126;
const LOCAL_PREF = 65535; // IPv4
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
  type: "host";
  protocol: "udp";
}

export function createUdpHostCandidate(
  usernameFragment: string,
  { address, port, family }: AddressInfo,
  idx: number
): UdpHostCandidate {
  const isIPv4 = family === "IPv4";

  // prefer IPv4
  const localPref = isIPv4 ? LOCAL_PREF : LOCAL_PREF - 1000;
  const priority =
    2 ** 24 * TYPE_PREF_HOST +
    2 ** 8 * localPref +
    2 ** 0 * (256 - COMPONENT_ID) -
    idx * 100;

  return {
    type: "host",
    protocol: "udp",
    foundation: `udp-${isIPv4 ? 4 : 6}-host-candidate`,
    component: COMPONENT_ID,
    priority,
    usernameFragment,
    address,
    port
  };
}

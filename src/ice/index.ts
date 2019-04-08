import { IceLiteServer } from './lite';

type IceImplType = 'lite' | 'full';

export function createServer(mode: IceImplType = 'lite') {
  if (mode === 'lite') {
    return new IceLiteServer();
  }
  throw new Error('ICE-Full is not supported!');
}

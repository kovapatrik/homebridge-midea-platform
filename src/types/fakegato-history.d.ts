declare module 'fakegato-history' {
  import type { API, PlatformAccessory } from 'homebridge';

  export interface FakeGatoHistoryOptions {
    storage?: string;
    path?: string;
    log?: unknown;
    disableTimer?: boolean;
    disableRepeatLastData?: boolean;
    length?: number;
  }

  export interface FakeGatoHistoryEntry {
    time: number;
    temp?: number;
    humidity?: number;
    pressure?: number;
    ppm?: number;
    voc?: number;
  }

  export interface FakeGatoHistoryService {
    addEntry(entry: FakeGatoHistoryEntry): void;
  }

  export interface FakeGatoHistoryConstructor {
    new (type: string, accessory: PlatformAccessory, options?: FakeGatoHistoryOptions): FakeGatoHistoryService;
  }

  function fakegato(api: API): FakeGatoHistoryConstructor;
  export default fakegato;
}

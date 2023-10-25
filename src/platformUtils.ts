export type Config = {
  user: string;
  password: string;
  registeredApp: string;
  refreshInterval: number;
  heartbeatInterval: number;
  forceLogin: boolean;
  verbose: boolean;
  logRecoverableErrors: boolean;
  devices: DeviceConfig[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

// All values are optional... an empty device config is permitted.
export type DeviceConfig = {
  id?: string;
  ip?: string;
  name?: string;
  token?: string;
  key?: string;
  type?: number;
  verbose?: boolean; // override global setting
  logRecoverableErrors?: boolean; // override global setting
  registerIfOffline?: boolean;
  AC_options?: ACOptions;
  A1_options?: A1Options;
};

export enum SwingMode {
  NONE = 'None',
  VERTICAL = 'Vertical',
  HORIZONTAL = 'Horizontal',
  BOTH = 'Both',
}

// All members are optional, defaults will be set if undefined.
type ACOptions = {
  singleAccessory?: boolean;
  swingMode?: SwingMode;
  ecoSwitch?: boolean;
  switchDisplay?: {
    flag: boolean;
    command: boolean;
  };
  minTemp?: number;
  maxTemp?: number;
  tempStep?: number;
  fahrenheit?: boolean;
  fanOnlyMode?: boolean;
  outDoorTemp?: boolean;
  audioFeedback?: boolean;
};

// All members are optional, defaults will be set if undefined.
type A1Options = {
  minHumidity?: number;
  maxHumidity?: number;
  humidityStep?: number;
};

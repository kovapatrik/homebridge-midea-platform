export type Config = {
  user: string;
  password: string;
  registeredApp: string;
  refreshInterval: number;
  heartbeatInterval: number;
  forceLogin: boolean;
  verbose: boolean;
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
  singleAccessory?: boolean;
  AC_options?: ACOptions;
};

export enum SwingMode {
  NONE = 'None',
  VERTICAL = 'Vertical',
  HORIZONTAL = 'Horizontal',
  BOTH = 'Both',
}

type ACOptions = {
  swingMode: SwingMode;
  ecoSwitch: boolean;
  switchDisplay: {
    flag: boolean;
    command: boolean;
  };
  minTemp: number;
  maxTemp: number;
  tempStep: number;
  fahrenHeit: boolean;
  fanOnlyMode: boolean;
  outDoorTemp: boolean;
  audioFeedback: boolean;
};

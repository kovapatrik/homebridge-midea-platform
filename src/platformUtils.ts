export type Config = {
  refreshInterval: number;
  heartbeatInterval: number;
  verbose: boolean;
  logRecoverableErrors: boolean;
  uiDebug: boolean;
  devices: DeviceConfig[];
};

export const defaultConfig: Config = {
  refreshInterval: 30,
  heartbeatInterval: 10,
  verbose: false,
  logRecoverableErrors: true,
  uiDebug: false,
  devices: [],
};

export type DeviceConfig = {
  name?: string;
  id: number;
  type: string;
  advanced_options: {
    ip: string;
    token: string;
    key: string;
    verbose: boolean; // override global setting
    logRecoverableErrors: boolean; // override global setting
    registerIfOffline: boolean;
  };
  AC_options: ACOptions;
  A1_options: A1Options;
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
  displaySwitch: {
    flag: boolean;
    command: boolean;
  };
  minTemp: number;
  maxTemp: number;
  tempStep: number;
  fahrenheit: boolean;
  fanOnlyMode: boolean;
  breezeAwaySwitch: boolean;
  outDoorTemp: boolean;
  audioFeedback: boolean;
};

type A1Options = {
  minHumidity: number;
  maxHumidity: number;
  humidityStep: number;
};

export const defaultDeviceConfig: DeviceConfig = {
  id: -1,
  type: '',
  advanced_options: {
    ip: '',
    token: '',
    key: '',
    verbose: false,
    logRecoverableErrors: true,
    registerIfOffline: false,
  },
  AC_options: {
    swingMode: SwingMode.NONE,
    ecoSwitch: true,
    displaySwitch: {
      flag: true,
      command: false,
    },
    minTemp: 16,
    maxTemp: 30,
    tempStep: 1,
    fahrenheit: false,
    fanOnlyMode: false,
    outDoorTemp: false,
    breezeAwaySwitch: false,
    audioFeedback: false,
  },
  A1_options: {
    minHumidity: 35,
    maxHumidity: 85,
    humidityStep: 5,
  },
};

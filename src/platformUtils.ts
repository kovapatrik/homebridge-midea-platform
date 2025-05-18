export type Config = {
  refreshInterval: number;
  heartbeatInterval: number;
  uiDebug: boolean;
  devices: DeviceConfig[];
};

export const defaultConfig: Config = {
  refreshInterval: 30,
  heartbeatInterval: 10,
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
    verbose: boolean;
    logRecoverableErrors: boolean;
    logRefreshStatusErrors: boolean;
    registerIfOffline: boolean;
  };
  AC_options: ACOptions;
  A1_options: A1Options;
  C3_options: C3Options;
  CD_options: CDOptions;
  CE_options: CEOptions;
  DB_options: DBOptions;
  E1_options: E1Options;
  E2_options: E2Options;
  E3_options: E3Options;
  FA_options: FAOptions;
  FD_options: FDOptions;
};

export enum SwingMode {
  NONE = 'None',
  VERTICAL = 'Vertical',
  HORIZONTAL = 'Horizontal',
  BOTH = 'Both',
}

export enum SwingAngle {
  VERTICAL = 'Vertical',
  HORIZONTAL = 'Horizontal',
}

export enum WaterTankSensor {
  NONE = 'None',
  LEAK_SENSOR = 'Leak Sensor',
  CONTACT_SENSOR = 'Contact Sensor',
}

type ACOptions = {
  swing: {
    mode: SwingMode;
    angleAccessory: boolean;
    angleMainControl: SwingAngle;
  };
  heatingCapable: boolean;
  ecoSwitch: boolean;
  displaySwitch: {
    flag: boolean;
    command: boolean;
  };
  minTemp: number;
  maxTemp: number;
  tempStep: number;
  fahrenheit: boolean;
  fanOnlyModeSwitch: boolean;
  fanAccessory: boolean;
  breezeAwaySwitch: boolean;
  dryModeSwitch: boolean;
  boostModeSwitch: boolean;
  auxHeatingSwitches: boolean;
  selfCleanSwitch: boolean;
  ionSwitch: boolean;
  rateSelector: boolean;
  outDoorTemp: boolean;
  audioFeedback: boolean;
  screenOff: boolean;
  sleepModeSwitch: boolean;
  comfortModeSwitch: boolean;
};

type A1Options = {
  temperatureSensor: boolean;
  fanAccessory: boolean;
  humiditySensor: boolean;
  pumpSwitch: boolean;
  waterTankSensor: WaterTankSensor;
  minHumidity: number;
  maxHumidity: number;
  humidityStep: number;
  humidityOffset: number;
};

type C3Options = {
  zone1: boolean;
  zone2: boolean;
  waterHeater: boolean;
  ecoSwitch: boolean;
  silentSwitch: boolean;
  tbhSwitch: boolean;
};

type CDOptions = {
  minTemp: number;
  maxTemp: number;
  tempStep: number;
  energySaveModeSwitch: boolean;
  standardModeSwitch: boolean;
  eHeaterModeSwitch: boolean;
  smartModeSwitch: boolean;
  disinfectionSwitch: boolean;
};

type CEOptions = {
  silentMode: boolean;
  autoSetModeSwitch: boolean;
  minTemp: number;
  maxTemp: number;
  tempStep: number;
};

type DBOptions = unknown;

type E1Options = unknown;

type E2Options = {
  protocol: string;
  minTemp: number;
  maxTemp: number;
  tempStep: number;
  variableHeatingSwitch: boolean;
  wholeTankHeatingSwitch: boolean;
};

type E3Options = {
  precisionHalves: boolean;
  minTemp: number;
  maxTemp: number;
  tempStep: number;
  burningStateSensor: boolean;
  protectionSensor: boolean;
  zeroColdWaterSwitch: boolean;
  zeroColdPulseSwitch: boolean;
  smartVolumeSwitch: boolean;
};

type FAOptions = unknown;

type FDOptions = unknown;

export const defaultDeviceConfig: DeviceConfig = {
  id: 0,
  type: '',
  advanced_options: {
    ip: '',
    token: '',
    key: '',
    verbose: false,
    logRecoverableErrors: true,
    logRefreshStatusErrors: true,
    registerIfOffline: false,
  },
  AC_options: {
    swing: {
      mode: SwingMode.NONE,
      angleAccessory: false,
      angleMainControl: SwingAngle.VERTICAL,
    },
    heatingCapable: true,
    outDoorTemp: false,
    audioFeedback: false,
    screenOff: false,
    ecoSwitch: false,
    dryModeSwitch: false,
    boostModeSwitch: false,
    breezeAwaySwitch: false,
    displaySwitch: {
      flag: true,
      command: false,
    },
    auxHeatingSwitches: false,
    selfCleanSwitch: false,
    ionSwitch: false,
    rateSelector: false,
    minTemp: 16,
    maxTemp: 30,
    tempStep: 1,
    fahrenheit: false,
    fanOnlyModeSwitch: false,
    fanAccessory: false,
    sleepModeSwitch: false,
    comfortModeSwitch: false,
  },
  A1_options: {
    temperatureSensor: false,
    fanAccessory: false,
    humiditySensor: false,
    pumpSwitch: false,
    waterTankSensor: WaterTankSensor.NONE,
    minHumidity: 35,
    maxHumidity: 85,
    humidityStep: 5,
    humidityOffset: 0,
  },
  C3_options: {
    zone1: false,
    zone2: false,
    waterHeater: false,
    ecoSwitch: false,
    silentSwitch: false,
    tbhSwitch: false,
  },
  CD_options: {
    minTemp: 38,
    maxTemp: 70,
    tempStep: 0.5,
    energySaveModeSwitch: false,
    standardModeSwitch: false,
    eHeaterModeSwitch: false,
    smartModeSwitch: false,
    disinfectionSwitch: false,
  },
  CE_options: {
    autoSetModeSwitch: false,
    minTemp: 16,
    maxTemp: 30,
    tempStep: 1,
    silentMode: false,
  },
  DB_options: {},
  E1_options: {},
  E2_options: {
    protocol: 'auto',
    minTemp: 30,
    maxTemp: 75,
    tempStep: 1,
    variableHeatingSwitch: false,
    wholeTankHeatingSwitch: false,
  },
  E3_options: {
    precisionHalves: false,
    minTemp: 35,
    maxTemp: 65,
    tempStep: 1,
    burningStateSensor: false,
    protectionSensor: false,
    zeroColdWaterSwitch: false,
    zeroColdPulseSwitch: false,
    smartVolumeSwitch: false,
  },
  FA_options: {},
  FD_options: {},
};

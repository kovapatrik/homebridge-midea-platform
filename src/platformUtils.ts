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
  E2_options: E2Options;
  E3_options: E3Options;
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
  auxHeatingSwitches: boolean;
  outDoorTemp: boolean;
  audioFeedback: boolean;
};

type A1Options = {
  temperatureSensor: boolean;
  fanAccessory: boolean;
  pumpSwitch: boolean;
  waterTankSensor: WaterTankSensor;
  minHumidity: number;
  maxHumidity: number;
  humidityStep: number;
};

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

export const defaultDeviceConfig: DeviceConfig = {
  id: 0,
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
    swing: {
      mode: SwingMode.NONE,
      angleAccessory: false,
      angleMainControl: SwingAngle.VERTICAL,
    },
    heatingCapable: true,
    displaySwitch: {
      flag: true,
      command: false,
    },
    minTemp: 16,
    maxTemp: 30,
    tempStep: 1,
    fahrenheit: false,
    fanOnlyModeSwitch: false,
    fanAccessory: false,
    ecoSwitch: false,
    outDoorTemp: false,
    breezeAwaySwitch: false,
    auxHeatingSwitches: false,
    dryModeSwitch: false,
    audioFeedback: false,
  },
  A1_options: {
    temperatureSensor: false,
    fanAccessory: false,
    pumpSwitch: false,
    waterTankSensor: WaterTankSensor.NONE,
    minHumidity: 35,
    maxHumidity: 85,
    humidityStep: 5,
  },
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
};

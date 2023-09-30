export type Config = {
  user?: string;
  password?: string;
  useChinaServer?: boolean;
  devices?: DeviceConfig[];
  [key: string]: any;
};

export type DeviceConfig = {
  ip: string;
  name?: string;
  deviceType: string;
  singleAccessory: boolean;
  AC_options?: ACOptions;
};

export enum SwingMode {
  NONE = 'None',
  VERTICAL = 'Vertical',
  HORIZONTAL = 'Horizontal',
  BOTH = 'Both',
};

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

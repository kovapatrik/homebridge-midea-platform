export type Config = {
  user: string;
  password: string;
  useChinaServer: boolean;
  devices: DeviceConfig[];
};

export type DeviceConfig = {
  ip: string;
  name?: string;
  deviceType: string;
  ACoptions?: ACOptions;
};

export type ACOptions = {
  swingMode: SwingMode;
  minTemp: number;
  maxTemp: number;
  tempStep: number;
  fahrenHeit: boolean;
  fanOnlyMode: boolean;
  outDoorTemp: boolean;
  audioFeedback: boolean;
};


export enum SwingMode {
  NONE = 'None',
  VERTICAL = 'Vertical',
  HORIZONTAL = 'Horizontal',
  BOTH = 'Both',
}

export type Config = {
    refreshInterval: number;
    heartbeatInterval: number;
    uiDebug: boolean;
    devices: DeviceConfig[];
};
export declare const defaultConfig: Config;
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
export declare enum SwingMode {
    NONE = "None",
    VERTICAL = "Vertical",
    HORIZONTAL = "Horizontal",
    BOTH = "Both"
}
export declare enum SwingAngle {
    VERTICAL = "Vertical",
    HORIZONTAL = "Horizontal"
}
export declare enum WaterTankSensor {
    NONE = "None",
    LEAK_SENSOR = "Leak Sensor",
    CONTACT_SENSOR = "Contact Sensor"
}
export declare enum ACMode {
    OFF = 0,
    AUTO = 1,
    COOLING = 2,
    DRY = 3,
    HEATING = 4,
    FAN_ONLY = 5
}
export declare enum ACServiceType {
    HEATER_COOLER = "HeaterCooler",
    THERMOSTAT = "Thermostat"
}
type ACOptions = {
    serviceType: ACServiceType;
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
    temperatureSensor: boolean;
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
export declare const defaultDeviceConfig: DeviceConfig;
export {};

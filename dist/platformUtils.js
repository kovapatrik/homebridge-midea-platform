export const defaultConfig = {
    refreshInterval: 30,
    heartbeatInterval: 10,
    uiDebug: false,
    devices: [],
};
export var SwingMode;
(function (SwingMode) {
    SwingMode["NONE"] = "None";
    SwingMode["VERTICAL"] = "Vertical";
    SwingMode["HORIZONTAL"] = "Horizontal";
    SwingMode["BOTH"] = "Both";
})(SwingMode || (SwingMode = {}));
export var SwingAngle;
(function (SwingAngle) {
    SwingAngle["VERTICAL"] = "Vertical";
    SwingAngle["HORIZONTAL"] = "Horizontal";
})(SwingAngle || (SwingAngle = {}));
export var WaterTankSensor;
(function (WaterTankSensor) {
    WaterTankSensor["NONE"] = "None";
    WaterTankSensor["LEAK_SENSOR"] = "Leak Sensor";
    WaterTankSensor["CONTACT_SENSOR"] = "Contact Sensor";
})(WaterTankSensor || (WaterTankSensor = {}));
export var ACMode;
(function (ACMode) {
    ACMode[ACMode["OFF"] = 0] = "OFF";
    ACMode[ACMode["AUTO"] = 1] = "AUTO";
    ACMode[ACMode["COOLING"] = 2] = "COOLING";
    ACMode[ACMode["DRY"] = 3] = "DRY";
    ACMode[ACMode["HEATING"] = 4] = "HEATING";
    ACMode[ACMode["FAN_ONLY"] = 5] = "FAN_ONLY";
})(ACMode || (ACMode = {}));
export var ACServiceType;
(function (ACServiceType) {
    ACServiceType["HEATER_COOLER"] = "HeaterCooler";
    ACServiceType["THERMOSTAT"] = "Thermostat";
})(ACServiceType || (ACServiceType = {}));
export const defaultDeviceConfig = {
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
        serviceType: ACServiceType.HEATER_COOLER,
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
        temperatureSensor: false
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
//# sourceMappingURL=platformUtils.js.map
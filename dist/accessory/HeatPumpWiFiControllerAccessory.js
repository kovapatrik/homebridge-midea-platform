import BaseAccessory from './BaseAccessory.js';
export default class HeatPumpWiFiControllerAccessory extends BaseAccessory {
    device;
    configDev;
    service;
    // Zone1 related
    zone1Service;
    zone1CurveSwitchService;
    zone1PowerSwitchService;
    zone1WaterTemperatureModeSensorService;
    zone1RoomTemperatureModeService;
    // Zone2 related
    zone2Service;
    zone2CurveSwitchService;
    zone2PowerSwitchService;
    zone2WaterTemperatureModeSensorService;
    zone2RoomTemperatureModeService;
    // Water heater related
    waterHeaterService;
    dhwPowerSwitchService;
    tbhPowerSwitchService;
    dhwSensorService;
    tbhSensorService;
    ibhSensorService;
    heatingSensorService;
    disinfectSwitchService;
    ecoSwitchService;
    silentModeSwitchService;
    /*********************************************************************
     * Constructor registers all the service types with Homebridge, registers
     * a callback function with the MideaDevice class, and requests device status.
     */
    constructor(platform, accessory, device, configDev) {
        super(platform, accessory, device, configDev);
        this.device = device;
        this.configDev = configDev;
        this.zone1Service = this.accessory.getService(this.platform.Service.Valve) || this.accessory.addService(this.platform.Service.Valve);
        this.service = this.zone1Service;
    }
    async updateCharacteristics(attributes) {
        // const updateState = false;
        for (const [k, v] of Object.entries(attributes)) {
            this.platform.log.debug(`[${this.device.name}] Set attribute ${k} to: ${v}`);
            switch (k) {
                default:
                    this.platform.log.debug(`[${this.device.name}] Attempt to set unsupported attribute ${k} to ${v}`);
                    break;
            }
        }
        // if (updateState) {
        // this.service.updateCharacteristic(this.platform.Characteristic.Active, this.getActive());
        // this.service.updateCharacteristic(this.platform.Characteristic.InUse, this.getInUse());
        // this.service.updateCharacteristic(this.platform.Characteristic.RemainingDuration, this.getRemainingDuration());
        // }
    }
}
//# sourceMappingURL=HeatPumpWiFiControllerAccessory.js.map
import BaseAccessory from './BaseAccessory.js';
export default class FreshAirApplianceAccessory extends BaseAccessory {
    device;
    configDev;
    service;
    silentModeService;
    autoSetModeService;
    /*********************************************************************
     * Constructor registers all the service types with Homebridge, registers
     * a callback function with the MideaDevice class, and requests device status.
     */
    constructor(platform, accessory, device, configDev) {
        super(platform, accessory, device, configDev);
        this.device = device;
        this.configDev = configDev;
        this.service =
            this.accessory.getService(this.platform.Service.HumidifierDehumidifier) || this.accessory.addService(this.platform.Service.HumidifierDehumidifier);
        this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.name);
        this.service.getCharacteristic(this.platform.Characteristic.Active).onGet(this.getActive.bind(this)).onSet(this.setActive.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState).onGet(this.getCurrentHeaterCoolerState.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
            .onGet(this.getTargetHeaterCoolerState.bind(this))
            .onSet(this.setTargetHeaterCoolerState.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature).onGet(this.getCurrentTemperature.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
            .onGet(this.getTargetTemperature.bind(this))
            .onSet(this.setTargetTemperature.bind(this))
            .setProps({
            minValue: this.configDev.CE_options.minTemp,
            maxValue: this.configDev.CE_options.maxTemp,
            minStep: this.configDev.CE_options.tempStep,
        });
        this.service
            .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
            .onGet(this.getTargetTemperature.bind(this))
            .onSet(this.setTargetTemperature.bind(this))
            .setProps({
            minValue: this.configDev.CE_options.minTemp,
            maxValue: this.configDev.CE_options.maxTemp,
            minStep: this.configDev.CE_options.tempStep,
        });
    }
    async updateCharacteristics(attributes) {
        for (const [k, v] of Object.entries(attributes)) {
            this.platform.log.debug(`[${this.device.name}] Set attribute ${k} to: ${v}`);
            let updateState = false;
            switch (k.toLowerCase()) {
                case 'power':
                    updateState = true;
                    break;
                case 'mode':
                    updateState = true;
                    break;
                case 'target_temperature':
                    // If MODE is 2 then device is heating.  Therefore target temperature value must be heating target? Right?
                    if (this.device.attributes.MODE === 2) {
                        this.service.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, this.getTargetTemperature());
                    }
                    else {
                        this.service.updateCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature, this.getTargetTemperature());
                    }
                    updateState = true;
                    break;
                case 'current_temperature':
                    this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.getCurrentTemperature());
                    break;
                case 'error_code':
                    this.service.updateCharacteristic(this.platform.Characteristic.StatusFault, this.device.attributes.ERROR_CODE > 0 ? this.platform.Characteristic.StatusFault.GENERAL_FAULT : this.platform.Characteristic.StatusFault.NO_FAULT);
                    break;
                default:
                    this.platform.log.debug(`[${this.device.name}] Attempt to set unsupported attribute ${k} to ${v}`);
                    break;
            }
            if (updateState) {
                this.service.updateCharacteristic(this.platform.Characteristic.Active, this.getActive());
                this.service.updateCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, this.getTargetHeaterCoolerState());
                this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState, this.getCurrentHeaterCoolerState());
            }
        }
    }
    getActive() {
        return this.device.attributes.POWER ? this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE;
    }
    async setActive(value) {
        await this.device.set_attribute({ POWER: value === this.platform.Characteristic.Active.ACTIVE });
    }
    getCurrentHeaterCoolerState() {
        // 1 - COOL, 2 - HEAT, 3 - FAN, 4 - AUTO
        if (!this.device.attributes.POWER || this.device.attributes.MODE === 0) {
            return this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE;
        }
        if (this.device.attributes.TARGET_TEMPERATURE < this.device.attributes.CURRENT_TEMPERATURE) {
            // COOL or AUTO
            if (this.device.attributes.MODE === 1 || this.device.attributes.MODE === 4) {
                return this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
            }
            return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
        }
        if (this.device.attributes.MODE === 2 || this.device.attributes.MODE === 4) {
            return this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
        }
        return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
    }
    getTargetHeaterCoolerState() {
        // 1 - COOL, 2 - HEAT, 3 - FAN, 4 - AUTO
        if (this.device.attributes.MODE === 1) {
            return this.platform.Characteristic.TargetHeaterCoolerState.COOL;
        }
        if (this.device.attributes.MODE === 2) {
            return this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
        }
        return this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
    }
    async setTargetHeaterCoolerState(value) {
        switch (value) {
            case this.platform.Characteristic.TargetHeaterCoolerState.COOL:
                await this.device.set_attribute({ POWER: true, MODE: 1 });
                break;
            case this.platform.Characteristic.TargetHeaterCoolerState.HEAT:
                await this.device.set_attribute({ POWER: true, MODE: 2 });
                break;
            case this.platform.Characteristic.TargetHeaterCoolerState.AUTO:
                await this.device.set_attribute({ POWER: true, MODE: 4 });
                break;
        }
    }
    getCurrentTemperature() {
        return this.device.attributes.CURRENT_TEMPERATURE;
    }
    getTargetTemperature() {
        return this.device.attributes.TARGET_TEMPERATURE;
    }
    async setTargetTemperature(value) {
        const limitedValue = Math.max(this.configDev.CE_options.minTemp, Math.min(this.configDev.CE_options.maxTemp, value));
        await this.device.set_attribute({ POWER: true, TARGET_TEMPERATURE: limitedValue });
    }
}
//# sourceMappingURL=FreshAirApplianceAccessory.js.map
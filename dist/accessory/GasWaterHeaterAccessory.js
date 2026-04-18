import BaseAccessory from './BaseAccessory.js';
const burningStateSubtype = 'burningState';
const protectionSubtype = 'protection';
const zeroColdWaterSubtype = 'zeroColdWater';
const zeroColdPulseSubtype = 'zeroColdPulse';
const smartVolumeSubtype = 'smartVolume';
export default class GasWaterHeaterAccessory extends BaseAccessory {
    device;
    configDev;
    service;
    // Sensors/states
    burningStateService;
    protectionService;
    // Switches
    zeroColdWaterService;
    zeroColdPulseService;
    smartVolumeService;
    constructor(platform, accessory, device, configDev) {
        super(platform, accessory, device, configDev);
        this.device = device;
        this.configDev = configDev;
        this.service = this.accessory.getService(this.platform.Service.HeaterCooler) || this.accessory.addService(this.platform.Service.HeaterCooler);
        this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.name);
        this.service.getCharacteristic(this.platform.Characteristic.Active).onGet(this.getActive.bind(this)).onSet(this.setActive.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState).onGet(this.getCurrentHeaterCoolerState.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
            .onGet(this.getTargetHeaterCoolerState.bind(this))
            .onSet(this.setTargetHeaterCoolerState.bind(this))
            .setProps({
            validValues: [this.platform.Characteristic.TargetHeatingCoolingState.OFF, this.platform.Characteristic.TargetHeaterCoolerState.HEAT],
        });
        this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature).onGet(this.getCurrentTemperature.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
            .onGet(this.getTargetTemperature.bind(this))
            .onSet(this.setTargetTemperature.bind(this))
            .setProps({
            minValue: this.configDev.E3_options.minTemp,
            maxValue: this.configDev.E3_options.maxTemp,
            minStep: this.configDev.E3_options.tempStep,
        });
        // Burning state sensor
        this.burningStateService = this.accessory.getServiceById(this.platform.Service.MotionSensor, burningStateSubtype);
        if (this.configDev.E3_options.burningStateSensor) {
            this.burningStateService ??= this.accessory.addService(this.platform.Service.MotionSensor, undefined, burningStateSubtype);
            this.handleConfiguredName(this.burningStateService, burningStateSubtype, 'Burning State');
            this.burningStateService.getCharacteristic(this.platform.Characteristic.On).onGet(this.getBurningState.bind(this));
        }
        else if (this.burningStateService) {
            this.accessory.removeService(this.burningStateService);
        }
        // Protection sensor
        this.protectionService = this.accessory.getServiceById(this.platform.Service.MotionSensor, protectionSubtype);
        if (this.configDev.E3_options.protectionSensor) {
            this.protectionService ??= this.accessory.addService(this.platform.Service.MotionSensor, undefined, protectionSubtype);
            this.handleConfiguredName(this.protectionService, protectionSubtype, 'Protection');
            this.protectionService.getCharacteristic(this.platform.Characteristic.On).onGet(this.getProtection.bind(this));
        }
        else if (this.protectionService) {
            this.accessory.removeService(this.protectionService);
        }
        // Zero Cold Water switch
        this.zeroColdWaterService = this.accessory.getServiceById(this.platform.Service.Switch, zeroColdWaterSubtype);
        if (this.configDev.E3_options.zeroColdWaterSwitch) {
            this.zeroColdWaterService ??= this.accessory.addService(this.platform.Service.Switch, undefined, zeroColdWaterSubtype);
            this.handleConfiguredName(this.zeroColdWaterService, zeroColdWaterSubtype, 'Zero Cold Water');
            this.zeroColdWaterService
                .getCharacteristic(this.platform.Characteristic.On)
                .onGet(this.getZeroColdWater.bind(this))
                .onSet(this.setZeroColdWater.bind(this));
        }
        else if (this.zeroColdWaterService) {
            this.accessory.removeService(this.zeroColdWaterService);
        }
        // Zero Cold Pulse switch
        this.zeroColdPulseService = this.accessory.getServiceById(this.platform.Service.Switch, zeroColdPulseSubtype);
        if (this.configDev.E3_options.zeroColdPulseSwitch) {
            this.zeroColdPulseService ??= this.accessory.addService(this.platform.Service.Switch, undefined, zeroColdPulseSubtype);
            this.handleConfiguredName(this.zeroColdPulseService, zeroColdPulseSubtype, 'Zero Cold Pulse');
            this.zeroColdPulseService
                .getCharacteristic(this.platform.Characteristic.On)
                .onGet(this.getZeroColdPulse.bind(this))
                .onSet(this.setZeroColdPulse.bind(this));
        }
        else if (this.zeroColdPulseService) {
            this.accessory.removeService(this.zeroColdPulseService);
        }
        // Smart Volume switch
        this.smartVolumeService = this.accessory.getServiceById(this.platform.Service.Switch, smartVolumeSubtype);
        if (this.configDev.E3_options.smartVolumeSwitch) {
            this.smartVolumeService ??= this.accessory.addService(this.platform.Service.Switch, undefined, smartVolumeSubtype);
            this.handleConfiguredName(this.smartVolumeService, smartVolumeSubtype, 'Smart Volume');
            this.smartVolumeService.getCharacteristic(this.platform.Characteristic.On).onGet(this.getSmartVolume.bind(this)).onSet(this.setSmartVolume.bind(this));
        }
        else if (this.smartVolumeService) {
            this.accessory.removeService(this.smartVolumeService);
        }
    }
    /*********************************************************************
     * Callback function called by MideaDevice whenever there is a change to
     * any attribute value.
     */
    async updateCharacteristics(attributes) {
        for (const [k, v] of Object.entries(attributes)) {
            this.platform.log.debug(`[${this.device.name}] Set attribute ${k} to: ${v}`);
            let updateState = false;
            switch (k.toLowerCase()) {
                case 'power':
                    this.service.updateCharacteristic(this.platform.Characteristic.Active, v ? this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE);
                    updateState = true;
                    break;
                case 'burning_state':
                    this.burningStateService?.updateCharacteristic(this.platform.Characteristic.MotionDetected, v);
                    break;
                case 'zero_cold_water':
                    this.zeroColdWaterService?.updateCharacteristic(this.platform.Characteristic.On, v);
                    break;
                case 'protection':
                    this.protectionService?.updateCharacteristic(this.platform.Characteristic.MotionDetected, v);
                    break;
                case 'zero_cold_pulse':
                    this.zeroColdPulseService?.updateCharacteristic(this.platform.Characteristic.On, v);
                    break;
                case 'smart_volume':
                    this.smartVolumeService?.updateCharacteristic(this.platform.Characteristic.On, v);
                    break;
                case 'current_temperature':
                    this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, v);
                    updateState = true;
                    break;
                case 'target_temperature':
                    this.service.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, v);
                    updateState = true;
                    break;
                default:
                    this.platform.log.debug(`[${this.device.name}] Attempt to set unsupported attribute ${k} to ${v}`);
            }
            if (updateState) {
                this.service.updateCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, this.getTargetHeaterCoolerState());
                this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState, this.getCurrentHeaterCoolerState());
            }
        }
    }
    /*********************************************************************
     * Callback functions for each Homebridge/HomeKit service
     *
     */
    getActive() {
        return this.device.attributes.POWER ? this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE;
    }
    async setActive(value) {
        await this.device.set_attribute({ POWER: !!value });
    }
    getCurrentHeaterCoolerState() {
        if (this.device.attributes.POWER) {
            return this.device.attributes.HEATING
                ? this.platform.Characteristic.CurrentHeaterCoolerState.HEATING
                : this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
        }
        return this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE;
    }
    getTargetHeaterCoolerState() {
        return this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
    }
    async setTargetHeaterCoolerState(value) {
        if (value === this.platform.Characteristic.TargetHeaterCoolerState.HEAT) {
            await this.device.set_attribute({ POWER: true });
        }
        else {
            await this.device.set_attribute({ POWER: false });
        }
    }
    getCurrentTemperature() {
        return this.device.attributes.CURRENT_TEMPERATURE ?? this.configDev.E3_options.minTemp;
    }
    getTargetTemperature() {
        return Math.max(this.configDev.E3_options.minTemp, Math.min(this.configDev.E3_options.maxTemp, this.device.attributes.TARGET_TEMPERATURE));
    }
    async setTargetTemperature(value) {
        const limitedValue = Math.max(this.configDev.E3_options.minTemp, Math.min(this.configDev.E3_options.maxTemp, value));
        await this.device.set_attribute({ TARGET_TEMPERATURE: limitedValue });
    }
    getBurningState() {
        return this.device.attributes.BURNING_STATE;
    }
    getProtection() {
        return this.device.attributes.PROTECTION;
    }
    getZeroColdWater() {
        return this.device.attributes.ZERO_COLD_WATER;
    }
    async setZeroColdWater(value) {
        await this.device.set_attribute({ ZERO_COLD_WATER: !!value });
    }
    getZeroColdPulse() {
        return this.device.attributes.ZERO_COLD_PULSE;
    }
    async setZeroColdPulse(value) {
        await this.device.set_attribute({ ZERO_COLD_PULSE: !!value });
    }
    getSmartVolume() {
        return this.device.attributes.SMART_VOLUME;
    }
    async setSmartVolume(value) {
        await this.device.set_attribute({ SMART_VOLUME: !!value });
    }
}
//# sourceMappingURL=GasWaterHeaterAccessory.js.map
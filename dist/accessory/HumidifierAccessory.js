import BaseAccessory from './BaseAccessory.js';
export default class FanAccessory extends BaseAccessory {
    device;
    configDev;
    service;
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
        this.service.getCharacteristic(this.platform.Characteristic.Active).onGet(this.getActive.bind(this)).onSet(this.setActive.bind(this));
    }
    async updateCharacteristics(attributes) {
        let updateState = false;
        for (const [k, v] of Object.entries(attributes)) {
            this.platform.log.debug(`[${this.device.name}] Set attribute ${k} to: ${v}`);
            switch (k) {
                case 'power':
                    updateState = true;
                    break;
                // case 'mode':
                //   this.service.updateCharacteristic(this.platform.Characteristic.TargetFanState, this.getTargetFanState());
                //   break;
                // case 'fan_speed':
                //   this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.getRotationSpeed());
                //   break;
                // case 'child_lock':
                //   this.service.updateCharacteristic(this.platform.Characteristic.LockPhysicalControls, this.getLockPhysicalControls());
                //   break;
                // case 'oscillate':
                // case 'oscillation_angle':
                // case 'oscillation_mode':
                // case 'tilting_angle':
                //   this.service.updateCharacteristic(this.platform.Characteristic.SwingMode, this.getSwingMode());
                //   break;
                default:
                    this.platform.log.debug(`[${this.device.name}] Attempt to set unsupported attribute ${k} to ${v}`);
                    break;
            }
        }
        if (updateState) {
            this.service.updateCharacteristic(this.platform.Characteristic.Active, this.getActive());
        }
    }
    getActive() {
        return this.device.attributes.POWER ? this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE;
    }
    async setActive(value) {
        await this.device.set_attribute({ POWER: value === this.platform.Characteristic.Active.ACTIVE });
    }
}
//# sourceMappingURL=HumidifierAccessory.js.map
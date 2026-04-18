export default class BaseAccessory {
    platform;
    accessory;
    device;
    configDev;
    constructor(platform, accessory, device, configDev) {
        this.platform = platform;
        this.accessory = accessory;
        this.device = device;
        this.configDev = configDev;
        // biome-ignore lint/style/noNonNullAssertion: by design, AccessoryInformation service is always present
        this.accessory
            .getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Midea')
            .setCharacteristic(this.platform.Characteristic.Model, this.accessory.context.model ?? this.device.model)
            .setCharacteristic(this.platform.Characteristic.SerialNumber, this.accessory.context.sn ?? this.device.sn)
            .setCharacteristic(this.platform.Characteristic.ProductData, `deviceId: ${this.accessory.context.id ?? this.device.id.toString()}`);
        if (!this.accessory.context.configuredNames) {
            this.accessory.context.configuredNames = {};
        }
        // Register a callback function with MideaDevice and then refresh device status.  The callback
        // is called whenever there is a change in any attribute value from the device.
        this.device.on('update', this.updateCharacteristics.bind(this));
        this.device.on('error_refresh', () => {
            this.service.updateCharacteristic(this.platform.Characteristic.Active, new Error('Error refreshing device status'));
        });
    }
    handleConfiguredName(service, subtype, fallbackName) {
        service
            .getCharacteristic(this.platform.Characteristic.ConfiguredName)
            .onGet(() => this.accessory.context.configuredNames[subtype] ?? `${this.device.name} ${fallbackName}`)
            .onSet((value) => {
            this.accessory.context.configuredNames[subtype] = value;
        });
    }
}
export function limitValue(value, min, max) {
    return Math.max(min, Math.min(value, max));
}
//# sourceMappingURL=BaseAccessory.js.map
import type { Service } from 'homebridge';
import type MideaDevice from '../core/MideaDevice.js';
import type { DeviceAttributeBase } from '../core/MideaDevice.js';
import type { MideaAccessory, MideaPlatform } from '../platform.js';
import type { DeviceConfig } from '../platformUtils.js';

export default abstract class BaseAccessory<T extends MideaDevice> {
  // main service of the accessory
  protected abstract service: Service;

  constructor(
    protected readonly platform: MideaPlatform,
    protected readonly accessory: MideaAccessory,
    protected readonly device: T,
    protected readonly configDev: DeviceConfig,
  ) {
    // biome-ignore lint/style/noNonNullAssertion: by design, AccessoryInformation service is always present
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Midea')
      .setCharacteristic(this.platform.Characteristic.Model, this.accessory.context.model ?? this.device.model)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.accessory.context.sn ?? this.device.sn)
      .setCharacteristic(this.platform.Characteristic.ProductData, `deviceId: ${this.accessory.context.id ?? this.device.id.toString()}`);

    // Register a callback function with MideaDevice and then refresh device status.  The callback
    // is called whenever there is a change in any attribute value from the device.
    this.device.on('update', this.updateCharacteristics.bind(this));
    this.device.on('error_refresh', () => {
      this.service.updateCharacteristic(this.platform.Characteristic.Active, new Error('Error refreshing device status'));
    });
  }

  handleConfiguredName(service: Service, subtype: string, fallbackName: string) {
    service
      .getCharacteristic(this.platform.Characteristic.ConfiguredName)
      .onGet(() => this.accessory.context.configuredNames[subtype] ?? `${this.device.name} ${fallbackName}`)
      .onSet((value) => {
        this.accessory.context.configuredNames[subtype] = value as string;
      });
  }

  // protected abstract handleErrorRefresh(): void;
  protected abstract updateCharacteristics(attributes: DeviceAttributeBase): Promise<void>;
}

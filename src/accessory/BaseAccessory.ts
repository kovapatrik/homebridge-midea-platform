import { MideaAccessory, MideaPlatform } from '../platform.js';
import MideaDevice, { DeviceAttributeBase } from '../core/MideaDevice.js';
import { DeviceConfig } from '../platformUtils.js';
import { Service } from 'homebridge';

export default abstract class BaseAccessory<T extends MideaDevice> {
  // main service of the accessory
  protected abstract service: Service;

  constructor(
    protected readonly platform: MideaPlatform,
    protected readonly accessory: MideaAccessory,
    protected readonly device: T,
    protected readonly configDev: DeviceConfig,
  ) {
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

  // protected abstract handleErrorRefresh(): void;
  protected abstract updateCharacteristics(attributes: DeviceAttributeBase): Promise<void>;
}

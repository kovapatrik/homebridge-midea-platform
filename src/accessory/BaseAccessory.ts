import { MideaAccessory, MideaPlatform } from '../platform';
import MideaDevice from '../core/MideaDevice';
import { DeviceConfig } from '../platformUtils';

export default class BaseAccessory<T extends MideaDevice> {

  constructor(
    protected readonly platform: MideaPlatform,
    protected readonly accessory: MideaAccessory,
    protected readonly device: T,
    protected readonly configDev: DeviceConfig,
  ) {

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Midea')
      .setCharacteristic(this.platform.Characteristic.Model, this.device.model)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.device.sn);

    this.device.open();
  }
}

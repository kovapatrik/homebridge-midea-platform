import { PlatformAccessory, Service } from 'homebridge';
import { MideaPlatform } from '../platform';

export default class BaseAccessory {
  protected service!: Service;

  constructor(
    protected readonly platform: MideaPlatform,
    protected readonly accessory: PlatformAccessory,
  ) {

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Midea')
      .setCharacteristic(this.platform.Characteristic.Model, this.accessory.context.device.model)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.accessory.context.device.sn);

    setInterval(() => {
      this.accessory.context.device.send_heartbeat();
    }, 10000);

    // setInterval(() => {
    //   this.accessory.context.device.refresh_status();
    // }, 30000);
  }
}

import { PlatformAccessory, Service } from 'homebridge';
import { MideaPlatform } from '../platform';
import { ParseMessageResult } from '../core/MideaConstants';

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

    setInterval(async () => {
      this.accessory.context.device.send_heartbeat();
      try {
        const msg = await this.accessory.context.device.promiseSocket.read(512);
        if (msg && msg.length > 0) {
          this.accessory.context.device.parse_message(msg);
        }
      } catch (err) {
        this.platform.log.error(err as string);
      }
    }, 10000);

    setInterval(() => {
      this.accessory.context.device.refresh_status();
    }, 30000);
  }
}

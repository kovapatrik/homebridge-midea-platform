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

    setInterval(async () => {
      this.device.send_heartbeat();
      try {
        const msg = await this.device.promiseSocket.read(512);
        if (msg && msg.length > 0) {
          this.device.parse_message(msg);
        }
      } catch (err) {
        this.platform.log.error(err as string);
      }
    }, 10000);

    setInterval(() => {
      this.device.refresh_status();
    }, 30000);
  }
}

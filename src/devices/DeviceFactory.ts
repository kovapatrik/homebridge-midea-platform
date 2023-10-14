import { Logger } from 'homebridge';
import { DeviceInfo, DeviceType } from '../core/MideaConstants';
import MideaACDevice from './ac/MideaACDevice';
import MideaA1Device from './a1/MideaA1Device';
import { Config } from '../platformUtils';

export default class DeviceFactory {
  public static createDevice(
    logger: Logger,
    device_info: DeviceInfo,
    config: Partial<Config>,
  ) {
    switch (device_info.type) {
      case DeviceType.AIR_CONDITIONER:
        return new MideaACDevice(logger, device_info, config);
      case DeviceType.DEHUMIDIFIER:
        return new MideaA1Device(logger, device_info, config);
    }
  }
}

import { Logger } from 'homebridge';
import { DeviceInfo, DeviceType } from '../core/MideaConstants';
import MideaACDevice from './ac/MideaACDevice';
import MideaA1Device from './a1/MideaA1Device';
import { Config, DeviceConfig } from '../platformUtils';

export default class DeviceFactory {
  public static createDevice(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig) {
    switch (device_info.type) {
      case DeviceType.AIR_CONDITIONER:
        return new MideaACDevice(logger, device_info, config, deviceConfig);
      case DeviceType.DEHUMIDIFIER:
        return new MideaA1Device(logger, device_info, config, deviceConfig);
    }
  }
}

import { Logger } from 'homebridge';
import { DeviceInfo, DeviceType } from '../core/MideaConstants';
import { Config, DeviceConfig } from '../platformUtils';
import MideaACDevice from './ac/MideaACDevice';
import MideaA1Device from './a1/MideaA1Device';
import MideaE2Device from './e2/MideaE2Device';
import MideaE3Device from './e3/MideaE3Device';
import MideaFADevice from './fa/MideaFADevice';

export default class DeviceFactory {
  public static createDevice(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig) {
    switch (device_info.type) {
      case DeviceType.AIR_CONDITIONER:
        return new MideaACDevice(logger, device_info, config, deviceConfig);
      case DeviceType.DEHUMIDIFIER:
        return new MideaA1Device(logger, device_info, config, deviceConfig);
      case DeviceType.ELECTRIC_WATER_HEATER:
        return new MideaE2Device(logger, device_info, config, deviceConfig);
      case DeviceType.GAS_WATER_HEATER:
        return new MideaE3Device(logger, device_info, config, deviceConfig);
      case DeviceType.FAN:
        return new MideaFADevice(logger, device_info, config, deviceConfig);
      default:
        return null;
    }
  }
}

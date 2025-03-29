import type { Logger } from 'homebridge';
import { type DeviceInfo, DeviceType } from '../core/MideaConstants.js';
import type { Config, DeviceConfig } from '../platformUtils.js';
import MideaA1Device from './a1/MideaA1Device.js';
import MideaACDevice from './ac/MideaACDevice.js';
import MideaC3Device from './c3/MideaC3Device.js';
import MideaDBDevice from './db/MideaDBDevice.js';
import MideaE1Device from './e1/MideaE1Device.js';
import MideaE2Device from './e2/MideaE2Device.js';
import MideaE3Device from './e3/MideaE3Device.js';
import MideaFADevice from './fa/MideaFADevice.js';
import MideaFDDevice from './fd/MideaFDDevice.js';

// biome-ignore lint/complexity/noStaticOnlyClass: static class is used for factory
export default class DeviceFactory {
  public static createDevice(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig) {
    switch (device_info.type) {
      case DeviceType.DEHUMIDIFIER:
        return new MideaA1Device(logger, device_info, config, deviceConfig);
      case DeviceType.AIR_CONDITIONER:
        return new MideaACDevice(logger, device_info, config, deviceConfig);
      case DeviceType.HEAT_PUMP_WIFI_CONTROLLER:
        return new MideaC3Device(logger, device_info, config, deviceConfig);
      case DeviceType.FRONT_LOAD_WASHER:
        return new MideaDBDevice(logger, device_info, config, deviceConfig);
      case DeviceType.DISHWASHER:
        return new MideaE1Device(logger, device_info, config, deviceConfig);
      case DeviceType.ELECTRIC_WATER_HEATER:
        return new MideaE2Device(logger, device_info, config, deviceConfig);
      case DeviceType.GAS_WATER_HEATER:
        return new MideaE3Device(logger, device_info, config, deviceConfig);
      case DeviceType.FAN:
        return new MideaFADevice(logger, device_info, config, deviceConfig);
      case DeviceType.HUMIDIFIER:
        return new MideaFDDevice(logger, device_info, config, deviceConfig);
      default:
        return null;
    }
  }
}

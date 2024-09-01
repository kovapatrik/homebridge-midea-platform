import { DeviceType } from '../core/MideaConstants';
import { MideaAccessory, MideaPlatform } from '../platform';
import AirConditionerAccessory from './AirConditionerAccessory';
import DehumidifierAccessory from './DehumidifierAccessory';
import FrontLoadWasherAccessory from './FrontLoadWasherAccessory';
import ElectricWaterHeaterAccessory from './ElectricWaterHeaterAccessory';
import GasWaterHeaterAccessory from './GasWaterHeaterAccessory';
import FanAccessory from './FanAccessory';
import DishwasherAccessory from './DishwasherAccessory';

import MideaDevice from '../core/MideaDevice';
import { DeviceConfig } from '../platformUtils';

import MideaACDevice from '../devices/ac/MideaACDevice';
import MideaA1Device from '../devices/a1/MideaA1Device';
import MideaDBDevice from '../devices/db/MideaDBDevice';
import MideaE2Device from '../devices/e2/MideaE2Device';
import MideaE3Device from '../devices/e3/MideaE3Device';
import MideaFADevice from '../devices/fa/MideaFADevice';
import MideaE1Device from '../devices/e1/MideaE1Device';

export default class AccessoryFactory {
  public static createAccessory<T extends MideaDevice>(
    platform: MideaPlatform,
    accessory: MideaAccessory,
    device: T,
    configDev: DeviceConfig,
  ) {
    switch (device.type) {
      case DeviceType.DEHUMIDIFIER:
        return new DehumidifierAccessory(platform, accessory, device as unknown as MideaA1Device, configDev);
      case DeviceType.AIR_CONDITIONER:
        return new AirConditionerAccessory(platform, accessory, device as unknown as MideaACDevice, configDev);
      case DeviceType.FRONT_LOAD_WASHER:
        return new FrontLoadWasherAccessory(platform, accessory, device as unknown as MideaDBDevice, configDev);
      case DeviceType.DISHWASHER:
        return new DishwasherAccessory(platform, accessory, device as unknown as MideaE1Device, configDev);
      case DeviceType.ELECTRIC_WATER_HEATER:
        return new ElectricWaterHeaterAccessory(platform, accessory, device as unknown as MideaE2Device, configDev);
      case DeviceType.GAS_WATER_HEATER:
        return new GasWaterHeaterAccessory(platform, accessory, device as unknown as MideaE3Device, configDev);
      case DeviceType.FAN:
        return new FanAccessory(platform, accessory, device as unknown as MideaFADevice, configDev);
      case DeviceType.UNKNOWN:
      default:
        throw new Error(`Unsupported device type: ${device.type}`);
    }
  }
}

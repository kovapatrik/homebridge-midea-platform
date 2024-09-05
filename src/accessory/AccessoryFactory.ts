import { DeviceType } from '../core/MideaConstants';
import { MideaAccessory, MideaPlatform } from '../platform';

import AirConditionerAccessory from './AirConditionerAccessory';
import MideaACDevice from '../devices/ac/MideaACDevice';

import DehumidifierAccessory from './DehumidifierAccessory';
import MideaA1Device from '../devices/a1/MideaA1Device';

import FrontLoadWasherAccessory from './FrontLoadWasherAccessory';
import MideaDBDevice from '../devices/db/MideaDBDevice';

import ElectricWaterHeaterAccessory from './ElectricWaterHeaterAccessory';
import MideaE2Device from '../devices/e2/MideaE2Device';

import GasWaterHeaterAccessory from './GasWaterHeaterAccessory';
import MideaE3Device from '../devices/e3/MideaE3Device';

import FanAccessory from './FanAccessory';
import MideaFADevice from '../devices/fa/MideaFADevice';

import DishwasherAccessory from './DishwasherAccessory';
import MideaE1Device from '../devices/e1/MideaE1Device';

import HeatPumpWiFiControllerAccessory from './HeatPumpWifiControllerAccessory';
import MideaC3Device from '../devices/c3/MideaC3Device';

import MideaDevice from '../core/MideaDevice';
import { DeviceConfig } from '../platformUtils';

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
      case DeviceType.HEAT_PUMP_WIFI_CONTROLLER:
        return new HeatPumpWiFiControllerAccessory(platform, accessory, device as unknown as MideaC3Device, configDev);
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

import { PlatformAccessory } from 'homebridge';
import { DeviceType } from '../core/MideaConstants';
import { MideaPlatform } from '../platform';
import AirConditionerAccessory from './AirConditionerAccessory';
import MideaDevice from '../core/MideaDevice';
import { DeviceConfig } from '../platformUtils';
import MideaACDevice from '../devices/ac/MideaACDevice';

export default class AccessoryFactory {

  public static createAccessory<T extends MideaDevice>(platform: MideaPlatform, accessory: PlatformAccessory, device: T, configDev: DeviceConfig) {
    switch (device.type) {
      case DeviceType.AIR_CONDITIONER:
        return new AirConditionerAccessory(platform, accessory, device as unknown as MideaACDevice, configDev);
    }
  }
}
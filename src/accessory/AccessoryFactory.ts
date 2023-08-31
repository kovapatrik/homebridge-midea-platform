import { PlatformAccessory } from 'homebridge';
import { DeviceType } from '../core/MideaConstants';
import { MideaPlatform } from '../platform';
import AirConditionerAccessory from './AirConditionerAccessory';

export default class AccessoryFactory {

  public static createAccessory(platform: MideaPlatform, accessory: PlatformAccessory, deviceType: DeviceType) {
    switch (deviceType) {
      case DeviceType.AIR_CONDITIONER:
        return new AirConditionerAccessory(platform, accessory);
    }
  }
}
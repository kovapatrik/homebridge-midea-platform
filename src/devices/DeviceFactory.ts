import { Logger } from 'homebridge';
import { DeviceInfo, DeviceType } from '../core/MideaConstants';
import MideaACDevice from './ac/MideaACDevice';
import { KeyToken } from '../core/MideaSecurity';

export default class DeviceFactory {
  public static createDevice(logger: Logger, device_info: DeviceInfo, token: KeyToken, key: KeyToken) {
    switch (device_info.type) {
      case DeviceType.AIR_CONDITIONER:
        return new MideaACDevice(logger, device_info, token, key);
    }
  }
}
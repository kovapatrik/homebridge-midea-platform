import { Logger } from 'homebridge';
import { DeviceInfo, DeviceType } from '../core/MideaConstants';
import MideaACDevice from './ac/MideaACDevice';
import MideaA1Device from './a1/MideaA1Device';
import { KeyToken } from '../core/MideaSecurity';
import { Config } from '../platformUtils';

export default class DeviceFactory {
  public static createDevice(logger: Logger, device_info: DeviceInfo, token: KeyToken, key: KeyToken, config: Partial<Config>) {
    switch (device_info.type) {
      case DeviceType.AIR_CONDITIONER:
        return new MideaACDevice(logger, device_info, token, key, config);
      case DeviceType.DEHUMIDIFIER:
        return new MideaA1Device(logger, device_info, token, key, config);
    }
  }
}
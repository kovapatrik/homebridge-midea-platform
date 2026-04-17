import type { Logger } from 'homebridge';
import { type DeviceInfo } from '../core/MideaConstants.js';
import type { Config, DeviceConfig } from '../platformUtils.js';
import MideaA1Device from './a1/MideaA1Device.js';
import MideaACDevice from './ac/MideaACDevice.js';
import MideaC3Device from './c3/MideaC3Device.js';
import MideaCDDevice from './cd/MideaCDDevice.js';
import MideaCEDevice from './ce/MideaCEDevice.js';
import MideaDBDevice from './db/MideaDBDevice.js';
import MideaE1Device from './e1/MideaE1Device.js';
import MideaE2Device from './e2/MideaE2Device.js';
import MideaE3Device from './e3/MideaE3Device.js';
import MideaFADevice from './fa/MideaFADevice.js';
import MideaFDDevice from './fd/MideaFDDevice.js';
export default class DeviceFactory {
    static createDevice(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig): MideaACDevice | MideaA1Device | MideaDBDevice | MideaE2Device | MideaE3Device | MideaFADevice | MideaE1Device | MideaC3Device | MideaFDDevice | MideaCEDevice | MideaCDDevice | null;
}

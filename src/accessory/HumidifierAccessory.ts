/***********************************************************************
 * Midea Platform Humidifier Accessory class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * Based on https://github.com/homebridge/homebridge-plugin-template
 *
 * An instance of this class is created for each accessory the platform registers.
 *
 */
import type { CharacteristicValue, Service } from 'homebridge';
import type MideaFDDevice from '../devices/fd/MideaFDDevice.js';
import type { FDAttributes } from '../devices/fd/MideaFDDevice.js';
import type { MideaAccessory, MideaPlatform } from '../platform.js';
import type { DeviceConfig } from '../platformUtils.js';
import BaseAccessory from './BaseAccessory.js';

export default class FanAccessory extends BaseAccessory<MideaFDDevice> {
  protected service: Service;

  /*********************************************************************
   * Constructor registers all the service types with Homebridge, registers
   * a callback function with the MideaDevice class, and requests device status.
   */
  constructor(
    platform: MideaPlatform,
    accessory: MideaAccessory,
    protected readonly device: MideaFDDevice,
    protected readonly configDev: DeviceConfig,
  ) {
    super(platform, accessory, device, configDev);

    this.service =
      this.accessory.getService(this.platform.Service.HumidifierDehumidifier) || this.accessory.addService(this.platform.Service.HumidifierDehumidifier);

    this.service.getCharacteristic(this.platform.Characteristic.Active).onGet(this.getActive.bind(this)).onSet(this.setActive.bind(this));
  }

  async updateCharacteristics(attributes: Partial<FDAttributes>) {
    let updateState = false;
    for (const [k, v] of Object.entries(attributes)) {
      this.platform.log.debug(`[${this.device.name}] Set attribute ${k} to: ${v}`);
      switch (k) {
        case 'power':
          updateState = true;
          break;
        // case 'mode':
        //   this.service.updateCharacteristic(this.platform.Characteristic.TargetFanState, this.getTargetFanState());
        //   break;
        // case 'fan_speed':
        //   this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.getRotationSpeed());
        //   break;
        // case 'child_lock':
        //   this.service.updateCharacteristic(this.platform.Characteristic.LockPhysicalControls, this.getLockPhysicalControls());
        //   break;
        // case 'oscillate':
        // case 'oscillation_angle':
        // case 'oscillation_mode':
        // case 'tilting_angle':
        //   this.service.updateCharacteristic(this.platform.Characteristic.SwingMode, this.getSwingMode());
        //   break;
        default:
          this.platform.log.debug(`[${this.device.name}] Attempt to set unsupported attribute ${k} to ${v}`);
          break;
      }
    }
    if (updateState) {
      this.service.updateCharacteristic(this.platform.Characteristic.Active, this.getActive());
    }
  }

  getActive(): CharacteristicValue {
    return this.device.attributes.POWER ? this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE;
  }

  async setActive(value: CharacteristicValue) {
    await this.device.set_attribute({ POWER: value === this.platform.Characteristic.Active.ACTIVE });
  }
}

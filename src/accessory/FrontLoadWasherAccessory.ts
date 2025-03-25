/***********************************************************************
 * Midea Platform Front Load Washer Accessory class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * Based on https://github.com/homebridge/homebridge-plugin-template
 *
 * An instance of this class is created for each accessory the platform registers.
 *
 */
import type { CharacteristicValue, Service } from 'homebridge';
import type MideaDBDevice from '../devices/db/MideaDBDevice.js';
import type { DBAttributes } from '../devices/db/MideaDBDevice.js';
import type { MideaAccessory, MideaPlatform } from '../platform.js';
import type { DeviceConfig } from '../platformUtils.js';
import BaseAccessory from './BaseAccessory.js';

export default class FanAccessory extends BaseAccessory<MideaDBDevice> {
  protected service: Service;

  /*********************************************************************
   * Constructor registers all the service types with Homebridge, registers
   * a callback function with the MideaDevice class, and requests device status.
   */
  constructor(
    platform: MideaPlatform,
    accessory: MideaAccessory,
    protected readonly device: MideaDBDevice,
    protected readonly configDev: DeviceConfig,
  ) {
    super(platform, accessory, device, configDev);

    this.service = this.accessory.getService(this.platform.Service.Valve) || this.accessory.addService(this.platform.Service.Valve);

    this.service.getCharacteristic(this.platform.Characteristic.Active).onGet(this.getActive.bind(this)).onSet(this.setActive.bind(this));
    this.service.getCharacteristic(this.platform.Characteristic.InUse).onGet(this.getInUse.bind(this));
    this.service.getCharacteristic(this.platform.Characteristic.ValveType).onGet(() => this.platform.Characteristic.ValveType.GENERIC_VALVE);
    this.service
      .getCharacteristic(this.platform.Characteristic.RemainingDuration)
      .setProps({ minValue: 0, maxValue: 60 * 60 * 8, minStep: 1 })
      .onGet(this.getRemainingDuration.bind(this));
  }

  async updateCharacteristics(attributes: Partial<DBAttributes>) {
    let updateState = false;
    for (const [k, v] of Object.entries(attributes)) {
      this.platform.log.debug(`[${this.device.name}] Set attribute ${k} to: ${v}`);
      switch (k) {
        case 'power':
          updateState = true;
          break;
        case 'start':
          updateState = true;
          break;
        case 'time_remaining':
        case 'progress':
          updateState = true;
          break;
        default:
          this.platform.log.debug(`[${this.device.name}] Attempt to set unsupported attribute ${k} to ${v}`);
          break;
      }
    }
    if (updateState) {
      this.service.updateCharacteristic(this.platform.Characteristic.Active, this.getActive());
      this.service.updateCharacteristic(this.platform.Characteristic.InUse, this.getInUse());
      this.service.updateCharacteristic(this.platform.Characteristic.RemainingDuration, this.getRemainingDuration());
    }
  }

  getActive(): CharacteristicValue {
    return this.device.attributes.POWER ? this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE;
  }

  async setActive(value: CharacteristicValue) {
    await this.device.set_attribute({ POWER: value === this.platform.Characteristic.Active.ACTIVE });
  }

  getInUse(): CharacteristicValue {
    return this.device.attributes.START ? this.platform.Characteristic.InUse.IN_USE : this.platform.Characteristic.InUse.NOT_IN_USE;
  }

  getRemainingDuration(): CharacteristicValue {
    return this.device.attributes.TIME_REMAINING * 60; // in seconds
  }
}

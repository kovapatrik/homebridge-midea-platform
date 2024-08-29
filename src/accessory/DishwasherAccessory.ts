/***********************************************************************
 * Midea Platform Dishwasher Accessory class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * Based on https://github.com/homebridge/homebridge-plugin-template
 *
 * An instance of this class is created for each accessory the platform registers.
 *
 */
import { CharacteristicValue, Service } from 'homebridge';
import { MideaAccessory, MideaPlatform } from '../platform';
import BaseAccessory from './BaseAccessory';
import { DeviceConfig } from '../platformUtils';
import MideaE1Device, { E1Attributes } from '../devices/e1/MideaE1Device';

export default class DishwasherAccessory extends BaseAccessory<MideaE1Device> {
  private service: Service;

  /*********************************************************************
   * Constructor registers all the service types with Homebridge, registers
   * a callback function with the MideaDevice class, and requests device status.
   */
  constructor(
    platform: MideaPlatform,
    accessory: MideaAccessory,
    protected readonly device: MideaE1Device,
    protected readonly configDev: DeviceConfig,
  ) {
    super(platform, accessory, device, configDev);

    this.service = this.accessory.getService(this.platform.Service.Valve) || this.accessory.addService(this.platform.Service.Valve);

    this.service.getCharacteristic(this.platform.Characteristic.Active).onGet(this.getActive.bind(this)).onSet(this.setActive.bind(this));

    // this.service
    //   .getCharacteristic(this.platform.Characteristic.TargetDishwasherState)
    //   .onGet(this.getTargetDishwasherState.bind(this))
    //   .onSet(this.setTargetDishwasherState.bind(this));
  }

  async updateCharacteristics(attributes: Partial<E1Attributes>) {
    const updateState = false;
    for (const [k, v] of Object.entries(attributes)) {
      this.platform.log.debug(`[${this.device.name}] Set attribute ${k} to: ${v}`);
      switch (k) {
        // case 'power':
        //   updateState = true;
        //   break;
        // case 'mode':
        //   this.service.updateCharacteristic(this.platform.Characteristic.TargetDishwasherState, this.getTargetDishwasherState());
        //   break;
        // case 'Dishwasher_speed':
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

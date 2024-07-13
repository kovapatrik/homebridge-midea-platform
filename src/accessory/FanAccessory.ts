/***********************************************************************
 * Midea Platform Fan Accessory class
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
import MideaFADevice, { FAAttributes } from '../devices/fa/MideaFADevice';

export default class FanAccessory extends BaseAccessory<MideaFADevice> {
  private service: Service;

  /*********************************************************************
   * Constructor registers all the service types with Homebridge, registers
   * a callback function with the MideaDevice class, and requests device status.
   */
  constructor(
    platform: MideaPlatform,
    accessory: MideaAccessory,
    protected readonly device: MideaFADevice,
    protected readonly configDev: DeviceConfig,
  ) {
    super(platform, accessory, device, configDev);

    this.service = this.accessory.getService(this.platform.Service.Fanv2) || this.accessory.addService(this.platform.Service.Fanv2);

    this.service.getCharacteristic(this.platform.Characteristic.Active).onGet(this.getActive.bind(this)).onSet(this.setActive.bind(this));

    // this.service
    //   .getCharacteristic(this.platform.Characteristic.TargetFanState)
    //   .onGet(this.getTargetFanState.bind(this))
    //   .onSet(this.setTargetFanState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CurrentFanState).onGet(this.getCurrentFanState.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .onGet(this.getRotationSpeed.bind(this))
      .onSet(this.setRotationSpeed.bind(this));

    // this.service
    //   .getCharacteristic(this.platform.Characteristic.RotationDirection)
    //   .onGet(this.getRotationDirection.bind(this))
    //   .onSet(this.setRotationDirection.bind(this));

    // this.service
    //   .getCharacteristic(this.platform.Characteristic.SwingMode)
    //   .onGet(this.getSwingMode.bind(this))
    //   .onSet(this.setSwingMode.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.LockPhysicalControls)
      .onGet(this.getLockPhysicalControls.bind(this))
      .onSet(this.setLockPhysicalControls.bind(this));
  }

  async updateCharacteristics(attributes: Partial<FAAttributes>) {
    let updateState = false;
    for (const [k, v] of Object.entries(attributes)) {
      this.platform.log.debug(`[${this.device.name}] Set attribute ${k} to: ${v}`);
      switch (k) {
        case 'power':
          updateState = true;
          break;
        case 'mode':
          this.service.updateCharacteristic(this.platform.Characteristic.TargetFanState, this.getTargetFanState());
          break;
        case 'fan_speed':
          this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.getRotationSpeed());
          break;
        case 'child_lock':
          this.service.updateCharacteristic(this.platform.Characteristic.LockPhysicalControls, this.getLockPhysicalControls());
          break;
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

  getTargetFanState(): CharacteristicValue {
    return this.device.attributes.MODE;
  }

  async setTargetFanState(value: CharacteristicValue) {
    throw new Error('Method not implemented.');
  }

  getCurrentFanState(): CharacteristicValue {
    return this.device.attributes.POWER
      ? this.device.attributes.FAN_SPEED > 0
        ? this.platform.Characteristic.CurrentFanState.BLOWING_AIR
        : this.platform.Characteristic.CurrentFanState.IDLE
      : this.platform.Characteristic.CurrentFanState.INACTIVE;
  }

  getRotationSpeed(): CharacteristicValue {
    return this.device.attributes.FAN_SPEED;
  }

  async setRotationSpeed(value: CharacteristicValue) {
    await this.device.set_attribute({ FAN_SPEED: value as number });
  }

  getRotationDirection(): CharacteristicValue {
    throw new Error('Method not implemented.');
  }

  async setRotationDirection(value: CharacteristicValue) {
    throw new Error('Method not implemented.');
  }

  getSwingMode(): CharacteristicValue {
    return this.device.attributes.OSCILLATE
      ? this.platform.Characteristic.SwingMode.SWING_ENABLED
      : this.platform.Characteristic.SwingMode.SWING_DISABLED;
  }

  async setSwingMode(value: CharacteristicValue) {
    await this.device.set_attribute({
      OSCILLATE: value === this.platform.Characteristic.SwingMode.SWING_ENABLED,
      OSCILLATION_MODE: value === this.platform.Characteristic.SwingMode.SWING_ENABLED ? 1 : 0,
    });
  }

  getLockPhysicalControls(): CharacteristicValue {
    return this.device.attributes.CHILD_LOCK
      ? this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED
      : this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED;
  }

  async setLockPhysicalControls(value: CharacteristicValue) {
    await this.device.set_attribute({ CHILD_LOCK: value === this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED });
  }
}

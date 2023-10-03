/***********************************************************************
 * Midea Platform Dehumidifier Accessory class
 *
 * Copyright (c) 2023 David Kerr, https://github.com/dkerr64
 *
 * Based on https://github.com/homebridge/homebridge-plugin-template
 * With thanks to https://github.com/kovapatrik/homebridge-midea-platform
 *
 * An instance of this class is created for each accessory the platform registers.
 *
 */
import { CharacteristicValue, Service } from 'homebridge';
import { MideaAccessory, MideaPlatform } from '../platform';
import BaseAccessory from './BaseAccessory';
import { DeviceConfig } from '../platformUtils';
import MideaA1Device, { A1Attributes } from '../devices/a1/MideaA1Device';
import { PLATFORM_NAME, PLUGIN_NAME } from '../settings';

export default class DehumidifierAccessory extends BaseAccessory<MideaA1Device> {

  private service: Service;
  private accessories: MideaAccessory[];

  /*********************************************************************
   * Constructor registers all the service types with Homebridge, registers
   * a callback function with the MideaDevice class, and requests device status.
   */
  constructor(
    platform: MideaPlatform,
    accessory: MideaAccessory,
    protected readonly device: MideaA1Device,
    protected readonly configDev: DeviceConfig,
  ) {
    super(platform, accessory, device, configDev);

    this.service = this.accessory.getService(this.platform.Service.HumidifierDehumidifier)
      || this.accessory.addService(this.platform.Service.HumidifierDehumidifier);

    this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.name);

    this.accessories = this.platform.accessories.filter(acc => acc.context.id === this.accessory.UUID && acc !== this.accessory);

    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .onGet(this.getActive.bind(this))
      .onSet(this.setActive.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CurrentHumidifierDehumidifierState)
      .onGet(this.getCurrentHumidifierDehumidifierState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetHumidifierDehumidifierState)
      .onGet(this.getTargetHumidifierDehumidifierState.bind(this))
      .onSet(this.setTargetHumidifierDehumidifierState.bind(this))
      .setProps({
        validValues: [
          this.platform.Characteristic.TargetHumidifierDehumidifierState.HUMIDIFIER_OR_DEHUMIDIFIER,
          this.platform.Characteristic.TargetHumidifierDehumidifierState.HUMIDIFIER,
          this.platform.Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER
        ]
      });

    this.service.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
      .onGet(this.getCurrentRelativeHumidity.bind(this))
      .setProps({
        minValue: 0,
        maxValue: 100,
        minStep: 1
      });

    this.service.getCharacteristic(this.platform.Characteristic.RelativeHumidityDehumidifierThreshold)
      .onGet(this.getRelativeHumidityDehumidifierThreshold.bind(this))
      .onSet(this.setRelativeHumidityDehumidifierThreshold.bind(this))
      .setProps({
        minValue: 0,   // need this to be 0..100 so that Apple Home User Inteface humidity percent matched
        maxValue: 100, // what we set to the himdifier.  If we have this as 35..85 then Apple Home UI will not match.
        minStep: 5
      });

    this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .onGet(this.getRotationSpeed.bind(this))
      .onSet(this.setRotationSpeed.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.SwingMode)
      .onGet(this.getSwingMode.bind(this))
      .onSet(this.setSwingMode.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.LockPhysicalControls)
      .onGet(this.getChildLockMode.bind(this))
      .onSet(this.setChildLockMode.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.WaterLevel)
      .onGet(this.getWaterLevel.bind(this));

    // Register a callback function with MideaDevice and then refresh device status.  The callback
    // is called whenever there is a change in any attribute value from the device.
    this.device.register_update(this.updateCharacteristics.bind(this));
    this.device.refresh_status();

    // Remove unused accessories
    this.platform.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, this.accessories);
  }

  /*********************************************************************
   * Callback function called by MideaDevice whenever there is a change to
   * any attribute value.
   */
  private async updateCharacteristics(attributes: Partial<A1Attributes>) {
    for (const [k, v] of Object.entries(attributes)) {
      this.platform.log.debug(`[${this.device.name}] Set attribute ${k} to: ${v}`);
      let updateState = false;
      switch (k.toLowerCase()) {
        case 'power':
          this.service.updateCharacteristic(this.platform.Characteristic.Active, v ? this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE);
          updateState = true;
          break;
        case 'target_humidity':
          this.service.updateCharacteristic(this.platform.Characteristic.RelativeHumidityDehumidifierThreshold, v as CharacteristicValue);
          updateState = true;
          break;
        case 'fan_speed':
          this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, v as CharacteristicValue);
          break;
        case 'current_humidity':
          this.service.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, v as CharacteristicValue);
          updateState = true;
          break;
        case 'mode':
          updateState = true;
          break;
        case 'swing':
          this.service.updateCharacteristic(this.platform.Characteristic.SwingMode, v ? this.platform.Characteristic.SwingMode.SWING_ENABLED : this.platform.Characteristic.SwingMode.SWING_DISABLED);
          break;
        case 'current_temperature':
          // Not currently supported
          break;
        case 'tank_level':
          this.service.updateCharacteristic(this.platform.Characteristic.WaterLevel, v as CharacteristicValue);
          break;
        case 'tank_full':
          // No HomeKit characteristic
          break;
        case 'water_level_set':
          // No HomeKit characteristic
          break;
        case 'child_lock':
          this.service.updateCharacteristic(this.platform.Characteristic.LockPhysicalControls, v ? this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED : this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED);
          break;
        default:
          this.platform.log.warn(`[${this.device.name}] Attempt to set unsupported attribute ${k} to ${v}`);
      }
      if (updateState) {
        this.service.updateCharacteristic(this.platform.Characteristic.TargetHumidifierDehumidifierState, this.platform.Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER);
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentHumidifierDehumidifierState, this.currentHumidifierDehumidifierState());
      }
    }
  }

  /*********************************************************************
   * Callback functions for each Homebridge/HomeKit service
   *
   */
  private async getActive(): Promise<CharacteristicValue> {
    this.platform.log.debug(`[${this.device.name}] GET Active, value: ${this.device.attributes.POWER}`);
    return this.device.attributes.POWER ?
      this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE;
  }

  private async setActive(value: CharacteristicValue) {
    this.platform.log.debug(`[${this.device.name}] SET Active to: ${value}`);
    await this.device.set_attribute({ POWER: !!value });
  }

  // Handle requests to get the current value of the "HumidifierDehumidifierState" characteristic
  private async getCurrentHumidifierDehumidifierState(): Promise<CharacteristicValue> {
    this.platform.log.debug(`[${this.device.name}] GET CurrentHumidifierDehumidifierState, value: ${this.device.attributes.POWER},${this.device.attributes.MODE}`);
    return this.currentHumidifierDehumidifierState();
  }

  private currentHumidifierDehumidifierState(): CharacteristicValue {
    if (!this.device.attributes.POWER) {
      // Powered off, must be inactive
      return this.platform.Characteristic.CurrentHumidifierDehumidifierState.INACTIVE;
    } else {
      // Powered on, check mode
      if (this.device.attributes.MODE >= 2) {
        // Dehumidifying
        return this.platform.Characteristic.CurrentHumidifierDehumidifierState.DEHUMIDIFYING;
      } else if (this.device.attributes.MODE === 1) {
        // Whether deumidifying depends on whether we have reached target.  This is not
        // always accurate, but is best we can do to signal whether actively dehumidifing or not.
        if (this.device.attributes.CURRENT_HUMIDITY < this.device.attributes.TARGET_HUMIDITY) {
          return this.platform.Characteristic.CurrentHumidifierDehumidifierState.IDLE;
        } else {
          return this.platform.Characteristic.CurrentHumidifierDehumidifierState.DEHUMIDIFYING;
        }
      }
      return this.platform.Characteristic.CurrentHumidifierDehumidifierState.IDLE;
    }
  }

  // Handle requests to get the target value of the "HumidifierDehumidifierState" characteristic
  private async getTargetHumidifierDehumidifierState(): Promise<CharacteristicValue> {
    this.platform.log.debug(`[${this.device.name}] GET TargetHumidifierDehumidifierState, value: ${this.platform.Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER}`);
    // Always return that we are a dehumidifier, other states not supported.
    return this.platform.Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER;
  }

  // Handle requests to set the target value of the "HumidifierDehumidifierState" characteristic
  private async setTargetHumidifierDehumidifierState(value: CharacteristicValue): Promise<void> {
    this.platform.log.debug(`[${this.device.name}] SET TargetHumidifierDehumidifierState to: ${value}`);
    if (value !== this.platform.Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER) {
      throw new Error(`Device ${this.device.name} (${this.device.id}) can only be a DeHumidifier, illegal value: ${value}`);
    }
  }

  // Handle requests to get the current value of the "RelativeHumidity" characteristic
  private async getCurrentRelativeHumidity(): Promise<CharacteristicValue> {
    this.platform.log.debug(`[${this.device.name}] GET CurrentRelativeHumidity, value: ${this.device.attributes.CURRENT_HUMIDITY}`);
    return this.device.attributes.CURRENT_HUMIDITY;
  }

  // Handle requests to get the Relative value of the "HumidityDehumidifierThreshold" characteristic
  private async getRelativeHumidityDehumidifierThreshold(): Promise<CharacteristicValue> {
    this.platform.log.debug(`[${this.device.name}] GET RelativeHumidityDehumidifierThreshold, value: ${this.device.attributes.TARGET_HUMIDITY}`);
    return this.device.attributes.TARGET_HUMIDITY;
  }

  // Handle requests to set the Relative value of the "HumidityDehumidifierThreshold" characteristic
  private async setRelativeHumidityDehumidifierThreshold(value: CharacteristicValue): Promise<void> {
    let RequestedHumidity = value as number;
    // valid humidity has to be between min and max values
    RequestedHumidity = (RequestedHumidity < this.device.MIN_HUMIDITY)
      ? this.device.MIN_HUMIDITY
      : (RequestedHumidity > this.device.MAX_HUMIDITY)
        ? this.device.MAX_HUMIDITY
        : RequestedHumidity;

    this.platform.log.debug(`[${this.device.name}] SET RelativeHumidityDehumidifierThreshold to: ${RequestedHumidity} (${value as number})`);
    await this.device.set_attribute({ TARGET_HUMIDITY: RequestedHumidity });
    // Update HomeKit in case we adjusted the value outside of min and max values
    if (RequestedHumidity !== value as number) {
      // We had to adjust the requested value to within permitted range...  Update homekit to actual value set.
      // Calling updateCharacteristic within set handler seems to fail, new value is not accepted.  Workaround is
      // to request the update after short delay (say 50ms) to allow homebridge/homekit to complete the set handler.
      setTimeout(() => {
        this.service.updateCharacteristic(this.platform.Characteristic.RelativeHumidityDehumidifierThreshold, RequestedHumidity);
      }, 50);
    }
  }

  // Handle requests to get the current value of the "RotationSpeed" characteristic
  private async getRotationSpeed(): Promise<CharacteristicValue> {
    this.platform.log.debug(`[${this.device.name}] GET RotationSpeed, value: ${this.device.attributes.FAN_SPEED}`);
    return this.device.attributes.FAN_SPEED;
  }

  // Handle requests to set the "RotationSpeed" characteristic
  private async setRotationSpeed(value: CharacteristicValue) {
    let speed = value as number;
    speed = (speed <= 40)
      ? 40
      : (speed > 40 && speed <= 60)
        ? 60
        : 80;
    this.platform.log.debug(`[${this.device.name}] SET RotationSpeed to: ${speed} (${value as number})`);
    await this.device.set_attribute({ FAN_SPEED: speed });
    if (speed !== value as number) {
      // We had to adjust the requested value to within permitted range...  Update homekit to actual value set.
      // Calling updateCharacteristic within set handler seems to fail, new value is not accepted.  Workaround is
      // to request the update after short delay (say 50ms) to allow homebridge/homekit to complete the set handler.
      setTimeout(() => {
        this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, speed);
      }, 50);
    }
  }

  // Handle requests to get the current value of the "WaterLevel" characteristic
  private async getWaterLevel(): Promise<CharacteristicValue> {
    this.platform.log.debug(`[${this.device.name}] GET WaterLevel, value: ${this.device.attributes.TANK_LEVEL}`);
    return this.device.attributes.TANK_LEVEL;
  }

  // Handle requests to get the current value of the "swingMode" characteristic
  private async getSwingMode(): Promise<CharacteristicValue> {
    this.platform.log.debug(`[${this.device.name}] GET SwingMode, value: ${this.device.attributes.SWING}`);
    return this.device.attributes.SWING ?
      this.platform.Characteristic.SwingMode.SWING_ENABLED :
      this.platform.Characteristic.SwingMode.SWING_DISABLED;
  }

  // Handle requests to set the "swingMode" characteristic
  private async setSwingMode(value: CharacteristicValue) {
    this.platform.log.debug(`[${this.device.name}] SET SwingMode to: ${value}`);
    await this.device.set_attribute({ SWING: !!value });
  }

  // Handle requests to get the current value of the "LockPhysicalControls" characteristic
  private async getChildLockMode(): Promise<CharacteristicValue> {
    this.platform.log.debug(`[${this.device.name}] GET LockPhysicalControls, value: ${this.device.attributes.SWING}`);
    return this.device.attributes.CHILD_LOCK ?
      this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED :
      this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED;
  }

  // Handle requests to set the "LockPhysicalControls" characteristic
  private async setChildLockMode(value: CharacteristicValue) {
    this.platform.log.debug(`[${this.device.name}] SET LockPhysicalControls to: ${value}`);
    await this.device.set_attribute({ CHILD_LOCK: !!value });
  };
}

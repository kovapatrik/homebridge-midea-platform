/***********************************************************************
 * Midea Heat Pump WiFi Controller Accessory class
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
import MideaC3Device, { C3Attributes } from '../devices/c3/MideaC3Device';

export default class HeatPumpWiFiControllerAccessory extends BaseAccessory<MideaC3Device> {
  private service: Service;

  /*********************************************************************
   * Constructor registers all the service types with Homebridge, registers
   * a callback function with the MideaDevice class, and requests device status.
   */
  constructor(
    platform: MideaPlatform,
    accessory: MideaAccessory,
    protected readonly device: MideaC3Device,
    protected readonly configDev: DeviceConfig,
  ) {
    super(platform, accessory, device, configDev);

    this.service = this.accessory.getService(this.platform.Service.Valve) || this.accessory.addService(this.platform.Service.Valve);
  }

  async updateCharacteristics(attributes: Partial<C3Attributes>) {
    // const updateState = false;
    for (const [k, v] of Object.entries(attributes)) {
      this.platform.log.debug(`[${this.device.name}] Set attribute ${k} to: ${v}`);
      switch (k) {
        default:
          this.platform.log.debug(`[${this.device.name}] Attempt to set unsupported attribute ${k} to ${v}`);
          break;
      }
    }
    // if (updateState) {
    // this.service.updateCharacteristic(this.platform.Characteristic.Active, this.getActive());
    // this.service.updateCharacteristic(this.platform.Characteristic.InUse, this.getInUse());
    // this.service.updateCharacteristic(this.platform.Characteristic.RemainingDuration, this.getRemainingDuration());
    // }
  }
}

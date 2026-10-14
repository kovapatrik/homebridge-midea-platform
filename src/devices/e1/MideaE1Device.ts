/***********************************************************************
 * Midea Dishwasher Device class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */

import type { Logger } from 'homebridge';
import type { DeviceInfo } from '../../core/MideaConstants.js';
import MideaDevice, { type DeviceAttributeBase } from '../../core/MideaDevice.js';
import type { Config, DeviceConfig } from '../../platformUtils.js';
import { MessageE1Response, MessageLock, MessagePower, MessageQuery, MessageStorage, MessageWork } from './MideaE1Message.js';

// Object that defines all attributes for air conditioner device.  Not all of
// these are useful for Homebridge/HomeKit, but we handle them anyway.
export interface E1Attributes extends DeviceAttributeBase {
  POWER: boolean;
  STATUS?: number;
  MODE: number;
  ADDITIONAL: number;
  DOOR: boolean;
  RINSE_AID: boolean;
  SALT: boolean;
  START_PAUSE: boolean;
  START: boolean;
  CHILD_LOCK: boolean;
  UV: boolean;
  DRY: boolean;
  DRY_STATUS: boolean;
  STORAGE: boolean;
  STORAGE_STATUS: boolean;
  TIME_REMAINING?: number;
  PROGRESS?: number;
  STORAGE_REMAINING?: number;
  TEMPERATURE?: number;
  HUMIDITY?: number;
  WATERSWITCH: boolean;
  WATER_LACK: boolean;
  ERROR_CODE?: number;
  SOFTWATER: number;
  WRONG_OPERATION?: number;
  BRIGHT?: number;
}

// Work modes (wash programs), same codes and names as midea-local MideaE1Device._modes.
// Which of them a given dishwasher supports depends on the model.
export const E1Modes: Readonly<Record<number, string>> = {
  0x00: 'none',
  0x01: 'auto_wash',
  0x02: 'strong_wash',
  0x03: 'standard_wash',
  0x04: 'eco_wash',
  0x05: 'glass_wash',
  0x06: 'hour_wash',
  0x07: 'fast_wash',
  0x08: 'soak_wash',
  0x09: '90min',
  0x0a: 'self_clean',
  0x0b: 'fruit_wash',
  0x0c: 'self_define',
  0x0d: 'germ',
  0x0e: 'bowl_wash',
  0x0f: 'kill_germ',
  0x10: 'sea_food_wash',
  0x12: 'hot_pot_wash',
  0x13: 'quiet_night_wash',
  0x14: 'less_wash',
  0x16: 'oil_net_wash',
  0x19: 'cloud_wash',
};

// Values of the STATUS attribute, same as midea-local MideaE1Device._status.
export enum E1Status {
  OFF = 0x00,
  CANCEL = 0x01,
  DELAY = 0x02,
  RUNNING = 0x03,
  ERROR = 0x04,
  SOFT_GEAR = 0x05,
}

export default class MideaE1Device extends MideaDevice {
  public attributes: E1Attributes;

  /*********************************************************************
   * Constructor initializes all the attributes.  We set some to invalid
   * values so that they are detected as "changed" on the first status
   * refresh... and passed back to the Homebridge/HomeKit accessory callback
   * function to set their initial values.
   */
  constructor(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig) {
    super(logger, device_info, config, deviceConfig);

    this.attributes = {
      POWER: false,
      STATUS: undefined,
      MODE: 0,
      ADDITIONAL: 0,
      DOOR: false,
      RINSE_AID: false,
      SALT: false,
      START_PAUSE: false,
      START: false,
      CHILD_LOCK: false,
      UV: false,
      DRY: false,
      DRY_STATUS: false,
      STORAGE: false,
      STORAGE_STATUS: false,
      TIME_REMAINING: undefined,
      PROGRESS: undefined,
      STORAGE_REMAINING: undefined,
      TEMPERATURE: undefined,
      HUMIDITY: undefined,
      WATERSWITCH: false,
      WATER_LACK: false,
      ERROR_CODE: undefined,
      SOFTWATER: 0,
      WRONG_OPERATION: undefined,
      BRIGHT: undefined,
    };
  }

  build_query() {
    return [new MessageQuery(this.device_protocol_version)];
  }

  process_message(msg: Buffer) {
    const message = new MessageE1Response(msg);
    if (this.verbose) {
      this.logger.debug(`[${this.name}] Body:\n${JSON.stringify(message.body)}`);
    }
    const changed: DeviceAttributeBase = {};
    for (const status of Object.keys(this.attributes)) {
      const value = message.get_body_attribute(status.toLowerCase());
      if (value !== undefined) {
        if (this.attributes[status] !== value) {
          // Track only those attributes that change value.  So when we send to the Homebridge /
          // HomeKit accessory we only update values that change.  First time through this
          // should be most/all attributes having initialized them to invalid values.
          this.logger.debug(`[${this.name}] Value for ${status} changed from '${this.attributes[status]}' to '${value}'`);
          changed[status] = value;
        }
        this.attributes[status] = value;
      }
    }

    // Now we update Homebridge / Homekit accessory
    if (Object.keys(changed).length > 0) {
      this.update(changed);
    } else {
      this.logger.debug(`[${this.name}] Status unchanged`);
    }
  }

  async set_attribute(attributes: Partial<E1Attributes>) {
    const messageToSend: {
      POWER: MessagePower | undefined;
      CHILD_LOCK: MessageLock | undefined;
      STORAGE: MessageStorage | undefined;
    } = {
      POWER: undefined,
      CHILD_LOCK: undefined,
      STORAGE: undefined,
    };
    const previousAttributes = { ...this.attributes };

    try {
      for (const [k, v] of Object.entries(attributes)) {
        if (v === this.attributes[k]) {
          this.logger.info(`[${this.name}] Attribute ${k} already set to ${v}`);
          continue;
        }
        this.logger.info(`[${this.name}] Set device attribute ${k} to: ${v}`);
        this.attributes[k] = v;

        if (k === 'POWER') {
          messageToSend.POWER ??= new MessagePower(this.device_protocol_version);
          messageToSend.POWER.power = v as boolean;
        } else if (k === 'CHILD_LOCK') {
          messageToSend.CHILD_LOCK ??= new MessageLock(this.device_protocol_version);
          messageToSend.CHILD_LOCK.lock = v as boolean;
        } else if (k === 'STORAGE') {
          messageToSend.STORAGE ??= new MessageStorage(this.device_protocol_version);
          messageToSend.STORAGE.storage = v as boolean;
        }
      }

      let messageSent = false;
      for (const [k, v] of Object.entries(messageToSend)) {
        if (v !== undefined) {
          this.logger.debug(`[${this.name}] Set message ${k}:\n${JSON.stringify(v)}`);
          await this.build_send(v);
          messageSent = true;
        }
      }
      if (messageSent) {
        this.update(attributes);
      }
    } catch (err) {
      this.attributes = previousAttributes;
      const msg = err instanceof Error ? err.stack : err;
      this.logger.debug(`[${this.name}] Error in set_attribute (${this.ip}:${this.port}):\n${msg}`);
      throw err;
    }
  }

  /*********************************************************************
   * Start a wash program. Port of midea-local MideaE1Device.set_work_mode().
   */
  async set_work_mode(mode: number) {
    if (!(mode in E1Modes) || mode === 0) {
      throw new Error(`Unsupported work mode: ${mode}`);
    }
    const message = new MessageWork(this.device_protocol_version);
    message.mode = mode;
    this.logger.info(`[${this.name}] Start work mode ${E1Modes[mode]} (${mode})`);
    await this.build_send(message);
  }

  /*********************************************************************
   * Start the currently selected program. Port of midea-local MideaE1Device.start_work().
   */
  async start_work() {
    await this.set_work_mode(this.attributes.MODE);
  }

  /*********************************************************************
   * Cancel the running program. The device ignores a power-off request while a
   * program is delayed or running, so the work message is sent with the
   * "cancel" work status first; the device then goes back to idle.
   */
  async cancel_work() {
    const message = new MessageWork(this.device_protocol_version);
    message.work_status = E1Status.CANCEL;
    message.mode = this.attributes.MODE;
    this.logger.info(`[${this.name}] Cancel work`);
    await this.build_send(message);
  }

  protected set_subtype(): void {
    this.logger.debug('No subtype for E1 device');
  }
}

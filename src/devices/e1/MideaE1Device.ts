/***********************************************************************
 * Midea Dishwasher Device class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */

import { Logger } from 'homebridge';
import MideaDevice, { DeviceAttributeBase } from '../../core/MideaDevice';
import { DeviceInfo } from '../../core/MideaConstants';
import { Config, DeviceConfig } from '../../platformUtils';
import { MessageE1Response, MessageLock, MessagePower, MessageQuery, MessageStorage } from './MideaE1Message';

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

      for (const [k, v] of Object.entries(messageToSend)) {
        if (v !== undefined) {
          this.logger.debug(`[${this.name}] Set message ${k}:\n${JSON.stringify(v)}`);
          await this.build_send(v);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.stack : err;
      this.logger.debug(`[${this.name}] Error in set_attribute (${this.ip}:${this.port}):\n${msg}`);
    }
  }

  protected set_subtype(): void {
    this.logger.debug('No subtype for E1 device');
  }
}

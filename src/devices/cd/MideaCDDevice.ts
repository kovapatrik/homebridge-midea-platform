/***********************************************************************
 * Midea Heat Pump Water Heater Device class
 *
 * Copyright (c) 2025 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */

import type { Logger } from 'homebridge';
import type { DeviceInfo } from '../../core/MideaConstants.js';
import MideaDevice, { type DeviceAttributeBase } from '../../core/MideaDevice.js';
import type { MessageRequest } from '../../core/MideaMessage.js';
import type { Config, DeviceConfig } from '../../platformUtils.js';
import { MessageCDResponse, MessageQuery, MessageSet } from './MideaCDMessage.js';

// Object that defines all attributes for air conditioner device.  Not all of
// these are useful for Homebridge/HomeKit, but we handle them anyway.
export interface CDAttributes extends DeviceAttributeBase {
  POWER: boolean;
  MODE?: number; // 0 - energy-save, 1 - standard, 2 - dual, 3 - smart
  MAX_TEMPERATURE: number;
  MIN_TEMPERATURE: number;
  TARGET_TEMPERATURE: number;
  CURRENT_TEMPERATURE?: number;
  OUTDOOR_TEMPERATURE?: number;
  CONDENSER_TEMPERATURE?: number;
  COMPRESSOR_TEMPERATURE?: number;
  COMPRESSOR_STATUS?: number;
  TR_TEMPERATURE?: number;
  OPEN_PTC?: boolean;
  PTC_TEMPERATURE?: number;
}

export default class MideaCDDevice extends MideaDevice {
  public attributes: CDAttributes;

  constructor(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig) {
    super(logger, device_info, config, deviceConfig);

    this.attributes = {
      POWER: false,
      MODE: undefined,
      MAX_TEMPERATURE: 65,
      MIN_TEMPERATURE: 35,
      TARGET_TEMPERATURE: 40,
      CURRENT_TEMPERATURE: undefined,
      OUTDOOR_TEMPERATURE: undefined,
      CONDENSER_TEMPERATURE: undefined,
      COMPRESSOR_TEMPERATURE: undefined,
      COMPRESSOR_STATUS: undefined,
      TR_VALUE: undefined,
      OPEN_PTC: undefined,
      PTC_TEMP: undefined,
    };
  }

  build_query(): MessageRequest[] {
    return [new MessageQuery(this.device_protocol_version)];
  }

  process_message(msg: Buffer) {
    const message = new MessageCDResponse(msg);
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

  set_subtype(): void {
    this.logger.debug('No subtype for CD device');
  }

  async set_attribute(attributes: Partial<CDAttributes>) {
    const messageToSend: {
      SET: MessageSet | undefined;
    } = {
      SET: undefined,
    };

    try {
      for (const [k, v] of Object.entries(attributes)) {
        if (v === this.attributes[k]) {
          this.logger.info(`[${this.name}] Attribute ${k} already set to ${v}`);
          continue;
        }
        this.logger.info(`[${this.name}] Set device attribute ${k} to: ${v}`);
        this.attributes[k] = v;

        messageToSend.SET ??= new MessageSet(this.device_protocol_version);
        messageToSend.SET[k.toLowerCase()] = v;
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
}

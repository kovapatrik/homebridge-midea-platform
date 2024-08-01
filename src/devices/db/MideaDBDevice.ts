/***********************************************************************
 * Midea Front Load Washer class
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
import { MessageRequest } from '../../core/MideaMessage';
import { MessageDBResponse, MessageQuery, MessagePower, MessageStart } from './MideaDBMessage';

// Object that defines all attributes for air conditioner device.  Not all of
// these are useful for Homebridge/HomeKit, but we handle them anyway.
export interface DBAttributes extends DeviceAttributeBase {
  POWER: boolean;
  START: boolean;
  WASHING_DATA: Buffer;
  PROGRESS: number;
  TIME_REMAINING: number;
}

export default class MideaDBDevice extends MideaDevice {
  public attributes: DBAttributes;

  constructor(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig) {
    super(logger, device_info, config, deviceConfig);

    this.attributes = {
      POWER: false,
      START: false,
      WASHING_DATA: Buffer.alloc(0),
      PROGRESS: 0,
      TIME_REMAINING: 0,
    };
  }

  build_query(): MessageRequest[] {
    return [new MessageQuery(this.device_protocol_version)];
  }

  process_message(msg: Buffer) {
    const message = new MessageDBResponse(msg);
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
    this.logger.debug('No subtype for FA device');
  }

  async set_attribute(attributes: Partial<DBAttributes>) {
    try {
      for (const [k, v] of Object.entries(attributes)) {
        if (k === 'POWER') {
          const message = new MessagePower(this.device_protocol_version);
          message.power = v as boolean;
          this.logger.debug(`[${this.name}] Set message:\n${JSON.stringify(message)}`);
          await this.build_send(message);
          continue;
        } else if (k === 'START') {
          const message = new MessageStart(this.device_protocol_version);
          message.start = v as boolean;
          this.logger.debug(`[${this.name}] Set message:\n${JSON.stringify(message)}`);
          await this.build_send(message);
          continue;
        } else {
          this.logger.debug(`[${this.name}] Attribute '${k}' not supported`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.stack : err;
      this.logger.debug(`[${this.name}] Error in set_attribute (${this.ip}:${this.port}):\n${msg}`);
    }
  }
}

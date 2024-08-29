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
    const messageToSend: {
      POWER: MessagePower | undefined;
      START: MessageStart | undefined;
    } = {
      POWER: undefined,
      START: undefined,
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
          messageToSend.POWER = messageToSend.POWER ?? new MessagePower(this.device_protocol_version);
          messageToSend.POWER.power = v as boolean;
        } else if (k === 'START') {
          messageToSend.START = messageToSend.START ?? new MessageStart(this.device_protocol_version);
          messageToSend.START.start = v as boolean;
          messageToSend.START.washing_data = this.attributes.WASHING_DATA;
        } else {
          this.logger.debug(`[${this.name}] Attribute '${k}' not supported`);
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
}

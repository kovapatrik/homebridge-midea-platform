/***********************************************************************
 * Midea Electric Water Heater Device class
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
import { MessageE2Response, MessageNewProtocolSet, MessagePower, MessageQuery, MessageSet } from './MideaE2Message';

// Object that defines all attributes for air conditioner device.  Not all of
// these are useful for Homebridge/HomeKit, but we handle them anyway.
export interface E2Attributes extends DeviceAttributeBase {
  POWER: boolean;
  HEATING: boolean;
  KEEP_WARM: boolean;
  PROTECTION: boolean;
  CURRENT_TEMPERATURE?: number;
  TARGET_TEMPERATURE: number;
  WHOLE_TANK_HEATING: boolean;
  VARIABLE_HEATING: boolean;
  HEATING_TIME_REMAINING: number;
  WATER_CONSUMPTION?: number;
  HEATING_POWER?: number;
}

export default class MideaE2Device extends MideaDevice {
  public attributes: E2Attributes;

  private _old_protocol: string;

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
      HEATING: false,
      KEEP_WARM: false,
      PROTECTION: false,
      CURRENT_TEMPERATURE: undefined,
      TARGET_TEMPERATURE: 40,
      WHOLE_TANK_HEATING: false,
      VARIABLE_HEATING: false,
      HEATING_TIME_REMAINING: 0,
      WATER_CONSUMPTION: undefined,
      HEATING_POWER: undefined,
    };
    this._old_protocol = deviceConfig.E2_options.protocol;
  }

  get old_protocol() {
    return this.sub_type <= 82 || this.sub_type === 85 || this.sub_type === 36353;
  }

  build_query() {
    return [new MessageQuery(this.device_protocol_version)];
  }

  process_message(msg: Buffer) {
    const message = new MessageE2Response(msg);
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

  make_message_set() {
    const message = new MessageSet(this.device_protocol_version);
    message.protection = this.attributes.PROTECTION;
    message.whole_tank_heating = this.attributes.WHOLE_TANK_HEATING;
    message.target_temperature = this.attributes.TARGET_TEMPERATURE;
    message.variable_heating = this.attributes.VARIABLE_HEATING;
    return message;
  }

  async set_attribute(attributes: Partial<E2Attributes>) {
    const messageToSend: {
      POWER: MessagePower | undefined;
      SET: MessageSet | undefined;
      NEW_PROTOCOL_SET: MessageNewProtocolSet | undefined;
    } = {
      POWER: undefined,
      SET: undefined,
      NEW_PROTOCOL_SET: undefined,
    };

    try {
      for (const [k, v] of Object.entries(attributes)) {
        if (v === this.attributes[k]) {
          this.logger.info(`[${this.name}] Attribute ${k} already set to ${v}`);
          continue;
        }
        this.logger.info(`[${this.name}] Set device attribute ${k} to: ${v}`);
        this.attributes[k] = v;

        // not sensor data
        if (!['HEATING', 'KEEP_WARM', 'CURRENT_TEMPERATURE'].includes(k)) {
          const old_protocol = this._old_protocol !== 'auto' ? this._old_protocol === 'old' : this.old_protocol;
          if (k === 'POWER') {
            messageToSend.POWER = messageToSend.POWER ?? new MessagePower(this.device_protocol_version);
            messageToSend.POWER.power = v as boolean;
          } else if (old_protocol) {
            messageToSend.SET = messageToSend.SET ?? this.make_message_set();
            messageToSend.SET[k.toLowerCase()] = v;
          } else {
            messageToSend.NEW_PROTOCOL_SET = messageToSend.NEW_PROTOCOL_SET ?? new MessageNewProtocolSet(this.device_protocol_version);
            messageToSend.NEW_PROTOCOL_SET[k.toLowerCase()] = v;
          }
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
    this.logger.debug('No subtype for E2 device');
  }
}

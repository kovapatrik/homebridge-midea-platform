/***********************************************************************
 * Midea Dehumidifier Device class
 *
 * Copyright (c) 2023 David Kerr, https://github.com/dkerr64
 *
 * With thanks to https://github.com/kovapatrik/homebridge-midea-platform
 * And https://github.com/georgezhao2010/midea_ac_lan
 *
 * An instance of this class is created for each device the platform registers.
 *
 */
import type { Logger } from 'homebridge';
import type { DeviceInfo } from '../../core/MideaConstants.js';
import MideaDevice, { type DeviceAttributeBase } from '../../core/MideaDevice.js';
import type { Config, DeviceConfig } from '../../platformUtils.js';
import { MessageA1Response, MessageQuery, MessageSet } from './MideaA1Message.js';

// Object that defines all attributes for dehumidifier device.  Not all of
// these are useful for Homebridge/HomeKit, but we handle them anyway.
export interface A1Attributes extends DeviceAttributeBase {
  POWER: boolean | undefined;
  PROMPT_TONE: boolean;
  CHILD_LOCK: boolean | undefined;
  MODE: number;
  FAN_SPEED: number;
  SWING: boolean | undefined;
  TARGET_HUMIDITY: number;
  ANION: boolean;
  TANK_LEVEL: number;
  WATER_LEVEL_SET: number;
  TANK_FULL: boolean;
  CURRENT_HUMIDITY: number;
  CURRENT_TEMPERATURE: number;
  DEFROSTING: boolean;
  FILTER_INDICATOR: boolean;
  PUMP: boolean;
  PUMP_ENABLE: boolean;
  SLEEP_MODE: boolean;
}

export default class MideaA1Device extends MideaDevice {
  readonly MIN_HUMIDITY: number;
  readonly MAX_HUMIDITY: number;
  readonly HUMIDITY_STEP: number;
  public attributes: A1Attributes;

  readonly MODES = {
    0: 'Off',
    1: 'Auto',
    2: 'Continuous',
    3: 'Clothes-Dry',
    4: 'Shoes-Dry',
  };

  readonly SPEEDS = {
    1: 'Lowest',
    40: 'Low',
    60: 'Medium',
    80: 'High',
    102: 'Auto',
    127: 'Off',
  };

  readonly WATER_LEVEL_SETS = {
    25: 'Low',
    50: 'Medium',
    75: 'High',
    100: 'Full',
  };

  /*********************************************************************
   * Constructor initializes all the attributes.  We set some to invalid
   * values so that they are detected as "changed" on the first status
   * refresh... and passed back to the Homebridge/HomeKit accessory callback
   * function to set their initial values.
   */
  constructor(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig) {
    super(logger, device_info, config, deviceConfig);

    this.attributes = {
      POWER: undefined, // invalid
      PROMPT_TONE: false,
      CHILD_LOCK: undefined,
      MODE: 0,
      FAN_SPEED: 0,
      SWING: undefined, // invalid
      TARGET_HUMIDITY: 0,
      ANION: false,
      TANK_LEVEL: 0,
      WATER_LEVEL_SET: 50,
      TANK_FULL: false,
      CURRENT_HUMIDITY: 0,
      CURRENT_TEMPERATURE: 0,
      DEFROSTING: false,
      FILTER_INDICATOR: false,
      PUMP: false,
      PUMP_ENABLE: false,
      SLEEP_MODE: false,
    };

    this.MIN_HUMIDITY = deviceConfig.A1_options.minHumidity;
    this.MAX_HUMIDITY = deviceConfig.A1_options.maxHumidity;
    this.HUMIDITY_STEP = deviceConfig.A1_options.humidityStep;
  }

  build_query() {
    return [new MessageQuery(this.device_protocol_version)];
  }

  process_message(msg: Buffer) {
    const message = new MessageA1Response(msg);
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
    message.power = !!this.attributes.POWER; // force to boolean
    message.prompt_tone = this.attributes.PROMPT_TONE;
    message.mode = this.attributes.MODE;
    message.fan_speed = this.attributes.FAN_SPEED;
    message.target_humidity = this.attributes.TARGET_HUMIDITY;
    message.swing = !!this.attributes.SWING;
    message.anion = this.attributes.ANION;
    message.water_level_set = this.attributes.WATER_LEVEL_SET;
    message.pump = this.attributes.PUMP;
    message.pump_enable = this.attributes.PUMP_ENABLE;
    return message;
  }

  async set_attribute(attributes: Partial<A1Attributes>) {
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

        // not sensor data
        if (!['CURRENT_TEMPERATURE', 'CURRENT_HUMIDITY', 'TANK_FULL', 'DEFROSTING', 'FILTER_INDICATOR', 'PUMP'].includes(k)) {
          if (k === 'PROMPT_TONE') {
            this.attributes.PROMPT_TONE = !!v;
          } else {
            messageToSend.SET ??= this.make_message_set();
            // TODO handle MODE, FAN_SPEED and WATER_LEVEL_SET to ensure valid value.
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
    this.logger.debug('No subtype for A1 (dehumidifier) device');
  }
}

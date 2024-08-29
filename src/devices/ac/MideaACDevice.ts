/***********************************************************************
 * Midea Air Conditioner Device class
 *
 * Copyright (c) 2023 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */
import { Logger } from 'homebridge';
import { DeviceInfo } from '../../core/MideaConstants';
import MideaDevice, { DeviceAttributeBase } from '../../core/MideaDevice';
import {
  MessageACResponse,
  MessageGeneralSet,
  MessageNewProtocolQuery,
  MessageNewProtocolSet,
  MessagePowerQuery,
  MessageQuery,
  MessageSubProtocolQuery,
  MessageSubProtocolSet,
  MessageSwitchDisplay,
} from './MideaACMessage';
import { Config, DeviceConfig, SwingAngle } from '../../platformUtils';

// Object that defines all attributes for air conditioner device.  Not all of
// these are useful for Homebridge/HomeKit, but we handle them anyway.
export interface ACAttributes extends DeviceAttributeBase {
  PROMPT_TONE: boolean;
  POWER: boolean | undefined;
  // OFF, AUTO, COOL, DRY, HEAT, FAN_ONLY
  MODE: number;
  TARGET_TEMPERATURE: number;
  FAN_SPEED: number;
  FAN_AUTO: boolean;
  SWING_VERTICAL: boolean | undefined;
  // Vertical swing angle
  WIND_SWING_UD_ANGLE: number;
  SWING_HORIZONTAL: boolean | undefined;
  // Horizontal swing angle
  WIND_SWING_LR_ANGLE: number;
  SMART_EYE: boolean;
  DRY: boolean;
  AUX_HEATING: boolean;
  BOOST_MODE: boolean;
  SLEEP_MODE: boolean;
  FROST_PROTECT: boolean;
  COMFORT_MODE: boolean;
  ECO_MODE: boolean;
  NATURAL_WIND: boolean;
  TEMP_FAHRENHEIT: boolean;
  SCREEN_DISPLAY: boolean | undefined;
  SCREEN_DISPLAY_NEW: boolean;
  FULL_DUST: boolean;
  INDOOR_TEMPERATURE?: number;
  OUTDOOR_TEMPERATURE?: number;
  INDIRECT_WIND: boolean;
  INDOOR_HUMIDITY: number | undefined;
  BREEZELESS: boolean;
  TOTAL_ENERGY_CONSUMPTION?: number;
  CURRENT_ENERGY_CONSUMPTION?: number;
  REALTIME_POWER: number;
  FRESH_AIR_POWER: boolean;
  FRESH_AIR_FAN_SPEED: number;
  FRESH_AIR_MODE?: string;
  FRESH_AIR_1: boolean;
  FRESH_AIR_2: boolean;
}

export default class MideaACDevice extends MideaDevice {
  readonly FRESH_AIR_FAN_SPEEDS = {
    0: 'Off',
    20: 'Silent',
    40: 'Low',
    60: 'Medium',
    80: 'High',
    100: 'Full',
  };

  readonly FRESH_AIR_FAN_SPEEDS_REVERSE = {
    100: 'Full',
    80: 'High',
    60: 'Medium',
    40: 'Low',
    20: 'Silent',
    0: 'Off',
  };

  public attributes: ACAttributes;

  private fresh_air_version?: number;
  private used_subprotocol = false;
  private bb_sn8_flag = false;
  private bb_timer = false;
  private readonly DEFAULT_POWER_ANALYSIS_METHOD = 2;
  private power_analysis_method?: number;

  private alternate_switch_display = false;
  private last_fan_speed = 0;

  private defaultFahrenheit: boolean;
  private defaultScreenOff: boolean;

  /*********************************************************************
   * Constructor initializes all the attributes.  We set some to invalid
   * values so that they are detected as "changed" on the first status
   * refresh... and passed back to the Homebridge/HomeKit accessory callback
   * function to set their initial values.
   */
  constructor(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig) {
    super(logger, device_info, config, deviceConfig);
    this.attributes = {
      PROMPT_TONE: false,
      POWER: undefined,
      MODE: 0,
      TARGET_TEMPERATURE: 0,
      FAN_SPEED: 0,
      FAN_AUTO: false,
      SWING_VERTICAL: undefined, // invalid
      WIND_SWING_UD_ANGLE: 0,
      SWING_HORIZONTAL: undefined, // invalid
      WIND_SWING_LR_ANGLE: 0,
      SMART_EYE: false,
      DRY: false,
      AUX_HEATING: false,
      BOOST_MODE: false,
      SLEEP_MODE: false,
      FROST_PROTECT: false,
      COMFORT_MODE: false,
      ECO_MODE: false,
      NATURAL_WIND: false,
      TEMP_FAHRENHEIT: false,
      SCREEN_DISPLAY: undefined, // invalid
      SCREEN_DISPLAY_NEW: false,
      FULL_DUST: false,
      INDOOR_TEMPERATURE: undefined, // invalid
      OUTDOOR_TEMPERATURE: undefined, // invalid
      INDIRECT_WIND: false,
      INDOOR_HUMIDITY: undefined, // invalid
      BREEZELESS: false,
      TOTAL_ENERGY_CONSUMPTION: undefined,
      CURRENT_ENERGY_CONSUMPTION: undefined,
      REALTIME_POWER: 0,
      FRESH_AIR_POWER: false,
      FRESH_AIR_FAN_SPEED: 0,
      FRESH_AIR_MODE: undefined, // invalid
      FRESH_AIR_1: false,
      FRESH_AIR_2: false,
    };

    this.defaultFahrenheit = deviceConfig.AC_options.fahrenheit;
    this.defaultScreenOff = deviceConfig.AC_options.screenOff;
  }

  build_query() {
    if (this.used_subprotocol) {
      return [
        new MessageSubProtocolQuery(this.device_protocol_version, 0x10),
        new MessageSubProtocolQuery(this.device_protocol_version, 0x11),
        new MessageSubProtocolQuery(this.device_protocol_version, 0x30),
      ];
    }
    return [
      new MessageQuery(this.device_protocol_version),
      new MessageNewProtocolQuery(this.device_protocol_version, this.alternate_switch_display),
      new MessagePowerQuery(this.device_protocol_version),
    ];
  }

  process_message(msg: Buffer) {
    const message = new MessageACResponse(msg, this.power_analysis_method);
    if (this.verbose) {
      this.logger.debug(`[${this.name}] Body:\n${JSON.stringify(message.body)}`);
    }
    const changed: DeviceAttributeBase = {};
    let has_fresh_air = false;
    if (message.used_subprotocol) {
      this.used_subprotocol = true;
      if (message.get_body_attribute('sn8_flag')) {
        this.bb_sn8_flag = message.get_body_attribute('sn8_flag');
      }
      if (message.get_body_attribute('timer')) {
        this.bb_timer = message.get_body_attribute('timer');
      }
    }

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
        if (status === 'FRESH_AIR_POWER') {
          has_fresh_air = true;
        }
      }
    }

    // Following attributes do not have equivalents in Homebridge / Homekit accessory so
    // there is no need to track whether anything has changed.
    if (has_fresh_air) {
      if (this.attributes.FRESH_AIR_POWER) {
        for (const [k, v] of Object.entries(this.FRESH_AIR_FAN_SPEEDS_REVERSE)) {
          if (this.attributes.FRESH_AIR_FAN_SPEED > Number.parseInt(k)) {
            break;
          } else {
            this.attributes.FRESH_AIR_MODE = v;
          }
        }
      } else {
        this.attributes.FRESH_AIR_MODE = 'Off';
      }
    }

    if (!this.attributes.POWER || this.attributes.SWING_VERTICAL) {
      this.attributes.INDIRECT_WIND = false;
    }
    if (!this.attributes.POWER) {
      this.attributes.SCREEN_DISPLAY = false;
    }
    if (this.attributes.FRESH_AIR_1) {
      this.fresh_air_version = 1;
    } else if (this.attributes.FRESH_AIR_2) {
      this.fresh_air_version = 2;
    }

    // Now we update Homebridge / Homekit accessory
    if (Object.keys(changed).length > 0) {
      this.update(changed);
    } else {
      this.logger.debug(`[${this.name}] Status unchanged`);
    }
  }

  make_message_set() {
    const message = new MessageGeneralSet(this.device_protocol_version);
    message.power = !!this.attributes.POWER; // force to boolean
    message.prompt_tone = this.attributes.PROMPT_TONE;
    message.mode = this.attributes.MODE;
    message.target_temperature = this.attributes.TARGET_TEMPERATURE;
    message.fan_speed = this.attributes.FAN_SPEED;
    message.swing_vertical = !!this.attributes.SWING_VERTICAL; // force to boolean
    message.swing_horizontal = !!this.attributes.SWING_HORIZONTAL; // force to boolean
    message.boost_mode = this.attributes.BOOST_MODE;
    message.smart_eye = this.attributes.SMART_EYE;
    message.dry = this.attributes.DRY;
    message.eco_mode = this.attributes.ECO_MODE;
    message.aux_heating = this.attributes.AUX_HEATING;
    message.sleep_mode = this.attributes.SLEEP_MODE;
    message.frost_protect = this.attributes.FROST_PROTECT;
    message.comfort_mode = this.attributes.COMFORT_MODE;
    message.natural_wind = this.attributes.NATURAL_WIND;
    message.temp_fahrenheit = this.attributes.TEMP_FAHRENHEIT;
    return message;
  }

  make_subprotocol_message_set() {
    const message = new MessageSubProtocolSet(this.device_protocol_version);
    message.power = !!this.attributes.POWER; // force to boolean
    message.prompt_tone = this.attributes.PROMPT_TONE;
    message.aux_heating = this.attributes.AUX_HEATING;
    message.mode = this.attributes.MODE;
    message.target_temperature = this.attributes.TARGET_TEMPERATURE;
    message.fan_speed = this.attributes.FAN_SPEED;
    message.boost_mode = this.attributes.BOOST_MODE;
    message.dry = this.attributes.DRY;
    message.eco_mode = this.attributes.ECO_MODE;
    message.sleep_mode = this.attributes.SLEEP_MODE;
    message.sn8_flag = this.bb_sn8_flag;
    message.timer = this.bb_timer;
    return message;
  }

  make_message_unique_set(): MessageGeneralSet | MessageSubProtocolSet {
    return this.used_subprotocol ? this.make_subprotocol_message_set() : this.make_message_set();
  }

  async set_attribute(attributes: Partial<ACAttributes>) {
    const messageToSend: {
      GENERAL: MessageGeneralSet | MessageSubProtocolSet | undefined;
      NEW_PROTOCOL: MessageNewProtocolSet | undefined;
      SWITCH_DISPLAY: MessageSwitchDisplay | undefined;
    } = {
      GENERAL: undefined,
      NEW_PROTOCOL: undefined,
      SWITCH_DISPLAY: undefined,
    };

    try {
      for (const [k, v] of Object.entries(attributes)) {
        // not sensor data
        if (
          ![
            'INDOOR_TEMPERATURE',
            'OUTDOOR_TEMPERATURE',
            'INDOOR_HUMIDITY',
            'FULL_DUST',
            'TOTAL_ENERGY_CONSUMPTION',
            'CURRENT_ENERGY_CONSUMPTION',
            'REALTIME_POWER',
          ].includes(k)
        ) {
          if (v === this.attributes[k]) {
            this.logger.info(`[${this.name}] Attribute ${k} already set to ${v}`);
            continue;
          }
          this.logger.info(`[${this.name}] Set device attribute ${k} to: ${v}`);
          this.attributes[k] = v;

          if (k === 'PROMPT_TONE') {
            this.attributes.PROMPT_TONE = !!v;
          } else if (k === 'SCREEN_DISPLAY') {
            // if (this.attributes.SCREEN_DISPLAY_NEW)
            if (this.alternate_switch_display) {
              messageToSend.NEW_PROTOCOL = messageToSend.NEW_PROTOCOL ?? new MessageNewProtocolSet(this.device_protocol_version);
              messageToSend.NEW_PROTOCOL.screen_display = !!v;
              messageToSend.NEW_PROTOCOL.prompt_tone = this.attributes.PROMPT_TONE;
            } else {
              messageToSend.SWITCH_DISPLAY = messageToSend.SWITCH_DISPLAY ?? new MessageSwitchDisplay(this.device_protocol_version);
            }
          } else if (['INDIRECT_WIND', 'BREEZELESS'].includes(k)) {
            messageToSend.NEW_PROTOCOL = messageToSend.NEW_PROTOCOL ?? new MessageNewProtocolSet(this.device_protocol_version);
            messageToSend.NEW_PROTOCOL[k.toLowerCase()] = !!v;
            messageToSend.NEW_PROTOCOL.prompt_tone = this.attributes.PROMPT_TONE;
          } else if (k === 'FRESH_AIR_POWER' && this.fresh_air_version !== undefined) {
            messageToSend.NEW_PROTOCOL = messageToSend.NEW_PROTOCOL ?? new MessageNewProtocolSet(this.device_protocol_version);
            messageToSend.NEW_PROTOCOL[this.fresh_air_version] = [!!v, this.attributes.FRESH_AIR_FAN_SPEED];
          } else if (k === 'FRESH_AIR_MODE' && this.fresh_air_version !== undefined) {
            if (Object.values(this.FRESH_AIR_FAN_SPEEDS).includes(v as string)) {
              const speed = Number.parseInt(Object.keys(this.FRESH_AIR_FAN_SPEEDS).find((key) => this.FRESH_AIR_FAN_SPEEDS[key] === v)!);
              const fresh_air = speed > 0 ? [true, speed] : [false, this.attributes.FRESH_AIR_FAN_SPEED];
              messageToSend.NEW_PROTOCOL = messageToSend.NEW_PROTOCOL ?? new MessageNewProtocolSet(this.device_protocol_version);
              messageToSend.NEW_PROTOCOL[this.fresh_air_version] = fresh_air;
            } else if (!v) {
              messageToSend.NEW_PROTOCOL = messageToSend.NEW_PROTOCOL ?? new MessageNewProtocolSet(this.device_protocol_version);
              messageToSend.NEW_PROTOCOL[this.fresh_air_version] = [false, this.attributes.FRESH_AIR_FAN_SPEED];
            }
          } else if (k === 'FRESH_AIR_FAN_SPEED' && this.fresh_air_version !== undefined) {
            const value = v as number;
            const fresh_air = value > 0 ? [true, value] : [false, this.attributes.FRESH_AIR_FAN_SPEED];
            messageToSend.NEW_PROTOCOL = messageToSend.NEW_PROTOCOL ?? new MessageNewProtocolSet(this.device_protocol_version);
            messageToSend.NEW_PROTOCOL[this.fresh_air_version] = fresh_air;
          } else {
            messageToSend.GENERAL = messageToSend.GENERAL ?? this.make_message_unique_set();
            messageToSend[k.toLowerCase()] = v;
            if (['BOOST_MODE', 'SLEEP_MODE', 'FROST_PROTECT', 'COMFORT_MODE', 'ECO_MODE'].includes(k)) {
              messageToSend.GENERAL.sleep_mode = false;
              messageToSend.GENERAL.boost_mode = false;
              messageToSend.GENERAL.eco_mode = false;

              if (messageToSend.GENERAL instanceof MessageGeneralSet) {
                messageToSend.GENERAL.frost_protect = false;
                messageToSend.GENERAL.comfort_mode = false;
              }
              messageToSend.GENERAL[k.toLowerCase()] = !!v;
            }
            if (k === 'POWER' && v === true && messageToSend.GENERAL instanceof MessageGeneralSet) {
              messageToSend.GENERAL.temp_fahrenheit = this.defaultFahrenheit;
              this.attributes.TEMP_FAHRENHEIT = this.defaultFahrenheit;
              if (this.defaultScreenOff) {
                messageToSend.SWITCH_DISPLAY = messageToSend.SWITCH_DISPLAY ?? new MessageSwitchDisplay(this.device_protocol_version);
              }
            }
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

  set_alternate_switch_display(value: boolean) {
    this.alternate_switch_display = value;
  }

  async set_target_temperature(target_temperature: number, mode?: number) {
    this.logger.info(`[${this.name}] Set target temperature to: ${target_temperature}`);
    const message = this.make_message_unique_set();
    message.target_temperature = target_temperature;
    this.attributes.TARGET_TEMPERATURE = target_temperature;
    if (mode) {
      message.mode = mode;
      message.power = true;

      this.attributes.MODE = mode;
      this.attributes.POWER = true;
    }
    await this.build_send(message);
  }

  async set_swing(swing_horizontal: boolean, swing_vertical: boolean) {
    this.logger.info(`[${this.name}] Set swing horizontal to: ${swing_horizontal}, vertical to: ${swing_vertical}`);
    const message = this.make_message_set();
    message.swing_horizontal = swing_horizontal;
    message.swing_vertical = swing_vertical;
    this.attributes.SWING_HORIZONTAL = swing_horizontal;
    this.attributes.SWING_VERTICAL = swing_vertical;
    this.attributes.WIND_SWING_LR_ANGLE = 0;
    this.attributes.WIND_SWING_UD_ANGLE = 0;
    await this.build_send(message);
  }

  async set_fan_auto(fan_auto: boolean) {
    this.logger.info(`[${this.name}] Set fan auto to: ${fan_auto}`);
    const message = this.make_message_unique_set();
    if (fan_auto) {
      // Save last fan speed before setting to auto
      this.last_fan_speed = this.attributes.FAN_SPEED;
    }
    const fan_speed = fan_auto ? 102 : this.last_fan_speed;
    message.fan_speed = fan_speed;
    this.attributes.FAN_SPEED = fan_speed;
    this.attributes.FAN_AUTO = fan_auto;
    await this.build_send(message);
  }

  async set_swing_angle(swing_direction: SwingAngle, swing_angle: number) {
    this.logger.info(`[${this.name}] Set swing ${swing_direction} angle to: ${swing_angle}`);
    const message = new MessageNewProtocolSet(this.device_protocol_version);
    this.attributes.SWING_HORIZONTAL = false;
    this.attributes.SWING_VERTICAL = false;
    switch (swing_direction) {
      case SwingAngle.HORIZONTAL:
        message.wind_swing_lr_angle = swing_angle;
        this.attributes.WIND_SWING_LR_ANGLE = swing_angle;
        break;
      case SwingAngle.VERTICAL:
        message.wind_swing_ud_angle = swing_angle;
        this.attributes.WIND_SWING_UD_ANGLE = swing_angle;
        break;
    }
    message.prompt_tone = this.attributes.PROMPT_TONE;
    await this.build_send(message);
  }

  protected set_subtype(): void {
    this.logger.debug('No subtype for AC device');
  }
}

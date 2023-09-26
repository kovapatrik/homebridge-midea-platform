import { Logger } from 'homebridge';
import { DeviceInfo } from '../../core/MideaConstants';
import MideaDevice, { DeviceAttributeBase } from '../../core/MideaDevice';
import { KeyToken } from '../../core/MideaSecurity';
import { MessageQuery, MessageA1Response, MessageSet } from './MideaA1Message';

export interface A1Attributes extends DeviceAttributeBase {
  POWER: boolean;
  PROMPT_TONE: boolean;
  CHILD_LOCK: boolean;
  MODE: number;
  FAN_SPEED: number;
  SWING: boolean;
  TARGET_HUMIDITY: number;
  ANION: boolean;
  TANK: number;
  WATER_LEVEL_SET: number;
  TANK_FULL: boolean | undefined;
  CURRENT_HUMIDITY: number | undefined;
  CURRENT_TEMPERATURE: number | undefined;

  TANK_LEVEL: number;
  DEFROSTING: boolean;
  FILTER_INDICATOR: boolean;
  PUMP: boolean;
  PUMP_SWITCH_FLAG: boolean;
  SLEEP_MODE: boolean;
};

export default class MideaA1Device extends MideaDevice {

  readonly MODES = {
    0: "Off",
    1: "Auto",
    2: "Continuous",
    3: "Clothes-Dry",
    4: "Shoes-Dry"
  };

  readonly SPEEDS = {
    1: "Lowest",
    40: "Low",
    60: "Medium",
    80: "High",
    102: "Auto",
    127: "Off"
  };

  readonly WATER_LEVEL_SETS = {
    25: 'Low',
    50: 'Medium',
    75: 'High',
    100: 'Full',
  };

  public attributes: A1Attributes;

  private readonly HUMIDITY_STEP = 5;
  private humidity_step?: number;

  constructor(
    logger: Logger,
    device_info: DeviceInfo,
    token: KeyToken,
    key: KeyToken,
  ) {
    super(logger, device_info, token, key);
    this.attributes = {
      POWER: false,
      PROMPT_TONE: false,
      CHILD_LOCK: false,
      MODE: 0,
      FAN_SPEED: 60,
      SWING: false,
      TARGET_HUMIDITY: 35,
      ANION: false,
      TANK: 0,
      WATER_LEVEL_SET: 50,
      TANK_FULL: undefined,
      CURRENT_HUMIDITY: undefined,
      CURRENT_TEMPERATURE: undefined,

      TANK_LEVEL: 0,
      DEFROSTING: false,
      FILTER_INDICATOR: false,
      PUMP: false,
      PUMP_SWITCH_FLAG: false,
      SLEEP_MODE: false
    };
  };

  build_query() {
    return [
      new MessageQuery(this.device_protocol_version)
    ];
  };

  process_message(msg: Buffer) {
    const message = new MessageA1Response(msg);
    this.logger.debug(`Got message:\n${JSON.stringify(message)}`);

    for (const status of Object.keys(this.attributes)) {
      const value = message.get_body_attribute(status.toLowerCase());
      if (value !== undefined) {
        this.logger.debug(`[${this.name}] Setting local ${status} to ${value}`);
        this.attributes[status] = value;
      };
    };
  };

  make_message_set() {
    const message = new MessageSet(this.device_protocol_version);
    message.power = this.attributes.POWER;
    message.prompt_tone = this.attributes.PROMPT_TONE;
    message.mode = this.attributes.MODE;
    message.child_lock = this.attributes.CHILD_LOCK;
    message.fan_speed = this.attributes.FAN_SPEED;
    message.target_humidity = this.attributes.TARGET_HUMIDITY;
    message.swing = this.attributes.SWING;
    message.anion = this.attributes.ANION;
    message.water_level_set = this.attributes.WATER_LEVEL_SET;
    return message;
  };

  async set_attribute(attributes: Partial<A1Attributes>) {
    for (const [k, v] of Object.entries(attributes)) {
      let message: MessageSet | undefined = undefined;

      // not sensor data
      if (!['CURRENT_TEMPERATURE', 'CURRENT_HUMIDITY', 'TANK_FULL', 'DEFROSTING', 
        'FILTER_INDICATOR', 'PUMP'].includes(k)) {

        this.attributes[k] = v;

        if (k === 'PROMPT_TONE') {
          this.attributes.PROMPT_TONE = v as boolean;
        } else {
          message = this.make_message_set();
          // TODO handle MODE, FAN_SPEED and WATER_LEVEL_SET to ensure valid value.
        }
      }
      if (message) {
        await this.build_send(message);
      }
    }
  }

  protected set_subtype(): void {
    this.logger.debug('No subtype for A1 (dehumidifier) device');
  }
}
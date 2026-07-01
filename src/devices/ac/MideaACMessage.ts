/***********************************************************************
 * Midea Air Conditioner Device message handler class
 *
 * Copyright (c) 2023 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */
import { DeviceType } from '../../core/MideaConstants.js';
import { MessageBody, MessageRequest, MessageResponse, MessageType, NewProtocolMessageBody } from '../../core/MideaMessage.js';
import { calculate } from '../../core/MideaUtils.js';

enum NewProtocolTags {
  WIND_SWING_UD_ANGLE = 0x0009,
  WIND_SWING_LR_ANGLE = 0x000a,
  SCREEN_DISPLAY = 0x0017,
  INDOOR_HUMIDITY = 0x0015,
  BREEZELESS = 0x0018,
  PROMPT_TONE = 0x001a,
  INDIRECT_WIND = 0x0042, // prevent_straight_wind
  FRESH_AIR_1 = 0x0233,
  FRESH_AIR_2 = 0x004b,
  SELF_CLEAN = 0x0039,
  RATE_SELECT = 0x0048, // GEAR
  ERROR_CODE_QUERY = 0x003f,
  // oxlint-disable-next-line typescript/no-duplicate-enum-values
  BUZZER_ALL = 0x022c,
  // B5 device
  B5_MODE = 0x0214,
  B5_WIND_SPEED = 0x0210,
  B5_STRONG_WIND = 0x021a,
  B5_HUMIDITY = 0x021f,
  B5_TEMPERATURE = 0x0225,
  B5_FILTER_REMIND = 0x0217,
  B5_SCREEN_DISPLAY = 0x0224,
  B5_ANION = 0x021e,
  B5_SOUND = 0x022c,
  // AC portasplit outdoor silent mode
  OUT_SILENT = 0x00cd,
}

const BB_AC_MODES = [0, 3, 1, 2, 4, 5];
const BB_MIN_BODY_LENGTH = 21;
const SCREEN_DISPLAY_BYTE_CHECK = 0x07;
const CONFORT_MODE_MIN_LENGTH = 16;
const CONFORT_MODE_MIN_LENGTH2 = 23;
const SWING_LR_MIN_LENGTH = 21;
const FROST_PROTECT_MIN_LENGTH = 22;
const OUT_SILENT_VALUE = 0x03;
const FRESH_AIR_C0_MIN_LENGTH = 29;
const MAX_BYTE_VALUE = 0xff;
const TEMP_DECIMAL_MIN_BODY_LENGTH = 20;
const INDIRECT_WIND_VALUE = 0x02;
const SMART_DRY_MIN_LENGTH = 20;
const XC1_SUBBODY_TYPE_44 = 0x44;
const XC1_SUBBODY_TYPE_40 = 0x40;
const XC1_SUBBODY_TYPE_45 = 0x45;
const XBB_SN8_BYTE_FLAG = 0x31;

// Power/Energy analysis formats.
enum PowerFormats {
  // unless stated, consumption / energy is 0.01 kWh, and power in 0.1 W resolution
  BCD = 1,
  BINARY = 2, // binary with energy in 0.1 kWh resolution
  MIXED = 3, // mixed/INT (byte = 0-99)
  BINARY1 = 12, // binary
  BCD_ENERGY_BINARY_POWER = 101,
}

abstract class MessageACBase extends MessageRequest {
  private static message_serial = 0;
  private message_id: number;

  constructor(device_protocol_version: number, message_type: MessageType, body_type: number) {
    super(DeviceType.AIR_CONDITIONER, message_type, body_type, device_protocol_version);
    MessageACBase.message_serial += 1;
    if (MessageACBase.message_serial >= 254) {
      MessageACBase.message_serial = 1;
    }
    this.message_id = MessageACBase.message_serial;
  }

  get body() {
    // biome-ignore lint/style/noNonNullAssertion: we know body_type cannot be null
    let body = Buffer.concat([Buffer.from([this.body_type!]), this._body, Buffer.from([this.message_id])]);
    body = Buffer.concat([body, Buffer.from([calculate(body)])]);
    return body;
  }
}

// query(queryType == "a0_query").
export class MessageA0Query extends MessageACBase {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.QUERY, 0xa0);
  }

  get _body() {
    return Buffer.from([0xa7]);
  }
}

// query(queryType == "a0_query_long")
export class MessageA0LongQuery extends MessageACBase {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.QUERY, 0xa0);
  }

  get _body() {
    return Buffer.alloc(19);
  }
}

// query(queryType == nil).
export class MessageQuery extends MessageACBase {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.QUERY, 0x41);
  }

  get _body() {
    // oxfmt-ignore
    return Buffer.from([
      0x81, 0x00, 0xff, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00
    ]);
  }
}

// capabilities query(queryType == "all_first_frame").
export class MessageCapabilitiesQuery extends MessageACBase {
  additional_capabilities: boolean;

  constructor(device_protocol_version: number, additional_capabilities = false) {
    super(device_protocol_version, MessageType.QUERY, 0xb5);
    this.additional_capabilities = additional_capabilities;
  }

  get _body() {
    return this.additional_capabilities ? Buffer.from([0x01, 0x01, 0x01]) : Buffer.from([0x01, 0x00]);
  }
}

///  capabilities additional query(queryType == "all_second_frame").
export class MessageCapabilitiesAdditionalQuery extends MessageCapabilitiesQuery {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, true);
  }
}

//  power query(queryType == "group_data_zero").
export class MessageGroupZeroQuery extends MessageACBase {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.QUERY, 0x41);
  }

  get _body() {
    return Buffer.from([0x21, 0x01, 0x40, 0x00, 0x01]);
  }

  get body() {
    // biome-ignore lint/style/noNonNullAssertion: we know body_type cannot be null
    let body = Buffer.concat([Buffer.from([this.body_type!]), this._body]);
    body = Buffer.concat([body, Buffer.from([calculate(body)])]);
    return body;
  }
}

// power query(queryType == "group_data_four").
export class MessagePowerQuery extends MessageACBase {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.QUERY, 0x41);
  }

  get _body() {
    return Buffer.from([0x21, 0x01, 0x44, 0x00, 0x01]);
  }

  get body() {
    // biome-ignore lint/style/noNonNullAssertion: we know body_type cannot be null
    let body = Buffer.concat([Buffer.from([this.body_type!]), this._body]);
    body = Buffer.concat([body, Buffer.from([calculate(body)])]);
    return body;
  }
}

// query indoor humidity(queryType == "group_data_five")."
export class MessageHumidityQuery extends MessageACBase {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.QUERY, 0x41);
  }

  get _body() {
    return Buffer.from([0x21, 0x01, 0x45, 0x00, 0x01]);
  }

  get body() {
    // biome-ignore lint/style/noNonNullAssertion: we know body_type cannot be null
    let body = Buffer.concat([Buffer.from([this.body_type!]), this._body]);
    body = Buffer.concat([body, Buffer.from([calculate(body)])]);
    return body;
  }
}

export class MessageSwitchDisplay extends MessageACBase {
  prompt_tone: boolean;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.QUERY, 0x41);
    this.prompt_tone = false;
  }

  get _body() {
    const prompt_tone = this.prompt_tone ? 0x40 : 0x00;
    // oxfmt-ignore
    return Buffer.from([
      0x02 | prompt_tone,
      0x00,
      0xFF,
      0x02,
      0x00,
      0x02,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
    ]);

    // return Buffer.from([0x81, 0x00, 0xff, 0x02, 0xff, 0x02, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  }
}

export class MessageNewProtocolQuery extends MessageACBase {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.QUERY, 0xb1);
  }

  get _body() {
    const query_params = [
      NewProtocolTags.WIND_SWING_UD_ANGLE,
      NewProtocolTags.WIND_SWING_LR_ANGLE,
      NewProtocolTags.INDIRECT_WIND,
      NewProtocolTags.BREEZELESS,
      NewProtocolTags.INDOOR_HUMIDITY,
      NewProtocolTags.SCREEN_DISPLAY,
      NewProtocolTags.FRESH_AIR_1,
      NewProtocolTags.FRESH_AIR_2,
      NewProtocolTags.SELF_CLEAN,
      NewProtocolTags.RATE_SELECT,
      NewProtocolTags.OUT_SILENT,
      NewProtocolTags.BUZZER_ALL,
      NewProtocolTags.ERROR_CODE_QUERY,
    ];
    let body = Buffer.from([query_params.length]);
    for (const param of query_params) {
      body = Buffer.concat([body, Buffer.from([param & 0xff, param >> 8])]);
    }
    return body;
  }
}

export abstract class MessageSubProtocol extends MessageACBase {
  protected abstract subprotocol_body?: Buffer;

  constructor(
    device_protocol_version: number,
    message_type: MessageType,
    private readonly subprotocol_query_type: number,
  ) {
    super(device_protocol_version, message_type, 0xaa);
  }

  get body() {
    // biome-ignore lint/style/noNonNullAssertion: we know body_type cannot be null
    let body = Buffer.concat([Buffer.from([this.body_type!]), this._body]);
    body = Buffer.concat([body, Buffer.from([calculate(body)])]);
    body = Buffer.concat([body, Buffer.from([this.checksum(body)])]);
    return body;
  }

  get _body() {
    let body = Buffer.from([6 + 2 + (this.subprotocol_body ? this.subprotocol_body.length : 0), 0x00, 0xff, 0xff, this.subprotocol_query_type]);
    if (this.subprotocol_body) {
      body = Buffer.concat([body, this.subprotocol_body]);
    }
    return body;
  }
}

export class MessageSubProtocolQuery extends MessageSubProtocol {
  protected subprotocol_body?: Buffer | undefined;
  constructor(device_protocol_version: number, subprotocol_query_type: number) {
    super(device_protocol_version, MessageType.QUERY, subprotocol_query_type);
  }
}

export class MessageSubProtocolSet extends MessageSubProtocol {
  // biome-ignore lint/suspicious/noExplicitAny: had to use any
  [key: string]: any;
  public power: boolean;
  public mode: number;
  public target_temperature: number;
  public fan_speed: number;
  public boost_mode: boolean;
  public aux_heating: boolean;
  public dry: boolean;
  public eco_mode: boolean;
  public sleep_mode: boolean;
  public sn8_flag: boolean;
  public timer: boolean;
  public prompt_tone: boolean;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0x20);
    this.power = false;
    this.mode = 0;
    this.target_temperature = 20.0;
    this.fan_speed = 102;
    this.boost_mode = false;
    this.aux_heating = false;
    this.dry = false;
    this.eco_mode = false;
    this.sleep_mode = false;
    this.sn8_flag = false;
    this.timer = false;
    this.prompt_tone = false;
  }

  get subprotocol_body() {
    const power = this.power ? 0x01 : 0x00;
    const dry = this.dry && this.power ? 0x10 : 0;
    const boost_mode = this.boost_mode ? 0x20 : 0;
    const aux_heating = this.aux_heating ? 0x40 : 0x80;
    const sleep_mode = this.sleep_mode ? 0x80 : 0;
    const mode = this.mode === 0 ? 0 : this.mode < BB_AC_MODES.length ? BB_AC_MODES[this.mode] - 1 : 2;
    const target_temperature = (this.target_temperature * 2 + 30) | 0;

    const water_model_temperature_set = ((this.target_temperature - 1) * 2 + 50) | 0;
    const fan_speed = this.fan_speed;
    const eco = this.eco_mode ? 0x40 : 0;
    const prompt_tone = this.prompt_tone ? 0x01 : 0;
    const timer = this.sn8_flag && this.timer ? 0x04 : 0;

    // oxfmt-ignore
    return Buffer.from([
      0x02 | boost_mode | power | dry,
      aux_heating,
      sleep_mode,
      0x00, 0x00,
      mode,
      target_temperature,
      fan_speed,
      0x32, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x01,
      0x01, 0x00, 0x01,
      water_model_temperature_set,
      prompt_tone,
      target_temperature,
      0x32,
      0x66,
      0x00,
      eco | timer,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00,
      0x08,
    ]);
  }
}

export class MessageGeneralSet extends MessageACBase {
  // biome-ignore lint/suspicious/noExplicitAny: had to use any
  [key: string]: any;
  public power: boolean;
  public prompt_tone: boolean;
  public mode: number;
  public target_temperature: number;
  public fan_speed: number;
  public swing_vertical: boolean;
  public swing_horizontal: boolean;
  public boost_mode: boolean;
  public dry: boolean;
  public aux_heating: boolean;
  public smart_eye: boolean;
  public eco_mode: boolean;
  public temp_fahrenheit: boolean;
  public sleep_mode: boolean;
  public natural_wind: boolean;
  public frost_protect: boolean;
  public comfort_mode: boolean;
  public anion: boolean;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0x40);
    this.power = false;
    this.prompt_tone = true;
    this.mode = 0;
    this.target_temperature = 20.0;
    this.fan_speed = 102;
    this.swing_vertical = false;
    this.swing_horizontal = false;
    this.boost_mode = false;
    this.smart_eye = false;
    this.dry = false;
    this.aux_heating = false;
    this.eco_mode = false;
    this.temp_fahrenheit = false;
    this.sleep_mode = false;
    this.natural_wind = false;
    this.frost_protect = false;
    this.comfort_mode = false;
    this.anion = false;
  }

  get _body() {
    // Byte1, Power, prompt_tone
    const power = this.power ? 0x01 : 0x00;
    const prompt_tone = this.prompt_tone ? 0x40 : 0x00;
    // Byte2, mode target_temperature
    const mode = (this.mode << 5) & 0xe0;
    const target_temperature = ((this.target_temperature | 0) & 0xf) | ((Math.round(this.target_temperature * 2) | 0) % 2 !== 0 ? 0x10 : 0);
    // Byte 3, fan_speed
    const fan_speed = this.fan_speed & 0x7f;
    // Byte 7, swing_mode
    const swing_mode = 0x30 | (this.swing_vertical ? 0x0c : 0) | (this.swing_horizontal ? 0x03 : 0);
    // Byte 8, turbo
    const boost_mode = this.boost_mode ? 0x20 : 0;
    // Byte 9 aux_heating eco_mode
    const smart_eye = this.smart_eye ? 0x01 : 0;
    const dry = this.dry ? 0x04 : 0;
    const aux_heating = this.aux_heating ? 0x08 : 0;
    const eco_mode = this.eco_mode ? 0x80 : 0;
    const anion = this.anion ? 0x20 : 0;
    // Byte 10 temp_fahrenheit
    const temp_fahrenheit = this.temp_fahrenheit ? 0x04 : 0;
    const sleep_mode = this.sleep_mode ? 0x01 : 0;
    const boost_mode_1 = this.boost_mode ? 0x02 : 0;
    // Byte 17 natural_wind
    const natural_wind = this.natural_wind ? 0x40 : 0;
    // Byte 21 frost_protect
    const frost_protect = this.frost_protect ? 0x80 : 0;
    // Byte 22 comfort_mode
    const comfort_mode = this.comfort_mode ? 0x01 : 0;
    // oxfmt-ignore
    return Buffer.from([
      power | prompt_tone,
      mode | target_temperature,
      fan_speed,
      0x00, 0x00, 0x00,
      swing_mode,
      boost_mode,
      smart_eye | dry | aux_heating | eco_mode | anion,
      temp_fahrenheit | sleep_mode | boost_mode_1,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00,
      natural_wind,
      0x00, 0x00, 0x00,
      frost_protect,
      comfort_mode,
    ]);
  }
}

export class MessageNewProtocolSet extends MessageACBase {
  // biome-ignore lint/suspicious/noExplicitAny: had to use any
  [k: string]: any;
  public wind_swing_ud_angle?: number;
  public wind_swing_lr_angle?: number;
  public indirect_wind?: boolean;
  public prompt_tone = false;
  public breezeless?: boolean;
  public screen_display_alternate?: boolean;
  public fresh_air_1?: Buffer;
  public fresh_air_2?: Buffer;
  public self_clean?: boolean;
  public rate_select?: number;
  public out_silent?: boolean;
  public sound?: boolean;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0xb0);
  }

  get _body() {
    let pack_count = 0;
    let payload = Buffer.from([0x00]);

    if (this.wind_swing_ud_angle !== undefined) {
      pack_count += 1;
      payload = Buffer.concat([payload, NewProtocolMessageBody.packet(NewProtocolTags.WIND_SWING_UD_ANGLE, Buffer.from([this.wind_swing_ud_angle]))]);
    }

    if (this.wind_swing_lr_angle !== undefined) {
      pack_count += 1;
      payload = Buffer.concat([payload, NewProtocolMessageBody.packet(NewProtocolTags.WIND_SWING_LR_ANGLE, Buffer.from([this.wind_swing_lr_angle]))]);
    }

    if (this.breezeless !== undefined) {
      pack_count += 1;
      payload = Buffer.concat([payload, NewProtocolMessageBody.packet(NewProtocolTags.BREEZELESS, Buffer.from([this.breezeless ? 0x01 : 0x00]))]);
    }

    if (this.indirect_wind !== undefined) {
      pack_count += 1;
      payload = Buffer.concat([payload, NewProtocolMessageBody.packet(NewProtocolTags.INDIRECT_WIND, Buffer.from([this.indirect_wind ? 0x02 : 0x01]))]);
    }

    if (this.screen_display_alternate !== undefined) {
      pack_count += 1;
      payload = Buffer.concat([
        payload,
        NewProtocolMessageBody.packet(NewProtocolTags.SCREEN_DISPLAY, Buffer.from([this.screen_display_alternate ? 0x64 : 0x00])),
      ]);
    }

    if (this.fresh_air_1 !== undefined && this.fresh_air_1.length === 2) {
      pack_count += 1;
      const fresh_air_power = this.fresh_air_1[0] > 0 ? 2 : 1;
      const fresh_air_fan_speed = this.fresh_air_1[1];
      payload = Buffer.concat([
        payload,
        NewProtocolMessageBody.packet(
          NewProtocolTags.FRESH_AIR_1,
          // oxfmt-ignore
          Buffer.from([
            fresh_air_power,
            fresh_air_fan_speed,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00
          ]),
        ),
      ]);
    }

    if (this.fresh_air_2 !== undefined && this.fresh_air_2.length === 2) {
      pack_count += 1;
      const fresh_air_power = this.fresh_air_2[0] > 0 ? 1 : 0;
      const fresh_air_fan_speed = this.fresh_air_2[1];
      // oxfmt-ignore
      payload = Buffer.concat([
        payload,
        NewProtocolMessageBody.packet(
          NewProtocolTags.FRESH_AIR_2,
          Buffer.from([
            fresh_air_power,
            fresh_air_fan_speed,
            0xff
          ]),
        )
      ]);
    }

    if (this.out_silent !== undefined) {
      pack_count += 1;
      payload = Buffer.concat([payload, NewProtocolMessageBody.packet(NewProtocolTags.OUT_SILENT, Buffer.from([this.out_silent ? OUT_SILENT_VALUE : 0x00]))]);
    }

    if (this.self_clean !== undefined) {
      pack_count += 1;
      payload = Buffer.concat([payload, NewProtocolMessageBody.packet(NewProtocolTags.SELF_CLEAN, Buffer.from([this.self_clean ? 0x01 : 0x00]))]);
    }

    if (this.sound !== undefined) {
      pack_count += 1;
      payload = Buffer.concat([payload, NewProtocolMessageBody.packet(NewProtocolTags.BUZZER_ALL, Buffer.from([this.sound ? 0x01 : 0x00]))]);
    }

    if (this.rate_select !== undefined) {
      pack_count += 1;
      payload = Buffer.concat([payload, NewProtocolMessageBody.packet(NewProtocolTags.RATE_SELECT, Buffer.from([this.rate_select]))]);
    }

    pack_count += 1;
    payload = Buffer.concat([payload, NewProtocolMessageBody.packet(NewProtocolTags.PROMPT_TONE, Buffer.from([this.prompt_tone ? 0x01 : 0x00]))]);

    payload[0] = pack_count;
    return payload;
  }
}

// A0 message body
class XA0MessageBody extends MessageBody {
  // powerValue
  public power: boolean;
  // temperature & smallTemperature
  public target_temperature: number;
  // modeValue
  public mode: number;
  // fanspeedValue
  public fan_speed: number;
  // swingLRValue
  public swing_vertical: boolean;
  // swingUDValue
  public swing_horizontal: boolean;
  // strongWindValue
  public boost_mode: boolean;
  // power_saving
  public power_saving: number;
  // comfortableSleepValue
  public comfort_sleep: number;
  // comfortableSleepSwitch
  public comfort_sleep_switch: number;
  // pmv
  public pmv: number;
  // screenDisplayNowValue
  public screen_display: boolean;
  public smart_eye: boolean;
  // dryValue
  public dry: boolean;
  // PTCValue
  public aux_heating: boolean;
  // purifierValue
  public purifier: number;
  public anion: boolean;
  // ecoValue
  public eco_mode: boolean;
  public sleep_mode: boolean;
  // naturalWind
  public natural_wind: boolean;
  // smartDryValue
  public smart_dry: boolean;
  // kickQuilt
  public kick_quilt: number;
  // preventCold
  public prevent_cold: number;
  // dust_full_time
  public full_dust: boolean;
  // comfortPowerSave
  public comfort_mode: boolean;
  // swingLRUnderSwitch
  public swing_lr_switch: number;
  // swingLRValueUnder
  public swing_lr_value: number;
  // arom
  public frost_protect: boolean;

  public fresh_filter_time_total?: number;
  public fresh_filter_time_use?: number;
  public fresh_filter_timeout?: number;

  constructor(body: Buffer) {
    super(body);

    this.power = (body[1] & 0x1) > 0;
    this.target_temperature = ((body[1] & 0x3e) >> 1) - 4.0 + 16.0 + ((body[1] & 0x40) > 0 ? 0.5 : 0.0);
    this.mode = (body[2] & 0xe0) >> 5;
    this.fan_speed = body[3] & 0x7f;
    this.swing_vertical = (body[7] & 0xc) > 0;
    this.swing_horizontal = (body[7] & 0x3) > 0;
    this.boost_mode = (body[8] & 0x20) > 0 || (body[10] & 0x2) > 0;
    this.power_saving = body[8] & 0x08;
    this.comfort_sleep = body[8] & 0x03;
    this.comfort_sleep_switch = body[14] & 0x01;
    this.pmv = ((body[11] & 0xf0) >> 4) * 0.5 - 3.5;
    this.screen_display = ((body[14] >> 4) & 0x7) !== SCREEN_DISPLAY_BYTE_CHECK && this.power;
    this.smart_eye = (body[9] & 0x01) > 0;
    this.dry = (body[9] & 0x04) > 0;
    this.aux_heating = (body[9] & 0x08) > 0;
    this.purifier = body[9] & 0x20;
    this.anion = (body[9] & 0x20) > 0;
    this.eco_mode = (body[9] & 0x10) > 0;
    this.sleep_mode = (body[10] & 0x01) > 0;
    this.natural_wind = (body[10] & 0x40) > 0;
    this.smart_dry = (body[13] & 0x7f) > 0;
    this.kick_quilt = (body[10] & 0x04) >> 2;
    this.prevent_cold = (body[10] & 0x08) >> 3;
    this.full_dust = (body[13] & 0x20) >> 5 > 0;
    this.comfort_mode = body.length > CONFORT_MODE_MIN_LENGTH ? (body[14] & 0x1) > 0 : false;
    this.swing_lr_switch = body.length >= SWING_LR_MIN_LENGTH ? body[19] & 0x80 : 0;
    this.swing_lr_value = body[9] & 0x40;
    this.frost_protect = body.length >= FROST_PROTECT_MIN_LENGTH ? (body[21] & 0x80) >> 7 > 0 : false;

    if (body.length >= FRESH_AIR_C0_MIN_LENGTH) {
      this.fresh_filter_time_total = body[25] * 256 + body[24];
      this.fresh_filter_time_use = body[16] * 256 + body[15];
      this.fresh_filter_timeout = (body[13] & 0x40) >> 6;
    }
  }
}

// A1/C0 parser function.
function parseTemperature(temp_integer: number, temp_decimal: number): number | undefined {
  if (temp_integer === MAX_BYTE_VALUE) {
    return undefined;
  }
  const div_temp_integer = (temp_integer - 50) / 2;
  if (temp_decimal === 0) {
    return div_temp_integer;
  }
  if (div_temp_integer < 0) {
    return Math.trunc(div_temp_integer) - temp_decimal * 0.1;
  }
  return Math.trunc(div_temp_integer) + temp_decimal * 0.1;
}

// A1 message body
class XA1MessageBody extends MessageBody {
  public current_work_time: number;
  public indoor_temperature?: number;
  public outdoor_temperature?: number;
  public indoor_humidity?: number;

  constructor(body: Buffer) {
    super(body);

    this.current_work_time = (((body[9] << 8) & 0xff00) | (body[10] & 0x00ff)) * 60 * 24 + body[11] * 60 + body[12];

    const decimal = body.length > TEMP_DECIMAL_MIN_BODY_LENGTH ? body[18] : 0;

    this.indoor_temperature = parseTemperature(body[13], decimal & 0x0f);
    this.outdoor_temperature = parseTemperature(body[14], decimal >> 4);
    this.indoor_humidity = body[17] !== 0 ? body[17] : undefined;
  }
}

// BX message body. body[0] b0/b1, body[1] propertyNumber, cursor 2.
class XBXMessageBody extends NewProtocolMessageBody {
  public wind_swing_lr_angle?: number;
  public wind_swing_ud_angle?: number;
  public indirect_wind?: boolean;
  public indoor_humidity?: number;
  public breezeless?: boolean;
  public screen_display_alternate?: boolean;
  public screen_display_new?: boolean;
  public fresh_air_1?: boolean;
  public fresh_air_2?: boolean;
  public fresh_air_power?: boolean;
  public fresh_air_fan_speed?: number;
  public out_silent?: boolean;
  public self_clean?: boolean;
  public rate_select?: number; // 50% 75% 100%
  public sound?: boolean;
  public error_code?: number;

  constructor(body: Buffer, body_type: number) {
    super(body, body_type);
    const params = this.parse();

    if (NewProtocolTags.INDIRECT_WIND in params) {
      this.indirect_wind = params[NewProtocolTags.INDIRECT_WIND][0] === INDIRECT_WIND_VALUE;
    }

    if (NewProtocolTags.INDOOR_HUMIDITY in params) {
      const indoor_humidity = params[NewProtocolTags.INDOOR_HUMIDITY][0];
      this.indoor_humidity = indoor_humidity !== 0 ? indoor_humidity : undefined;
    }

    if (NewProtocolTags.BREEZELESS in params) {
      this.breezeless = params[NewProtocolTags.BREEZELESS][0] === 1;
    }

    if (NewProtocolTags.SCREEN_DISPLAY in params) {
      this.screen_display_alternate = params[NewProtocolTags.SCREEN_DISPLAY][0] > 0;
      this.screen_display_new = true;
    }

    if (NewProtocolTags.FRESH_AIR_1 in params) {
      this.fresh_air_1 = true;
      const data = params[NewProtocolTags.FRESH_AIR_1];
      this.fresh_air_power = data[0] === INDIRECT_WIND_VALUE;
      this.fresh_air_fan_speed = data[1];
    }
    if (NewProtocolTags.FRESH_AIR_2 in params) {
      this.fresh_air_2 = true;
      const data = params[NewProtocolTags.FRESH_AIR_2];
      this.fresh_air_power = data[0] > 0;
      this.fresh_air_fan_speed = data[1];
    }

    if (NewProtocolTags.WIND_SWING_LR_ANGLE in params) {
      this.wind_swing_lr_angle = params[NewProtocolTags.WIND_SWING_LR_ANGLE][0];
    }

    if (NewProtocolTags.WIND_SWING_UD_ANGLE in params) {
      this.wind_swing_ud_angle = params[NewProtocolTags.WIND_SWING_UD_ANGLE][0];
    }

    if (NewProtocolTags.OUT_SILENT in params) {
      this.out_silent = params[NewProtocolTags.OUT_SILENT][0] === OUT_SILENT_VALUE;
    }

    if (NewProtocolTags.SELF_CLEAN in params) {
      this.self_clean = params[NewProtocolTags.SELF_CLEAN][0] === 0x1;
    }

    if (NewProtocolTags.RATE_SELECT in params) {
      this.rate_select = params[NewProtocolTags.RATE_SELECT][0];
    }

    if (NewProtocolTags.BUZZER_ALL in params) {
      this.sound = params[NewProtocolTags.BUZZER_ALL][0] > 0;
    }

    if (NewProtocolTags.ERROR_CODE_QUERY in params) {
      this.error_code = params[NewProtocolTags.ERROR_CODE_QUERY][0];
    }
  }
}

class XB5MessageBody extends NewProtocolMessageBody {
  public b5_mode?: number;
  public b5_anion?: number;
  public b5_filter_remind?: number;
  public b5_strong_wind?: number;
  public b5_wind_speed?: number;
  public b5_temperature0?: number;
  public b5_temperature1?: number;
  public b5_temperature2?: number;
  public b5_temperature3?: number;
  public b5_temperature4?: number;
  public b5_temperature5?: number;
  public b5_temperature6?: number;
  public b5_screen_display?: number;
  public b5_sound?: number;
  public b5_humidity?: number;

  constructor(body: Buffer, body_type: number) {
    super(body, body_type);
    const params = this.parse();

    if (NewProtocolTags.B5_MODE in params) {
      this.b5_mode = params[NewProtocolTags.B5_MODE][0];
    }

    if (NewProtocolTags.B5_ANION in params) {
      this.b5_anion = params[NewProtocolTags.B5_ANION][0];
    }

    if (NewProtocolTags.B5_FILTER_REMIND in params) {
      this.b5_filter_remind = params[NewProtocolTags.B5_FILTER_REMIND][0];
    }

    if (NewProtocolTags.B5_STRONG_WIND in params) {
      this.b5_strong_wind = params[NewProtocolTags.B5_STRONG_WIND][0];
    }

    if (NewProtocolTags.B5_WIND_SPEED in params) {
      this.b5_wind_speed = params[NewProtocolTags.B5_WIND_SPEED][0];
    }

    if (NewProtocolTags.B5_TEMPERATURE in params) {
      this.b5_temperature0 = params[NewProtocolTags.B5_TEMPERATURE][0];
      this.b5_temperature1 = params[NewProtocolTags.B5_TEMPERATURE][1];
      this.b5_temperature2 = params[NewProtocolTags.B5_TEMPERATURE][2];
      this.b5_temperature3 = params[NewProtocolTags.B5_TEMPERATURE][3];
      this.b5_temperature4 = params[NewProtocolTags.B5_TEMPERATURE][4];
      this.b5_temperature5 = params[NewProtocolTags.B5_TEMPERATURE][5];
      this.b5_temperature6 = params[NewProtocolTags.B5_TEMPERATURE][6];
    }

    if (NewProtocolTags.B5_SCREEN_DISPLAY in params) {
      this.b5_screen_display = params[NewProtocolTags.B5_SCREEN_DISPLAY][0];
    }

    if (NewProtocolTags.B5_SOUND in params) {
      this.b5_sound = params[NewProtocolTags.B5_SOUND][0];
    }

    if (NewProtocolTags.B5_HUMIDITY in params) {
      this.b5_humidity = params[NewProtocolTags.B5_HUMIDITY][0];
    }
  }
}

// C0 message body
class XC0MessageBody extends MessageBody {
  // powerValue
  public power: boolean;
  // modeValue
  public mode: number;
  // temperature & smallTemperature
  public target_temperature: number;
  // fanspeedValue
  public fan_speed: number;
  // swingLRValue
  public swing_vertical: boolean;
  // swingUDValue
  public swing_horizontal: boolean;
  // strongWindValue
  public boost_mode: boolean;
  // power_saving
  public power_saving: number;
  // comfortableSleepValue
  public comfort_sleep: number;
  // comfortableSleepSwitch
  public comfort_sleep_switch: number;
  // pmv
  public pmv: number;
  // screenDisplayNowValue
  public screen_display: boolean;
  public smart_eye: boolean;
  // dryValue
  public dry: boolean;
  // PTCValue
  public aux_heating: boolean;
  // purifierValue
  public purifier: number;
  public anion: boolean;
  // ecoValue
  public eco_mode: boolean;
  public sleep_mode: boolean;
  public indoor_temperature?: number;
  public outdoor_temperature?: number;
  public temp_fahrenheit: boolean;
  // naturalWind
  public natural_wind: boolean;
  // smartDryValue
  public smart_dry: boolean;
  // kickQuilt
  public kick_quilt: number;
  // preventCold
  public prevent_cold: number;
  // dust_full_time
  public full_dust: boolean;
  // comfortPowerSave
  public comfort_mode: boolean;
  // swingLRUnderSwitch
  public swing_lr_switch: number;
  // swingLRValueUnder
  public swing_lr_value: number;
  // arom
  public frost_protect: boolean;

  public fresh_filter_time_total?: number;
  public fresh_filter_time_use?: number;
  public fresh_filter_timeout?: number;

  constructor(body: Buffer) {
    super(body);

    this.power = (body[1] & 0x1) > 0;
    this.mode = (body[2] & 0xe0) >> 5;
    this.target_temperature = (body[2] & 0x0f) + 16.0 + ((body[2] & 0x10) > 0 ? 0.5 : 0.0);
    this.fan_speed = body[3] & 0x7f;
    this.swing_vertical = (body[7] & 0xc) > 0;
    this.swing_horizontal = (body[7] & 0x3) > 0;
    this.boost_mode = (body[8] & 0x20) > 0 || (body[10] & 0x2) > 0;
    this.power_saving = body[8] & 0x08;
    this.comfort_sleep = body[8] & 0x03;
    this.comfort_sleep_switch = body[9] & 0x40;
    this.pmv = (body[14] & 0x0f) * 0.5 - 3.5;
    this.smart_eye = (body[8] & 0x40) > 0;
    this.natural_wind = (body[9] & 0x02) > 0;
    this.dry = (body[9] & 0x04) > 0;
    this.eco_mode = (body[9] & 0x10) > 0;
    this.aux_heating = (body[9] & 0x08) > 0;
    this.purifier = body[9] & 0x20;
    this.anion = (body[9] & 0x20) > 0;
    this.temp_fahrenheit = (body[10] & 0x04) > 0;
    this.sleep_mode = (body[10] & 0x01) > 0;
    const decimal = body.length > TEMP_DECIMAL_MIN_BODY_LENGTH ? body[15] : 0;
    this.indoor_temperature = parseTemperature(body[11], decimal & 0x0f);
    this.outdoor_temperature = parseTemperature(body[12], decimal >> 4);
    this.kick_quilt = (body[10] & 0x04) >> 2;
    this.prevent_cold = (body[10] & 0x20) >> 5;
    this.full_dust = (body[13] & 0x20) >> 5 > 0;
    this.screen_display = ((body[14] >> 4) & 0x7) !== SCREEN_DISPLAY_BYTE_CHECK && this.power;
    this.frost_protect = body.length >= FROST_PROTECT_MIN_LENGTH ? (body[21] & 0x80) > 0 : false;
    this.comfort_mode = body.length >= CONFORT_MODE_MIN_LENGTH2 ? (body[22] & 0x1) > 0 : false;
    this.smart_dry = body.length >= SMART_DRY_MIN_LENGTH ? (body[19] & 0x7f) > 0 : false;
    this.swing_lr_switch = body.length >= SWING_LR_MIN_LENGTH ? body[19] & 0x80 : 0;
    this.swing_lr_value = body.length >= SWING_LR_MIN_LENGTH ? body[20] & 0x80 : 0;

    if (body.length >= FRESH_AIR_C0_MIN_LENGTH) {
      this.fresh_filter_time_total = body[25] * 256 + body[24];
      this.fresh_filter_time_use = body[27] * 256 + body[26];
      this.fresh_filter_timeout = (body[13] & 0x40) >> 6;
    }
  }
}

const powerAnalysisMethods: Readonly<Record<number, (byte: number, value: number) => number>> = {
  [PowerFormats.BCD]: (byte, value) => (byte >> 4) * 10 + (byte & 0x0f) + value * 100,
  [PowerFormats.BINARY]: (byte, value) => byte + (value << 8),
  [PowerFormats.MIXED]: (byte, value) => byte + value * 100,
};

const validPowerFormats = new Set([PowerFormats.BCD, PowerFormats.BINARY, PowerFormats.MIXED, PowerFormats.BINARY1, PowerFormats.BCD_ENERGY_BINARY_POWER]);

function parseValue(analysisMethod: number, databytes: Buffer): number {
  if (!validPowerFormats.has(analysisMethod)) {
    return 0;
  }
  const fn = powerAnalysisMethods[analysisMethod % 10];
  if (!fn) return 0;
  let value = 0;
  for (const byte of databytes) {
    value = fn(byte, value);
  }
  return value;
}

function parsePower(analysisMethod: number, databytes: Buffer): number {
  if (analysisMethod === PowerFormats.BCD_ENERGY_BINARY_POWER) {
    return parseValue(PowerFormats.BINARY, databytes) / 10;
  }
  return parseValue(analysisMethod, databytes) / 10;
}

function parseConsumption(analysisMethod: number, databytes: Buffer): number {
  if (analysisMethod === PowerFormats.BCD_ENERGY_BINARY_POWER) {
    return parseValue(PowerFormats.BCD, databytes) / 100;
  }
  const divisor = analysisMethod === PowerFormats.BINARY ? 10 : 100;
  return parseValue(analysisMethod, databytes) / divisor;
}

class XC1MessageBody extends MessageBody {
  public total_energy_consumption?: number;
  public total_operating_consumption?: number;
  public current_energy_consumption?: number;
  public realtime_power?: number;

  public electrify_time_day?: number;
  public electrify_time_hour?: number;
  public electrify_time_min?: number;
  public electrify_time_second?: number;
  public electrify_time?: number;

  public total_operating_time_day?: number;
  public total_operating_time_hour?: number;
  public total_operating_time_min?: number;
  public total_operating_time_second?: number;
  public total_operating_time?: number;

  public current_operating_time_day?: number;
  public current_operating_time_hour?: number;
  public current_operating_time_min?: number;
  public current_operating_time_second?: number;
  public current_operating_time?: number;

  public indoor_humidity?: number;

  constructor(body: Buffer, analysis_method = 3) {
    super(body);

    if (body[3] === XC1_SUBBODY_TYPE_44) {
      // total_power_consumption
      this.total_energy_consumption = parseConsumption(analysis_method, body.subarray(4, 8));
      // total_operating_consumption
      this.total_operating_consumption = parseConsumption(analysis_method, body.subarray(8, 12));
      // current_operating_consumption
      this.current_energy_consumption = parseConsumption(analysis_method, body.subarray(12, 16));
      // current_time_power
      this.realtime_power = parsePower(analysis_method, body.subarray(16, 19));
    } else if (body[3] === XC1_SUBBODY_TYPE_40) {
      this.electrify_time_day = body[5] | (body[4] << 8);
      this.electrify_time_hour = body[6];
      this.electrify_time_min = body[7];
      this.electrify_time_second = body[8];
      // summary
      this.electrify_time = this.electrify_time_day * 24 + this.electrify_time_hour + this.electrify_time_min / 60 + this.electrify_time_second / 3600;
      this.total_operating_time_day = body[10] | (body[9] << 8);
      this.total_operating_time_hour = body[11];
      this.total_operating_time_min = body[12];
      this.total_operating_time_second = body[13];
      // summary
      this.total_operating_time =
        this.total_operating_time_day * 24 + this.total_operating_time_hour + this.total_operating_time_min / 60 + this.total_operating_time_second / 3600;
      this.current_operating_time_day = body[15] | (body[14] << 8);
      this.current_operating_time_hour = body[16];
      this.current_operating_time_min = body[17];
      this.current_operating_time_second = body[18];
      // summary
      this.current_operating_time =
        this.current_operating_time_day * 24 +
        this.current_operating_time_hour +
        this.current_operating_time_min / 60 +
        this.current_operating_time_second / 3600;
    } else if (body[3] === XC1_SUBBODY_TYPE_45) {
      // indoor humidity, it should be the same value as XBB/XA1 message
      this.indoor_humidity = body[4] !== 0 ? body[4] : undefined;
    }
  }
}

// BB message body
class XBBMessageBody extends MessageBody {
  public power?: boolean;
  public dry?: boolean;
  public boost_mode?: boolean;
  public aux_heating?: boolean;
  public sleep_mode?: boolean;
  public mode?: number;
  public target_temperature?: number;
  public fan_speed?: number;
  public timer?: boolean;
  public eco_mode?: boolean;
  public indoor_temperature?: number;
  public indoor_humidity?: number;
  public sn8_flag?: boolean;
  public outdoor_temperature?: number;

  constructor(body: Buffer) {
    super(body);
    const subprotocol_head = body.subarray(0, 6);
    const subprotocol_body = body.subarray(6, body.length);
    const data_type = subprotocol_head[subprotocol_head.length - 1];
    const subprotocol_body_len = subprotocol_body.length;
    if (data_type === 0x11 || data_type === 0x20) {
      this.power = (subprotocol_body[0] & 0x1) > 0;
      this.dry = (subprotocol_body[0] & 0x10) > 0;
      this.boost_mode = (subprotocol_body[0] & 0x20) > 0;
      this.aux_heating = (subprotocol_body[1] & 0x40) > 0;
      this.sleep_mode = (subprotocol_body[2] & 0x80) > 0;
      this.mode = BB_AC_MODES.indexOf(subprotocol_body[5] + 1);
      if (this.mode === -1) {
        this.mode = 0;
      }
      this.target_temperature = (subprotocol_body[6] - 30) / 2;
      this.fan_speed = subprotocol_body[7];
      this.timer = subprotocol_body_len > 27 ? (subprotocol_body[25] & 0x04) > 0 : false;
      this.eco_mode = subprotocol_body_len > 27 ? (subprotocol_body[25] & 0x40) > 0 : false;
    } else if (data_type === 0x10) {
      if ((subprotocol_body[8] & 0x80) === 0x80) {
        this.indoor_temperature = ((0 - (~(subprotocol_body[7] + subprotocol_body[8] * 256) + 1)) & 0xffff) / 100;
      } else {
        this.indoor_temperature = (subprotocol_body[7] + subprotocol_body[8] * 256) / 100;
      }
      this.indoor_humidity = subprotocol_body[30] !== 0 ? subprotocol_body[30] : undefined;
      this.sn8_flag = subprotocol_body[80] === XBB_SN8_BYTE_FLAG;
    } else if (data_type === 0x30) {
      if ((subprotocol_body[6] & 0x80) === 0x80) {
        this.outdoor_temperature = ((0 - (~(subprotocol_body[5] + subprotocol_body[6] * 256) + 1)) & 0xffff) / 100;
      } else {
        this.outdoor_temperature = (subprotocol_body[5] + subprotocol_body[6] * 256) / 100;
      }
    }
  }
}

export class MessageACResponse extends MessageResponse {
  public used_subprotocol?: boolean;

  constructor(
    private readonly message: Buffer,
    power_analysis_method = 3,
  ) {
    super(message);

    // dataType 0x05 and messageBytes[0] 0xA0
    if (this.message_type === MessageType.NOTIFY2 && this.body_type === 0xa0) {
      this.set_body(new XA0MessageBody(this.body));
    } // dataType 0x04 and messageBytes[0] 0xA1
    else if (this.message_type === MessageType.NOTIFY1 && this.body_type === 0xa1) {
      this.set_body(new XA1MessageBody(this.body));
    }
    // parse MessageCapabilitiesQuery/MessageCapabilitiesAdditionalQuery response
    // dataType 0x03 and messageBytes[0] 0xB5
    else if (this.message_type === MessageType.QUERY && this.body_type === 0xb5) {
      this.set_body(new XB5MessageBody(this.body, this.body_type));
    }
    // dataType 0x05 and messageBytes[0] 0xB5
    // dataType 0x02 and messageBytes[0] 0xB0 (set result Unidentified protocol)
    // dataType 0x03 and messageBytes[0] 0xB1
    else if ([MessageType.QUERY, MessageType.SET, MessageType.NOTIFY2].includes(this.message_type) && [0xb0, 0xb1, 0xb5].includes(this.body_type)) {
      this.set_body(new XBXMessageBody(this.body, this.body_type));
    }
    // dataType 0x02 and messageBytes[0] 0xC0
    // dataType 0x03 and messageBytes[0] 0xC0
    else if ([MessageType.QUERY, MessageType.SET].includes(this.message_type) && this.body_type === 0xc0) {
      this.set_body(new XC0MessageBody(this.body));
    }
    // messageBytes[0] 0xC1
    else if (this.message_type === MessageType.QUERY && this.body_type === 0xc1) {
      this.set_body(new XC1MessageBody(this.body, power_analysis_method));
    } else if (
      [MessageType.QUERY, MessageType.SET, MessageType.NOTIFY2].includes(this.message_type) &&
      this.body_type === 0xbb &&
      this.body.length >= BB_MIN_BODY_LENGTH
    ) {
      this.used_subprotocol = true;
      this.set_body(new XBBMessageBody(this.body));
    }
  }
}

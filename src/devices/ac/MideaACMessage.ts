/***********************************************************************
 * Midea Air Conditioner Device message handler class
 *
 * Copyright (c) 2023 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */
import { DeviceType } from '../../core/MideaConstants';
import { MessageBody, MessageRequest, MessageResponse, MessageType, NewProtocolMessageBody } from '../../core/MideaMessage';
import { calculate } from '../../core/MideaUtils';

enum NewProtocolTags {
  WIND_SWING_UD_ANGLE = 0x0009,
  WIND_SWING_LR_ANGLE = 0x000a,
  INDOOR_HUMIDITY = 0x0015,
  SCREEN_DISPLAY = 0x0017,
  BREEZELESS = 0x0018,
  PROMPT_TONE = 0x001a,
  INDIRECT_WIND = 0x0042, // prevent_straight_wind
  FRESH_AIR_1 = 0x0233,
  FRESH_AIR_2 = 0x004b,
  SELF_CLEAN = 0x0039, // ION
  RATE_SELECT = 0x0048, // GEAR
}

const BB_AC_MODES = [0, 3, 1, 2, 4, 5];

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
    let body = Buffer.concat([Buffer.from([this.body_type!]), this._body, Buffer.from([this.message_id])]);
    body = Buffer.concat([body, Buffer.from([calculate(body)])]);
    return body;
  }
}

export class MessageQuery extends MessageACBase {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.QUERY, 0x41);
  }

  get _body() {
    return Buffer.from([0x81, 0x00, 0xff, 0x03, 0xff, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  }
}

export class MessagePowerQuery extends MessageACBase {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.QUERY, 0x41);
  }

  get _body() {
    return Buffer.from([0x21, 0x01, 0x44, 0x00, 0x01]);
  }

  get body() {
    let body = Buffer.concat([Buffer.from([this.body_type!]), this._body]);
    body = Buffer.concat([body, Buffer.from([calculate(body)])]);
    return body;
  }
}

export class MessageSwitchDisplay extends MessageACBase {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.QUERY, 0x41);
  }

  get _body() {
    return Buffer.from([0x81, 0x00, 0xff, 0x02, 0xff, 0x02, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  }
}

export class MessageNewProtocolQuery extends MessageACBase {
  constructor(
    device_protocol_version: number,
    private readonly alternate_display = false,
  ) {
    super(device_protocol_version, MessageType.QUERY, 0xb1);
  }

  get _body() {
    const query_params = [
      NewProtocolTags.WIND_SWING_UD_ANGLE,
      NewProtocolTags.WIND_SWING_LR_ANGLE,
      NewProtocolTags.INDIRECT_WIND,
      NewProtocolTags.BREEZELESS,
      NewProtocolTags.INDOOR_HUMIDITY,
      this.alternate_display ? NewProtocolTags.SCREEN_DISPLAY : undefined,
      NewProtocolTags.FRESH_AIR_1,
      NewProtocolTags.FRESH_AIR_2,
      NewProtocolTags.SELF_CLEAN,
      NewProtocolTags.RATE_SELECT,
    ];
    let body = Buffer.from([query_params.length]);
    for (const param of query_params) {
      if (param) {
        body = Buffer.concat([body, Buffer.from([param & 0xff, param >> 8])]);
      }
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
    let body = Buffer.concat([Buffer.from([this.body_type!]), this._body]);
    body = Buffer.concat([body, Buffer.from([calculate(body)])]);
    body = Buffer.concat([body, Buffer.from([this.checksum(body)])]);
    return body;
  }

  get _body() {
    let body = Buffer.from([
      6 + 2 + (this.subprotocol_body ? this.subprotocol_body.length : 0),
      0x00,
      0xff,
      0xff,
      this.subprotocol_query_type,
    ]);
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
    const aux_heating = this.aux_heating ? 0x40 : 0;
    const sleep_mode = this.sleep_mode ? 0x80 : 0;
    const mode = this.mode === 0 ? 0 : this.mode < BB_AC_MODES.length ? BB_AC_MODES[this.mode] - 1 : 2;
    const target_temperature = (this.target_temperature * 2 + 30) | 0;

    const water_model_temperature_set = ((this.target_temperature - 1) * 2 + 50) | 0;
    const fan_speed = this.fan_speed;
    const eco = this.eco_mode ? 0x40 : 0;
    const prompt_tone = this.prompt_tone ? 0x01 : 0;
    const timer = this.sn8_flag && this.timer ? 0x04 : 0;

    return Buffer.from([
      boost_mode | power | dry,
      aux_heating,
      sleep_mode,
      0x00,
      0x00,
      mode,
      target_temperature,
      fan_speed,
      0x32,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x01,
      0x01,
      0x00,
      0x01,
      water_model_temperature_set,
      prompt_tone,
      target_temperature,
      0x32,
      0x66,
      0x00,
      eco | timer,
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
      0x08,
    ]);
  }
}

export class MessageGeneralSet extends MessageACBase {
  public power: boolean;
  public prompt_tone: boolean;
  public mode: number;
  public target_temperature: number;
  public fan_speed: number;
  public swing_vertical: boolean;
  public swing_horizontal: boolean;
  public boost_mode: boolean;
  public smart_eye: boolean;
  public dry: boolean;
  public aux_heating: boolean;
  public eco_mode: boolean;
  public temp_fahrenheit: boolean;
  public sleep_mode: boolean;
  public natural_wind: boolean;
  public frost_protect: boolean;
  public comfort_mode: boolean;

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

    return Buffer.from([
      power | prompt_tone,
      mode | target_temperature,
      fan_speed,
      0x00,
      0x00,
      0x00,
      swing_mode,
      boost_mode,
      smart_eye | dry | aux_heating | eco_mode,
      temp_fahrenheit | sleep_mode | boost_mode_1,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      natural_wind,
      0x00,
      0x00,
      0x00,
      frost_protect,
      comfort_mode,
    ]);
  }
}

export class MessageNewProtocolSet extends MessageACBase {
  public wind_swing_ud_angle?: number;
  public wind_swing_lr_angle?: number;
  public indirect_wind?: boolean;
  public prompt_tone = false;
  public breezeless?: boolean;
  public screen_display?: boolean;
  public fresh_air_1?: Buffer;
  public fresh_air_2?: Buffer;
  public self_clean?: boolean;
  public rate_select?: number;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0xb0);
  }

  get _body() {
    let pack_count = 0;
    let payload = Buffer.from([0x00]);

    if (this.wind_swing_ud_angle !== undefined) {
      pack_count += 1;
      payload = Buffer.concat([
        payload,
        NewProtocolMessageBody.packet(NewProtocolTags.WIND_SWING_UD_ANGLE, Buffer.from([this.wind_swing_ud_angle])),
      ]);
    }

    if (this.wind_swing_lr_angle !== undefined) {
      pack_count += 1;
      payload = Buffer.concat([
        payload,
        NewProtocolMessageBody.packet(NewProtocolTags.WIND_SWING_LR_ANGLE, Buffer.from([this.wind_swing_lr_angle])),
      ]);
    }

    if (this.breezeless !== undefined) {
      pack_count += 1;
      payload = Buffer.concat([
        payload,
        NewProtocolMessageBody.packet(NewProtocolTags.BREEZELESS, Buffer.from([this.breezeless ? 0x01 : 0x00])),
      ]);
    }

    if (this.indirect_wind !== undefined) {
      pack_count += 1;
      payload = Buffer.concat([
        payload,
        NewProtocolMessageBody.packet(NewProtocolTags.INDIRECT_WIND, Buffer.from([this.indirect_wind ? 0x02 : 0x01])),
      ]);
    }

    if (this.screen_display !== undefined) {
      pack_count += 1;
      payload = Buffer.concat([
        payload,
        NewProtocolMessageBody.packet(NewProtocolTags.SCREEN_DISPLAY, Buffer.from([this.screen_display ? 0x64 : 0x00])),
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
          Buffer.from([fresh_air_power, fresh_air_fan_speed, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
        ),
      ]);
    }

    if (this.fresh_air_2 !== undefined && this.fresh_air_2.length === 2) {
      pack_count += 1;
      const fresh_air_power = this.fresh_air_2[0] > 0 ? 1 : 0;
      const fresh_air_fan_speed = this.fresh_air_2[1];
      payload = Buffer.concat([
        payload,
        NewProtocolMessageBody.packet(NewProtocolTags.FRESH_AIR_2, Buffer.from([fresh_air_power, fresh_air_fan_speed, 0xff])),
      ]);
    }

    if (this.self_clean !== undefined) {
      pack_count += 1;
      payload = Buffer.concat([
        payload,
        NewProtocolMessageBody.packet(NewProtocolTags.SELF_CLEAN, Buffer.from([this.self_clean ? 0x01 : 0x00])),
      ]);
    }

    if (this.rate_select !== undefined) {
      pack_count += 1;
      payload = Buffer.concat([payload, NewProtocolMessageBody.packet(NewProtocolTags.RATE_SELECT, Buffer.from([this.rate_select]))]);
    }

    pack_count += 1;
    payload = Buffer.concat([
      payload,
      NewProtocolMessageBody.packet(NewProtocolTags.PROMPT_TONE, Buffer.from([this.prompt_tone ? 0x01 : 0x00])),
    ]);

    payload[0] = pack_count;
    return payload;
  }
}

class XA0MessageBody extends MessageBody {
  public power: boolean;
  public target_temperature: number;
  public mode: number;
  public fan_speed: number;
  public fan_auto: boolean;
  public swing_vertical: boolean;
  public swing_horizontal: boolean;
  public boost_mode: boolean;
  public smart_eye: boolean;
  public dry: boolean;
  public aux_heating: boolean;
  public eco_mode: boolean;
  public sleep_mode: boolean;
  public natural_wind: boolean;
  public full_dust: boolean;
  public comfort_mode: boolean;

  constructor(body: Buffer) {
    super(body);

    this.power = (body[1] & 0x1) > 0;
    this.target_temperature = ((body[1] & 0x3e) >> 1) - 4 + 16.0 + ((body[1] & 0x40) > 0 ? 0.5 : 0.0);
    this.mode = (body[2] & 0xe0) >> 5;
    this.fan_speed = body[3] & 0x7f;
    this.fan_auto = this.fan_speed > 100;
    this.swing_vertical = (body[7] & 0xc) > 0;
    this.swing_horizontal = (body[7] & 0x3) > 0;
    this.boost_mode = (body[8] & 0x20) > 0 || (body[10] & 0x2) > 0;
    this.smart_eye = (body[9] & 0x01) > 0;
    this.dry = (body[9] & 0x04) > 0;
    this.aux_heating = (body[9] & 0x08) > 0;
    this.eco_mode = (body[9] & 0x10) > 0;
    this.sleep_mode = (body[10] & 0x01) > 0;
    this.natural_wind = (body[10] & 0x40) > 0;
    this.full_dust = (body[13] & 0x20) > 0;
    this.comfort_mode = body.length > 16 ? (body[14] & 0x1) > 0 : false;
  }
}

class XA1MessageBody extends MessageBody {
  public indoor_temperature?: number;
  public outdoor_temperature?: number;
  public indoor_humidity?: number;

  constructor(body: Buffer) {
    super(body);

    if (body[13] !== 0xff) {
      const temp_integer = ((body[13] - 50) / 2) | 0;
      const temp_decimal = body.length > 20 ? (body[18] & 0xf) * 0.1 : 0;
      if (body[13] > 49) {
        this.indoor_temperature = temp_integer + temp_decimal;
      } else {
        this.indoor_temperature = temp_integer - temp_decimal;
      }
    }

    if (body[14] === 0xff) {
      this.outdoor_temperature = undefined;
    } else {
      const temp_integer = ((body[14] - 50) / 2) | 0;
      const temp_decimal = body.length > 20 ? ((body[18] & 0xf0) >> 4) * 0.1 : 0;
      if (body[14] > 49) {
        this.outdoor_temperature = temp_integer + temp_decimal;
      } else {
        this.outdoor_temperature = temp_integer - temp_decimal;
      }
    }
    this.indoor_humidity = body[17];
  }
}

class XBXMessageBody extends NewProtocolMessageBody {
  public wind_swing_lr_angle?: number;
  public wind_swing_ud_angle?: number;
  public indirect_wind?: boolean;
  public indoor_humidity?: number;
  public breezeless?: boolean;
  public screen_display?: boolean;
  public screen_display_new?: boolean;
  public fresh_air_1?: boolean;
  public fresh_air_2?: boolean;
  public fresh_air_power?: boolean;
  public fresh_air_fan_speed?: number;
  public self_clean?: boolean;
  public rate_select?: number;

  constructor(body: Buffer, body_type: number) {
    super(body, body_type);
    const params = this.parse();

    if (NewProtocolTags.WIND_SWING_LR_ANGLE in params) {
      this.wind_swing_lr_angle = params[NewProtocolTags.WIND_SWING_LR_ANGLE][0];
    }
    if (NewProtocolTags.WIND_SWING_UD_ANGLE in params) {
      this.wind_swing_ud_angle = params[NewProtocolTags.WIND_SWING_UD_ANGLE][0];
    }

    if (NewProtocolTags.INDIRECT_WIND in params) {
      this.indirect_wind = params[NewProtocolTags.INDIRECT_WIND][0] === 0x02;
    }
    if (NewProtocolTags.INDOOR_HUMIDITY in params) {
      this.indoor_humidity = params[NewProtocolTags.INDOOR_HUMIDITY][0];
    }
    if (NewProtocolTags.BREEZELESS in params) {
      this.breezeless = params[NewProtocolTags.BREEZELESS][0] === 1;
    }
    if (NewProtocolTags.SCREEN_DISPLAY in params) {
      this.screen_display = params[NewProtocolTags.SCREEN_DISPLAY][0] > 0;
      this.screen_display_new = true;
    }
    if (NewProtocolTags.FRESH_AIR_1 in params) {
      this.fresh_air_1 = true;
      const data = params[NewProtocolTags.FRESH_AIR_1];
      this.fresh_air_power = data[0] === 0x02;
      this.fresh_air_fan_speed = data[1];
    }
    if (NewProtocolTags.FRESH_AIR_2 in params) {
      this.fresh_air_2 = true;
      const data = params[NewProtocolTags.FRESH_AIR_2];
      this.fresh_air_power = data[0] > 0;
      this.fresh_air_fan_speed = data[1];
    }

    if (NewProtocolTags.SELF_CLEAN in params) {
      console.log(params[NewProtocolTags.SELF_CLEAN]);
      this.self_clean = params[NewProtocolTags.SELF_CLEAN][0] === 1;
    }

    if (NewProtocolTags.RATE_SELECT in params) {
      console.log(params[NewProtocolTags.RATE_SELECT]);
      this.rate_select = params[NewProtocolTags.RATE_SELECT][0];
    }
  }
}

class XC0MessageBody extends MessageBody {
  public power: boolean;
  public mode: number;
  public target_temperature: number;
  public fan_speed: number;
  public fan_auto: boolean;
  public swing_vertical: boolean;
  public swing_horizontal: boolean;
  public boost_mode: boolean;
  public smart_eye: boolean;
  public natural_wind: boolean;
  public dry: boolean;
  public eco_mode: boolean;
  public aux_heating: boolean;
  public temp_fahrenheit: boolean;
  public sleep_mode: boolean;
  public indoor_temperature?: number;
  public outdoor_temperature?: number;
  public full_dust: boolean;
  public screen_display: boolean;
  public frost_protect: boolean;
  public comfort_mode: boolean;

  constructor(body: Buffer) {
    super(body);

    this.power = (body[1] & 0x1) > 0;
    this.mode = (body[2] & 0xe0) >> 5;
    this.target_temperature = (body[2] & 0x0f) + 16.0 + ((body[2] & 0x10) > 0 ? 0.5 : 0.0);
    this.fan_speed = body[3] & 0x7f;
    this.fan_auto = this.fan_speed > 100;
    this.swing_vertical = (body[7] & 0x0c) > 0;
    this.swing_horizontal = (body[7] & 0x03) > 0;
    this.boost_mode = (body[8] & 0x20) > 0 || (body[10] & 0x2) > 0;
    this.smart_eye = (body[8] & 0x40) > 0;
    this.natural_wind = (body[9] & 0x2) > 0;
    this.dry = (body[9] & 0x4) > 0;
    this.eco_mode = (body[9] & 0x10) > 0;
    this.aux_heating = (body[9] & 0x08) > 0;
    this.temp_fahrenheit = (body[10] & 0x04) > 0;
    this.sleep_mode = (body[10] & 0x01) > 0;

    if (body[11] !== 0xff) {
      const temp_integer = ((body[11] - 50) / 2) | 0;
      const temp_decimal = (body[15] & 0x0f) * 0.1;
      if (body[11] > 49) {
        this.indoor_temperature = temp_integer + temp_decimal;
      } else {
        this.indoor_temperature = temp_integer - temp_decimal;
      }
    }

    if (body[12] === 0xff) {
      this.outdoor_temperature = undefined;
    } else {
      const temp_integer = ((body[12] - 50) / 2) | 0;
      const temp_decimal = ((body[15] & 0xf0) >> 4) * 0.1;
      if (body[12] > 49) {
        this.outdoor_temperature = temp_integer + temp_decimal;
      } else {
        this.outdoor_temperature = temp_integer - temp_decimal;
      }
    }

    this.full_dust = (body[13] & 0x20) > 0;
    this.screen_display = (body[14] & 0x70) >> 4 !== 0x07 && this.power;
    this.frost_protect = body.length > 23 ? (body[21] & 0x80) > 0 : false;
    this.comfort_mode = body.length > 24 ? (body[22] & 0x1) > 0 : false;
  }
}

class XC1MessageBody extends MessageBody {
  public total_energy_consumption?: number;
  public current_energy_consumption?: number;
  public realtime_power?: number;

  constructor(body: Buffer, analysis_method = 3) {
    super(body);

    if (body[3] === 0x44) {
      this.total_energy_consumption = XC1MessageBody.parse_consumption(analysis_method, body[4], body[5], body[6], body[7]);
      this.current_energy_consumption = XC1MessageBody.parse_consumption(analysis_method, body[12], body[13], body[14], body[15]);
      this.realtime_power = XC1MessageBody.parse_power(analysis_method, body[16], body[17], body[18]);
    }
  }

  static parse_power(analysis_method: number, byte1: number, byte2: number, byte3: number) {
    if (analysis_method === 1) {
      return byte1 + byte2 / 100 + byte3 / 10000;
    } else if (analysis_method === 2) {
      return ((byte1 << 16) + (byte2 << 8) + byte3) / 1000;
    } else {
      return (byte1 * 10000 + byte2 * 100 + byte3) / 10;
    }
  }

  static parse_consumption(analysis_method: number, byte1: number, byte2: number, byte3: number, byte4: number) {
    if (analysis_method === 1) {
      return byte1 * 10000 + byte2 * 100 + byte3 + byte4 / 100;
    } else if (analysis_method === 2) {
      return ((byte1 << 32) + (byte2 << 16) + (byte3 << 8) + byte4) / 1000;
    } else {
      return (byte1 * 1000000 + byte2 * 10000 + byte3 * 100 + byte4) / 100;
    }
  }
}

class XBBMessageBody extends MessageBody {
  public power?: boolean;
  public dry?: boolean;
  public boost_mode?: boolean;
  public aux_heating?: boolean;
  public sleep_mode?: boolean;
  public mode?: number;
  public target_temperature?: number;
  public fan_speed?: number;
  public fan_auto?: boolean;
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
    if (data_type === 0x20 || data_type === 0x11) {
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
      this.fan_auto = this.fan_speed > 100;
      this.timer = subprotocol_body_len > 27 ? (subprotocol_body[25] & 0x04) > 0 : false;
      this.eco_mode = subprotocol_body_len > 27 ? (subprotocol_body[25] & 0x40) > 0 : false;
    } else if (data_type === 0x10) {
      if ((subprotocol_body[8] & 0x80) === 0x80) {
        this.indoor_temperature = ((0 - (~(subprotocol_body[7] + subprotocol_body[8] * 256) + 1)) & 0xffff) / 100;
      } else {
        this.indoor_temperature = (subprotocol_body[7] + subprotocol_body[8] * 256) / 100;
      }
      this.indoor_humidity = subprotocol_body[30];
      this.sn8_flag = subprotocol_body[80] === 0x31;
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

    if (this.message_type === MessageType.NOTIFY2 && this.body_type === 0xa0) {
      this.set_body(new XA0MessageBody(this.body));
    } else if (this.message_type === MessageType.NOTIFY1 && this.body_type === 0xa1) {
      this.set_body(new XA1MessageBody(this.body));
    } else if (
      [MessageType.QUERY, MessageType.SET, MessageType.NOTIFY2].includes(this.message_type) &&
      [0xb0, 0xb1, 0xb5].includes(this.body_type)
    ) {
      this.set_body(new XBXMessageBody(this.body, this.body_type));
    } else if ([MessageType.QUERY, MessageType.SET].includes(this.message_type) && this.body_type === 0xc0) {
      this.set_body(new XC0MessageBody(this.body));
    } else if (this.message_type === MessageType.QUERY && this.body_type === 0xc1) {
      this.set_body(new XC1MessageBody(this.body, power_analysis_method));
    } else if (
      [MessageType.QUERY, MessageType.SET, MessageType.NOTIFY2].includes(this.message_type) &&
      this.body_type === 0xbb &&
      this.body.length >= 21
    ) {
      this.used_subprotocol = true;
      this.set_body(new XBBMessageBody(this.body));
    }
  }
}

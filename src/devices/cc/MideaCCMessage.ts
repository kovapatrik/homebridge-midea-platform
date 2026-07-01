/***********************************************************************
 * Midea MDV Wi-Fi Controller Device message handler class
 *
 * Copyright (c) 2025 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *                https://github.com/mill1000/midea-msmart
 *                https://github.com/midea-lan/midea-local
 *
 */

import { DeviceType } from '../../core/MideaConstants.js';
import { MessageBody, MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage.js';
import { calculate } from '../../core/MideaUtils.js';

// ptc_setting (body[14] bits5-6): legacy wire values 0x00=Auto, 0x10=On, 0x20=Off
export enum HeatStatus {
  Auto = 0x00,
  On = 0x10,
  Off = 0x20,
}

// Operational mode — legacy binary wire values (body[1] & 0x1F)
export enum Mode {
  Fan = 0x01,
  Dry = 0x02,
  Heat = 0x04,
  Cool = 0x08,
  Auto = 0x10,
}

// Fan speed — legacy binary bitmask values (body[2])
export enum FanSpeed {
  Auto = 0x80,
  Power = 0x40,
  SuperHigh = 0x20,
  High = 0x10,
  Mid = 0x08,
  Low = 0x04,
  Micron = 0x02,
  Sleep = 0x01,
}

// Louver angle for TLV (86X Controller) devices.
// Raw byte = value_map_key − 1; Auto(0x06) = oscillating, Close(0x00) = off.
export enum SwingAngle {
  Close = 0x00,
  Pos1 = 0x01,
  Pos2 = 0x02,
  Pos3 = 0x03,
  Pos4 = 0x04,
  Pos5 = 0x05,
  Auto = 0x06,
}

// Purifier / sterilize / ion mode (key_maps idx=58, sterilize_status).
// Raw byte = value_map_key − 1: Auto=0, On=1, Off=2.
export enum PurifierMode {
  Auto = 0x00,
  On = 0x01,
  Off = 0x02,
}

// Control IDs for the 0xFE VRF panel key-value control protocol.
// Values are the key_maps indices from T_0000_CC_10011006_2025033001.lua.
// oxfmt-ignore
export enum ControlId {
  POWER              = 0x0000, // power
  TARGET_TEMPERATURE = 0x0003, // temperature_current
  MODE               = 0x0012, // mode_current
  FAN_SPEED          = 0x0015, // wind_speed_level
  SWING_VERTICAL     = 0x001C, // swing_louver_vertical_level
  SWING_HORIZONTAL   = 0x001E, // swing_louver_horizontal_level
  ECO_MODE           = 0x0028, // eco_status
  SILENT_MODE        = 0x002A, // idu_silent_status
  SLEEP_MODE         = 0x002C, // idu_sleep_status
  PURIFIER_MODE      = 0x003A, // sterilize_status
  NIGHT_LIGHT        = 0x0040, // idu_light
  AUX_HEAT_RUNNING   = 0x0041, // ptc_enable
  AUX_HEAT_MODE      = 0x0043, // ptc_status
}

abstract class MessageCCBase extends MessageRequest {
  constructor(device_protocol_version: number, message_type: MessageType, body_type: number) {
    super(DeviceType.MDV_WIFI_CONTROLLER, message_type, body_type, device_protocol_version);
  }
}

export class MessageQuery extends MessageCCBase {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.QUERY, 0x01);
  }

  get _body() {
    return Buffer.alloc(23);
  }
}

export class MessageSet extends MessageCCBase {
  // biome-ignore lint/suspicious/noExplicitAny: had to use any
  [key: string]: any;
  power: boolean;
  mode: Mode;
  fan_speed: FanSpeed;
  target_temperature: number;
  // eco_status (legacy body[13] bit0)
  eco_mode: boolean;
  // idu_sleep_status (legacy body[14] bit4)
  sleep_mode: boolean;
  // digit_display_switch (legacy body[14] bit3)
  night_light: boolean;
  // exhaust / ventilation (legacy body[13] bit3)
  exhaust: boolean;
  // ptc_setting (legacy body[14] bits5-6)
  aux_heat_mode: HeatStatus;
  // wind_swing_ud_site (legacy body[9]); Close = swing off
  vertical_swing_angle: SwingAngle;
  // wind_swing_lr_site (legacy body[17]); Close = swing off
  horizontal_swing_angle: SwingAngle;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0xc3);
    this.power = false;
    this.mode = Mode.Auto;
    this.fan_speed = FanSpeed.Auto;
    this.target_temperature = 26;
    this.eco_mode = false;
    this.sleep_mode = false;
    this.night_light = false;
    this.exhaust = false;
    this.aux_heat_mode = HeatStatus.Auto;
    this.vertical_swing_angle = SwingAngle.Close;
    this.horizontal_swing_angle = SwingAngle.Close;
  }

  get _body() {
    const power = this.power ? 0x80 : 0;
    const mode = this.mode;
    const fan_speed = this.fan_speed;
    const temperature_integer = this.target_temperature & 0xff;
    // Byte6: eco_mode | exhaust | swing_vertical enable | aux_heat_mode
    const eco = this.eco_mode ? 0x01 : 0;
    const ptc = this.aux_heat_mode & 0x30; // 0x00=Auto, 0x10=On, 0x20=Off
    const swing_ud = this.vertical_swing_angle !== SwingAngle.Close ? 0x04 : 0;
    const exhaust = this.exhaust ? 0x08 : 0;
    // Byte8: sleep_mode | night_light | swing_horizontal enable
    const sleep = this.sleep_mode ? 0x10 : 0;
    const display = this.night_light ? 0x08 : 0;
    const swing_lr = this.horizontal_swing_angle !== SwingAngle.Close ? 0x01 : 0;
    const temperature_dot = ((this.target_temperature - temperature_integer) * 10) & 0xff;

    // oxfmt-ignore
    return Buffer.from([
      power | mode,
      fan_speed,
      temperature_integer,
      // timer (not supported)
      0x00,
      0x00,
      eco | exhaust | swing_ud | ptc,
      // non-stepless fan speed
      0xFF,
      sleep | display | swing_lr,
      this.horizontal_swing_angle,
      this.vertical_swing_angle,
      temperature_dot,
      0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
  }
}

// Build a single TLV control section: [idx_hi][idx_lo][size][data…][0xFF]
function tlvSection(idx: ControlId, value: number): Buffer {
  return Buffer.from([idx >> 8, idx & 0xff, 1, value & 0xff, 0xff]);
}

// FE format mode byte → Mode enum
// mode_current value_map: {[2]="fan",[3]="cool",[4]="heat",[6]="auto",[7]="dry"} (byte = key − 1)
// biome-ignore-start lint/complexity/useSimpleNumberKeys: clearer with hex
const FE_BYTE_TO_MODE: Record<number, Mode> = {
  0x01: Mode.Fan,
  0x02: Mode.Cool,
  0x03: Mode.Heat,
  0x05: Mode.Auto,
  0x06: Mode.Dry,
};
// biome-ignore-end lint/complexity/useSimpleNumberKeys: clearer with hex
export const FE_MODE_TO_BYTE: Partial<Record<Mode, number>> = {
  [Mode.Fan]: 0x01,
  [Mode.Cool]: 0x02,
  [Mode.Heat]: 0x03,
  [Mode.Auto]: 0x05,
  [Mode.Dry]: 0x06,
};

// FE format fan speed byte (1–8) ↔ FanSpeed enum
// wind_speed_level value_map: {[2]='1',…,[8]='7',[9]='auto'} (byte = key − 1)
// biome-ignore-start lint/complexity/useSimpleNumberKeys: clearer with hex
const FE_BYTE_TO_FAN: Record<number, FanSpeed> = {
  0x01: FanSpeed.Micron,
  0x02: FanSpeed.Low,
  0x03: FanSpeed.Mid,
  0x04: FanSpeed.Mid,
  0x05: FanSpeed.High,
  0x06: FanSpeed.SuperHigh,
  0x07: FanSpeed.Power,
  0x08: FanSpeed.Auto,
};
// biome-ignore-end lint/complexity/useSimpleNumberKeys: clearer with hex
export const FE_FAN_TO_BYTE: Partial<Record<FanSpeed, number>> = {
  [FanSpeed.Sleep]: 0x01,
  [FanSpeed.Micron]: 0x01,
  [FanSpeed.Low]: 0x02,
  [FanSpeed.Mid]: 0x03,
  [FanSpeed.High]: 0x05,
  [FanSpeed.SuperHigh]: 0x06,
  [FanSpeed.Power]: 0x07,
  [FanSpeed.Auto]: 0x08,
};

/**
 * Control message for 0xFE VRF panel controllers (86X Controller).
 *
 * Sends a list of (CCControlId, value) pairs as TLV key-value sections,
 * followed by an incrementing message id and CRC8-854. Protocol reverse-
 * engineered by the msmart-ng project (https://github.com/mill1000/midea-ac-py).
 */
export class MessageFEControl extends MessageRequest {
  private static _message_id = 0;
  private readonly _controls: [ControlId, number][];

  constructor(device_protocol_version: number, controls: [ControlId, number][]) {
    super(DeviceType.MDV_WIFI_CONTROLLER, MessageType.SET, null, device_protocol_version);
    this._controls = controls;
  }

  private _next_message_id(): number {
    MessageFEControl._message_id = (MessageFEControl._message_id + 1) & 0xff;
    return MessageFEControl._message_id;
  }

  get _body(): Buffer {
    const sections = Buffer.concat(this._controls.map(([id, val]) => tlvSection(id, val)));
    const msgId = this._next_message_id();
    const withMsgId = Buffer.concat([sections, Buffer.from([msgId])]);
    return Buffer.concat([withMsgId, Buffer.from([calculate(withMsgId)])]);
  }
}

/**
 * Response body for both legacy binary and TLV/FE-format CC devices.
 *
 * When body[1] === 0xFE the response comes from a 86X Controller (VRF panel)
 * using the TLV compact-range format. Fixed byte offsets are derived from the
 * 8-byte Format-A header plus contiguous field data starting at idx=0; all
 * multi-byte field sizes are sourced from T_0000_CC_10011006_2025033001.lua.
 * This approach mirrors midea-local's _parse_fe_body (fixed offsets instead of
 * a runtime TLV map).
 */
export class CCGeneralMessageBody extends MessageBody {
  readonly is_fe_format: boolean;
  power!: boolean;
  mode!: Mode;
  fan_speed!: FanSpeed;
  target_temperature!: number;
  indoor_temperature?: number;
  outdoor_temperature?: number;
  // eco_status
  eco_mode!: boolean;
  // idu_silent_status (FE format only)
  silent_mode!: boolean;
  // idu_sleep_status
  sleep_mode!: boolean;
  // digit_display_switch / idu_light
  night_light!: boolean;
  // ptc_status
  aux_heat_mode!: HeatStatus;
  // ptc_enable / ptc power running bit
  aux_heat_running!: boolean;
  // sterilize_status / ion (FE format only)
  purifier_mode!: PurifierMode;
  temperature_precision!: 1 | 0.5;
  // wind_swing_ud_site / swing_louver_vertical_level; Close when swing is off
  vertical_swing_angle!: SwingAngle;
  // wind_swing_lr_site / swing_louver_horizontal_level; Close when swing is off
  horizontal_swing_angle!: SwingAngle;
  error_code!: number;
  temp_fahrenheit!: boolean;

  constructor(body: Buffer) {
    super(body);
    this.is_fe_format = body.length > 1 && body[1] === 0xfe;
    if (this.is_fe_format) {
      this._parse_fe_body(body);
    } else {
      this._parse_legacy_body(body);
    }
  }

  private _parse_legacy_body(body: Buffer): void {
    // Byte 1: power & mode (legacy wire values)
    this.power = (body[1] & 0x80) > 0;
    this.mode = (body[1] & 0x1f) as Mode;
    // Byte 2: fan_speed
    this.fan_speed = body[2] as FanSpeed;
    // Byte 3 + Byte 19: target_temperature (integer + decimal)
    this.target_temperature = body[3] + body[19] / 10;
    // Byte 4: indoor_temperature
    this.indoor_temperature = (body[4] - 40) / 2;
    // Byte 13: eco_mode, swing_vertical enable, aux_heat_running
    this.eco_mode = (body[13] & 0x01) > 0;
    this.aux_heat_running = (body[13] & 0x02) > 0;
    // Byte 9 + 13 bit2: vertical_swing_angle; Close when swing enable is off
    this.vertical_swing_angle = (body[13] & 0x04) > 0 ? (body[9] as SwingAngle) : SwingAngle.Close;
    // Byte 14: aux_heat_mode, sleep_mode, night_light, swing_horizontal enable, temperature_precision
    const ptc_bits = (body[14] & 0x60) >> 5; // 0=Auto, 1=On, 2=Off
    this.aux_heat_mode = ptc_bits === 0 ? HeatStatus.Auto : ptc_bits === 1 ? HeatStatus.On : HeatStatus.Off;
    this.sleep_mode = (body[14] & 0x10) > 0;
    this.night_light = (body[14] & 0x08) > 0;
    this.temperature_precision = (body[14] & 0x80) > 0 ? 1 : 0.5;
    // Byte 17 + 14 bit0: horizontal_swing_angle; Close when swing enable is off
    this.horizontal_swing_angle = (body[14] & 0x01) > 0 ? (body[17] as SwingAngle) : SwingAngle.Close;
    // Bytes 15 & 18: error_code
    this.error_code = (body[18] & 0x7f) * 255 + body[15];
    // Byte 20: temp_fahrenheit
    this.temp_fahrenheit = body.length > 20 ? (body[20] & 0x80) > 0 : false;
    // Fields absent from legacy format
    this.outdoor_temperature = undefined;
    this.silent_mode = false;
    this.purifier_mode = PurifierMode.Off;
  }

  private _parse_fe_body(body: Buffer): void {
    // 0xFE VRF panel payload. Absolute offsets = 8 (header) + data_offset.
    // data_offset is the cumulative byte size of all preceding indices (idx < N),
    // accounting for multi-byte fields: idx=4(2B), idx=17(5B), idx=34(3B),
    // idx=38(2B), idx=47(2B), idx=66(4B).

    // idx=0  power: 0=off, 1=on  →  body[8]
    this.power = body.length > 8 && body[8] === 0x01;
    // idx=3  temperature_current: byte = (temp × 2) + 80  →  body[11]
    this.target_temperature = body.length > 11 ? body[11] / 2 - 40 : 26;
    // idx=4  temperature_room (2B big-endian, 0.1°C, 0xFFFF=unavailable)  →  body[12:14]
    if (body.length > 13) {
      const raw = (body[12] << 8) | body[13];
      this.indoor_temperature = raw !== 0xffff ? raw / 10 : undefined;
    } else {
      this.indoor_temperature = undefined;
    }
    // idx=5  temperature_outside: byte = (temp × 2) + 80, 0xFF=unavailable  →  body[14]
    this.outdoor_temperature = body.length > 14 && body[14] !== 0xff ? body[14] / 2 - 40 : undefined;
    // idx=12 temp_unit: 0=C, 1=F  →  body[21]
    this.temp_fahrenheit = body.length > 21 && body[21] === 0x01;
    // idx=13 temp_accurate: 0=1°, 1=0.5°  →  body[22]
    this.temperature_precision = body.length > 22 && body[22] === 0x01 ? 0.5 : 1;
    // idx=18 mode_current (past 5B idx=17)  →  body[31]
    this.mode = (body.length > 31 ? FE_BYTE_TO_MODE[body[31]] : undefined) ?? Mode.Auto;
    // idx=21 wind_speed_level  →  body[34]
    this.fan_speed = (body.length > 34 ? FE_BYTE_TO_FAN[body[34]] : undefined) ?? FanSpeed.Auto;
    // idx=27 swing_louver_vertical_enable + idx=28 level  →  body[40], body[41]
    const vertEnable = body.length > 40 && body[40] === 0x01;
    this.vertical_swing_angle = vertEnable && body.length > 41 ? (body[41] as SwingAngle) : SwingAngle.Close;
    // idx=29 swing_louver_horizontal_enable + idx=30 level  →  body[42], body[43]
    const horzEnable = body.length > 42 && body[42] === 0x01;
    this.horizontal_swing_angle = horzEnable && body.length > 43 ? (body[43] as SwingAngle) : SwingAngle.Close;
    // idx=40 eco_status: 0=off, 1=on  →  body[56]
    this.eco_mode = body.length > 56 && body[56] === 0x01;
    // idx=42 idu_silent_status: 0=off, 1=on  →  body[58]
    this.silent_mode = body.length > 58 && body[58] === 0x01;
    // idx=44 idu_sleep_status: 0=off, 1=on  →  body[60]
    this.sleep_mode = body.length > 60 && body[60] === 0x01;
    // idx=58 sterilize_status: 0=auto, 1=on, 2=off  →  body[75]
    this.purifier_mode = body.length > 75 ? (body[75] as PurifierMode) : PurifierMode.Off;
    // idx=64 idu_light: 0=off, 1=on  →  body[81]
    this.night_light = body.length > 81 && body[81] === 0x01;
    // idx=65 ptc_enable: 0=disabled, 1=enabled  →  body[82]
    this.aux_heat_running = body.length > 82 && body[82] === 0x01;
    // idx=67 ptc_status: 0=auto, 1=on, 2=off (past 4B idx=66)  →  body[87]
    const ptcByte = body.length > 87 ? body[87] : 0;
    this.aux_heat_mode = ptcByte === 0x01 ? HeatStatus.On : ptcByte === 0x02 ? HeatStatus.Off : HeatStatus.Auto;
    // Error code not present in FE format
    this.error_code = 0;
  }
}

export class MessageCCResponse extends MessageResponse {
  constructor(message: Buffer) {
    super(message);

    if (
      (this.message_type === MessageType.QUERY && this.body_type === 0x01) ||
      ([MessageType.NOTIFY1, MessageType.NOTIFY2].includes(this.message_type) && (this.body_type === 0x01 || this.body_type === 0xc3)) ||
      (this.message_type === MessageType.SET && this.body_type === 0xc3)
    ) {
      // CCGeneralMessageBody detects the FE-format marker (body[1]=0xFE) internally.
      this.set_body(new CCGeneralMessageBody(this.body));
    }
    // FE control (MessageFEControl) responses are not parsed; state arrives via the
    // next NOTIFY from the device.
  }
}

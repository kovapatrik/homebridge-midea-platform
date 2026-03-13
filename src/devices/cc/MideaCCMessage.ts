/***********************************************************************
 * Midea MDV Wi-Fi Controller Device message handler class
 *
 * Copyright (c) 2025 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *                https://github.com/mill1000/midea-msmart
 *
 */

import { DeviceType } from '../../core/MideaConstants.js';
import { MessageBody, MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage.js';
import { calculate } from '../../core/MideaUtils.js';

export enum HeatStatus {
  Auto = 0x00,
  On = 0x10,
  Off = 0x20,
}

export enum Mode {
  Fan = 0x01,
  Dry = 0x02,
  Heat = 0x04,
  Cool = 0x08,
  Auto = 0x10,
}

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

abstract class MessageCCBase extends MessageRequest {
  constructor(device_protocol_version: number, message_type: MessageType, body_type: number) {
    super(DeviceType.MDV_WIFI_CONTROLLER, message_type, body_type, device_protocol_version);
  }

  get body() {
    const random = Math.floor(Math.random() * 101); // 0-100 like Lua's math.random(0, 100)
    // biome-ignore lint/style/noNonNullAssertion: body_type is always set for CC messages
    const data = Buffer.concat([Buffer.from([this.body_type!]), this._body, Buffer.from([random])]);
    return Buffer.concat([data, Buffer.from([calculate(data)])]);
  }
}

export class MessageQuery extends MessageCCBase {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.QUERY, 0x01);
  }

  get _body() {
    return Buffer.alloc(21);
  }
}

export class MessageSet extends MessageCCBase {
  // biome-ignore lint/suspicious/noExplicitAny: had to use any
  [key: string]: any;
  power: boolean;
  mode: Mode;
  fan_speed: FanSpeed;
  target_temperature: number;
  eco: boolean;
  sleep: boolean;
  display: boolean;
  exhaust: boolean;
  ptc_setting: HeatStatus;
  swing_ud: boolean;
  swing_lr: boolean;
  swing_lr_site: number;
  swing_ud_site: number;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0xc3);
    this.power = false;
    this.mode = Mode.Auto;
    this.fan_speed = FanSpeed.Auto;
    this.target_temperature = 26;
    this.eco = false;
    this.sleep = false;
    this.display = false;
    this.exhaust = false;
    this.ptc_setting = HeatStatus.Auto;
    this.swing_ud = false;
    this.swing_lr = false;
    this.swing_lr_site = 0;
    this.swing_ud_site = 0;
  }

  get _body() {
    // Byte0: Power | Mode
    const power = this.power ? 0x80 : 0;
    const mode = this.mode;
    // Byte1: fan_speed
    const fan_speed = this.fan_speed;
    // Byte2: Integer part of target_temperature
    const temperature_integer = this.target_temperature & 0xff;
    // Byte5: eco | exhaust | swing_ud | ptc_setting
    const eco = this.eco ? 0x01 : 0;
    const ptc_setting = this.ptc_setting & 0x30; // 0x00=Auto, 0x10=On, 0x20=Off
    const swing_ud = this.swing_ud ? 0x04 : 0;
    const exhaust = this.exhaust ? 0x08 : 0;
    // Byte7: sleep | display | swing_lr
    const sleep = this.sleep ? 0x10 : 0;
    const display = this.display ? 0x08 : 0;
    const swing_lr = this.swing_lr ? 0x01 : 0;
    // Byte10: Decimal part of target_temperature (multiplied by 10)
    const temperature_dot = ((this.target_temperature - temperature_integer) * 10) & 0xff;

    // biome-ignore format: easier to read
    return Buffer.from([
      power | mode,
      fan_speed,
      temperature_integer,
      // timer (not supported)
      0x00,
      0x00,
      eco | exhaust | swing_ud | ptc_setting,
      // non-stepless fan speed
      0xFF,
      sleep | display | swing_lr,
      this.swing_lr_site,
      this.swing_ud_site,
      temperature_dot,
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
    ])
  }
}

export class CCGeneralMessageBody extends MessageBody {
  power: boolean;
  mode: Mode;
  fan_speed: FanSpeed;
  target_temperature: number;
  indoor_temperature: number;
  evaporator_entrance_temperature: number;
  evaporator_exit_temperature: number;
  eco: boolean;
  sleep: boolean;
  display: boolean;
  exhaust: boolean;
  ptc_setting: HeatStatus;
  ptc_power: boolean;
  control_fan_speed: number;
  temperature_precision: 1 | 0.5;
  swing_ud: boolean;
  swing_lr: boolean;
  swing_ud_site: number;
  swing_lr_site: number;
  error_code: number;
  temp_fahrenheit: boolean;

  constructor(body: Buffer) {
    super(body);
    // Byte 1: power & mode
    this.power = (body[1] & 0x80) > 0;
    this.mode = (body[1] & 0x1f) as Mode;
    // Byte 2: fan_speed
    this.fan_speed = body[2] as FanSpeed;
    // Byte 3 + Byte 19: target_temperature (integer + decimal)
    this.target_temperature = body[3] + body[19] / 10;
    // Byte 4: indoor_temperature
    this.indoor_temperature = (body[4] - 40) / 2;
    // Byte 5: evaporator_entrance_temperature
    this.evaporator_entrance_temperature = (body[5] - 40) / 2;
    // Byte 6: evaporator_exit_temperature
    this.evaporator_exit_temperature = (body[6] - 40) / 2;
    // Byte 9: swing_ud_site
    this.swing_ud_site = body[9];
    // Byte 13: eco, swing_ud, exhaust, ptc_power, control_fan_speed
    this.eco = (body[13] & 0x01) > 0;
    this.swing_ud = (body[13] & 0x04) > 0;
    this.exhaust = (body[13] & 0x08) > 0;
    this.ptc_power = (body[13] & 0x02) > 0;
    this.control_fan_speed = 0xFF; // Always 0xFF, not present in response (per Lua line 308)
    // Byte 14: ptc_setting, sleep, display, swing_lr, temperature_precision
    const ptc_setting_bits = (body[14] & 0x60) >> 5;
    // Response uses different values: 0=Auto, 1=On, 2=Off (shifted from bits 5-6)
    this.ptc_setting = ptc_setting_bits === 0 ? HeatStatus.Auto : ptc_setting_bits === 1 ? HeatStatus.On : HeatStatus.Off;
    this.sleep = (body[14] & 0x10) > 0;
    this.display = (body[14] & 0x08) > 0;
    this.swing_lr = (body[14] & 0x01) > 0;
    this.temperature_precision = (body[14] & 0x80) > 0 ? 1 : 0.5;
    // Byte 15 & 18: error_code
    const error_low = body[15];
    const error_high = body[18] & 0x7f;
    this.error_code = error_high * 255 + error_low;
    // Byte 17: swing_lr_site
    this.swing_lr_site = body[17];
    // Byte 20: temp_fahrenheit (not in Lua, but doesn't conflict)
    this.temp_fahrenheit = body.length > 20 ? (body[20] & 0x80) > 0 : false;
  }
}

// ---------------------------------------------------------------------------
// TLV protocol (T_0000_CC_10011006_2025033001.lua)
// ---------------------------------------------------------------------------

// Size in bytes of multi-byte TLV fields. All others default to 1.
// biome-ignore format: easier to read as a flat list
const TLV_SIZES = new Map<number, number>([
  [ 4, 2], // temperature_room      (temp_10s, uint16 BE)
  [17, 5], // mode_supported        (multi-value)
  [34, 3], // cur_fault_code        (chars, size 3)
  [38, 2], // co2_value             (uint16)
  [47, 2], // selfclean_time_left   (uint16)
  [66, 4], // ptc_supported         (multi-value)
  [75, 4], // language_supported    (multi-value)
  [80, 6], // cur_fault_code        (chars, size 6)
  [82, 3], // about_version
  [83, 3], // about_lua_version
  [86, 4], // date_seconds          (uint32)
  [88, 2], // timer_on_timeout      (uint16)
  [90, 2], // timer_off_timeout     (uint16)
  [95, 2], [132, 2], [169, 2], [206, 2], // schedule weekday (uint16)
  [228, 2], [231, 2], [235, 2], [238, 2], // holiday year (uint16)
  [242, 2], [245, 2], [249, 2], [252, 2],
]);

/**
 * Parse TLV body into a map of idx → raw bytes.
 *
 * Format A (compact range):
 *   [0xFF][0xFE][idx_start_hi][idx_start_lo][idx_end_hi][idx_end_lo][len_hi][len_lo][data…]
 *
 * Format B (sparse) / control response:
 *   [idx_hi][idx_lo][size][data…][0xFF]  …repeated…  [0xFF][0xFF]…
 */
function parseTLVBody(body: Buffer, isControlResponse: boolean): Map<number, Buffer> {
  const result = new Map<number, Buffer>();
  if (body.length < 2) return result;

  if (!isControlResponse && body[0] === 0xff && body[1] === 0xfe) {
    // Format A: compact range starting at body[2]
    const idxStart = (body[2] << 8) | body[3];
    const idxEnd   = (body[4] << 8) | body[5];
    let pos = 8;
    for (let idx = idxStart; idx <= idxEnd && pos < body.length; idx++) {
      const size = TLV_SIZES.get(idx) ?? 1;
      if (pos + size > body.length) break;
      result.set(idx, body.subarray(pos, pos + size));
      pos += size;
    }
  } else {
    // Format B / control response: each section [idx_hi][idx_lo][size][data…][0xFF]
    let offset = 0;
    while (offset + 3 < body.length) {
      if (body[offset] === 0xff) break; // end marker
      const idx  = (body[offset] << 8) | body[offset + 1];
      const size = body[offset + 2];
      if (offset + 3 + size >= body.length) break;
      result.set(idx, body.subarray(offset + 3, offset + 3 + size));
      offset += 3 + size + 1; // +1 for the 0xFF section delimiter
    }
  }
  return result;
}

/** Build a single TLV section: [idx_hi][idx_lo][size][data…][0xFF] */
function tlvSection(idx: number, bytes: number[]): Buffer {
  return Buffer.from([idx >> 8, idx & 0xff, bytes.length, ...bytes, 0xff]);
}

// TLV byte value → Mode enum (byte = value_map_key - 1)
// mode_current value_map: { [2]="fan", [3]="cool", [4]="heat", [6]="auto", [7]="dry" }
// biome-ignore-start lint/complexity/useSimpleNumberKeys: make more sense with hex
const TLV_BYTE_TO_MODE: Record<number, Mode> = {
  0x01: Mode.Fan,
  0x02: Mode.Cool,
  0x03: Mode.Heat,
  0x05: Mode.Auto,
  0x06: Mode.Dry,
};
// biome-ignore-end lint/complexity/useSimpleNumberKeys: make more sense with hex
const TLV_MODE_TO_BYTE: Partial<Record<Mode, number>> = {
  [Mode.Fan]:  0x01,
  [Mode.Cool]: 0x02,
  [Mode.Heat]: 0x03,
  [Mode.Auto]: 0x05,
  [Mode.Dry]:  0x06,
};

// TLV byte value → FanSpeed enum
// wind_speed_level value_map: { [2]='1', [3]='2', … [8]='7', [9]='auto' }
// byte = value_map_key - 1, so level-1 = byte 0x01, auto = byte 0x08
// biome-ignore-start lint/complexity/useSimpleNumberKeys: make more sense with hex
const TLV_BYTE_TO_FAN_SPEED: Record<number, FanSpeed> = {
  0x01: FanSpeed.Micron,
  0x02: FanSpeed.Low,
  0x03: FanSpeed.Mid,
  0x04: FanSpeed.Mid,
  0x05: FanSpeed.High,
  0x06: FanSpeed.SuperHigh,
  0x07: FanSpeed.Power,
  0x08: FanSpeed.Auto,
};
// biome-ignore-end lint/complexity/useSimpleNumberKeys: make more sense with hex
const TLV_FAN_SPEED_TO_BYTE: Partial<Record<FanSpeed, number>> = {
  [FanSpeed.Sleep]:     0x01,
  [FanSpeed.Micron]:    0x01,
  [FanSpeed.Low]:       0x02,
  [FanSpeed.Mid]:       0x03,
  [FanSpeed.High]:      0x05,
  [FanSpeed.SuperHigh]: 0x06,
  [FanSpeed.Power]:     0x07,
  [FanSpeed.Auto]:      0x08,
};

export class CCTLVMessageBody extends MessageBody {
  power: boolean;
  mode: Mode;
  fan_speed: FanSpeed;
  target_temperature: number;
  indoor_temperature?: number;
  outdoor_temperature?: number;
  eco: boolean;
  sleep: boolean;
  display: boolean;
  ptc_setting: HeatStatus;
  ptc_power: boolean;
  temperature_precision: 1 | 0.5;
  swing_ud: boolean;
  swing_lr: boolean;
  swing_ud_site: number;
  swing_lr_site: number;
  error_code: number;
  temp_fahrenheit: boolean;

  constructor(body: Buffer, isControlResponse: boolean) {
    super(body);
    const f = parseTLVBody(body, isControlResponse);

    // idx=0  power: value_map {[1]="off",[2]="on"} → byte 0=off, 1=on
    this.power = (f.get(0)?.[0] ?? 0) === 0x01;

    // idx=18 mode_current
    this.mode = TLV_BYTE_TO_MODE[f.get(18)?.[0] ?? 0xff] ?? Mode.Auto;

    // idx=3  temperature_current: temp type → (byte - 80) / 2
    const tempRaw = f.get(3)?.[0];
    this.target_temperature = tempRaw !== undefined ? (tempRaw - 80) / 2 : 26;

    // idx=4  temperature_room: temp_10s → uint16 BE / 10, 0xFFFF = unavailable
    const roomBuf = f.get(4);
    if (roomBuf && roomBuf.length >= 2) {
      const raw = (roomBuf[0] << 8) | roomBuf[1];
      this.indoor_temperature = raw !== 0xffff ? raw / 10 : undefined;
    } else {
      this.indoor_temperature = undefined;
    }

    // idx=5  temperature_outside: temp type → (byte - 80) / 2, 0xFF = unavailable
    const outsideRaw = f.get(5)?.[0];
    this.outdoor_temperature = outsideRaw !== undefined && outsideRaw !== 0xff ? (outsideRaw - 80) / 2 : undefined;

    // idx=21 wind_speed_level
    this.fan_speed = TLV_BYTE_TO_FAN_SPEED[f.get(21)?.[0] ?? 0xff] ?? FanSpeed.Auto;

    // idx=40 eco_status: {[1]="off",[2]="on"} → byte 0=off, 1=on
    this.eco = (f.get(40)?.[0] ?? 0) === 0x01;

    // idx=44 idu_sleep_status: {[1]="off",[2]="on"}
    this.sleep = (f.get(44)?.[0] ?? 0) === 0x01;

    // idx=64 idu_light: {[1]="off",[2]="on"}
    this.display = (f.get(64)?.[0] ?? 0) === 0x01;

    // idx=65 ptc_enable: {[1]="false",[2]="true"} → byte 0=disabled, 1=enabled
    this.ptc_power = (f.get(65)?.[0] ?? 0) === 0x01;

    // idx=67 ptc_status: {[1]="auto",[2]="on",[3]="off",[4]="separate"}
    // byte: 0=auto, 1=on, 2=off, 3=separate
    const ptcByte = f.get(67)?.[0] ?? 0;
    this.ptc_setting = ptcByte === 0x01 ? HeatStatus.On : ptcByte === 0x02 ? HeatStatus.Off : HeatStatus.Auto;

    // idx=13 temp_accurate: {[1]="1",[2]="0.5"} → byte 0=1°, 1=0.5°
    this.temperature_precision = (f.get(13)?.[0] ?? 0) === 0x01 ? 0.5 : 1;

    // idx=12 temp_unit: {[1]="C",[2]="F"} → byte 0=C, 1=F
    this.temp_fahrenheit = (f.get(12)?.[0] ?? 0) === 0x01;

    // idx=27 swing_louver_vertical_enable: {[1]="false",[2]="true"}
    this.swing_ud = (f.get(27)?.[0] ?? 0) === 0x01;
    // idx=28 swing_louver_vertical_level
    this.swing_ud_site = f.get(28)?.[0] ?? 0;

    // idx=29 swing_louver_horizontal_enable: {[1]="false",[2]="true"}
    this.swing_lr = (f.get(29)?.[0] ?? 0) === 0x01;
    // idx=30 swing_louver_horizontal_level
    this.swing_lr_site = f.get(30)?.[0] ?? 0;

    // idx=33 cur_fault_enable: {[1]="false",[2]="true"}, idx=34 cur_fault_code (3 ASCII chars)
    const faultEnabled = (f.get(33)?.[0] ?? 1) === 2;
    if (faultEnabled) {
      const faultBuf = f.get(34);
      const faultStr = faultBuf ? Buffer.from(faultBuf).toString('ascii').replace(/\0/g, '') : '';
      const faultNum = Number.parseInt(faultStr.replace(/\D/g, ''), 10);
      this.error_code = Number.isNaN(faultNum) ? 0 : faultNum;
    } else {
      this.error_code = 0;
    }
  }
}

export class MessageQueryTLV extends MessageRequest {
  constructor(device_protocol_version: number) {
    super(DeviceType.MDV_WIFI_CONTROLLER, MessageType.QUERY, null, device_protocol_version);
  }

  get _body(): Buffer {
    // Query-all command: six 0xFF bytes (assembleUart body)
    return Buffer.from([0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
  }
}

export class MessageSetTLV extends MessageRequest {
  // biome-ignore lint/suspicious/noExplicitAny: had to use any
  [key: string]: any;
  power: boolean;
  mode: Mode;
  fan_speed: FanSpeed;
  target_temperature: number;
  eco: boolean;
  sleep: boolean;
  display: boolean;
  ptc_setting: HeatStatus;
  swing_ud: boolean;
  swing_lr: boolean;
  swing_ud_site: number;
  swing_lr_site: number;

  constructor(device_protocol_version: number) {
    super(DeviceType.MDV_WIFI_CONTROLLER, MessageType.SET, null, device_protocol_version);
    this.power = false;
    this.mode = Mode.Auto;
    this.fan_speed = FanSpeed.Auto;
    this.target_temperature = 26;
    this.eco = false;
    this.sleep = false;
    this.display = false;
    this.ptc_setting = HeatStatus.Auto;
    this.swing_ud = false;
    this.swing_lr = false;
    this.swing_ud_site = 0;
    this.swing_lr_site = 0;
  }

  get _body(): Buffer {
    // idx=0  power
    const powerSection = tlvSection(0, [this.power ? 0x01 : 0x00]);
    // idx=3  temperature_current: encode_temp = (t * 2) + 80
    const tempSection = tlvSection(3, [Math.round(this.target_temperature * 2) + 80]);
    // idx=18 mode_current
    const modeSection = tlvSection(18, [TLV_MODE_TO_BYTE[this.mode] ?? 0x05]);
    // idx=21 wind_speed_level
    const fanSection = tlvSection(21, [TLV_FAN_SPEED_TO_BYTE[this.fan_speed] ?? 0x08]);
    // idx=27 swing_louver_vertical_enable
    const swingUDSection = tlvSection(27, [this.swing_ud ? 0x01 : 0x00]);
    // idx=28 swing_louver_vertical_level
    const swingUDSiteSection = tlvSection(28, [this.swing_ud_site]);
    // idx=29 swing_louver_horizontal_enable
    const swingLRSection = tlvSection(29, [this.swing_lr ? 0x01 : 0x00]);
    // idx=30 swing_louver_horizontal_level
    const swingLRSiteSection = tlvSection(30, [this.swing_lr_site]);
    // idx=40 eco_status
    const ecoSection = tlvSection(40, [this.eco ? 0x01 : 0x00]);
    // idx=44 idu_sleep_status
    const sleepSection = tlvSection(44, [this.sleep ? 0x01 : 0x00]);
    // idx=64 idu_light
    const displaySection = tlvSection(64, [this.display ? 0x01 : 0x00]);
    // idx=67 ptc_status: auto=0x00, on=0x01, off=0x02
    const ptcByte = this.ptc_setting === HeatStatus.On ? 0x01 : this.ptc_setting === HeatStatus.Off ? 0x02 : 0x00;
    const ptcSection = tlvSection(67, [ptcByte]);

    return Buffer.concat([
      powerSection, tempSection, modeSection, fanSection,
      swingUDSection, swingUDSiteSection, swingLRSection, swingLRSiteSection,
      ecoSection, sleepSection, displaySection, ptcSection,
    ]);
  }
}

export class MessageCCResponse extends MessageResponse {
  constructor(message: Buffer) {
    super(message);

    // if (
    //   (this.message_type === MessageType.QUERY && this.body_type === 0x01) ||
    //   ([MessageType.NOTIFY1, MessageType.NOTIFY2].includes(this.message_type) && (this.body_type === 0x01 || this.body_type === 0xc3)) ||
    //   (this.message_type === MessageType.SET && this.body_type === 0xc3)
    // ) {
    //   this.set_body(new CCGeneralMessageBody(this.body));
    // } else

    if (
      // TLV protocol
      (this.message_type === MessageType.QUERY || [MessageType.NOTIFY1, MessageType.NOTIFY2].includes(this.message_type)) && this.body_type === 0xff ||
      (this.message_type === MessageType.SET && this.body_type !== 0xc3)
    ) {
      this.set_body(new CCTLVMessageBody(this.body, this.message_type === MessageType.SET));
    }
  }
}

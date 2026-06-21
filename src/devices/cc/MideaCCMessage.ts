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
import { boolField, compositeField, type FEField, parseFEBranch, readOnlyField, simpleField, tlvSection } from './MideaCCTLV.js';

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

// Per-unit status returned in mcs_idxN_* fields of the FE branch response.
export interface IndoorUnitStatus {
  addr: number;
  power: boolean;
  mode: Mode;
  fan_speed: FanSpeed;
  target_temperature: number;
  room_temperature?: number;
  vertical_swing_angle: SwingAngle;
  horizontal_swing_angle: SwingAngle;
}

// ---------------------------------------------------------------------------
// FE branch (compact-range) byte ↔ enum maps
// ---------------------------------------------------------------------------

// mode_current value_map: {[2]="fan",[3]="cool",[4]="heat",[6]="auto",[7]="dry"} (byte = key − 1)
const FE_BYTE_TO_MODE: Record<number, Mode> = {
  1: Mode.Fan,
  2: Mode.Cool,
  3: Mode.Heat,
  5: Mode.Auto,
  6: Mode.Dry,
};
const FE_MODE_TO_BYTE: Partial<Record<Mode, number>> = {
  [Mode.Fan]: 0x01,
  [Mode.Cool]: 0x02,
  [Mode.Heat]: 0x03,
  [Mode.Auto]: 0x05,
  [Mode.Dry]: 0x06,
};

// wind_speed_level value_map: {[2]='1',…,[8]='7',[9]='auto'} (byte = key − 1)
const FE_BYTE_TO_FAN: Record<number, FanSpeed> = {
  1: FanSpeed.Micron,
  2: FanSpeed.Low,
  3: FanSpeed.Mid,
  4: FanSpeed.Mid,
  5: FanSpeed.High,
  6: FanSpeed.SuperHigh,
  7: FanSpeed.Power,
  8: FanSpeed.Auto,
};
const FE_FAN_TO_BYTE: Partial<Record<FanSpeed, number>> = {
  [FanSpeed.Sleep]: 0x01,
  [FanSpeed.Micron]: 0x01,
  [FanSpeed.Low]: 0x02,
  [FanSpeed.Mid]: 0x03,
  [FanSpeed.High]: 0x05,
  [FanSpeed.SuperHigh]: 0x06,
  [FanSpeed.Power]: 0x07,
  [FanSpeed.Auto]: 0x08,
};

// ---------------------------------------------------------------------------
// Bidirectional field registry — shared by parser and encoder
// ---------------------------------------------------------------------------

// biome-ignore format: easier to read as a flat list
const FIELDS = {
  // idx=0x0000  power
  power:                boolField(0x0000),
  // idx=0x0003  temperature_current: byte = (temp × 2) + 80
  target_temperature:   simpleField(
    0x0003,
    buf => buf?.[0] !== undefined ? buf[0] / 2 - 40 : undefined,
    v   => [Math.round(v * 2) + 80],
  ),
  // idx=0x0004  temperature_room (2B BE, 0.1°C, 0xFFFF=unavailable) — response only
  indoor_temperature:   readOnlyField(0x0004, buf => {
    if (!buf || buf.length < 2) return undefined;
    const raw = (buf[0] << 8) | buf[1];
    return raw !== 0xffff ? raw / 10 : undefined;
  }),
  // idx=0x0005  temperature_outside: byte = (temp × 2) + 80, 0xFF=unavailable — response only
  outdoor_temperature:  readOnlyField(0x0005, buf => buf?.[0] !== undefined && buf[0] !== 0xff ? buf[0] / 2 - 40 : undefined),
  // idx=0x000C  temp_unit: 0=C, 1=F
  temp_fahrenheit:      boolField(0x000C),
  // idx=0x000D  temp_accurate: 0=1°, 1=0.5°
  temperature_precision: simpleField<1 | 0.5>(
    0x000D,
    buf => buf?.[0] !== undefined ? (buf[0] === 0x01 ? 0.5 : 1) : undefined,
    v   => [v === 0.5 ? 1 : 0],
  ),
  // idx=0x0012  mode_current
  mode:                 simpleField(
    0x0012,
    buf => FE_BYTE_TO_MODE[buf?.[0] ?? 0xff],
    v   => [FE_MODE_TO_BYTE[v] ?? 0x05],
  ),
  // idx=0x0015  wind_speed_level
  fan_speed:            simpleField(
    0x0015,
    buf => FE_BYTE_TO_FAN[buf?.[0] ?? 0xff],
    v   => [FE_FAN_TO_BYTE[v] ?? 0x08],
  ),
  // idx=0x001B enable + idx=0x001C level; write targets level only
  vertical_swing_angle:   compositeField(
    [0x001B, 0x001C], 0x001C,
    ([enable, level]) => enable?.[0] === 0x01 ? (level?.[0] ?? 0) as SwingAngle : SwingAngle.Close,
    v => [v],
  ),
  // idx=0x001D enable + idx=0x001E level; write targets level only
  horizontal_swing_angle: compositeField(
    [0x001D, 0x001E], 0x001E,
    ([enable, level]) => enable?.[0] === 0x01 ? (level?.[0] ?? 0) as SwingAngle : SwingAngle.Close,
    v => [v],
  ),
  // idx=0x0028  eco_status
  eco_mode:             boolField(0x0028),
  // idx=0x002A  idu_silent_status
  silent_mode:          boolField(0x002A),
  // idx=0x002C  idu_sleep_status
  sleep_mode:           boolField(0x002C),
  // idx=0x003A  sterilize_status: 0=auto, 1=on, 2=off
  purifier_mode:        simpleField(
    0x003A,
    buf => buf?.[0] !== undefined ? buf[0] as PurifierMode : undefined,
    v   => [v],
  ),
  // idx=0x0040  idu_light
  night_light:          boolField(0x0040),
  // idx=0x0041  ptc_enable
  aux_heat_running:     boolField(0x0041),
  // idx=0x0043  ptc_status: 0=auto, 1=on, 2=off
  aux_heat_mode:        simpleField(
    0x0043,
    buf => {
      if (buf?.[0] === undefined) return undefined;
      return buf[0] === 0x01 ? HeatStatus.On : buf[0] === 0x02 ? HeatStatus.Off : HeatStatus.Auto;
    },
    v => [v === HeatStatus.On ? 1 : v === HeatStatus.Off ? 2 : 0],
  ),
};

// Derived from the union: all non-CTRL ControlField kinds.
// Adding a new main-controller ControlField variant that's missing here is a compile error.
type MainFieldKind = Exclude<ControlField['kind'], `CTRL_${string}`>;

// biome-ignore format: easier to read as a flat list
const KIND_TO_FIELD = {
  POWER:                  FIELDS.power,
  TARGET_TEMPERATURE:     FIELDS.target_temperature,
  MODE:                   FIELDS.mode,
  FAN_SPEED:              FIELDS.fan_speed,
  VERTICAL_SWING_ANGLE:   FIELDS.vertical_swing_angle,
  HORIZONTAL_SWING_ANGLE: FIELDS.horizontal_swing_angle,
  ECO_MODE:               FIELDS.eco_mode,
  SILENT_MODE:            FIELDS.silent_mode,
  SLEEP_MODE:             FIELDS.sleep_mode,
  PURIFIER_MODE:          FIELDS.purifier_mode,
  NIGHT_LIGHT:            FIELDS.night_light,
  AUX_HEAT_RUNNING:       FIELDS.aux_heat_running,
  AUX_HEAT_MODE:          FIELDS.aux_heat_mode,
  TEMP_FAHRENHEIT:        FIELDS.temp_fahrenheit,
  TEMPERATURE_PRECISION:  FIELDS.temperature_precision,
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous field types unified at boundary
} satisfies Record<MainFieldKind, FEField<any>>;

// ---------------------------------------------------------------------------
// ControlField — discriminated union for FE VRF panel control
// ---------------------------------------------------------------------------

/**
 * Each variant carries a correctly-typed value. buildTLVSection() handles the
 * wire encoding centrally, so call sites never deal with raw byte math.
 *
 * Per-unit (CTRL_*) variants embed the target unit address — both in the
 * wire value bytes (need_addr fields) and in the variant itself so the caller
 * doesn't need to track it separately. Always precede CTRL_* fields with a
 * CTRL_ADDR field for the same addr.
 */
// biome-ignore format: easier to read as a flat list
export type ControlField =
  // Main controller fields
  | { kind: 'POWER';              value: boolean }
  | { kind: 'TARGET_TEMPERATURE'; value: number }
  | { kind: 'MODE';               value: Mode }
  | { kind: 'FAN_SPEED';          value: FanSpeed }
  | { kind: 'VERTICAL_SWING_ANGLE';   value: SwingAngle }
  | { kind: 'HORIZONTAL_SWING_ANGLE'; value: SwingAngle }
  | { kind: 'ECO_MODE';           value: boolean }
  | { kind: 'SILENT_MODE';        value: boolean }
  | { kind: 'SLEEP_MODE';         value: boolean }
  | { kind: 'PURIFIER_MODE';      value: PurifierMode }
  | { kind: 'NIGHT_LIGHT';        value: boolean }
  | { kind: 'AUX_HEAT_RUNNING';      value: boolean }
  | { kind: 'AUX_HEAT_MODE';         value: HeatStatus }
  | { kind: 'TEMP_FAHRENHEIT';        value: boolean }
  | { kind: 'TEMPERATURE_PRECISION';  value: 1 | 0.5 }
  // Per-unit controls (write-only, need_addr — addr embedded in wire value)
  | { kind: 'CTRL_ADDR';              addr: number }
  | { kind: 'CTRL_POWER';             addr: number; value: boolean }
  | { kind: 'CTRL_MODE';              addr: number; value: Mode }
  | { kind: 'CTRL_WIND_SPEED';        addr: number; value: FanSpeed }
  | { kind: 'CTRL_TEMP';              addr: number; value: number }
  | { kind: 'CTRL_LOUVER_VERTICAL';   addr: number; value: SwingAngle }
  | { kind: 'CTRL_LOUVER_HORIZONTAL'; addr: number; value: SwingAngle }

/**
 * Encode a ControlField into a single TLV section buffer.
 * Field IDs are the key_maps indices from T_0000_CC_10011006_2025033001.lua.
 */
// biome-ignore format: easier to read as a flat list
export function buildTLVSection(field: ControlField): Buffer {
  switch (field.kind) {
    // Main controller — each case delegates to KIND_TO_FIELD for type-safe dispatch.
    // KIND_TO_FIELD satisfies Record<MainFieldKind, FEField<any>>, so adding a new
    // ControlField variant without updating that registry is a compile error.
    case 'POWER':              return KIND_TO_FIELD.POWER.write(field.value);
    case 'TARGET_TEMPERATURE': return KIND_TO_FIELD.TARGET_TEMPERATURE.write(field.value);
    case 'MODE':               return KIND_TO_FIELD.MODE.write(field.value);
    case 'FAN_SPEED':          return KIND_TO_FIELD.FAN_SPEED.write(field.value);
    case 'VERTICAL_SWING_ANGLE':   return KIND_TO_FIELD.VERTICAL_SWING_ANGLE.write(field.value);
    case 'HORIZONTAL_SWING_ANGLE': return KIND_TO_FIELD.HORIZONTAL_SWING_ANGLE.write(field.value);
    case 'ECO_MODE':           return KIND_TO_FIELD.ECO_MODE.write(field.value);
    case 'SILENT_MODE':        return KIND_TO_FIELD.SILENT_MODE.write(field.value);
    case 'SLEEP_MODE':         return KIND_TO_FIELD.SLEEP_MODE.write(field.value);
    case 'PURIFIER_MODE':      return KIND_TO_FIELD.PURIFIER_MODE.write(field.value);
    case 'NIGHT_LIGHT':        return KIND_TO_FIELD.NIGHT_LIGHT.write(field.value);
    case 'AUX_HEAT_RUNNING':      return KIND_TO_FIELD.AUX_HEAT_RUNNING.write(field.value);
    case 'AUX_HEAT_MODE':         return KIND_TO_FIELD.AUX_HEAT_MODE.write(field.value);
    case 'TEMP_FAHRENHEIT':       return KIND_TO_FIELD.TEMP_FAHRENHEIT.write(field.value);
    case 'TEMPERATURE_PRECISION': return KIND_TO_FIELD.TEMPERATURE_PRECISION.write(field.value);
    // Per-unit (need_addr) — addr embedded in value bytes, no symmetric read side
    case 'CTRL_ADDR':              return tlvSection(0x02A8, [field.addr]);
    case 'CTRL_POWER':             return tlvSection(0x02A9, [field.value ? 1 : 0,                    field.addr]);
    case 'CTRL_MODE':              return tlvSection(0x02AA, [FE_MODE_TO_BYTE[field.value] ?? 0x05,   field.addr]);
    case 'CTRL_WIND_SPEED':        return tlvSection(0x02AB, [FE_FAN_TO_BYTE[field.value] ?? 0x08,   field.addr]);
    case 'CTRL_TEMP':              return tlvSection(0x02AC, [Math.round(field.value * 2) + 80,       field.addr]);
    case 'CTRL_LOUVER_HORIZONTAL': return tlvSection(0x02AF, [field.value,                            field.addr]);
    case 'CTRL_LOUVER_VERTICAL':   return tlvSection(0x02B0, [field.value,                            field.addr]);
  }
}

// ---------------------------------------------------------------------------
// Message classes
// ---------------------------------------------------------------------------

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

    // biome-ignore format: easier to read
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

/**
 * Control message for 0xFE VRF panel controllers (86X Controller).
 *
 * Each ControlField is encoded into a TLV section by buildTLVSection(), then
 * the sections are concatenated with an incrementing message id and CRC8.
 */
export class MessageFEControl extends MessageRequest {
  private static _message_id = 0;
  private readonly _controls: ControlField[];

  constructor(device_protocol_version: number, controls: ControlField[]) {
    super(DeviceType.MDV_WIFI_CONTROLLER, MessageType.SET, null, device_protocol_version);
    this._controls = controls;
  }

  private _next_message_id(): number {
    MessageFEControl._message_id = (MessageFEControl._message_id + 1) & 0xff;
    return MessageFEControl._message_id;
  }

  get _body(): Buffer {
    const sections = Buffer.concat(this._controls.map(buildTLVSection));
    const msgId = this._next_message_id();
    const withMsgId = Buffer.concat([sections, Buffer.from([msgId])]);
    return Buffer.concat([withMsgId, Buffer.from([calculate(withMsgId)])]);
  }
}

/**
 * Response body for both legacy binary and FE-format CC devices.
 *
 * When body[1] === 0xFE the response comes from a 86X Controller (VRF panel)
 * using the compact-range format parsed by parseFEBranch(). The same field-size
 * registry covers both the main controller attributes and the per-unit mcs_idxN
 * blocks, so no hardcoded byte offsets are needed.
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
  // Per-unit status (FE format only; empty for legacy)
  mcs_num!: number;
  mcs_units!: IndoorUnitStatus[];

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
    this.mcs_num = 0;
    this.mcs_units = [];
  }

  private _parse_fe_body(body: Buffer): void {
    const f = parseFEBranch(body);

    this.power = FIELDS.power.read(f) ?? false;
    this.target_temperature = FIELDS.target_temperature.read(f) ?? 26;
    this.indoor_temperature = FIELDS.indoor_temperature.read(f);
    this.outdoor_temperature = FIELDS.outdoor_temperature.read(f);
    this.temp_fahrenheit = FIELDS.temp_fahrenheit.read(f) ?? false;
    this.temperature_precision = FIELDS.temperature_precision.read(f) ?? 1;
    this.mode = FIELDS.mode.read(f) ?? Mode.Auto;
    this.fan_speed = FIELDS.fan_speed.read(f) ?? FanSpeed.Auto;
    this.vertical_swing_angle = FIELDS.vertical_swing_angle.read(f) ?? SwingAngle.Close;
    this.horizontal_swing_angle = FIELDS.horizontal_swing_angle.read(f) ?? SwingAngle.Close;
    this.eco_mode = FIELDS.eco_mode.read(f) ?? false;
    this.silent_mode = FIELDS.silent_mode.read(f) ?? false;
    this.sleep_mode = FIELDS.sleep_mode.read(f) ?? false;
    this.purifier_mode = FIELDS.purifier_mode.read(f) ?? PurifierMode.Off;
    this.night_light = FIELDS.night_light.read(f) ?? false;
    this.aux_heat_running = FIELDS.aux_heat_running.read(f) ?? false;
    this.aux_heat_mode = FIELDS.aux_heat_mode.read(f) ?? HeatStatus.Auto;
    this.error_code = 0;

    // idx=375 mcs_num: number of connected indoor units
    const mcsNum = f.get(375)?.[0] ?? 0;
    this.mcs_num = mcsNum;
    this.mcs_units = [];
    // mcs_idxN blocks: 19 entries each at base = 376 + N*19
    //   base+0: addr, base+1: fault_code(6B), base+2: type,
    //   base+3: temp_room(2B), base+4: power, base+5: mode,
    //   base+6: wind_speed, base+7: temp, base+8: auto_min, base+9: auto_max,
    //   base+10: louver_horizontal_enable, base+11: louver_horizontal_level,
    //   base+12: louver_vertical_enable,   base+13: louver_vertical_level
    for (let n = 0; n < mcsNum && n < 16; n++) {
      const base = 376 + n * 19;
      const addr = f.get(base)?.[0];
      if (addr === undefined) break;

      const unitRoomBuf = f.get(base + 3);
      let room_temperature: number | undefined;
      if (unitRoomBuf && unitRoomBuf.length >= 2) {
        const raw = (unitRoomBuf[0] << 8) | unitRoomBuf[1];
        room_temperature = raw !== 0xffff ? raw / 10 : undefined;
      }

      const power = f.get(base + 4)?.[0] === 0x01;
      const mode = FE_BYTE_TO_MODE[f.get(base + 5)?.[0] ?? 0xff] ?? Mode.Auto;
      const fan_speed = FE_BYTE_TO_FAN[f.get(base + 6)?.[0] ?? 0xff] ?? FanSpeed.Auto;
      const unitTempByte = f.get(base + 7)?.[0];
      const target_temperature = unitTempByte !== undefined ? unitTempByte / 2 - 40 : 26;

      const horzEnable = f.get(base + 10)?.[0] === 0x01;
      const horizontal_swing_angle = horzEnable ? ((f.get(base + 11)?.[0] ?? 0) as SwingAngle) : SwingAngle.Close;

      const vertEnable = f.get(base + 12)?.[0] === 0x01;
      const vertical_swing_angle = vertEnable ? ((f.get(base + 13)?.[0] ?? 0) as SwingAngle) : SwingAngle.Close;

      this.mcs_units.push({ addr, power, mode, fan_speed, target_temperature, room_temperature, vertical_swing_angle, horizontal_swing_angle });
    }
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

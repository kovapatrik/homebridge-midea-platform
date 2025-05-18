/***********************************************************************
 * Midea Heat Pump WiFi Controller Device message handler class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */
import { DeviceType } from '../../core/MideaConstants.js';
import { MessageBody, MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage.js';

export enum SilentLevel {
  OFF = 0x0,
  SILENT = 0x1,
  SUPER_SILENT = 0x3,
}

const TEMPERATURE_NEGATIVE_VALUE = 127;

abstract class MessageC3Base extends MessageRequest {
  constructor(device_protocol_version: number, message_type: MessageType, body_type: number) {
    super(DeviceType.HEAT_PUMP_WIFI_CONTROLLER, message_type, body_type, device_protocol_version);
  }
}

export class MessageQuery extends MessageC3Base {
  constructor(device_protocol_version: number, body_type: number) {
    super(device_protocol_version, MessageType.QUERY, body_type);
  }

  get _body() {
    return Buffer.alloc(0);
  }
}

export class MessageQueryBasic extends MessageQuery {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, 0x01);
  }
}

export class MessageQuerySilence extends MessageQuery {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, 0x05);
  }
}

export class MessageQueryECO extends MessageQuery {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, 0x07);
  }
}

export class MessageQueryInstall extends MessageQuery {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, 0x08);
  }
}

export class MessageQueryDisinfect extends MessageQuery {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, 0x09);
  }
}

export class MessageQueryUnitPara extends MessageQuery {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, 0x10);
  }
}

export class MessageQueryHMIPara extends MessageQuery {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, 0x0a);
  }
}

export class MessageSet extends MessageC3Base {
  // biome-ignore lint/suspicious/noExplicitAny: had to use any
  [key: string]: any;
  zone1_power: boolean;
  zone2_power: boolean;
  dhw_power: boolean;
  mode: number;
  zone_target_temperature: number[];
  dhw_target_temperature: number;
  room_target_temperature: number;
  zone1_curve: boolean;
  zone2_curve: boolean;
  fast_dhw: boolean;
  tbh: boolean;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0x01);
    this.zone1_power = false;
    this.zone2_power = false;
    this.dhw_power = false;
    this.mode = 0;
    this.zone_target_temperature = [25, 25];
    this.dhw_target_temperature = 40;
    this.room_target_temperature = 25;
    this.zone1_curve = false;
    this.zone2_curve = false;
    this.fast_dhw = false;
    this.tbh = false;
  }

  get _body() {
    // Byte 1
    const zone1_power = this.zone1_power ? 0x01 : 0x00;
    const zone2_power = this.zone2_power ? 0x02 : 0x00;
    const dhw_power = this.dhw_power ? 0x04 : 0x00;
    // Byte 7
    const zone1_curve = this.zone1_curve ? 0x01 : 0x00;
    const zone2_curve = this.zone2_curve ? 0x02 : 0x00;
    const tbh = this.tbh ? 0x04 : 0x00;
    const fast_dhw = this.fast_dhw ? 0x08 : 0x00;

    const room_target_temperature = (this.room_target_temperature * 2) | 0;
    const zone1_target_temperature = this.zone_target_temperature[0] | 0;
    const zone2_target_temperature = this.zone_target_temperature[1] | 0;
    const dhw_target_temperature = this.dhw_target_temperature | 0;
    return Buffer.from([
      zone1_power | zone2_power | dhw_power,
      this.mode,
      zone1_target_temperature,
      zone2_target_temperature,
      dhw_target_temperature,
      room_target_temperature,
      zone1_curve | zone2_curve | tbh | fast_dhw,
    ]);
  }
}

export class MessageSetSilent extends MessageC3Base {
  // biome-ignore lint/suspicious/noExplicitAny: had to use any
  [key: string]: any;
  silent_level: SilentLevel;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0x05);
    this.silent_level = SilentLevel.OFF;
  }

  get _body() {
    // biome-ignore format: easier to read
    return Buffer.from([
      this.silent_level,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00
    ]);
  }
}

export class MessageSetECO extends MessageC3Base {
  // biome-ignore lint/suspicious/noExplicitAny: had to use any
  [key: string]: any;
  eco_mode: boolean;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0x07);
    this.eco_mode = false;
  }

  get _body() {
    const eco_mode = this.eco_mode ? 0x01 : 0x00;
    // biome-ignore format: easier to read
    return Buffer.from([
      eco_mode, 0x00, 0x00, 0x00, 0x00, 0x00
    ]);
  }
}

export class MessageSetDisinfect extends MessageC3Base {
  // biome-ignore lint/suspicious/noExplicitAny: had to use any
  [key: string]: any;
  disinfect: boolean;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0x09);
    this.disinfect = false;
  }

  get _body() {
    const disinfect = this.disinfect ? 0x01 : 0x00;
    // biome-ignore format: easier to read
    return Buffer.from([
      disinfect, 0x00, 0x00, 0x00, 0x00,
    ]);
  }
}

export class C3BasicMessageBody extends MessageBody {
  zone1_power: boolean;
  zone2_power: boolean;
  dhw_power: boolean;
  zone1_curve: boolean;
  zone2_curve: boolean;
  tbh: boolean; // disinfect
  fast_dhw: boolean;
  remote_onoff: boolean;

  heat: boolean;
  cool: boolean;
  dhw: boolean;
  double_zone: boolean;
  zone_temperature_type: boolean[];
  room_thermal_support: boolean;
  room_thermal_state: boolean;

  time_set: boolean;
  silent_mode: boolean;
  holiday_on: boolean;
  eco_mode: boolean;
  zone_terminal_type: number;

  mode: number;
  mode_auto: number;

  zone_target_temperature: number[];
  dhw_target_temperature: number;
  room_target_temperature: number;

  zone_heating_temperature_max: number[];
  zone_heating_temperature_min: number[];
  zone_cooling_temperature_max: number[];
  zone_cooling_temperature_min: number[];
  room_temperature_max: number;
  room_temperature_min: number;
  dhw_temperature_max: number;
  dhw_temperature_min: number;
  tank_actual_temperature: number;
  error_code: number;
  tbh_control: boolean;
  sys_energy_ana_en: boolean; // SysEnergyAnaEN
  hmi_energy_ana_set_en: boolean; // HMIEnergyAnaSetEN

  constructor(body: Buffer, data_offset = 0) {
    super(body);

    this.zone1_power = (body[data_offset + 0] & 0x01) > 0;
    this.zone2_power = (body[data_offset + 0] & 0x02) > 0;
    this.dhw_power = (body[data_offset + 0] & 0x04) > 0;
    this.zone1_curve = (body[data_offset + 0] & 0x08) > 0;
    this.zone2_curve = (body[data_offset + 0] & 0x10) > 0;
    this.tbh = (body[data_offset + 0] & 0x20) > 0;
    this.fast_dhw = (body[data_offset + 0] & 0x40) > 0;
    this.remote_onoff = (body[data_offset + 0] & 0x80) > 0;

    this.heat = (body[data_offset + 1] & 0x01) > 0;
    this.cool = (body[data_offset + 1] & 0x02) > 0;
    this.dhw = (body[data_offset + 1] & 0x04) > 0;
    this.double_zone = (body[data_offset + 1] & 0x08) > 0;
    this.zone_temperature_type = [(body[data_offset + 1] & 0x10) > 0, (body[data_offset + 1] & 0x20) > 0];
    this.room_thermal_support = (body[data_offset + 1] & 0x40) > 0;
    this.room_thermal_state = (body[data_offset + 1] & 0x80) > 0;

    this.time_set = (body[data_offset + 2] & 0x01) > 0;
    this.silent_mode = (body[data_offset + 2] & 0x02) > 0;
    this.holiday_on = (body[data_offset + 2] & 0x04) > 0;
    this.eco_mode = (body[data_offset + 2] & 0x08) > 0;
    this.zone_terminal_type = body[data_offset + 2];

    this.mode = body[data_offset + 3];
    this.mode_auto = body[data_offset + 4];

    this.zone_target_temperature = [body[data_offset + 5], body[data_offset + 6]];
    this.dhw_target_temperature = body[data_offset + 7];
    this.room_target_temperature = body[data_offset + 8] / 2;

    this.zone_heating_temperature_max = [body[data_offset + 9], body[data_offset + 13]];
    this.zone_heating_temperature_min = [body[data_offset + 10], body[data_offset + 14]];
    this.zone_cooling_temperature_max = [body[data_offset + 11], body[data_offset + 15]];
    this.zone_cooling_temperature_min = [body[data_offset + 12], body[data_offset + 16]];
    this.room_temperature_max = body[data_offset + 17] / 2;
    this.room_temperature_min = body[data_offset + 18] / 2;
    this.dhw_temperature_max = body[data_offset + 19];
    this.dhw_temperature_min = body[data_offset + 20];
    this.tank_actual_temperature = body[data_offset + 21];
    this.error_code = body[data_offset + 22];
    this.tbh_control = (body[data_offset + 23] & 0x80) > 0;
    this.sys_energy_ana_en = (body[data_offset + 23] & 0x20) > 0;
    this.hmi_energy_ana_set_en = (body[data_offset + 23] & 0x40) > 0;
  }
}

export class C3EnergyMessageBody extends MessageBody {
  status_heating: boolean;
  status_cool: boolean;
  status_dhw: boolean;
  status_tbh: boolean;
  status_ibh: boolean;

  total_energy_consumption: number;
  total_produced_energy: number;
  outdoor_temperature: number;
  zone1_temperature_set: number;
  zone2_temperature_set: number;
  t5s: number;
  tas: number;

  constructor(body: Buffer, data_offset = 0) {
    super(body);
    const status_byte = body[data_offset];

    this.status_heating = (status_byte & 0x01) > 0;
    this.status_cool = (status_byte & 0x02) > 0;
    this.status_dhw = (status_byte & 0x04) > 0;
    this.status_tbh = (status_byte & 0x08) > 0;
    this.status_ibh = (status_byte & 0x10) > 0;

    this.total_energy_consumption = body.readUInt32LE(data_offset + 1);
    this.total_produced_energy = body.readUInt32LE(data_offset + 5);
    const base_value = body[data_offset + 9];
    this.outdoor_temperature = base_value > TEMPERATURE_NEGATIVE_VALUE ? base_value - 256 : base_value;
    this.zone1_temperature_set = body[data_offset + 10];
    this.zone2_temperature_set = body[data_offset + 11];
    this.t5s = body[data_offset + 12];
    this.tas = body[data_offset + 13];
  }
}

export class C3SilenceMessageBody extends MessageBody {
  silent_mode: boolean;
  silent_level: SilentLevel;

  constructor(body: Buffer, data_offset = 0) {
    super(body);
    this.silent_mode = (body[data_offset] & 0x01) > 0;
    this.silent_level = (() => {
      if (!this.silent_mode) return SilentLevel.OFF;
      switch (((body[data_offset] & 0x01) + (body[data_offset] & 0x08)) >> 2) {
        case 0x01:
          return SilentLevel.SILENT;
        case 0x03:
          return SilentLevel.SUPER_SILENT;
        default:
          return SilentLevel.OFF;
      }
    })();
  }
}

export class C3ECOMessageBody extends MessageBody {
  eco_function_state: boolean;
  eco_timer_state: boolean;

  constructor(body: Buffer, data_offset = 0) {
    super(body);
    this.eco_function_state = (body[data_offset] & 0x01) > 0;
    this.eco_timer_state = (body[data_offset] & 0x02) > 0;
  }
}

export class C3DisinfectMessageBody extends MessageBody {
  disinfect: boolean;
  disinfect_run: boolean;
  disinfect_set_weekday: number;
  disinfect_start_hour: number;
  disinfect_start_minute: number;

  constructor(body: Buffer, data_offset = 0) {
    super(body);
    this.disinfect = (body[data_offset] & 0x01) > 0;
    this.disinfect_run = (body[data_offset] & 0x02) > 0;
    this.disinfect_set_weekday = body[data_offset + 1];
    this.disinfect_start_hour = body[data_offset + 2];
    this.disinfect_start_minute = body[data_offset + 3];
  }
}

export class C3UnitParaMessageBody extends MessageBody {
  comp_run_freq: number;
  unit_mode_run: number;
  fan_speed: number;
  fg_capacity_need: number;
  temp_t3: number;
  temp_t4: number;
  temp_tp: number;
  temp_tw_in: number;
  temp_tw_out: number;
  temp_tsolar: number;
  hydbox_subtype: number;
  fg_usb_info_connect: number;
  // usb_index_max: number;
  // odu_comp_current: number;
  odu_voltage: number;
  exv_current: number;
  odu_model: number;
  // unit_online_num: number;
  // current_code: number;
  temp_t1: number;
  temp_tw2: number;
  temp_t2: number;
  temp_t2b: number;
  temp_t5: number;
  temp_ta: number;
  temp_tb_t1: number;
  temp_tb_t2: number;
  hydrobox_capacity: number;
  pressure_high: number;
  pressure_low: number;
  temp_th: number;
  machine_type: number;
  odu_target_fre: number;
  dc_current: number;
  temp_tf: number;
  idu_t1s1: number;
  idu_t1s2: number;
  water_flower: number;
  odu_plan_vol_lmt: number;
  current_unit_capacity: number;
  sphera_ahs_voltage: number;
  temp_t4a_ver: number;
  water_pressure: number;
  room_rel_hum: number;
  pwm_pump_out: number;
  total_electricity0: number;
  total_thermal0: number;
  heat_elec_total_consum0: number;
  heat_elec_total_capacity0: number;
  instant_power0: number;
  instant_renew_power0: number;
  total_renew_power0: number;

  constructor(body: Buffer, data_offset = 0) {
    super(body);
    this.comp_run_freq = body[data_offset];
    this.unit_mode_run = body[data_offset + 1];
    this.fan_speed = body[data_offset + 3] * 10;
    this.fg_capacity_need = body[data_offset + 5];
    this.temp_t3 = body[data_offset + 6];
    this.temp_t4 = body[data_offset + 7];
    this.temp_tp = body[data_offset + 8];
    this.temp_tw_in = body[data_offset + 9];
    this.temp_tw_out = body[data_offset + 10];
    this.temp_tsolar = body[data_offset + 11];
    this.hydbox_subtype = body[data_offset + 12];
    this.fg_usb_info_connect = body[data_offset + 13];
    // this.usb_index_max  body[data_offset + 14]
    // this.odu_comp_current  body[data_offset + 16]
    this.odu_voltage = body[data_offset + 17] * 256 + body[data_offset + 18];
    this.exv_current = body[data_offset + 19] * 256 + body[data_offset + 20];
    this.odu_model = body[data_offset + 21];
    // this.unit_online_num  body[data_offset + 22]
    // this.current_code  body[data_offset + 23]
    this.temp_t1 = body[data_offset + 33];
    this.temp_tw2 = body[data_offset + 34];
    this.temp_t2 = body[data_offset + 35];
    this.temp_t2b = body[data_offset + 36];
    this.temp_t5 = body[data_offset + 37];
    this.temp_ta = body[data_offset + 38];
    this.temp_tb_t1 = body[data_offset + 39];
    this.temp_tb_t2 = body[data_offset + 40];
    this.hydrobox_capacity = body[data_offset + 41];
    this.pressure_high = body[data_offset + 42] * 256 + body[data_offset + 43];
    this.pressure_low = body[data_offset + 44] * 256 + body[data_offset + 45];
    this.temp_th = body[data_offset + 46];
    this.machine_type = body[data_offset + 47];
    this.odu_target_fre = body[data_offset + 48];
    this.dc_current = body[data_offset + 49];
    this.temp_tf = body[data_offset + 51];
    this.idu_t1s1 = body[data_offset + 52];
    this.idu_t1s2 = body[data_offset + 53];
    this.water_flower = body[data_offset + 54] * 256 + body[data_offset + 55];
    this.odu_plan_vol_lmt = body[data_offset + 56];
    this.current_unit_capacity = body[data_offset + 57];
    this.sphera_ahs_voltage = body[data_offset + 59];
    this.temp_t4a_ver = body[data_offset + 60];
    this.water_pressure = body[data_offset + 61] * 256 + body[data_offset + 62];
    this.room_rel_hum = body[data_offset + 63];
    this.pwm_pump_out = body[data_offset + 63];
    this.total_electricity0 = body.readUInt32LE(data_offset + 69);
    this.total_thermal0 = body.readUInt32LE(data_offset + 73);
    this.heat_elec_total_consum0 = body.readUInt32LE(data_offset + 77);
    this.heat_elec_total_capacity0 = body.readUInt32LE(data_offset + 81);
    this.instant_power0 = (body[data_offset + 82] << 8) + body[data_offset + 83];
    this.instant_renew_power0 = (body[data_offset + 84] << 8) + body[data_offset + 85];
    this.total_renew_power0 = (body[data_offset + 84] << 8) + body[data_offset + 85];
  }
}

export class MessageC3Response extends MessageResponse {
  constructor(message: Buffer) {
    super(message);
    if (
      ([MessageType.SET, MessageType.NOTIFY1, MessageType.QUERY].includes(this.message_type) && this.body_type === 0x01) ||
      this.message_type === MessageType.NOTIFY2
    ) {
      this.set_body(new C3BasicMessageBody(this.body, 1));
    } else if (this.message_type === MessageType.NOTIFY1 && this.body_type === 0x04) {
      this.set_body(new C3EnergyMessageBody(this.body, 1));
    } else if (this.message_type === MessageType.QUERY && this.body_type === 0x05) {
      this.set_body(new C3SilenceMessageBody(this.body, 1));
    } else if (this.body_type === 0x07) {
      this.set_body(new C3ECOMessageBody(this.body, 1));
    } else if (this.body_type === 0x09) {
      this.set_body(new C3DisinfectMessageBody(this.body, 1));
    } else if (this.body_type === 0x10) {
      this.set_body(new C3UnitParaMessageBody(this.body, 1));
    }
  }
}

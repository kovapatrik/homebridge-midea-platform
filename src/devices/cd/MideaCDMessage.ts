/***********************************************************************
 * Midea Heat Pump Water Heater Device message handler class
 *
 * Copyright (c) 2025 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */

import { DeviceType } from '../../core/MideaConstants.js';
import { MessageBody, MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage.js';

const OLD_BODY_LENGTH = 29;

abstract class MessageCDBase extends MessageRequest {
  constructor(device_protocol_version: number, message_type: MessageType, body_type: number) {
    super(DeviceType.HEAT_PUMP_WATER_HEATER, message_type, body_type, device_protocol_version);
  }
}

export class MessageQuery extends MessageCDBase {
  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.QUERY, 0x01);
  }

  get _body() {
    return Buffer.from([0x01]);
  }
}

export class MessageSet extends MessageCDBase {
  // biome-ignore lint/suspicious/noExplicitAny: had to use any
  [key: string]: any;
  power: boolean;
  target_temperature: number;
  aux_heating: boolean;
  mode: number;
  tr_temperature: number;
  open_ptc: boolean;
  ptc_temperature: number;

  constructor(device_protocol_version: number) {
    super(device_protocol_version, MessageType.SET, 0x01);
    this.power = false;
    this.target_temperature = 0;
    this.aux_heating = false;
    this.tr_temperature = 0;
    this.open_ptc = false;
    this.ptc_temperature = 0;
    this.mode = 1;
  }

  get _body() {
    const power = this.power ? 0x01 : 0x00;
    const mode = this.mode + 1;
    const target_temperature = Math.round(this.target_temperature * 2 + 30);

    // biome-ignore format: easier to read
    return Buffer.from([
      0x01, power, mode, target_temperature,
      this.tr_temperature,
      this.open_ptc ? 0x01 : 0x00,
      this.ptc_temperature,
      0x00 // byte8
    ])
  }
}

export class CDGeneralMessageBody extends MessageBody {
  power: boolean;
  mode: number;
  heat: number;
  eco: number;
  target_temperature: number;
  current_temperature: number;
  top_temperature: number;
  bottom_temperature: number;
  condenser_temperature: number;
  outdoor_temperature: number;
  compressor_temperature: number;
  max_temperature: number;
  min_temperature: number;
  error_code: number;
  bottom_elec_heat: boolean;
  top_elec_heat: boolean;
  water_pump: boolean;
  compressor_status: boolean;
  wind?: string;
  four_way: boolean;
  elec_heat: boolean;
  back_water: boolean;
  sterilize: boolean;
  typeinfo: number;
  water_level?: number;
  smart_grid?: boolean;
  multi_terminal?: boolean;
  fahrenheit?: boolean;
  mute_effect?: boolean;
  mute_status?: boolean;

  constructor(body: Buffer) {
    super(body);

    this.power = (body[2] & 0x01) > 0;
    this.mode = 0;
    if ((body[2] & 0x02) > 0) {
      this.mode = 0x01; // energyMode
    } else if ((body[2] & 0x04) > 0) {
      this.mode = 0x02; // standardMode
    } else if ((body[2] & 0x08) > 0) {
      this.mode = 0x03; // compatibilizingMode
    }
    this.heat = body[2] & 0x20; // energyMode
    this.heat = body[2] & 0x30; // dicaryonHeat
    this.eco = body[2] & 0x40; // eco
    this.target_temperature = body[3]; // tsValue
    this.current_temperature = body[4]; // washBoxTemp
    this.top_temperature = body[5]; // boxTopTemp
    this.bottom_temperature = body[6]; // boxBottomTemp
    this.condenser_temperature = body[7]; // t3Value
    this.outdoor_temperature = body[8]; // t4Value
    this.compressor_temperature = body[9]; // compressorTopTemp
    this.max_temperature = body[10]; // tsMaxValue
    this.min_temperature = body[11]; // tsMinValue
    this.error_code = body[20]; // errorCode
    this.bottom_elec_heat = (body[27] & 0x01) > 0; // bottomElecHeat
    this.top_elec_heat = (body[27] & 0x02) > 0; // topElecHeat
    this.water_pump = (body[27] & 0x04) > 0; // waterPump
    this.compressor_status = (body[27] & 0x08) > 0; // compressor
    if ((body[27] & 0x10) > 0) {
      this.wind = 'middle'; // middleWind
    } else if ((body[27] & 0x40) > 0) {
      this.wind = 'low'; // lowWind
    } else if ((body[27] & 0x80) > 0) {
      this.wind = 'high'; // highWind
    }
    this.four_way = (body[27] & 0x20) > 0; // fourWayValve
    this.elec_heat = (body[28] & 0x01) > 0; // elecHeatSupport
    if ((body[28] & 0x20) > 0) {
      this.mode = 0x04; // smartMode
    }
    this.back_water = (body[28] & 0x40) > 0; // backwaterEffect
    this.sterilize = (body[28] & 0x80) > 0; // sterilizeEffect
    this.typeinfo = body[29]; // typeInfo
    this.water_level = body.length > OLD_BODY_LENGTH ? body[34] : undefined; // hotWater
    if (body.length > OLD_BODY_LENGTH && (body[35] & 0x01) > 0) {
      this.mode = 0x05; // vacationMode
    }
    this.smart_grid = body.length > OLD_BODY_LENGTH ? (body[35] & 0x01) > 0 : undefined; // smartGrid
    this.multi_terminal = body.length > OLD_BODY_LENGTH ? (body[35] & 0x40) > 0 : undefined; // multiTerminal
    this.fahrenheit = body.length > OLD_BODY_LENGTH ? (body[35] & 0x80) > 0 : undefined; // fahrenheitEffect
    this.mute_effect = body.length > OLD_BODY_LENGTH ? (body[39] & 0x40) > 0 : undefined; // mute_effect
    this.mute_status = body.length > OLD_BODY_LENGTH ? (body[39] & 0x80) > 0 : undefined; // mute_status
  }
}

export class CD01MessageBody extends MessageBody {
  power: boolean;
  mode: number;
  target_temperature: number;
  tr_temperature: number;
  open_ptc: boolean;
  ptc_temperature: number;
  byte8: number;

  constructor(body: Buffer) {
    super(body);

    this.power = (body[2] & 0x01) > 0;
    this.mode = body[3];
    this.target_temperature = Math.round((body[4] - 30) / 2);
    this.tr_temperature = body[5];
    this.open_ptc = body[5] === 0x01;
    this.ptc_temperature = body[7];
    this.byte8 = body[8];
  }
}

export class MessageCDResponse extends MessageResponse {
  constructor(message: Buffer) {
    super(message);

    if ([MessageType.QUERY, MessageType.NOTIFY2].includes(this.message_type)) {
      this.set_body(new CDGeneralMessageBody(this.body));
    } else if (MessageType.SET === this.message_type && this.body_type === 0x01) {
      this.set_body(new CD01MessageBody(this.body));
    }
  }
}

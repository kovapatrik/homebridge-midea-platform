import { MessageBody, MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage.js';
export declare enum SilentLevel {
    OFF = 0,
    SILENT = 1,
    SUPER_SILENT = 3
}
declare abstract class MessageC3Base extends MessageRequest {
    constructor(device_protocol_version: number, message_type: MessageType, body_type: number);
}
export declare class MessageQuery extends MessageC3Base {
    constructor(device_protocol_version: number, body_type: number);
    get _body(): Buffer;
}
export declare class MessageQueryBasic extends MessageQuery {
    constructor(device_protocol_version: number);
}
export declare class MessageQuerySilence extends MessageQuery {
    constructor(device_protocol_version: number);
}
export declare class MessageQueryECO extends MessageQuery {
    constructor(device_protocol_version: number);
}
export declare class MessageQueryInstall extends MessageQuery {
    constructor(device_protocol_version: number);
}
export declare class MessageQueryDisinfect extends MessageQuery {
    constructor(device_protocol_version: number);
}
export declare class MessageQueryUnitPara extends MessageQuery {
    constructor(device_protocol_version: number);
}
export declare class MessageQueryHMIPara extends MessageQuery {
    constructor(device_protocol_version: number);
}
export declare class MessageSet extends MessageC3Base {
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
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessageSetSilent extends MessageC3Base {
    [key: string]: any;
    silent_level: SilentLevel;
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessageSetECO extends MessageC3Base {
    [key: string]: any;
    eco_mode: boolean;
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessageSetDisinfect extends MessageC3Base {
    [key: string]: any;
    disinfect: boolean;
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class C3BasicMessageBody extends MessageBody {
    zone1_power: boolean;
    zone2_power: boolean;
    dhw_power: boolean;
    zone1_curve: boolean;
    zone2_curve: boolean;
    tbh: boolean;
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
    sys_energy_ana_en: boolean;
    hmi_energy_ana_set_en: boolean;
    constructor(body: Buffer, data_offset?: number);
}
export declare class C3EnergyMessageBody extends MessageBody {
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
    constructor(body: Buffer, data_offset?: number);
}
export declare class C3SilenceMessageBody extends MessageBody {
    silent_mode: boolean;
    silent_level: SilentLevel;
    constructor(body: Buffer, data_offset?: number);
}
export declare class C3ECOMessageBody extends MessageBody {
    eco_function_state: boolean;
    eco_timer_state: boolean;
    constructor(body: Buffer, data_offset?: number);
}
export declare class C3DisinfectMessageBody extends MessageBody {
    disinfect: boolean;
    disinfect_run: boolean;
    disinfect_set_weekday: number;
    disinfect_start_hour: number;
    disinfect_start_minute: number;
    constructor(body: Buffer, data_offset?: number);
}
export declare class C3UnitParaMessageBody extends MessageBody {
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
    odu_voltage: number;
    exv_current: number;
    odu_model: number;
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
    constructor(body: Buffer, data_offset?: number);
}
export declare class MessageC3Response extends MessageResponse {
    constructor(message: Buffer);
}
export {};

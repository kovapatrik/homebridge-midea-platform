import { MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage.js';
declare abstract class MessageACBase extends MessageRequest {
    private static message_serial;
    private message_id;
    constructor(device_protocol_version: number, message_type: MessageType, body_type: number);
    get body(): Buffer;
}
export declare class MessageQuery extends MessageACBase {
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessageCapabilityQuery extends MessageACBase {
    additional_capabilities: boolean;
    constructor(device_protocol_version: number, additional_capabilities: boolean);
    get _body(): Buffer;
}
export declare class MessagePowerQuery extends MessageACBase {
    constructor(device_protocol_version: number);
    get _body(): Buffer;
    get body(): Buffer;
}
export declare class MessageSwitchDisplay extends MessageACBase {
    prompt_tone: boolean;
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessageNewProtocolQuery extends MessageACBase {
    private readonly alternate_display;
    constructor(device_protocol_version: number, alternate_display?: boolean);
    get _body(): Buffer;
}
export declare abstract class MessageSubProtocol extends MessageACBase {
    private readonly subprotocol_query_type;
    protected abstract subprotocol_body?: Buffer;
    constructor(device_protocol_version: number, message_type: MessageType, subprotocol_query_type: number);
    get body(): Buffer;
    get _body(): Buffer;
}
export declare class MessageSubProtocolQuery extends MessageSubProtocol {
    protected subprotocol_body?: Buffer | undefined;
    constructor(device_protocol_version: number, subprotocol_query_type: number);
}
export declare class MessageSubProtocolSet extends MessageSubProtocol {
    [key: string]: any;
    power: boolean;
    mode: number;
    target_temperature: number;
    fan_speed: number;
    boost_mode: boolean;
    aux_heating: boolean;
    dry: boolean;
    eco_mode: boolean;
    sleep_mode: boolean;
    sn8_flag: boolean;
    timer: boolean;
    prompt_tone: boolean;
    constructor(device_protocol_version: number);
    get subprotocol_body(): Buffer;
}
export declare class MessageGeneralSet extends MessageACBase {
    [key: string]: any;
    power: boolean;
    prompt_tone: boolean;
    mode: number;
    target_temperature: number;
    fan_speed: number;
    swing_vertical: boolean;
    swing_horizontal: boolean;
    boost_mode: boolean;
    smart_eye: boolean;
    dry: boolean;
    aux_heating: boolean;
    eco_mode: boolean;
    temp_fahrenheit: boolean;
    sleep_mode: boolean;
    natural_wind: boolean;
    frost_protect: boolean;
    comfort_mode: boolean;
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessageNewProtocolSet extends MessageACBase {
    [k: string]: any;
    wind_swing_ud_angle?: number;
    wind_swing_lr_angle?: number;
    indirect_wind?: boolean;
    prompt_tone: boolean;
    breezeless?: boolean;
    screen_display?: boolean;
    fresh_air_1?: Buffer;
    fresh_air_2?: Buffer;
    self_clean?: boolean;
    rate_select?: number;
    ion?: boolean;
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessageACResponse extends MessageResponse {
    private readonly message;
    used_subprotocol?: boolean;
    constructor(message: Buffer, power_analysis_method?: number);
}
export {};

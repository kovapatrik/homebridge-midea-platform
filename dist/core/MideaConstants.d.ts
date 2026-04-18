export declare const DISCOVERY_MESSAGE: Int8Array;
export declare const DEVICE_INFO_MESSAGE: Int8Array;
export declare enum DeviceType {
    UNKNOWN = 0,
    AIR_CONDITIONER = 172,
    DEHUMIDIFIER = 161,
    HEAT_PUMP_WIFI_CONTROLLER = 195,
    HEAT_PUMP_WATER_HEATER = 205,
    FRESH_AIR_APPLIANCE = 206,
    FRONT_LOAD_WASHER = 219,
    DISHWASHER = 225,
    ELECTRIC_WATER_HEATER = 226,
    GAS_WATER_HEATER = 227,
    FAN = 250,
    HUMIDIFIER = 253
}
export declare const DeviceTypeToName: {
    readonly [K in DeviceType]: string;
};
export declare enum ParseMessageResult {
    SUCCESS = 0,
    PADDING = 1,
    ERROR = 99
}
export type DeviceInfo = {
    ip: string;
    port: number;
    id: number;
    model: string | undefined;
    sn: string | undefined;
    name: string;
    type: number;
    version: number;
};
export declare enum FrameType {
    UNKNOWN = 0,
    SET = 2,
    REQUEST = 3,
    RESPONSE = 4,
    ABNORMAL_REPORT = 6
}
export declare enum TCPMessageType {
    HANDSHAKE_REQUEST = 0,
    HANDSHAKE_RESPONSE = 1,
    ENCRYPTED_RESPONSE = 3,
    ENCRYPTED_REQUEST = 6
}
export declare enum ProtocolVersion {
    UNKNOWN = 0,
    V1 = 1,
    V2 = 2,
    V3 = 3
}
export declare enum Endianness {
    Little = 0,
    Big = 1
}

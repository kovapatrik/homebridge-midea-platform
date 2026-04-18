export const DISCOVERY_MESSAGE = new Int8Array([
    0x5a, 0x5a, 0x01, 0x11, 0x48, 0x00, 0x92, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x7f, 0x75, 0xbd, 0x6b, 0x3e, 0x4f, 0x8b, 0x76, 0x2e, 0x84, 0x9c, 0x6e,
    0x57, 0x8d, 0x65, 0x90, 0x03, 0x6e, 0x9d, 0x43, 0x42, 0xa5, 0x0f, 0x1f, 0x56, 0x9e, 0xb8, 0xec, 0x91, 0x8e, 0x92, 0xe5,
]);
export const DEVICE_INFO_MESSAGE = new Int8Array([
    0x5a, 0x5a, 0x15, 0x00, 0x00, 0x38, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x27, 0x33, 0x05, 0x13, 0x06, 0x14, 0x14, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x03, 0xe8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xca, 0x8d, 0x9b, 0xf9, 0xa0, 0x30, 0x1a, 0xe3, 0xb7, 0xe4, 0x2d, 0x53,
    0x49, 0x47, 0x62, 0xbe,
]);
export var DeviceType;
(function (DeviceType) {
    DeviceType[DeviceType["UNKNOWN"] = 0] = "UNKNOWN";
    DeviceType[DeviceType["AIR_CONDITIONER"] = 172] = "AIR_CONDITIONER";
    DeviceType[DeviceType["DEHUMIDIFIER"] = 161] = "DEHUMIDIFIER";
    DeviceType[DeviceType["HEAT_PUMP_WIFI_CONTROLLER"] = 195] = "HEAT_PUMP_WIFI_CONTROLLER";
    DeviceType[DeviceType["HEAT_PUMP_WATER_HEATER"] = 205] = "HEAT_PUMP_WATER_HEATER";
    DeviceType[DeviceType["FRESH_AIR_APPLIANCE"] = 206] = "FRESH_AIR_APPLIANCE";
    DeviceType[DeviceType["FRONT_LOAD_WASHER"] = 219] = "FRONT_LOAD_WASHER";
    DeviceType[DeviceType["DISHWASHER"] = 225] = "DISHWASHER";
    DeviceType[DeviceType["ELECTRIC_WATER_HEATER"] = 226] = "ELECTRIC_WATER_HEATER";
    DeviceType[DeviceType["GAS_WATER_HEATER"] = 227] = "GAS_WATER_HEATER";
    DeviceType[DeviceType["FAN"] = 250] = "FAN";
    DeviceType[DeviceType["HUMIDIFIER"] = 253] = "HUMIDIFIER";
})(DeviceType || (DeviceType = {}));
export const DeviceTypeToName = {
    [DeviceType.UNKNOWN]: 'Unknown',
    [DeviceType.AIR_CONDITIONER]: 'Air Conditioner',
    [DeviceType.DEHUMIDIFIER]: 'Dehumidifier',
    [DeviceType.HEAT_PUMP_WIFI_CONTROLLER]: 'Heat Pump Wifi Controller',
    [DeviceType.HEAT_PUMP_WATER_HEATER]: 'Heat Pump Water Heater',
    [DeviceType.FRESH_AIR_APPLIANCE]: 'Fresh Air Appliance',
    [DeviceType.FRONT_LOAD_WASHER]: 'Front Load Washer',
    [DeviceType.DISHWASHER]: 'Dishwasher',
    [DeviceType.ELECTRIC_WATER_HEATER]: 'Electric Water Heater',
    [DeviceType.GAS_WATER_HEATER]: 'Gas Water Heater',
    [DeviceType.FAN]: 'Fan',
    [DeviceType.HUMIDIFIER]: 'Humidifier',
};
export var ParseMessageResult;
(function (ParseMessageResult) {
    ParseMessageResult[ParseMessageResult["SUCCESS"] = 0] = "SUCCESS";
    ParseMessageResult[ParseMessageResult["PADDING"] = 1] = "PADDING";
    ParseMessageResult[ParseMessageResult["ERROR"] = 99] = "ERROR";
})(ParseMessageResult || (ParseMessageResult = {}));
export var FrameType;
(function (FrameType) {
    FrameType[FrameType["UNKNOWN"] = 0] = "UNKNOWN";
    FrameType[FrameType["SET"] = 2] = "SET";
    FrameType[FrameType["REQUEST"] = 3] = "REQUEST";
    FrameType[FrameType["RESPONSE"] = 4] = "RESPONSE";
    FrameType[FrameType["ABNORMAL_REPORT"] = 6] = "ABNORMAL_REPORT";
})(FrameType || (FrameType = {}));
export var TCPMessageType;
(function (TCPMessageType) {
    TCPMessageType[TCPMessageType["HANDSHAKE_REQUEST"] = 0] = "HANDSHAKE_REQUEST";
    TCPMessageType[TCPMessageType["HANDSHAKE_RESPONSE"] = 1] = "HANDSHAKE_RESPONSE";
    TCPMessageType[TCPMessageType["ENCRYPTED_RESPONSE"] = 3] = "ENCRYPTED_RESPONSE";
    TCPMessageType[TCPMessageType["ENCRYPTED_REQUEST"] = 6] = "ENCRYPTED_REQUEST";
})(TCPMessageType || (TCPMessageType = {}));
export var ProtocolVersion;
(function (ProtocolVersion) {
    ProtocolVersion[ProtocolVersion["UNKNOWN"] = 0] = "UNKNOWN";
    ProtocolVersion[ProtocolVersion["V1"] = 1] = "V1";
    ProtocolVersion[ProtocolVersion["V2"] = 2] = "V2";
    ProtocolVersion[ProtocolVersion["V3"] = 3] = "V3";
})(ProtocolVersion || (ProtocolVersion = {}));
export var Endianness;
(function (Endianness) {
    Endianness[Endianness["Little"] = 0] = "Little";
    Endianness[Endianness["Big"] = 1] = "Big";
})(Endianness || (Endianness = {}));
//# sourceMappingURL=MideaConstants.js.map
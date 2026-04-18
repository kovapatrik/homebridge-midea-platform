/***********************************************************************
 * Midea Device class from which specfic device support is inherited.
 *
 * Copyright (c) 2023 Kovalovszky Patrik, https://github.com/kovapatrik
 * Portions Copyright (c) 2023 David Kerr, https://github.com/dkerr64
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */
import EventEmitter from 'node:events';
import type { Logger } from 'homebridge';
import type { Config, DeviceConfig } from '../platformUtils.js';
import { type DeviceInfo, type DeviceType, ParseMessageResult, ProtocolVersion } from './MideaConstants.js';
import { type MessageRequest, MessageType } from './MideaMessage.js';
import { type KeyToken, LocalSecurity } from './MideaSecurity.js';
export type DeviceAttributeBase = {
    [key: string]: number | number[] | string | boolean | boolean[] | Buffer | undefined;
};
export default abstract class MideaDevice extends EventEmitter {
    protected readonly logger: Logger;
    private readonly SOCKET_TIMEOUT;
    readonly ip: string;
    protected readonly port: number;
    readonly id: number;
    readonly model: string;
    readonly sn: string;
    readonly name: string;
    readonly type: DeviceType;
    protected readonly version: ProtocolVersion;
    protected is_running: boolean;
    protected available: boolean;
    private _authenticated;
    private unsupported_protocol;
    protected device_protocol_version: number;
    protected refresh_interval: number;
    protected heartbeat_interval: number;
    protected verbose: boolean;
    protected logRecoverableErrors: boolean;
    protected logRefreshStatusErrors: boolean;
    private _sub_type?;
    token: KeyToken;
    key: KeyToken;
    protected readonly security: LocalSecurity;
    private buffer;
    private promiseSocket;
    abstract attributes: DeviceAttributeBase;
    protected abstract build_query(): MessageRequest[];
    protected abstract process_message(message: Buffer): void;
    protected abstract set_subtype(): void;
    abstract set_attribute(status: DeviceAttributeBase): Promise<void>;
    constructor(logger: Logger, device_info: DeviceInfo, config: Config, configDev: DeviceConfig);
    get sub_type(): number;
    setCredentials(token: KeyToken, key: KeyToken): void;
    fetch_v2_message(messageToProcess: Buffer): [Buffer[], Buffer];
    connect(refresh_status?: boolean): Promise<boolean>;
    private authenticate;
    send_message(data: Buffer): Promise<void>;
    private send_message_v2;
    private send_message_v3;
    build_send(command: MessageRequest): Promise<void>;
    refresh_status(wait_response?: boolean, ignore_unsupported?: boolean): Promise<boolean>;
    preprocess_message(message: Buffer): boolean;
    parse_message(message: Buffer): ParseMessageResult;
    send_command(command_type: MessageType, command_body: Buffer): Promise<void>;
    send_heartbeat(): Promise<void>;
    protected update(values: DeviceAttributeBase): Promise<void>;
    open(): void;
    close(): void;
    private close_socket;
    /*********************************************************************
     * run
     * Continuous loop that runs listening for network traffic from the device
     * and proceses each message as received.
     */
    private run;
}

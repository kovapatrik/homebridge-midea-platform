/***********************************************************************
 * Midea Device class from which specfic device support is inherited.
 *
 * Copyright (c) 2023 Kovalovszky Patrik, https://github.com/kovapatrik
 * Portions Copyright (c) 2023 David Kerr, https://github.com/dkerr64
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */
import { Logger } from 'homebridge';
import { KeyToken, LocalSecurity } from './MideaSecurity';
import { DeviceInfo, DeviceType, TCPMessageType, ProtocolVersion, ParseMessageResult } from './MideaConstants';
import { MessageQuerySubtype, MessageQuestCustom, MessageRequest, MessageSubtypeResponse, MessageType } from './MideaMessage';
import PacketBuilder from './MideaPacketBuilder';
import { PromiseSocket } from './MideaUtils';
import { Config, DeviceConfig } from '../platformUtils';
import EventEmitter from 'events';

export type DeviceAttributeBase = {
  [key: string]: number | string | boolean | undefined;
};

export default abstract class MideaDevice extends EventEmitter {
  private readonly SOCKET_TIMEOUT = 1000; // milliseconds

  public readonly ip: string;
  protected readonly port: number;

  public readonly id: number;
  public readonly model: string;
  public readonly sn: string;
  public readonly name: string;
  public readonly type: DeviceType;
  protected readonly version: ProtocolVersion;

  protected is_running = false;
  protected available = false;

  private unsupported_protocol: string[] = [];
  protected device_protocol_version = 0;

  protected refresh_interval: number;
  protected heartbeat_interval: number;
  protected verbose: boolean;
  protected logRecoverableErrors: boolean;

  private _sub_type?: number;

  public token: KeyToken = undefined;
  public key: KeyToken = undefined;

  protected readonly security: LocalSecurity;
  private buffer: Buffer;

  private promiseSocket: PromiseSocket;

  public abstract attributes: DeviceAttributeBase;

  protected abstract build_query(): MessageRequest[];
  protected abstract process_message(message: Buffer): void;
  protected abstract set_subtype(): void;
  public abstract set_attribute(status: DeviceAttributeBase): Promise<void>;

  constructor(
    protected readonly logger: Logger,
    device_info: DeviceInfo,
    config: Config,
    configDev: DeviceConfig,
  ) {
    super();

    this.ip = device_info.ip;
    this.port = device_info.port;

    this.id = device_info.id;
    this.model = device_info.model ?? 'unknown';
    this.sn = device_info.sn ?? 'unknown';
    this.name = device_info.name;
    this.type = device_info.type;
    this.version = device_info.version;

    this.verbose = configDev.advanced_options.verbose;
    this.logRecoverableErrors = configDev.advanced_options.logRecoverableErrors;

    this.logger.warn(`[${this.name}] Device specific verbose debug logging is set to ${configDev.advanced_options.verbose}`);
    this.logger.warn(`[${this.name}] Device specific log recoverable errors is set to ${configDev.advanced_options.logRecoverableErrors}`);

    this.refresh_interval = config.refreshInterval * 1000; // convert to miliseconds
    this.heartbeat_interval = config.heartbeatInterval * 1000;

    this.security = new LocalSecurity();
    this.buffer = Buffer.alloc(0);

    this.promiseSocket = new PromiseSocket(this.logger, this.logRecoverableErrors);
  }

  get sub_type(): number {
    return this._sub_type || 0;
  }

  public setCredentials(token: KeyToken, key: KeyToken) {
    this.token = token;
    this.key = key;
  }

  public fetch_v2_message(message: Buffer): [Buffer[], Buffer] {
    const result: Buffer[] = [];
    while (message.length > 0) {
      const length = message.length;
      if (length < 6) {
        break;
      }
      const alleged_length = message[4] + (message[5] << 8);
      if (length >= alleged_length) {
        result.push(message.subarray(0, alleged_length));
        message = message.subarray(alleged_length, length);
      } else {
        break;
      }
    }
    return [result, message];
  }

  public async connect(refresh_status = true) {
    try {
      this.logger.debug(`Connecting to device ${this.name} (${this.ip}:${this.port})...`);
      await this.promiseSocket.connect(this.port, this.ip);
      this.promiseSocket.setTimeout(this.SOCKET_TIMEOUT);
      if (this.version === ProtocolVersion.V3) {
        await this.authenticate();
      }
      let retries = 0;
      if (refresh_status) {
        let success = await this.refresh_status(true);
        while (!success && retries++ < 3) {
          success = await this.refresh_status(true, true);
        }
      }
      if (retries > 3) {
        this.logger.debug(`[${this.name}] Error when connecting to device ${this.name} (${this.ip}:${this.port}): Refresh status failed.`);
        return false;
      }
      // Start listening for network traffic
      this.open();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.stack : err;
      this.logger.debug(`[${this.name}] Error when connecting to device ${this.name} (${this.ip}:${this.port}):\n${msg}`);
      // Even though error thrown, it is probably because device is offline.  Start listening anyway.
      this.open();
      return true;
    }
  }

  private async authenticate() {
    if (!(this.token && this.key)) {
      throw new Error('Token or key is missing!');
    }

    const request = this.security.encode_8370(this.token, TCPMessageType.HANDSHAKE_REQUEST);
    await this.promiseSocket.write(request);
    const response = await this.promiseSocket.read();

    if (response) {
      if (response.length < 20) {
        throw Error(`Authenticate error when receiving data from ${this.ip}:${this.port}. (Data length mismatch)`);
      }
      const resp = response.subarray(8, 72);
      this.security.tcp_key_from_resp(resp, this.key);
      this.logger.debug(`[${this.name}] Authentication success.`);
    } else {
      throw Error(`Authenticate error when receiving data from ${this.ip}:${this.port}.`);
    }
  }

  public async send_message(data: Buffer) {
    if (this.verbose) {
      this.logger.debug(`[${this.name}] Send message:\n${data.toString('hex')}`);
    }
    if (this.version === ProtocolVersion.V3) {
      await this.send_message_v3(data);
    } else {
      await this.send_message_v2(data);
    }
  }

  private async send_message_v2(data: Buffer, retries = 3, force_reinit = false) {
    if (retries === 0) {
      throw new Error(`[${this.name} | send_message] Error when sending data to device.`);
    }
    if (force_reinit || !this.promiseSocket || this.promiseSocket.destroyed) {
      this.promiseSocket = new PromiseSocket(this.logger, this.logRecoverableErrors);
      let connected = await this.connect(false);
      while (!connected) {
        connected = await this.connect(false);
      }
    }
    try {
      await this.promiseSocket.write(data);
    } catch {
      this.logger.debug(`[${this.name}] Error when sending data to device, retrying...`);
      await this.send_message_v2(data, retries - 1, true);
    }
  }

  private async send_message_v3(data: Buffer, message_type: TCPMessageType = TCPMessageType.ENCRYPTED_REQUEST) {
    const encrypted_data = this.security.encode_8370(data, message_type);
    await this.send_message_v2(encrypted_data);
  }

  public async build_send(command: MessageRequest) {
    const data = command.serialize();
    const message = new PacketBuilder(this.id, data).finalize();
    await this.send_message(message);
  }

  public async refresh_status(wait_response = false, ignore_unsupported = false) {
    this.logger.debug(`[${this.name}] Refreshing status...`);
    const commands = this.build_query();
    if (this._sub_type === undefined) {
      commands.unshift(new MessageQuerySubtype(this.type));
    }
    try {
      let error_cnt = 0;
      for (const cmd of commands) {
        if (ignore_unsupported || !this.unsupported_protocol.includes(cmd.constructor.name)) {
          await this.build_send(cmd);
          if (wait_response) {
            try {
              // eslint-disable-next-line no-constant-condition
              while (true) {
                const message = await this.promiseSocket.read();
                if (message.length === 0) {
                  throw new Error(`[${this.name} | refresh_status] Error when receiving data from device.`);
                }
                const result = this.parse_message(message);
                if (result === ParseMessageResult.SUCCESS) {
                  const cmd_idx = this.unsupported_protocol.indexOf(cmd.constructor.name);
                  if (cmd_idx !== -1) {
                    this.unsupported_protocol.splice(cmd_idx, 1);
                  }
                  break;
                } else if (result === ParseMessageResult.PADDING) {
                  continue;
                } else {
                  throw new Error(`[${this.name} | refresh_status] Error when parsing message.`);
                }
              }
            } catch (err) {
              error_cnt++;
              // TODO: handle connection error
              // this.unsupported_protocol.push(cmd.constructor.name);
              this.logger.warn(`[${this.name}] Does not supports the protocol ${cmd.constructor.name}, ignored, error: ${err}`);
            }
          }
        } else {
          error_cnt++;
        }
      }

      if (error_cnt === commands.length) {
        this.logger.error(`[${this.name}] Refresh failed.`);
        return false;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.stack : err;
      if (this.logRecoverableErrors) {
        this.logger.warn(`[${this.name} | refresh_status] Recoverable error:\n${msg}`);
      } else {
        this.logger.debug(`[${this.name} | refresh_status] Recoverable error:\n${msg}`);
      }
      return false;
    }
    return true;
  }

  public preprocess_message(message: Buffer): boolean {
    if (message[9] === MessageType.QUERY_SUBTYPE) {
      const msg = new MessageSubtypeResponse(message);
      this._sub_type = msg.sub_type;
      this.set_subtype();
      this.device_protocol_version = msg.device_protocol_version;
      this.logger.debug(`[${this.name}] Subtype: ${this._sub_type}, device protocol version: ${this.device_protocol_version}`);
      return false;
    }
    return true;
  }

  public parse_message(message: Buffer) {
    let messages: Buffer[];
    if (this.verbose) {
      this.logger.debug(`[${this.name}] Raw data to parse:\n${message.toString('hex')}`);
    }
    if (this.version === ProtocolVersion.V3) {
      [messages, this.buffer] = this.security.decode_8370(Buffer.concat([this.buffer, message]));
    } else {
      [messages, this.buffer] = this.fetch_v2_message(Buffer.concat([this.buffer, message]));
    }
    if (message.length === 0) {
      return ParseMessageResult.PADDING;
    }

    for (const msg of messages) {
      if (msg.toString('utf8') === 'ERROR') {
        return ParseMessageResult.ERROR;
      }
      const payload_length = msg[4] + (msg[5] << 8) - 56;
      const payload_type = msg[2] + (msg[3] << 8);
      if (this.verbose) {
        this.logger.debug(
          `[${this.name}] Msg to process. Length: ${payload_length} (0x${payload_length.toString(
            16,
          )}), Type: ${payload_type} (0x${payload_type.toString(16)})\n${msg.toString('hex')}`,
        );
      }
      if ([0x1001, 0x0001].includes(payload_type)) {
        // Heartbeat
        if (this.verbose) {
          this.logger.debug(`[${this.name}] Heartbeat:\n${msg.toString('hex')}`);
        }
      } else if (msg.length > 56) {
        const cryptographic = msg.subarray(40, -16);
        if (payload_length % 16 === 0) {
          const decrypted = this.security.aes_decrypt(cryptographic);
          if (this.preprocess_message(decrypted)) {
            if (this.verbose) {
              this.logger.debug(`[${this.name}] Decrypted data to parse:\n${decrypted.toString('hex')}`);
            }
            this.process_message(decrypted);
          }
        } else {
          if (this.logRecoverableErrors) {
            this.logger.warn(`[${this.name}] Invalid payload length: ` + `${payload_length} (0x${payload_length.toString(16)})`);
          } else {
            this.logger.debug(`[${this.name}] Invalid payload length: ` + `${payload_length} (0x${payload_length.toString(16)})`);
          }
        }
      } else {
        this.logger.warn(`[${this.name}] Illegal message.`);
      }
    }
    return ParseMessageResult.SUCCESS;
  }

  public async send_command(command_type: MessageType, command_body: Buffer) {
    const cmd = new MessageQuestCustom(this.type, command_type, command_body);
    try {
      if (this.verbose) {
        this.logger.debug(`[${this.name}] Send command: ${command_body.toString('hex')}`);
      }
      await this.build_send(cmd);
    } catch (e) {
      this.logger.debug(`[${this.name}]  Interface send_command failure: ${e}, 
                        cmd_type: ${command_type}, 
                        cmd_body: ${command_body.toString('hex')}`);
    }
  }

  public async send_heartbeat() {
    const message = new PacketBuilder(this.id, Buffer.alloc(0)).finalize(0);
    await this.send_message(message);
  }

  protected async update(values: DeviceAttributeBase) {
    this.logger.info(`[${this.name}] Status change: ${JSON.stringify(values)}`);
    this.emit('update', values);
  }

  public open() {
    if (!this.is_running) {
      this.is_running = true;
      this.run();
    }
  }

  public close() {
    if (this.is_running) {
      this.is_running = false;
      this.close_socket();
    }
  }

  private close_socket() {
    this.unsupported_protocol = [];
    this.buffer = Buffer.alloc(0);
    if (this.promiseSocket) {
      this.promiseSocket.destroy();
    }
  }

  /*********************************************************************
   * run
   * Continuous loop that runs listening for network traffic from the device
   * and proceses each message as received.
   */
  private async run() {
    this.logger.info(`[${this.name}] Starting network listener.`);
    while (this.is_running) {
      while (this.promiseSocket.destroyed) {
        if (this.logRecoverableErrors) {
          this.logger.info(`[${this.name}] Create new socket, reconnect`);
        } else {
          this.logger.debug(`[${this.name}] Create new socket, reconnect`);
        }
        this.promiseSocket = new PromiseSocket(this.logger, this.logRecoverableErrors);
        await this.connect(true); // need to refresh_status on connect as we reset start time below.
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
        await sleep(5000);
      }
      let timeout_counter = 0;
      const start = Date.now(); // milliseconds
      let previous_refresh = start;
      let previous_heartbeat = start;
      while (!this.promiseSocket.destroyed) {
        try {
          const now = Date.now();
          if (0 < this.refresh_interval && this.refresh_interval <= now - previous_refresh) {
            this.refresh_status();
            previous_refresh = now;
          } else if (now - previous_heartbeat >= this.heartbeat_interval) {
            this.send_heartbeat();
            previous_heartbeat = now;
          }
          // We wait up to one second for a message, in effect we cause the while loop
          // we are in to itterate once a second... allowing us to check for heartbeat
          // and refresh intervals (above).
          this.promiseSocket.setTimeout(this.SOCKET_TIMEOUT);
          const msg = await this.promiseSocket.read();
          if (msg.length > 0) {
            const result = this.parse_message(msg);
            if (result === ParseMessageResult.ERROR) {
              this.logger.debug(`[${this.name} | run] Error return from ParseMessageResult.`);
              break;
            } else if (result === ParseMessageResult.SUCCESS) {
              timeout_counter = 0;
            }
          } else {
            timeout_counter++;
            if (timeout_counter > 120 / (this.SOCKET_TIMEOUT / 1000)) {
              // we've looped for ~two minutes and not received a successful response
              // to heartbeat or status refresh.  Therefore something must be broken.
              if (this.logRecoverableErrors) {
                this.logger.warn(`[${this.name} | run] Heartbeat timeout, closing.`);
              } else {
                this.logger.debug(`[${this.name} | run] Heartbeat timeout, closing.`);
              }
              this.close_socket();
              // We break out of inner loop, but within outer loop we will attempt to
              // reopen the socket and continue.
              break;
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.stack : e;
          if (this.logRecoverableErrors) {
            this.logger.warn(`[${this.name} | run] Error reading from socket:\n${msg}`);
          } else {
            this.logger.debug(`[${this.name} | run] Error reading from socket:\n${msg}`);
          }
        }
      }
    }
    this.logger.info(`[${this.name}] Stopping network listener.`);
  }
}

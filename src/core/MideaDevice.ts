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
import { type DeviceInfo, type DeviceType, ParseMessageResult, ProtocolVersion, TCPMessageType } from './MideaConstants.js';
import { MessageQuerySubtype, MessageQuestCustom, type MessageRequest, MessageSubtypeResponse, MessageType } from './MideaMessage.js';
import PacketBuilder from './MideaPacketBuilder.js';
import { type KeyToken, LocalSecurity } from './MideaSecurity.js';
import { PromiseSocket } from './MideaUtils.js';

export type DeviceAttributeBase = {
  [key: string]: number | number[] | string | boolean | boolean[] | Buffer | undefined;
};

export default abstract class MideaDevice extends EventEmitter {
  private readonly SOCKET_TIMEOUT = 1000; // milliseconds
  private readonly HEARTBEAT_TIMEOUT = 120_000; // milliseconds — force reconnect if no valid response arrives
  private readonly RECONNECT_INTERVAL = 5000; // milliseconds — backoff between reconnect attempts

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
  private _authenticated = false;

  private unsupported_protocol: string[] = [];
  protected device_protocol_version = 0;

  protected refresh_interval: number;
  protected heartbeat_interval: number;
  protected verbose: boolean;
  protected logRecoverableErrors: boolean;
  protected logRefreshStatusErrors: boolean;

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

    this._sub_type = configDev.advanced_options.sub_type;

    this.verbose = configDev.advanced_options.verbose;
    this.logRecoverableErrors = configDev.advanced_options.logRecoverableErrors;
    this.logRefreshStatusErrors = configDev.advanced_options.logRefreshStatusErrors;

    this.logger.debug(`[${this.name}] Device specific verbose debug logging is set to ${configDev.advanced_options.verbose}`);
    this.logger.debug(`[${this.name}] Device specific log recoverable errors is set to ${configDev.advanced_options.logRecoverableErrors}`);

    this.refresh_interval = config.refreshInterval * 1000; // convert to miliseconds
    this.heartbeat_interval = config.heartbeatInterval * 1000;

    this.security = new LocalSecurity();
    this.buffer = Buffer.alloc(0);

    this.promiseSocket = new PromiseSocket(this.logger, this.logRecoverableErrors);
  }

  get sub_type(): number {
    return this._sub_type ?? 0;
  }

  public setCredentials(token: KeyToken, key: KeyToken) {
    this.token = token;
    this.key = key;
  }

  public fetch_v2_message(messageToProcess: Buffer): [Buffer[], Buffer] {
    const result: Buffer[] = [];
    let message = messageToProcess;
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
    this.logger.debug(`Connecting to device ${this.name} (${this.ip}:${this.port})...`);
    if (await this.establishSocket(refresh_status)) {
      // Start listening for network traffic
      this.open();
      return true;
    }
    // Do NOT start the run loop with a broken connection — clean up instead
    this.logger.error(`[${this.name}] Failed to connect to device (${this.ip}:${this.port}).`);
    this.close_socket();
    return false;
  }

  /**
   * Create a fresh socket, connect, authenticate (V3) and optionally send the
   * initial status query. Shared by connect() and the run() reconnect loop.
   * Returns true on success; on failure the socket is torn down and false is
   * returned (callers decide how loudly to log and whether to retry).
   */
  private async establishSocket(refresh_status: boolean): Promise<boolean> {
    this.promiseSocket = new PromiseSocket(this.logger, this.logRecoverableErrors);
    try {
      await this.promiseSocket.connect(this.port, this.ip);
      this.promiseSocket.setTimeout(this.SOCKET_TIMEOUT);
      if (this.version === ProtocolVersion.V3) {
        await this.authenticate();
      }
      if (refresh_status) {
        // Send queries without waiting for synchronous responses.
        // The network listener will pick up the device's responses asynchronously.
        await this.refresh_status(false);
      }
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.stack : err;
      this.logger.debug(`[${this.name}] Connection attempt failed (${this.ip}:${this.port}):\n${msg}`);
      this._authenticated = false;
      this.promiseSocket.destroy();
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async authenticate() {
    if (!(this.token && this.key)) {
      this._authenticated = false;
      throw new Error('Token or key is missing!');
    }

    try {
      const request = this.security.encode_8370(this.token, TCPMessageType.HANDSHAKE_REQUEST);
      await this.promiseSocket.write(request);
      const response = await this.promiseSocket.read();

      if (response) {
        if (response.length < 20) {
          this._authenticated = false;
          throw Error(`Authenticate error when receiving data from ${this.ip}:${this.port}. (Data length mismatch)`);
        }
        const resp = response.subarray(8, 72);
        this.security.tcp_key_from_resp(resp, this.key);
        this._authenticated = true;
        if (this.logRecoverableErrors) {
          this.logger.info(`[${this.name}] Authentication success.`);
        } else {
          this.logger.debug(`[${this.name}] Authentication success.`);
        }
      } else {
        this._authenticated = false;
        throw Error(`Authenticate error when receiving data from ${this.ip}:${this.port}.`);
      }
    } catch (err) {
      this._authenticated = false;
      throw err;
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

  private async send_message_v2(data: Buffer, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      if (this.promiseSocket.destroyed) {
        if (this.is_running) {
          // run() owns the socket lifecycle and is (re)connecting — wait for it
          // to restore the socket rather than racing it with a second connection.
          await this.sleep(this.SOCKET_TIMEOUT);
        } else {
          // No listener loop is active — bootstrap a fresh connection ourselves.
          await this.connect(false);
        }
      }
      try {
        await this.promiseSocket.write(data);
        return;
      } catch (err) {
        this.logger.debug(`[${this.name}] Error when sending data to device (attempt ${attempt}/${retries}): ${err}`);
      }
    }
    throw new Error(`[${this.name} | send_message] Error when sending data to device.`);
  }

  private async send_message_v3(data: Buffer, message_type: TCPMessageType = TCPMessageType.ENCRYPTED_REQUEST) {
    if (!this._authenticated) {
      this.logger.warn(`[${this.name}] Cannot send V3 message — not authenticated. Dropping message.`);
      return;
    }
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
                }
                if (result === ParseMessageResult.PADDING) {
                  continue;
                }
                throw new Error(`[${this.name} | refresh_status] Error when parsing message.`);
              }
            } catch (err) {
              error_cnt++;
              // TODO: handle connection error
              // this.unsupported_protocol.push(cmd.constructor.name);
              if (this.logRefreshStatusErrors) {
                this.logger.warn(`[${this.name}] Does not supports the protocol ${cmd.constructor.name}, ignored, error: ${err}`);
              } else {
                this.logger.debug(`[${this.name}] Does not supports the protocol ${cmd.constructor.name}, ignored, error: ${err}`);
              }
            }
          }
        } else {
          error_cnt++;
        }
      }

      if (error_cnt === commands.length) {
        this.emit('error_refresh');
        if (this.logRefreshStatusErrors) {
          this.logger.error(`[${this.name}] Refresh failed.`);
        } else {
          this.logger.debug(`[${this.name}] Refresh failed.`);
        }
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
      this.logger.debug(`[${this.name}] Subtype: ${this.sub_type}, device protocol version: ${this.device_protocol_version}`);
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
          const cont = this._sub_type === undefined ? this.preprocess_message(decrypted) : true;
          if (cont) {
            if (this.verbose) {
              this.logger.debug(`[${this.name}] Decrypted data to parse:\n${decrypted.toString('hex')}`);
            }
            this.process_message(decrypted);
          }
        } else {
          if (this.logRecoverableErrors) {
            this.logger.warn(`[${this.name}] Invalid payload length: ${payload_length} (0x${payload_length.toString(16)})`);
          } else {
            this.logger.debug(`[${this.name}] Invalid payload length: ${payload_length} (0x${payload_length.toString(16)})`);
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
    if (this.verbose) {
      this.logger.info(`[${this.name}] Status change: ${JSON.stringify(values)}`);
    }
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
    this._authenticated = false;
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
      // (Re)establish the socket if it is down. On first entry the socket is
      // already connected (from connect()), so this block is skipped.
      if (this.promiseSocket.destroyed) {
        if (this.logRecoverableErrors) {
          this.logger.info(`[${this.name}] Create new socket, reconnect`);
        } else {
          this.logger.debug(`[${this.name}] Create new socket, reconnect`);
        }
        if (!(await this.establishSocket(true))) {
          if (this.logRecoverableErrors) {
            this.logger.warn(`[${this.name}] Reconnect failed.`);
          } else {
            this.logger.debug(`[${this.name}] Reconnect failed.`);
          }
          if (this.is_running) {
            await this.sleep(this.RECONNECT_INTERVAL);
          }
          continue;
        }
        if (this.logRecoverableErrors) {
          this.logger.info(`[${this.name}] Reconnected successfully.`);
        } else {
          this.logger.debug(`[${this.name}] Reconnected successfully.`);
        }
      }

      // Capture the socket for this connection. run() is the sole owner of the
      // socket lifecycle while is_running, so this reference stays valid for the
      // whole for-await loop below.
      const socket = this.promiseSocket;
      // Disable the poll timeout: heartbeat/refresh run on their own timers and
      // the watchdog handles staleness, so reads can block until data arrives.
      socket.setTimeout(0);

      const connectedAt = Date.now();
      const activity = { last: connectedAt };
      const timers: NodeJS.Timeout[] = [];
      if (this.heartbeat_interval > 0) {
        timers.push(
          setInterval(() => {
            this.send_heartbeat().catch((e) => this.logger.debug(`[${this.name}] Heartbeat failed: ${e}`));
          }, this.heartbeat_interval),
        );
      }
      if (this.refresh_interval > 0) {
        timers.push(
          setInterval(() => {
            this.refresh_status().catch((e) => this.logger.debug(`[${this.name}] Refresh failed: ${e}`));
          }, this.refresh_interval),
        );
      }
      // Watchdog: if no valid response arrives within HEARTBEAT_TIMEOUT, assume
      // the connection is broken and destroy the socket, which ends the loop below.
      timers.push(
        setInterval(() => {
          if (Date.now() - activity.last > this.HEARTBEAT_TIMEOUT) {
            if (this.logRecoverableErrors) {
              this.logger.warn(`[${this.name} | run] Heartbeat timeout, closing.`);
            } else {
              this.logger.debug(`[${this.name} | run] Heartbeat timeout, closing.`);
            }
            socket.destroy();
          }
        }, this.SOCKET_TIMEOUT),
      );

      try {
        for await (const msg of socket) {
          const result = this.parse_message(msg);
          if (result === ParseMessageResult.ERROR) {
            this.logger.debug(`[${this.name} | run] Error return from ParseMessageResult.`);
            break;
          }
          if (result === ParseMessageResult.SUCCESS) {
            activity.last = Date.now();
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.stack : e;
        if (this.logRecoverableErrors) {
          this.logger.warn(`[${this.name} | run] Error reading from socket:\n${msg}`);
        } else {
          this.logger.debug(`[${this.name} | run] Error reading from socket:\n${msg}`);
        }
      } finally {
        for (const timer of timers) {
          clearInterval(timer);
        }
      }

      // The socket has ended (closed, errored, or watchdog fired). Reset the
      // per-connection state and let the outer loop reconnect.
      this._authenticated = false;
      this.unsupported_protocol = [];
      this.buffer = Buffer.alloc(0);
      socket.destroy();

      // Back off only if the connection was short-lived, so a flapping device
      // doesn't churn while a long-lived connection still recovers promptly.
      const uptime = Date.now() - connectedAt;
      if (this.is_running && uptime < this.RECONNECT_INTERVAL) {
        await this.sleep(this.RECONNECT_INTERVAL - uptime);
      }
    }
    this.logger.info(`[${this.name}] Stopping network listener.`);
  }
}

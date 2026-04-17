import type { Logger } from 'homebridge';
import { Endianness } from './MideaConstants.js';
export declare function numberToUint8Array(inputNum: number, byte_length: number, endianness: Endianness): Uint8Array;
export declare function strxor(a: Buffer, b: Buffer): Buffer;
export declare function calculate(data: Buffer): number;
/*********************************************************************
 * PromiseSocket
 * A very basic implementation of promise-wrapped Socket
 *
 */
export declare class PromiseSocket {
    private readonly logger;
    private readonly logerror;
    private innerSok;
    destroyed: boolean;
    constructor(logger: Logger, logerror: boolean);
    connect(port: number, host: string): Promise<void>;
    setTimeout(t: number): void;
    destroy(): void;
    write(data: string | Buffer, encoding?: BufferEncoding): Promise<void>;
    read(): Promise<Buffer>;
}

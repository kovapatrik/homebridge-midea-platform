export default class PacketBuilder {
    private readonly command;
    private readonly security;
    private packet;
    constructor(device_id: number, command: Buffer);
    finalize(message_type?: number): Buffer;
    static packet_time(): Buffer;
    static checksum(data: Buffer): number;
}

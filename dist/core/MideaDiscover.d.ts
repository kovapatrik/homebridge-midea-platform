import EventEmitter from 'node:events';
import type { Logger } from 'homebridge';
export default class Discover extends EventEmitter {
    private readonly logger;
    private socket;
    private readonly xml_parser;
    private security;
    private ips;
    constructor(logger: Logger);
    /*********************************************************************
     * discoverDeviceByIP
     * Sends discover message to a single IP address.  Will resend the message
     * an additional "retries" times spaced by 3 seconds if the target IP
     * address has not responded (recorded in the above callback).
     */
    discoverDeviceByIP(ip: string, retries?: number, timeout?: number): void;
    /*********************************************************************
     * ifBroadcastAddrs
     * Broadcasts to 255.255.255.255 only gets sent out on the first network inteface.
     * This function finds all network interfaces and returns the broadcast address
     * for each in an array, e.g. ['192.168.1.255', '192.168.100.255'].  If there are
     * multiple interfaces this will cause broadcast to be sent out on each interface
     * so all appliances are properly discovered.
     */
    private ifBroadcastAddrs;
    /*********************************************************************
     * startDiscover
     * Sends broadcast to network discover Midea devices. Will continue sending
     * up to an additional "retries" times each spaced by 3 seconds.
     */
    startDiscover(retries?: number, timeout?: number): void;
    private getDeviceVersion;
    private getDeviceInfo;
}

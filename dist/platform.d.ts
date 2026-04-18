/***********************************************************************
 * Midea Homebridge platform initialization
 *
 * Copyright (c) 2023 Kovalovszky Patrik, https://github.com/kovapatrik
 * Portions Copyright (c) 2023 David Kerr, https://github.com/dkerr64
 *
 * Based on https://github.com/homebridge/homebridge-plugin-template
 *
 */
import type { API, Characteristic, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service } from 'homebridge';
type MideaContext = {
    token: string;
    key: string;
    id: string;
    type: string;
    sn: string;
    model: string;
    serviceVersion: number;
    configuredNames: {
        [key: string]: string;
    };
    thresholds: {
        [key: string]: number;
    };
};
export type MideaAccessory = PlatformAccessory<MideaContext>;
export declare class MideaPlatform implements DynamicPlatformPlugin {
    readonly log: Logger;
    readonly config: PlatformConfig;
    readonly api: API;
    readonly Service: typeof Service;
    readonly Characteristic: typeof Characteristic;
    readonly accessories: Map<string, MideaAccessory>;
    readonly discoveredCacheUUIDs: string[];
    private discoveredDevices;
    private discoveryInterval;
    private readonly discover;
    private readonly platformConfig;
    constructor(log: Logger, config: PlatformConfig, api: API);
    /*********************************************************************
     * finishedLaunching
     * Function called when Homebridge has finished loading the plugin.
     */
    private finishedLaunching;
    /*********************************************************************
     * deviceDiscovered
     * Function called by the 'device' on handler.
     */
    private deviceDiscovered;
    /*********************************************************************
     * discoveryComplete
     * Function called by the 'complete' on handler.
     */
    private discoveryComplete;
    /*********************************************************************
     * addDevice
     * Called for each device as discovered on the network.  Creates the
     * Midea device handler and the associated Homebridge accessory.
     */
    private addDevice;
    /**
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * It should be used to setup event handlers for characteristics and update respective values.
     */
    configureAccessory(accessory: PlatformAccessory): void;
}
export {};

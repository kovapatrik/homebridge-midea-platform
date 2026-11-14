import assert from 'node:assert/strict';
import test from 'node:test';
import * as hap from '@homebridge/hap-nodejs';
import AirConditionerAccessory from '../src/accessory/AirConditionerAccessory.ts';
import { DeviceType, ProtocolVersion } from '../src/core/MideaConstants.ts';
import MideaACDevice from '../src/devices/ac/MideaACDevice.ts';
import { defaultConfig, defaultDeviceConfig } from '../src/platformUtils.ts';

const CONSUMPTION_UUID = 'E863F10D-079E-48FF-8F27-9C2605A29F52';
const TOTAL_CONSUMPTION_UUID = 'E863F10C-079E-48FF-8F27-9C2605A29F52';

const logger = {
  debug() {},
  error() {},
  info() {},
  warn() {},
};

const platform = { Service: hap.Service, Characteristic: hap.Characteristic, api: { hap }, log: logger };

function createDevice() {
  return new MideaACDevice(
    logger,
    {
      ip: '127.0.0.1',
      port: 6444,
      id: 1,
      model: 'test',
      sn: 'test',
      name: 'Test AC',
      type: DeviceType.AIR_CONDITIONER,
      version: ProtocolVersion.V3,
    },
    structuredClone(defaultConfig),
    structuredClone(defaultDeviceConfig),
  );
}

function createAccessory(accessory, energyMonitoring) {
  const configDev = structuredClone(defaultDeviceConfig);
  configDev.AC_options.energyMonitoring = energyMonitoring;
  const device = createDevice();
  const acAccessory = new AirConditionerAccessory(platform, accessory, device, configDev);
  return { acAccessory, device, service: accessory.getService(hap.Service.HeaterCooler) };
}

function newPlatformAccessory() {
  const accessory = new hap.Accessory('Test AC', hap.uuid.generate('test-ac'));
  accessory.context = {};
  return accessory;
}

const find = (service, uuid) => service.characteristics.find((c) => c.UUID === uuid);

test('energy characteristics are not exposed by default', () => {
  const { service } = createAccessory(newPlatformAccessory(), false);
  assert.equal(find(service, CONSUMPTION_UUID), undefined);
  assert.equal(find(service, TOTAL_CONSUMPTION_UUID), undefined);
});

test('energy monitoring exposes and updates the Eve characteristics', async () => {
  const { device, service } = createAccessory(newPlatformAccessory(), true);
  const power = find(service, CONSUMPTION_UUID);
  const total = find(service, TOTAL_CONSUMPTION_UUID);
  assert.equal(power?.displayName, 'Consumption');
  assert.equal(total?.displayName, 'Total Consumption');

  // the device stores the decoded values before emitting them, as process_message() does
  const changed = { REALTIME_POWER: 129.9, TOTAL_ENERGY_CONSUMPTION: 4.88 };
  Object.assign(device.attributes, changed);
  device.emit('update', changed);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(power.value, 129.9);
  assert.equal(total.value, 4.88);
});

test('disabling energy monitoring removes the cached characteristics', () => {
  const accessory = newPlatformAccessory();
  createAccessory(accessory, true);
  const { service } = createAccessory(accessory, false);
  assert.equal(find(service, CONSUMPTION_UUID), undefined);
  assert.equal(find(service, TOTAL_CONSUMPTION_UUID), undefined);
});

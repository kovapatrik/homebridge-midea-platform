import type { IHomebridgePluginUi, IHomebridgeUiFormHelper } from '@homebridge/plugin-ui-utils';
import type { PluginSchema } from '@homebridge/plugin-ui-utils/ui.interface';
import Alpine from 'alpinejs';
import { defaultsDeep, isEmpty, isEqual, isPlainObject, transform } from 'lodash-es';
import { type Config, defaultConfig, defaultDeviceConfig } from '../platformUtils.js';

declare const homebridge: IHomebridgePluginUi;

declare global {
  interface Window {
    Alpine: Alpine.Alpine;
  }
}

type DeviceStatus = 'add' | 'update' | 'added' | 'updated' | 'no-credentials' | 'not-supported';

type DeviceRow = {
  id: number;
  name: string;
  type: number;
  sn: string;
  model: string;
  version: number;
  ip: string;
  port: number;
  displayName: string;
  token?: string;
  key?: string;
  tokenShort?: string;
  keyShort?: string;
  status: DeviceStatus;
};

function filterOutDefaults(object: Record<string, unknown>, defaults: Record<string, unknown>): Record<string, unknown> {
  return transform(
    object,
    (acc, value, key) => {
      if (key === 'devices') {
        acc[key] = (value as Record<string, unknown>[]).map((device) => filterOutDefaults(device, defaultDeviceConfig as unknown as Record<string, unknown>));
      } else if (isPlainObject(value)) {
        const nested = filterOutDefaults(value as Record<string, unknown>, (defaults[key] ?? {}) as Record<string, unknown>);
        if (!isEmpty(nested)) acc[key] = nested;
      } else if (!isEqual(value, defaults[key])) {
        acc[key] = value;
      }
    },
    {} as Record<string, unknown>,
  );
}

window.Alpine = Alpine;

Alpine.data('discoverApp', () => {
  let configuration = {} as Config;
  let configSchema = {} as PluginSchema;
  let currentForm: IHomebridgeUiFormHelper | null = null;

  return {
    open: false,

    username: '',
    password: '',
    registeredApp: 'Midea SmartHome (MSmartHome)',
    useDefaultProfile: false,
    ipInput: '',

    devices: [] as DeviceRow[],
    showTable: false,
    resolvedIpAddrs: [] as string[],
    discovering: false,

    luaModal: { show: false, model: '', deviceType: 0, code: '' },

    async init() {
      homebridge.showSpinner();

      const pluginConfig = await homebridge.getPluginConfig();
      configSchema = await homebridge.getPluginConfigSchema();

      if (!pluginConfig.length) pluginConfig.push({});

      configuration = pluginConfig[0] as Config;
      defaultsDeep(configuration, defaultConfig);
      configuration.devices ??= [];
      for (const device of configuration.devices) {
        defaultsDeep(device, defaultDeviceConfig);
      }

      this.createForm();
      homebridge.hideSpinner();

      homebridge.addEventListener('showToast', (event: Event) => {
        const { success, msg } = (event as MessageEvent).data as { success: boolean; msg: string };
        if (success) {
          homebridge.toast.success(msg);
        } else {
          homebridge.toast.error(msg);
        }
      });
    },

    createForm() {
      currentForm?.end();
      currentForm = homebridge.createForm({ schema: configSchema.schema ?? {}, layout: configSchema.layout, form: configSchema.form }, configuration);
      currentForm.onChange(async (changes: Record<string, unknown>) => {
        await homebridge.updatePluginConfig([filterOutDefaults(changes, defaultConfig as unknown as Record<string, unknown>)]);
      });
    },

    async discover() {
      let ipAddrs: string[] = this.ipInput ? this.ipInput.split(/[\s,]+/).filter(Boolean) : [];

      const currentConfig = ((await homebridge.getPluginConfig())[0] ?? {}) as Record<string, unknown>;
      defaultsDeep(currentConfig, defaultConfig);
      (currentConfig.devices as unknown[]) ??= [];
      for (const device of currentConfig.devices as Record<string, unknown>[]) {
        defaultsDeep(device, defaultDeviceConfig);
      }
      configuration = currentConfig as Config;

      for (const d of configuration.devices as Record<string, unknown>[]) {
        const ip = (d.advanced_options as Record<string, unknown>)?.ip as string | undefined;
        if (ip) ipAddrs.push(ip);
      }
      ipAddrs = [...new Set(ipAddrs)];

      const ipRegex = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/i;
      if (ipAddrs.length > 0 && !ipAddrs.every((ip) => ipRegex.test(ip))) {
        homebridge.toast.error('Invalid IP address provided');
        return;
      }

      this.resolvedIpAddrs = ipAddrs;
      this.discovering = true;
      homebridge.showSpinner();

      try {
        await homebridge.request('/login', {
          username: this.username,
          password: this.password,
          registeredApp: this.registeredApp,
          useDefaultProfile: this.useDefaultProfile,
        });

        const discovered = (await homebridge.request('/discover', { ip: ipAddrs.length ? ipAddrs : undefined })) as
          | Omit<DeviceRow, 'status' | 'tokenShort' | 'keyShort'>[]
          | null;

        const existing = configuration.devices as Record<string, unknown>[];

        this.devices = (discovered ?? []).map((device) => {
          const validAuth = (device.token && device.key) || device.version !== 3;
          let status: DeviceStatus;

          if (device.displayName === 'Unknown') {
            status = 'not-supported';
          } else if (!validAuth) {
            status = 'no-credentials';
          } else if (existing.find((d) => d.id === device.id)) {
            status = 'update';
          } else {
            status = 'add';
          }

          return {
            ...device,
            status,
            tokenShort: device.token ? `${device.token.slice(0, 6)}...${device.token.slice(-4)}` : undefined,
            keyShort: device.key ? `${device.key.slice(0, 6)}...${device.key.slice(-4)}` : undefined,
          };
        });

        this.showTable = true;
      } catch (e: unknown) {
        homebridge.toast.error((e as Error).message);
      } finally {
        this.discovering = false;
        homebridge.hideSpinner();
      }
    },

    async addDevice(device: DeviceRow) {
      (configuration.devices as Record<string, unknown>[]).push({
        ...(defaultDeviceConfig as unknown as Record<string, unknown>),
        id: device.id,
        name: device.name,
        type: device.displayName,
        advanced_options: {
          ...(defaultDeviceConfig.advanced_options as Record<string, unknown>),
          ip: this.resolvedIpAddrs.includes(device.ip) ? device.ip : undefined,
          token: device.token,
          key: device.key,
        },
      });
      await homebridge.updatePluginConfig([
        filterOutDefaults(configuration as unknown as Record<string, unknown>, defaultConfig as unknown as Record<string, unknown>),
      ]);
      this.createForm();
      device.status = 'added';
    },

    async updateDevice(device: DeviceRow) {
      const devices = configuration.devices as Record<string, unknown>[];
      const i = devices.findIndex((d) => (d as Record<string, unknown>).id === device.id);
      const opts = (devices[i] as Record<string, unknown>).advanced_options as Record<string, unknown>;
      opts.token = device.token;
      opts.key = device.key;
      opts.ip = opts.ip ? device.ip : undefined;
      await homebridge.updatePluginConfig([
        filterOutDefaults(configuration as unknown as Record<string, unknown>, defaultConfig as unknown as Record<string, unknown>),
      ]);
      this.createForm();
      device.status = 'updated';
    },

    async downloadLua(device: DeviceRow) {
      homebridge.showSpinner();
      try {
        const code = (await homebridge.request('/downloadLua', { deviceType: device.type, deviceSn: device.sn })) as string;
        this.luaModal = { show: true, model: device.model, deviceType: device.type, code };
      } catch (e: unknown) {
        homebridge.toast.error((e as Error).message);
      } finally {
        homebridge.hideSpinner();
      }
    },

    selectLuaCode() {
      const pre = document.getElementById('luaCodePre');
      if (!pre) return;
      const range = document.createRange();
      range.selectNodeContents(pre);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    },
  };
});

Alpine.start();

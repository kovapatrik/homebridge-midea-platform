import type { IHomebridgePluginUi } from '@homebridge/plugin-ui-utils';
import type { PluginFormSchema, PluginSchema } from '@homebridge/plugin-ui-utils/ui.interface';
import { defaultsDeep, isEmpty, isEqual, isPlainObject, transform } from 'lodash-es';
import { type Config, defaultConfig, defaultDeviceConfig } from '../platformUtils.js';

declare const homebridge: IHomebridgePluginUi;
declare const bootstrap: { Modal: new (el: HTMLElement) => { show(): void } };

(async () => {
  homebridge.showSpinner();

  const pluginConfig = await homebridge.getPluginConfig();
  const configSchema = await homebridge.getPluginConfigSchema();

  if (!pluginConfig.length) {
    pluginConfig.push({});
  }

  let configuration = pluginConfig[0] as Config;

  defaultsDeep(configuration, defaultConfig);
  configuration.devices ??= [];
  for (const device of configuration.devices) {
    defaultsDeep(device, defaultDeviceConfig);
  }

  homebridge.hideSpinner();

  function debugLog(s: string) {
    if (configuration.uiDebug) {
      console.debug(s);
    }
  }

  debugLog(`Plugin Config:\n${JSON.stringify(configuration, null, 2)}`);

  homebridge.addEventListener('showToast', (event: Event) => {
    const data = (event as MessageEvent).data as { success: boolean; msg: string };
    debugLog(`showToast Received: ${JSON.stringify(data)}`);
    if (data.success) {
      homebridge.toast.success(data.msg);
    } else {
      homebridge.toast.error(data.msg);
    }
  });

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

  function createForm(schema: PluginSchema, config: Record<string, unknown>) {
    const configForm = homebridge.createForm(schema, config);
    configForm.onChange(async (changes: Record<string, unknown>) => {
      const filtered = filterOutDefaults(changes, defaultConfig as unknown as Record<string, unknown>);
      debugLog(`[createForm] Config changes:\n${JSON.stringify(filtered, null, 2)}`);
      await homebridge.updatePluginConfig([filtered]);
    });
  }

  createForm(configSchema, configuration);

  const main = document.getElementById('main') as HTMLElement;
  const loginSection = document.getElementById('login') as HTMLElement;

  document.getElementById('useDefaultProfile')?.addEventListener('change', (e) => {
    if ((e.target as HTMLInputElement).checked === true) {
      loginSection.classList.add('disabled');
    } else {
      loginSection.classList.remove('disabled');
    }
  });

  document.getElementById('discoverBtn')?.addEventListener('click', async (e) => {
    e.preventDefault();

    const username = (document.getElementById('username') as HTMLInputElement).value;
    const password = (document.getElementById('password') as HTMLInputElement).value;
    const registeredApp = (document.getElementById('registeredApp') as HTMLSelectElement).value;
    const useDefaultProfile = (document.getElementById('useDefaultProfile') as HTMLInputElement).checked === true;

    const ipInput = (document.getElementById('ip') as HTMLInputElement).value;
    let ipAddrs: string[] = ipInput ? ipInput.split(/[\s,]+/) : [];

    homebridge.showSpinner();

    console.info('Request login...');
    await homebridge.request('/login', { username, password, registeredApp, useDefaultProfile });

    const table = document.getElementById('discoverTable')?.getElementsByTagName('tbody')[0];
    table.innerHTML = '';

    const currentConfig: Record<string, any> = await homebridge.getPluginConfig().then((c) => c[0] ?? {});

    defaultsDeep(currentConfig, defaultConfig);
    currentConfig.devices = (currentConfig.devices as unknown[]) || [];
    for (const device of currentConfig.devices as Record<string, unknown>[]) {
      defaultsDeep(device, defaultDeviceConfig);
    }
    configuration = currentConfig;

    configuration.devices.forEach((d: Record<string, any>) => {
      if (d['advanced_options']?.ip) ipAddrs.push(d['advanced_options'].ip as string);
    });
    ipAddrs = [...new Set(ipAddrs)];

    const validIPs = ipAddrs.every((ip) => {
      const regexIPv4 = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/gi;
      return regexIPv4.test(ip);
    });
    if (!validIPs) {
      homebridge.toast.error('Invalid IP address provided');
      return;
    }

    console.info('Request device discovery...');
    debugLog(`Specific IP addresses: ${JSON.stringify(ipAddrs)}`);
    const devices = (await homebridge.request('/discover', { ip: ipAddrs.length ? ipAddrs : undefined })) as Record<string, any>[] | null;
    debugLog(`Discovered devices:\n${JSON.stringify(devices, null, 2)}`);

    configuration.devices = configuration.devices || [];
    if (devices) {
      devices.forEach((device: Record<string, any>) => {
        const validAuth = (device['token'] && device['key']) || device['version'] !== 3;
        const tr = table.insertRow();
        const td = tr.insertCell();
        td.appendChild(document.createTextNode(device['name'] as string));
        td.setAttribute('scope', 'row');

        tr.insertCell().appendChild(document.createTextNode(device['displayName'] as string));

        const modelCell = tr.insertCell();
        const download_btn = document.createElement('button');
        download_btn.innerText = device['model'] as string;
        download_btn.className = 'btn btn-outline-secondary btn-sm';
        download_btn.addEventListener('click', async () => {
          try {
            homebridge.showSpinner();
            const file_data_str = (await homebridge.request('/downloadLua', { deviceType: device['type'], deviceSn: device['sn'] })) as string;

            const modal = document.createElement('div');
            modal.className = 'modal fade';
            modal.id = 'luaCodeModal';
            modal.setAttribute('tabindex', '-1');
            modal.setAttribute('aria-labelledby', 'luaCodeModalLabel');
            modal.setAttribute('aria-hidden', 'true');

            modal.innerHTML = `
                <div class="modal-dialog modal-lg modal-dialog-scrollable">
                  <div class="modal-content">
                    <div class="modal-header">
                      <h5 class="modal-title" id="luaCodeModalLabel">Lua Code for ${device['model'] as string}</h5>
                      <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                      <div class="mb-3 btn-toolbar">
                        <div class="btn-group me-2">
                          <button id="selectAllLuaBtn" class="btn btn-secondary">Select All</button>
                        </div>
                        <small class="text-warning ms-2 align-self-center">Save this as ${(device['type'] as number).toString(16)}_${device['model'] as string}.lua</small>
                      </div>
                      <pre id="luaCodePre"><code style="color: var(--bs-body-color);">${file_data_str}</code></pre>
                    </div>
                    <div class="modal-footer">
                      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                  </div>
                </div>
              `;

            main.appendChild(modal);

            const bootstrapModal = new bootstrap.Modal(modal);
            bootstrapModal.show();

            document.getElementById('selectAllLuaBtn')!.addEventListener('click', () => {
              const codeElement = document.getElementById('luaCodePre')!;
              const selection = window.getSelection()!;
              const range = document.createRange();
              range.selectNodeContents(codeElement);
              selection.removeAllRanges();
              selection.addRange(range);
            });

            modal.addEventListener('hidden.bs.modal', () => {
              main.removeChild(modal);
            });

            homebridge.hideSpinner();
          } catch (e: unknown) {
            homebridge.hideSpinner();
            homebridge.toast.error((e as Error).message);
          }
        });

        modelCell.appendChild(download_btn);

        tr.insertCell().appendChild(document.createTextNode(String(device['id'])));
        tr.insertCell().appendChild(document.createTextNode(String(device['version'])));
        if (device['version'] === 3) {
          tr.insertCell().appendChild(
            document.createTextNode(
              (device['token'] ? String(device['token']).slice(0, 6) + '...' + String(device['token']).slice(-4) : 'token missing') +
                '\n' +
                (device['key'] ? String(device['key']).slice(0, 6) + '...' + String(device['key']).slice(-4) : 'key missing'),
            ),
          );
        } else {
          tr.insertCell().appendChild(document.createTextNode('not needed'));
        }
        tr.insertCell().appendChild(document.createTextNode(device['ip'] as string));

        const addCell = tr.insertCell();
        if (device['displayName'] === 'Unknown') {
          addCell.appendChild(document.createTextNode('Not supported!\nDownload the Lua file and attach it to a GitHub issue.'));
        } else if (!validAuth) {
          addCell.appendChild(document.createTextNode('No credentials'));
        } else if ((configuration.devices as Record<string, any>[]).find((d) => d['id'] === device['id'])) {
          const button = document.createElement('button');
          button.innerText = 'Update';
          button.className = 'btn btn-outline-secondary btn-sm';
          button.addEventListener('click', async () => {
            const devices = configuration.devices as Record<string, any>[];
            const i = devices.findIndex((o) => o['id'] === device['id']);
            devices[i]['advanced_options']['token'] = device['token'];
            devices[i]['advanced_options']['key'] = device['key'];
            devices[i]['advanced_options']['ip'] = devices[i]['advanced_options']['ip'] ? device['ip'] : undefined;
            createForm(configSchema, configuration);

            addCell.removeChild(button);
            addCell.appendChild(document.createTextNode('Updated'));
            homebridge.toast.success('Device Updated');
          });
          addCell.appendChild(button);
        } else {
          const button = document.createElement('button');
          button.innerText = 'Add';
          button.className = 'btn btn-secondary btn-sm';
          button.addEventListener('click', async () => {
            const newDevice = {
              id: device['id'],
              name: device['name'],
              type: device['displayName'],
              advanced_options: {
                ...(defaultDeviceConfig.advanced_options as Record<string, unknown>),
                ip: ipAddrs.includes(device['ip'] as string) ? device['ip'] : undefined,
                token: device['token'],
                key: device['key'],
              },
            };

            (configuration.devices as Record<string, unknown>[]).push({
              ...(defaultDeviceConfig as unknown as Record<string, unknown>),
              ...newDevice,
            });
            debugLog(`Adding new device:\n${JSON.stringify({ ...(defaultDeviceConfig as object), ...newDevice }, null, 2)}`);
            createForm(configSchema, configuration);

            addCell.removeChild(button);
            addCell.appendChild(document.createTextNode('Added'));
            homebridge.toast.success('Device added');
          });
          addCell.appendChild(button);
        }
      });
    } else {
      table.innerHTML += '<tr><td>No devices found!</td></tr>';
    }
    document.getElementById('discoverTableWrapper')!.style.display = 'block';
    homebridge.hideSpinner();
  });
})();

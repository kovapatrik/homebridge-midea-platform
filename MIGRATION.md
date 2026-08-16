### Migration Guide to @jouskaio/homebridge-midea-portasplit

To make your modifications permanent and prevent Homebridge from overwriting your plugin during an official version update, we have renamed the plugin to `@jouskaio/homebridge-midea-portasplit`.

#### 1. Official Installation

The plugin is now officially available on npm. You can install it directly from the Homebridge interface:

1. Go to the **Plugins** tab.
2. Search for `@jouskaio/homebridge-midea-portasplit`.
3. Click **Install**.

Alternatively, via the command line on your server:

```bash
sudo npm install -g @jouskaio/homebridge-midea-portasplit
```

#### 2. Cleaning up the old version

On your Homebridge server (via SSH), it is recommended to delete the old official version to avoid any conflict:

```bash
sudo hb-service uninstall homebridge-midea-platform
```

_(Or `npm uninstall -g homebridge-midea-platform` if you are not using hb-service)_

#### 3. Homebridge Configuration

Your `config.json` file already uses `midea-platform` as the platform alias. Since this name has not changed, the new plugin should pick up your configuration automatically.

#### 4. HomeKit (Important)

Changing the plugin name may cause your devices to reappear in HomeKit as new accessories.

- If your devices disappear, they will likely be in the "Default Room" of the Home app.
- You will need to move them back to their respective rooms and potentially recreate your linked scenes/automations.

This is a one-time necessary step to ensure that no future official updates will overwrite your work.

# Homebridge Midea-Platform Plugin
<!--
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
 -->
[![npm](https://badgen.net/npm/v/homebridge-midea-platform/latest?icon=npm&label)](https://www.npmjs.com/package/homebridge-midea-platform)
[![npm](https://badgen.net/npm/dt/homebridge-midea-platform?label=downloads)](https://www.npmjs.com/package/homebridge-midea-platform)

*Unofficial* plugin for Midea. This is implemented by building on the Homebridge platform plugin template and the work done by [@georgezhao2010](https://github.com/georgezhao2010) in the [midea_ac_lan](https://github.com/georgezhao2010/midea_ac_lan) project for Home Assistant.

**Warning** this plugin is new and not fully tested for all devices.

Pull requests and/or other offers of development assistance gratefully received.

## Features

Currently supports the following devices:

* Air Conditioner (0xAC)
* Humidifier (0xA1)

## Installation

**Option 1: Install via Homebridge Config UI X:**

Search for "midea" in [homebridge-config-ui-x](https://github.com/oznu/homebridge-config-ui-x) and install `homebridge-midea-platform`.

**Option 2: Manually Install:**

```text
sudo npm install -g homebridge-midea-platform
```

Midea device status is retrieved over your Local Area Network (LAN) and credentials are obtained from the Midea cloud services over the internet. While the plugin maintains a status cache, **use of Homebridge [child bridge](https://github.com/homebridge/homebridge/wiki/Child-Bridges)** is strongly encouraged. As noted below in the *network resiliency* section, this plugin will make multiple attempts to fulfill a request if necessary, which can take time.

## Configuration

### Homebridge Config UI X

[Homebridge Config UI X](https://github.com/oznu/homebridge-config-ui-x) is the easiest and **strongly recommended** way to configure this plugin.

## Device Discovery

Credentials for each Midea device on your Local Area Network (LAN) must be retrieved from Midea cloud server, this is done through the Settings window in the Homebridge Config User Interface.  On opening the settings window, click on *Discover Devices* and enter the requested information.

* **Registered app** *(required)*: Name of the Midea mobile app that you registered your userid and password with.  Defaults to *Midea SmartHome (MSmartHome)*, but you can also select *NetHome Plus* or *Meiju*.
* **Username** *(required)*: Email address / userid that you use to login to the Midea cloud service.
* **Password** *(required)*: Password for Midea cloud service

On clicking *Discover All Devices* the plugin sends a message to the broadcast address for the subnet of each network interface attached to the Homebridge server.  Midea devices attached to the network will respond.  Network discovery is repeated multiple times (currently 4 times at interval of 2 seconds between each).  At the end of the process details of all devices discovered are listed in the Settings window.  From there, you can add new devices or update the *token/key* credentials for existing devices.  You can then edit details for each device (for example change the name).

If your Midea device is not connected to the same LAN subnet as your Homebridge server then you must manually add the IP address of each device in config settings. You can do this in the plugin settings window by opening advanced options and typing in the IP address of your device. You can add multiple devices and then run the device discovery process to obtain *token/key* credentials. You must press the *Update* button for each device to copy the credentials into the device configuration.

*You must click Save button* to update the Homebridge config.json file and restart the plugin.

Midea cloud credentals (Username / Password) are not saved as these are only required for retrieval of each device token/key pair. Once those are known and saved this plugin no longer accesses Midea cloud servers over the internet.

### Deleting a device

If you delete a device in the plugin settings window, or the Homebridge config.json file, then note that this does *not* delete the cached accessory from Homebridge... the device will still be visible in Homebridge and Apple Home, but it will not respond to any requests or update any data.  To remove the device from Apple Home you must use Homebridge Settings and select *Remove Single Cached Accessory* to complete the deletion. **Caution:** removing an accessory from Apple Home may impact any automations that are dependent on the accessory, possibly deleting the automations.

### Configuration File

```json
"platforms": [
        {
            "name": "Midea Platform",
            "platform": "midea-platform",
            "refreshInterval": 30,
            "heartbeatInterval": 10,
            "verbose": false,
            "logRecoverableErrors": true,
            "uiDebug": false,
            "devices": [
                {
                    "type": "dehumidifier",
                    "name": "Dehumidifier",
                    "id": "123456789012345",
                    "advanced_options": {
                        "ip": "192.168.100.1",
                        "token": "ABCDEF1234567890",
                        "key": "1234567890ABCDEF",
                        "verbose": false,
                        "logRecoverableErrors": true
                    },
                    "<device_options>": {
                        "device_option": "value"
                    }
                }
            ]
        }
    ]
```
* **Platform Properties**
  * **name** *(required)*: Platform name, set to 'Midea Platform'.
  * **platform** *(required)*: Platform identifier, set to 'midea-platform'.
  * **refreshInterval** *(optional)*: Frequency in seconds that the plugin will query a device for status. The plugin maintains a cache of device status so that it can respond quickly to state requests from HomeKit without having to send a request to the Midea device.  Many Midea devices will automatically notify the plugin of any status change (e.g. temperature or humidity) but the plugin will also regularly request status from each device at the interval specified. The default is 30 seconds, the maximum is 86400 (24 hours). Setting value to 0 (zero) disables polling and updates will only be noted if devices sends it automatically.
  * **heartbeatInterval** *(optional)*: Frequency in seconds that the plugin will send a heartbeat message to a device to keep the network socket open. The default and minimum is 10 seconds, you can increase this up to a maximum of 120 (2 minutes). If you see socket closed error messages in the log reduce this value.
  * **verbose** *(optional)*: Enables more verbose debug logging.  This requires that Homebridge is run with debug mode enabled and will add additional network traffic details to the log. Default is false. See *logging* section below.
  * **logRecoverableErrors** *(optional)*: Enables logging of recoverable warning or error messages.  Default is true.  See *logging* and *network resiliency* sections below.
  * **uiDebug** *(optional)*: Debug data for the custom UI device discovery process will be logged to the Homebridge log and Javascript console.  Default is false.
  * **devices** *(required)*: Array of device settings, see below.

* **devices** is an array of objects that allow settings or overrides for each device and contains the following fields:
  * **type** *(required)*: Must be set to one of the supported devices.
  * **name** *(optional)*: This replaces the name set by the Midea device and is displayed in the Homebridge accessories page. Entries in the log are prefixed with this name to assist in identifying the source of information being logged.
  * **id** *(required)*: ID to identify specific device.  This will be filled in by the device discovery process in the Settings window but uou can also find this from the Homebridge log during plugin initialization or in the Homebridge Config UI X by clicking on an accessory settings and copying the *Product Data* field.
  * **advanced_options** *(required)*: Object with settings specific for this device:
    * **ip** *(optional)*: IP address of device on your local LAN. This is only required if the device is not on the same LAN subnet as your Homebridge server.
    * **token** *(required)*: Device login token.
    * **key** *(required)*: Device login key. Specifying a token/key pair will override any values previously cached by the plugin.
    * **verbose** *(optional)*: Override global setting for this one device.
    * **logRecoverableErrors** *(optional)*: Override global setting for this one device.
  * **<device_options>** *(optional)*: Object with name and options that are device type specific.  See *device notes* below.

## Plugin Initialization

When the plugin initializes it attempts to find all devices attached to the Local Area Network (LAN) by sending a message to the broadcast address of the subnet for each network interface attached to the Homebridge server.  Midea devices attached to the network will respond and are checked against devices configured in the plugin platform config.json file. Network discovery is repeated multiple times (currently 4 times at interval of 2 seconds between each).

At the end of the discovery process, if there are devices configured in the *devices* array with deviceID that was not discovered, then a warning is noted in the log and the plugin will retry every 60 seconds until the missing device comes online.

## Device Notes

Observed behavior of various devices, and specific configuration settings are noted below for supported devices. 

### Air Conditioner

Providing air conditioner settings is optional and the whole section or individual options may be ommitted and default values (noted below) will be used. Within the *devices.config* object the following air conditioner specific options.

```json
"AC_options": {
    "swingMode": "Both",
    "outDoorTemp": false,
    "audioFeedback": false,
    "ecoSwitch": true,
    "switchDisplay": {
        "flag": true,
        "command": false
    },
    "minTemp": 16,
    "maxTemp": 30,
    "tempStep": 1,
    "fahrenheit": false,
    "fanOnlyMode": false
}
```

* **Air Conditioner options**
  * **swingMode** *(optional)*: Set swing mode of the unit. If you AC does not support this feature then leave it on None.
  * **outDoorTemp** *(optional)*: Toggles if the outdoor temperature is created with the accessory, default is false.
  * **audioFeedback** *(optional)*: Toggles if the unit beeps when a command is sent, default is false.
  * **ecoSwitch** *(optional)*: Toggles if the ECO mode switch is created with the accessory, default is true.
  * **switchDisplay** *(optional)*: Object with following two options...
    * **flag** *(optional)*: Toggles if a switch, which can turn the display on or off will be created or not. Default is true.
    * **command** *(optional)*: Use this if the switch display command does not work. If it doesn't work either way then you unit does not support this feature. Default is false. 
  * **minTemp** *(optional)*: The minimum temperature that the unit can be set for.  Default is 16 celsius
  * **maxTemp** *(optional)*: The maximum temperature that the unit can be set for.  Default is 30 celsius
  * **tempStep** *(optional)*: Increment in which the temperature setting can be changed, may be set to either 0.5 or 1 degree celsius.  The default is one degree.
  * **fahrenheit** *(optional)*: Toggles if the temperature on the unit is displayed in Fahrenheit or Celsius.  Default is false (displays in Celsius).
  * **fanOnlyMode** *(optional)*: Toggles if the fan only mode is created with the accessory. Default is false.

### Dehumidifier

Providing dehumidifier settings is optional and the whole section or individual options may be ommitted and default values (noted below) will be used. Within the *devices.config* object the following dehumidifier specific options.

```json
"A1_options": {
    "minHumidity": 35,
    "maxHumidity": 85,
    "humidityStep": 5
}
```

* **Dehumidifier options**
  * **minHumidity** *(optional)*: The minimum relative humidity that the unit can be set for.  Default is 35%
  * **maxHumidity** *(optional)*: The maximum relative humidity that the unit can be set for.  Default is 85%
  * **humidityStep** *(optional)*: Increment in which the relative himidity setting can be changed, may be set to either 5% or 10%.  The default is 5%.

### Unsupported Devices

If you have a device not supported by the plugin then useful information will be logged as warnings.  If you are interested in developing support for a device please contact the authors by opening an [issue](https://github.com/kovapatrik/homebridge-midea-platform/issues).

## Technical Notes

### Network Resiliency

Various strategies are employed in an attempt to handle an unstable network. If a failure occurs at any point while accessing the network or Midea devices then the plugin will attempt to reconnect.  During testing we have observed that if a Midea device is isolated from the public internet, and therefore unable to connect to Midea cloud servers, it will close the internal LAN connection to this plugin after a few minutes.  The plugin is able to recover and reopen this connection.  See *logging* setion below.

### Logging

Device status changes, for example temperature or humidity changes are logged into the Homebridge log as are any warnings or errors.  This includes errors that the plugin can recover from.  If your log is filling up with recoverable errors you can suppress these by setting *logRecoverableErrors* to false.  You can turn on debug log by running Homebridge with debug enabled, in the Homebridge UI you can set this in Homebridge Settings.

By default the plugin does not debug-log all network traffic.  If you are developing support for a new device it may be helpful to turn this on by setting *verbose* to true.

The custom UI settings window performs device discovery on your network.  To enable debug log for this process you must enable *uiDebug* in the settings.  Server side debug will log to the Homebridge log, client side debug will log to the browser javascript console.

## License

Copyright (c) 2023 [Kovalovszky Patrik](https://github.com/kovapatrik),  
Copyright (c) 2023 [David A. Kerr](https://github.com/dkerr64)

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this program except in compliance with the License. You may obtain a copy of the License at [http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0)

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

### Trademarks

Apple and HomeKit are registered trademarks of Apple Inc.

Midea is a trademark of Midea Group Co., Ltd.

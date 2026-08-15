# Air Conditioner

## Auto mode

This setting is only makes sense and works, if your device can handle heating, and if the `heatingCapable` option is set to `true`.

The `Auto` mode is emulated, because Midea devices are only providing a single target temperature, there are no separate temperatures for cooling and heating. In `Auto` mode it's possible to change the cooling and heating target thresholds. Here is how they are working in each mode:

- Cool: target temperature is the cooling threshold
- Heat: target temperature is the heating threshold
- Auto: if the indoor temperature is below the heating threshold, set the target temperature to the heating threshold; if the indoor temperature is above the cooling threshold, set the target temperature to the cooling threshold; if the temperature is within the band set the target temperature to the current indoor temperature so the devices stays idle and save energy

## Configuration

Providing air conditioner settings is optional and the whole section or individual options may be ommitted and default values (noted below) will be used. Within the _devices.config_ object the following air conditioner specific options.

```json
"AC_options": {
    "swing": {
        "mode": "None",
        "angleAccessory": false,
        "angleMainControl": "Vertical"
    },
    "heatingCapable": true,
    "outDoorTemp": false,
    "humiditySensor": false,
    "humidityWeatherFallback": false,
    "audioFeedback": false,
    "audioFeedbackSwitch": false,
    "coolModeSwitch": false,
    "heatModeSwitch": false,
    "autoModeSwitch": false,
    "dryModeSwitch": false,
    "fanOnlyModeSwitch": false,
    "selfCleanSwitch": false,
    "ecoSwitch": false,
    "boostModeSwitch": false,
    "breezeAwaySwitch": false,
    "displaySwitch": false,
    "displaySwitchAlternate": false,
    "auxHeatingSwitches": false,
    "ionSwitch": false,
    "smartEyeSwitch": false,
    "powerMeter": false,
    "powerMeterName": "Consumption",
    "powerDisplayType": "Lux",
    "energyDisplayType": "None",
    "timerSwitch": false,
    "rateSelector": false,
    "sleepModeSwitch": false,
    "fanSpeedMode": "None",
    "minTemp": 16,
    "maxTemp": 30,
    "tempStep": 1,
    "fahrenheit": false
}
```

## Options

- **swing**:
  - **mode** _(optional)_: Set swing mode of the unit. If your unit does not support this feature then leave it on `None`. Default is `None`.
  - **angleAccessory** _(optional)_: Toggles if the swing angle accessory is created with the accessory. The accessory can be used to set the angle of the slat to a specified value. The `mode` property will be used to determine the direction of the slat. The main position bar will be used to set the angle of the direction which is selected in the `mode` property. Default is `false`.
  - **angleMainControl** _(optional)_: If `mode` property is Both and the swing angle accessory is enabled, this property will be used to determine which direction will be controlled by the main position bar of the accessory. Default is `Vertical`.
- **heatingCapable** _(optional)_: Toggles if the unit is capable of heating. Default is `true`.
- **outDoorTemp** _(optional)_: Toggles if the outdoor temperature sensor is created with the accessory. Default is `false`.
- **humiditySensor** _(optional)_: Toggles if the indoor humidity sensor is created as a separate service. Required to see indoor humidity in HomeKit. Default is `false`.
- **humidityWeatherFallback** _(optional)_: If enabled, the plugin will use local weather data as a fallback for the humidity sensor if the device sensor is unavailable or reporting 0%. Requires the global **Weather Service** to be configured. Default is `false`.
- **audioFeedback** _(optional)_: Toggles if the unit beeps when a command is sent, default is false.
- **audioFeedbackSwitch** _(optional)_: Toggles if the audio feedback switch is created with the accessory. Default is `false`.
- **coolModeSwitch** _(optional)_: Toggles if a dedicated switch for Cool mode is created. Default is `false`.
- **heatModeSwitch** _(optional)_: Toggles if a dedicated switch for Heat mode is created. Default is `false`.
- **autoModeSwitch** _(optional)_: Toggles if a dedicated switch for Auto mode is created. Default is `false`.
- **dryModeSwitch** _(optional)_: Toggles if a dedicated switch for Dry mode is created. Default is `false`.
- **fanOnlyModeSwitch** _(optional)_: Toggles if a dedicated switch for Fan-only mode is created. Default is `false`.
- **selfCleanSwitch** _(optional)_: Toggles if a dedicated switch for Self-cleaning (Auto-clean) mode is created. Default is `false`.
- **ecoSwitch** _(optional)_: Toggles if the eco switch is created with the accessory. Default is `false`.
- **boostModeSwitch** _(optional)_: Toggles if the boost/turbo mode switch is created with the accessory. Default is `false`.
- **breezeAwaySwitch** _(optional)_: Toggles if the breeze away switch is created with the accessory. Default is `false`.
- **displaySwitch** _(optional)_: Toggles if a switch to turn the unit's display LED on or off is created. Default is `false`.
- **displaySwitchAlternate** _(optional)_: Use this if the standard display switch does not work. Default is `false`.
- **auxHeatingSwitches** _(optional)_: Toggles if the aux heating switches are created with the accessory. Default is `false`.
- **ionSwitch** _(optional)_: Toggles if the ION (Anion) switch is created with the accessory. Default is `false`.
- **smartEyeSwitch** _(optional)_: Toggles if the iSense (Smart Eye) switch is created with the accessory. Default is `false`.
- **powerMeter** _(optional)_: Toggles if the power meter accessory is created. This displays real-time power consumption (in Watts) and total energy usage (in kWh). Compatible with Eve Home. Default is `false`.
- **powerMeterName** _(optional)_: Custom name for the power meter accessory.
- **powerDisplayType** _(optional)_: How real-time power (Watts) should be displayed in the standard Home app. Options: `Lux` (default), `Humidity`, `CarbonDioxide`, `Temperature`, `None`. **Tip**: Use `CarbonDioxide` to show values without the "Lux" unit and avoid being capped at 100.
- **energyDisplayType** _(optional)_: How total energy (kWh) should be displayed in the standard Home app. Options: `None` (default), `Lux`, `Humidity`, `CarbonDioxide`, `Temperature`.
- **timerSwitch** _(optional)_: Toggles if the off timer switch is created (displayed as a Valve). Default is `false`.
- **rateSelector** _(optional)_: Toggles if the gear selector (power consumption limit) is created. Allows setting 0-100% power limit. Default is `false`.
- **sleepModeSwitch** _(optional)_: Toggles if the sleep mode switch is created. Default is `false`.
- **fanSpeedMode** _(optional)_: Configure how fan speed is controlled.
  - `None`: Continuous slider (0-100%).
  - `3 levels`: Steps (Low, Medium, High).
  - `5 levels`: Steps (Silent, Low, Medium, High, Full) + Auto.
- **minTemp** _(optional)_: The minimum temperature that the unit can be set for. Default is `16 celsius`.
- **maxTemp** _(optional)_: The maximum temperature that the unit can be set for. Default is `30 celsius`.
- **tempStep** _(optional)_: Increment in which the temperature setting can be changed (0.5 or 1). Default is `1`.
- **fahrenheit** _(optional)_: Toggles if the temperature is displayed in Fahrenheit or Celsius. Default is `false`.

# Fresh Air Appliance

Providing Fresh Air Appliance settings is optional and the whole section or individual options may be ommitted and default values (noted below) will be used. Within the _devices.config_ object the following air conditioner specific options.

```json
"CE_options": {
  "autoSetModeSwitch": false,
  "minTemp": 16,
  "maxTemp": 30,
  "tempStep": 1,
  "silentMode": false,
}
```

## Options

- **autoSetModeSwitch** _(optional)_: Toggles if the auto set mode switch is created with the accessory. Default is `false`
- **minTemp** _(optional)_: The minimum temperature that the unit can be set for. Default is `16 celsius`
- **maxTemp** _(optional)_: The maximum temperature that the unit can be set for. Default is `30 celsius`
- **tempStep** _(optional)_: Increment in which the temperature setting can be changed, may be set to either 0.5 or 1 degree celsius. The default is `1 degree`.
- **silentMode** _(optional)_: Toggles if the silent mode switch alongside the level slider is created with the accessory. Default is `false`

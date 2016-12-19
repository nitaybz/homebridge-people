# homebridge-people
This is a plugin for [homebridge](https://github.com/nfarina/homebridge). 
It monitors who is at home, based on received webhooks sent by location-aware mobile apps (such as [Locative](https://my.locative.io), which can use iBeacons and geofencing to provide faster and more accurate location information.

# Installation

1. Install homebridge (if not already installed) using: `npm install -g homebridge`
2. Install this plugin using: `npm install -g homebridge-people-geofence`
3. Update your configuration file. See below for a sample.

# Configuration

```
"accessories": [
	{
  "accessory" : "GeoFence",
  "name" : "People",
  "people" : [
   { "name" : "John"},
   { "name" : "Rachel"}
  ],
  "anyoneSensor" : true,
  "nooneSensor" : false
 }
],
```

# How it works
* When started homebridge-people-geofence will create a webserver that listen to http requests on port 51829.
* With an iBeacon or geofencing smartphone app, you can configure a HTTP push to trigger when you enter and exit your 'home' region.
* When a request is successful the status ```Home``` or ```Away``` is logged to a file ("person_NAME") in the persist folder
* When a Homekit enabled app looks up the state of a person the state of the person is pulled out of that file.

# 'Anyone' and 'No One' sensors
Some HomeKit automations need to happen when "anyone" is home or when "no one" is around, but the default Home app makes this difficult. homebridge-people-geofence can automatically create additional sensors called "Anyone" and "No One" to make these automations very easy.

For example, you might want to run your "Arrive Home" scene when _Anyone_ gets home. Or run "Leave Home" when _No One_ is home.

These sensors can be enabled by adding `"anyoneSensor" : true` and `"nooneSensor" : true` to your homebridge `config.json` file.

# Accuracy
This plugin requires that the device where the location app is installed will be online and location permission will be approved even when the app is closed.

this plugin can receive a HTTP push from the app to immediately see you as present or not present when you physically enter or exit your desired region. This is particularly useful for "Arrive Home" and "Depart Home" HomeKit automations.

# Pairing with a location-aware mobile app
Apps like [Locative](https://my.locative.io) range for iBeacons and geofences by using core location APIs available on your smartphone. With bluetooth and location services turned on, these apps can provide an instantaneous update when you enter and exit a desired region.

To use this plugin with one of these apps, configure your region and set the HTTP push to `http://youripaddress:51829/?sensor=[name]&state=true` for arrival, and `http://youripaddress:51829/?sensor=[name]&state=false` for departure, where `[name]` is the name of the person the device belongs to as specified in your config under `people`. *Note:* you may need to enable port forwarding on your router to accomplish this.

By default homebridge-people-geofence listens on port 51828 for updates.  This can be changed by setting `webhookPort` in your homebridge `config.json`.

# Notes
## Credits
This plugin was forked and inspired from homebridge-people by PeteLawrence.
Basically, it takes the the last released feature of the people plugin and isolate it.
makes the plugin not depended on WiFi network or any connection. simple Home and Away status.

## Running on a raspberry pi as non 'pi' user
On some versions of raspbian, users are not able to use the ping program by default. If none of your devices show online try running ```sudo chmod u+s /bin/ping```. Thanks to oberstmueller for the tip.

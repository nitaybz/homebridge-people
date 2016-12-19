var request = require("request");
var http = require('http');
var url = require('url');
var DEFAULT_REQUEST_TIMEOUT = 10000;

var Service, Characteristic, HomebridgeAPI;


module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  HomebridgeAPI = homebridge;

  homebridge.registerAccessory("homebridge-people-geofence", "GeoFence", PeopleAccessory);
}


function PeopleAccessory(log, config) {
  this.log = log;
  this.name = config['name'];
  this.people = config['people'];
  this.anyoneSensor = config['anyoneSensor'] || true;
  this.nooneSensor = config['nooneSensor'] || false;
  this.webhookPort = config["webhookPort"] || 51829;
  this.services = [];
  this.storage = require('node-persist');
  this.stateCache = [];

  //Init storage
  this.storage.initSync({
    dir: HomebridgeAPI.user.persistPath()
  });

  //Setup an OccupancySensor for each person defined in the config file
  config['people'].forEach(function(personConfig) {
    var pName = personConfig.name;
    var service = new Service.OccupancySensor(personConfig.name, personConfig.name);
    service.pName = pName;
    service
      .getCharacteristic(Characteristic.OccupancyDetected)
      .on('get', this.getState.bind(this, pName));

    this.services.push(service);
  }.bind(this));

  if(this.anyoneSensor) {
    //Setup an Anyone OccupancySensor
    var service = new Service.OccupancySensor('Anyone', 'Anyone');
    service.pName = 'Anyone';
    service
      .getCharacteristic(Characteristic.OccupancyDetected)
      .on('get', this.getAnyoneState.bind(this));

    this.services.push(service);

    this.populateStateCache();
  }

  if(this.nooneSensor) {
    //Setup an No One OccupancySensor
    var service = new Service.OccupancySensor('No One', 'No One');
    service.pName = 'No One';
    service
      .getCharacteristic(Characteristic.OccupancyDetected)
      .on('get', this.getNoOneState.bind(this));

    this.services.push(service);

    this.populateStateCache();
  }


  //
  // HTTP webserver code influenced by benzman81's great
  // homebridge-http-webhooks homebridge plugin.
  // https://github.com/benzman81/homebridge-http-webhooks
  //

  // Start the HTTP webserver
  http.createServer((function(request, response) {
    var theUrl = request.url;
    var theUrlParts = url.parse(theUrl, true);
    var theUrlParams = theUrlParts.query;
    var body = [];
    request.on('error', (function(err) {
      this.log("WebHook error: %s.", err);
    }).bind(this)).on('data', function(chunk) {
      body.push(chunk);
    }).on('end', (function() {
      body = Buffer.concat(body).toString();

      response.on('error', function(err) {
        this.log("WebHook error: %s.", err);
      });

      response.statusCode = 200;
      response.setHeader('Content-Type', 'application/json');

      if(!theUrlParams.sensor || !theUrlParams.state) {
        response.statusCode = 404;
        response.setHeader("Content-Type", "text/plain");
        var errorText = "WebHook error: No sensor or state specified in request.";
        this.log(errorText);
        response.write(errorText);
        response.end();
      }
      else {
        var sensor = theUrlParams.sensor.toLowerCase();
        var state = (theUrlParams.state == "true");
        this.log('Received hook for ' + sensor + ' -> ' + state);
        var responseBody = {
          statusChanged: true
        };

        for(var i = 0; i < this.people.length; i++){
          var person = this.people[i];
          if(person.name.toLowerCase() === sensor) {
            if (state) {
              this.storage.setItem('person_' + person.name, "Home");
            } else {
              this.storage.setItem('person_' + person.name, "Away");
            }
            var pName = person.name;
            var oldState = this.getStateFromCache(pName);
            var newState = state;
            if (oldState != newState) {
              //Update our internal cache of states
              this.updateStateCache(pName, newState);

              //Trigger an update to the Homekit service associated with the Name
              var service = this.getServiceForName(pName);
              service.getCharacteristic(Characteristic.OccupancyDetected).setValue(newState);

              //Trigger an update to the Homekit service associated with 'Anyone'
              var anyoneService = this.getServiceForName('Anyone');
              if (anyoneService) {
                var anyoneState = this.getAnyoneStateFromCache();
                anyoneService.getCharacteristic(Characteristic.OccupancyDetected).setValue(anyoneState);
              }
              var anyoneState = this.getAnyoneStateFromCache();
              anyoneService.getCharacteristic(Characteristic.OccupancyDetected).setValue(anyoneState);

              //Trigger an update to the Homekit service associated with 'No One'
              var noOneService = this.getServiceForName('No One');
              if (noOneService) {
                var noOneState = this.getNoOneStateFromCache();
                noOneService.getCharacteristic(Characteristic.OccupancyDetected).setValue(noOneState);
              }
            }
          }
        }
        response.write(JSON.stringify(responseBody));
        response.end();
      }
    }).bind(this));
  }).bind(this)).listen(this.webhookPort);
  this.log("WebHook: Started server on port '%s'.", this.webhookPort);
}

PeopleAccessory.prototype.populateStateCache = function() {
  this.people.forEach(function(personConfig) {
    var pName = people.name;
    var isActive = this.targetIsActive(pName);

    this.stateCache[pName] = isActive;
  }.bind(this));
}

PeopleAccessory.prototype.updateStateCache = function(pName, state) {
  this.stateCache[pName] = state;
}

PeopleAccessory.prototype.getStateFromCache = function(pName) {
  return this.stateCache[pName];
}

PeopleAccessory.prototype.getServices = function() {
  return this.services;
}

PeopleAccessory.prototype.getServiceForName = function(pName) {
  var service = this.services.find(function(pName, service) {
    return (service.pName == pName);
  }.bind(this, pName));

  return service;
}


PeopleAccessory.prototype.getState = function(pName, callback) {
  callback(null, this.getStateFromCache(pName));
}


PeopleAccessory.prototype.getAnyoneState = function(callback) {
  var isAnyoneActive = this.getAnyoneStateFromCache();

  callback(null, isAnyoneActive);
}

PeopleAccessory.prototype.getAnyoneStateFromCache = function() {
  for (var i = 0; i < this.people.length; i++) {
    var personConfig = this.people[i];
    var pName = personConfig.name;

    var isActive = this.getStateFromCache(pName);

    if (isActive) {
      return true;
    }
  }

  return false;
}

PeopleAccessory.prototype.getNoOneState = function(callback) {
  var isAnyoneActive = !this.getAnyoneStateFromCache();

  callback(null, isAnyoneActive);
}

PeopleAccessory.prototype.getNoOneStateFromCache = function() {
  for (var i = 0; i < this.people.length; i++) {
    var personConfig = this.people[i];
    var pName = personConfig.name;
    var isActive = this.getStateFromCache(pName);

    if (isActive) {
      return false;
    }
  }

  return false;
}

PeopleAccessory.prototype.targetIsActive = function(pName) {
  var isHome = this.storage.getItem('person_' + pName);
  if (isHome) {
    var isActive = (isHome === "Home");
    if (isActive) {
      return true;
    }
  }

  return false;
}

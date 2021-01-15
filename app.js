'use strict';

const Homey = require('homey');

class LoqedApp extends Homey.App {
  async onInit() {
    this.log('LoqedApp has been initialized');
  }

  async setLockState(lockId, newState, keyEmail) {
    const device = this.homey
      .drivers
      .getDriver('touch-smart-lock')
      .getDevice({"id": lockId});

    return new Promise(resolve => {
      device.setState(newState, keyEmail);

      resolve();
    });
  }
}

module.exports = LoqedApp;

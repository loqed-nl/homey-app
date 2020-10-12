'use strict';

const Homey = require('homey');

class LoqedApp extends Homey.App {
  async onInit() {
    this.log('LoqedApp has been initialized');
  }
}

module.exports = LoqedApp;

'use strict';

const Homey = require('homey');
const https = require("https");
const Util = require('./../../lib/util');
const fetch = require('node-fetch');

const STATE_OPEN = 'OPEN';
const STATE_LATCH = 'DAY_LOCK';
const STATE_NIGHT_LOCK = 'NIGHT_LOCK';

class TouchSmartLockDeviceLegacy extends Homey.Device {
  async onInit() {
    this.util = new Util({ homey: this.homey });
    this._flowLockStateChanged = this.homey.flow.getDeviceTriggerCard('lock_state_changed');

    this.log('TouchSmartLockDevice has been initialized');

    if (! this.hasCapability('lock_state')) {
      await this.addCapability('lock_state');
    }

    this.registerCapabilityListener('locked', async (value) => {
      const currentLockValue = this.getCapabilityValue('locked');
      const lockState = value ? STATE_NIGHT_LOCK : STATE_LATCH;

      return this.changeLockState(lockState);
    });

    this.registerCapabilityListener('lock_state', async (lockState) => {
      const currentLockState = this.getCapabilityValue('lock_state');

      return this.changeLockState(lockState);
    });
  }

  triggerLockStateChange(lockState, keyAccountEmail) {
    this.setCapabilityValue('lock_state', lockState);

    this._flowLockStateChanged
      .trigger(this, {
        lockState: lockState,
        keyAccountEmail: keyAccountEmail
      }, {})
      .then(this.log)
      .catch(this.error)
  }

  async changeLockState(lockState) {
    const deviceId = this.getData().id;
    const apiKey = this.getSetting('apiKey');
    const apiToken = this.getSetting('apiToken');
    const localKeyId = this.getSetting('localKeyId');

    const webhookUrl = `https://production.loqed.com:8080/v1/locks/${deviceId}/state?lock_api_key=${apiKey}&api_token=${apiToken}&lock_state=${lockState}&local_key_id=${localKeyId}`;

    return fetch(webhookUrl);
  }

  async setState(lockState, keyAccountEmail) {
    if (this.getSetting('lockType') === 'CYLINDER_OPERATED_WITH_HANDLE' && lockState === STATE_OPEN) {
      await this.setCapabilityValue('locked', false);
    } else if (lockState === STATE_NIGHT_LOCK) {
      await this.setCapabilityValue('locked', true);
    } else if (lockState === STATE_LATCH) {
      await this.setCapabilityValue('locked', false);
    }

    this.triggerLockStateChange(lockState, keyAccountEmail);
  }
}

module.exports = TouchSmartLockDeviceLegacy;

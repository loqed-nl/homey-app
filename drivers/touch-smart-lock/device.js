'use strict';

const Homey = require('homey');
const https = require("https");
const Util = require('/lib/util');

const STATE_OPEN = 'OPEN';
const STATE_LATCH = 'DAY_LOCK';
const STATE_NIGHT_LOCK = 'NIGHT_LOCK';

class TouchSmartLockDevice extends Homey.Device {
  async onInit() {
    this.util = new Util({ homey: this.homey });
    this._flowLockStateChanged = new Homey.FlowCardTriggerDevice('lock_state_changed').register();

    this.log('TouchSmartLockDevice has been initialized');

    this.registerCapabilityListener('locked', async (value) => {
      const currentLockValue = this.getCapabilityValue('locked');
      const lockState = value ? STATE_NIGHT_LOCK : STATE_OPEN;
      return new Promise(resolve => {
        if (value === currentLockValue) {
          return resolve();
        }

        this.changeLockState(lockState)

        return resolve();
      });
    });
  }

  triggerLockStateChange(lockState, keyAccountEmail) {
    this._flowLockStateChanged
      .trigger(this, {
        lockState: lockState,
        keyAccountEmail: keyAccountEmail
      }, {})
      .then(this.log)
      .catch(this.error)
  }

  changeLockState(lockState) {
    const deviceId = this.getData().id;
    const apiKey = this.getSetting('apiKey');
    const apiToken = this.getSetting('apiToken');
    const localKeyId = this.getSetting('localKeyId');

    const webhookUrl = `https://production.loqed.com:8080/v1/locks/${deviceId}/state?lock_api_key=${apiKey}&api_token=${apiToken}&lock_state=${lockState}&local_key_id=${localKeyId}`;
    https.get(webhookUrl);

    console.log(`Value: ${lockState}`);
    console.log(apiKey, apiToken, webhookUrl);

    this.triggerLockStateChange(lockState, 'Homey');
  }

  async setState(lockState, keyAccountEmail) {
    switch (lockState) {
      case STATE_OPEN:
        await this.setCapabilityValue('locked', false);
        break;
      case STATE_NIGHT_LOCK:
        await this.setCapabilityValue('locked', true);
        break;
      case STATE_LATCH:
        await this.setCapabilityValue('locked', true);
        break;
    }

    this.triggerLockStateChange(lockState, keyAccountEmail);
  }
}

module.exports = TouchSmartLockDevice;

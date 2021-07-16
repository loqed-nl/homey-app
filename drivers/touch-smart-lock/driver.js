'use strict';

const Homey = require('homey');
const SHA256 = require('crypto-js/sha256');
const Base64 = require('crypto-js/enc-base64');
const cheerio = require('cheerio')
const Util = require('./../../lib/util');

class TouchSmartLockDriver extends Homey.Driver {
  async onInit() {
    const homeyId = await this.homey.cloud.getHomeyId();

    this.util = new Util({homey: this.homey});
    this.webhookUrl = `https://${(homeyId)}.connect.athom.com/API/app/com.loqed.touch-smart-lock`;

    this.homey.flow.getActionCard('change_lock_state')
      .registerRunListener(args => {
        args.device.changeLockState(args.lockState);

        return Promise.resolve();
      });
  }

  onPair(session) {
    let encryptedPassword = '';
    let passwordOrig = '';
    let email = '';
    let foundDevices = [];

    const onLogin = async ({ username, password }) => {
      passwordOrig = password.trim();
      encryptedPassword = Base64.stringify(SHA256(password));
      email = username.trim().toLowerCase();

      return this.getLocks(email, encryptedPassword)
        .then(devices => {
          foundDevices = devices;

          return true;
        })
        .catch(_ => false);
    }

    const onListDevices = async data => {
      return foundDevices;
    }

    const onCreateHooks = async data => {
      const device = data[0];

      return this.createWebhook(device.data.id, email, encryptedPassword, passwordOrig)
        .then(() => {
          return this.createKey(device.data.id, email, encryptedPassword, passwordOrig);
        })
        .then(() => {
          return this.getDeviceAuthData(device, email, encryptedPassword, passwordOrig);
        })
        .then((device) => {
          return device;
        });
    }

    session.setHandler('login', onLogin)
      .setHandler('list_devices', onListDevices)
      .setHandler('create_hooks', onCreateHooks);

  }

  async getLocks(email, encryptedPassword) {
    return new Promise((resolve, reject) => {
      this.util
        .callLoqedSite('webhook-edit', {
          email: email,
          password: encryptedPassword,
        })
        .then(res => {
          const $ = cheerio.load(res.data);
          const devices = [];

          if (res.data.includes('Incorrect username or password, please try again.')) {
            reject('Incorrect username or password, please try again.');
          }

          $('option').each(function () {
            devices.push({
              name: $(this).text().match('"(.*)",')[1],
              data: {
                id: parseInt($(this).val()),
              },
            });
          });

          resolve(devices);
        })
        .catch(err => reject(err));
    });
  }

  async getDeviceAuthData(device, email, encryptedPassword, password) {
    return this.retry(_ => {
      return new Promise((resolve, reject) => {
        this.util
          .callLoqedSite('webhook-list', {
            email: email,
            password: encryptedPassword,
            password_orig: password
          })
          .then(response => {
            const $ = cheerio.load(response.data);
            const webhookData = $(`table[data-id="${device.data.id}"]`).data();

            if (typeof webhookData === undefined || ! webhookData) {
              return reject('reject');
            }

            device.settings = {
              lockType: webhookData.lockType,
              apiKey: webhookData.apiKey,
              apiToken: webhookData.apiToken,
              localKeyId: webhookData.localKeyId
            };

            return resolve(device);
          });
      });
    })
  }

  async createKey(deviceId, email, encryptedPassword, password) {
    await this.util
      .callLoqedSite('key-update', {
        email: email,
        password: encryptedPassword,
        password_orig: password,
        name: 'Homey',
        lock_id: deviceId,
        p_remote: 'Checked',
        p_admin: '',
        p_pin: '',
        p_auto_unlock: '',
        p_touch: '',
        p_valid_from: '',
        p_valid_to: '',
      });
  }

  async createWebhook(deviceId, email, encryptedPassword, password) {
    await this.util
      .callLoqedSite('webhook-update', {
        email: email,
        password: encryptedPassword,
        password_orig: password,
        lock_id: deviceId,
        url: this.webhookUrl,
        trigger_state_changed_open: 'checked',
        trigger_state_changed_latch: 'checked',
        trigger_state_changed_night_lock: 'checked',
      });
  }

  async retry(fn, retries = 10) {
    if (! retries) {
      return Promise.reject();
    }

    return fn().catch(async err => {
      await new Promise(r => setTimeout(r, 2000));

      return this.retry(fn, (retries - 1));
    });
  }
}

module.exports = TouchSmartLockDriver;

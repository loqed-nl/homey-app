'use strict';

const axios = require('axios');
const FormData = require('form-data');

class Util {

  constructor(opts) {
    this.homey = opts.homey;
  }

  async callLoqedSite(page, data) {
    const postData = new FormData();

    for (let key in data) {
      if (data.hasOwnProperty(key)) {
        postData.append(key, data[key])
      }
    }

    return axios.post(
      `https://webhooks.loqed.com/page.php?page=${page}`,
      postData,
      {
        headers: postData.getHeaders()
      }
    )
  }
}

module.exports = Util;

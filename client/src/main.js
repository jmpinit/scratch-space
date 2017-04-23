const testing = false;

/* eslint-disable global-require */

if (testing) {
  document.body.innerHTML = '';
  document.body.setAttribute('style', '');

  const tests = require('../tests');
  tests.testUnroll();
} else {
  const ui = require('./ui');
  ui.interfaceUser();
}

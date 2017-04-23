const util = require('../src/utilities');
const testUnspin = require('./test-unspin');

function run() {
  util.loadImageAsCanvas('/images/hiro-disk.png').then((canvas) => {
    document.body.appendChild(canvas);
    return Promise.resolve();
  }).then(() => testUnspin());
}

module.exports = {
  run,
};

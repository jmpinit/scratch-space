const util = require('../src/utilities');
const vinyl = require('../src/vinyl-press');

function runTest() {
  util.loadImageAsCanvas('/images/hiro-disk.png').then((canvas) => {
    const unspun = vinyl.unspin(canvas);
    document.body.appendChild(unspun);
  });
}

module.exports = runTest;

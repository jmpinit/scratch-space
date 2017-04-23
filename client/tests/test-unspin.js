const util = require('../src/utilities');
const vinyl = require('../src/vinyl-press');

function runTest() {
  util.loadImageAsCanvas('/images/hiro-disk.png').then((canvas) => {
    /*const testCanvas = document.createElement('canvas');
    testCanvas.width = 2048;
    testCanvas.height = 2048;
    const ctx = testCanvas.getContext('2d');
    ctx.drawImage(canvas, 0, 0, testCanvas.width, testCanvas.height);*/

    const unspun = vinyl.unspin(canvas);
    document.body.appendChild(unspun);
  });
}

module.exports = runTest;

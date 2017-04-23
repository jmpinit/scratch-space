const audioContext = new (window.AudioContext ||
  window.webkitAudioContext ||
  window.mozAudioContext ||
  window.oAudioContext ||
  window.msAudioContext)();

// thx http://danielrapp.github.io/spectroface/
function brightness(imageData, x, y) {
  const imageIndex = 4 * ((imageData.width * y) + x);
  const r = imageData.data[imageIndex];
  const g = imageData.data[imageIndex + 1];
  const b = imageData.data[imageIndex + 2];
  const avg = (r + b + g) / 3;
  const intensity = avg / 255;

  return intensity;
}

// thx http://danielrapp.github.io/spectroface/
// Scales a value, where minVal <= val <= maxVal
// and returns a value r, where minScale <= r <= maxScale.
// Just uses linear scaling.
function linScale(val, minVal, maxVal, minScale, maxScale) {
  const ratio = (maxScale - minScale) / (maxVal - minVal);
  return (minScale + ratio) * (val - minVal);
}

// thx http://danielrapp.github.io/spectroface/
// Each entry in the "freqData" array is interpreted as a
// frequency, the zero:th entry represents minFreq and the last
// entry represents maxFreq and we linearly interpolate the values inbetween.
// The value at each index represents how much the sinusoid should be scaled.
function sumSines(t, freqData, minFreq, maxFreq) {
  let sum = 0;

  for (let i = 0; i < freqData.length; i += 1) {
    const freq = linScale(i, 0, freqData.length, minFreq, maxFreq);
    sum += freqData[i] * Math.sin(freq * t);
  }

  return sum;
}

// Given an image (e.g. canvas) return AudioBuffer
function sonify(image) {
  const workCanvas = document.createElement('canvas');
  workCanvas.width = image.width;
  workCanvas.height = image.height;

  const imageCtx = workCanvas.getContext('2d');
  imageCtx.drawImage(image, 0, 0);

  const imageData = imageCtx.getImageData(0, 0, image.width, image.height);

  const SQUARE_IMAGE_TIME = 15; // seconds
  const frameCount = (image.width / image.height) * audioContext.sampleRate * SQUARE_IMAGE_TIME;
  const audioBuffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate);

  const audioData = audioBuffer.getChannelData(0);

  const samplesPerCol = audioData.length / image.width;

  // Scan image from left to right column-by-column
  let audioBufferIndex = 0;
  for (let x = 0; x < imageData.width; x += 1) {
    const column = [];

    for (let y = 0; y < imageData.height; y += 1) {
      column.unshift(brightness(imageData, x, y));
    }

    for (let sliceIndex = 0; sliceIndex < samplesPerCol; sliceIndex += 1) {
      audioData[audioBufferIndex] = sumSines(audioBufferIndex, column, 0.5, 2.0);
      audioBufferIndex += 1;
    }
  }

  return audioBuffer;
}

// Given an AudioBuffer, return a canvas containing a vinyl cover representing the sound
function coverArt(audioBuffer) {
  const audioLength = audioBuffer.length / audioContext.sampleRate;
  const renderContext = new OfflineAudioContext(1, audioBuffer.length, audioContext.sampleRate);

  const spectrumAnalyser = renderContext.createAnalyser();
  spectrumAnalyser.smoothingTimeConstant = 0;
  spectrumAnalyser.fftSize = 512;

  const audioBufferNode = renderContext.createBufferSource();
  audioBufferNode.buffer = audioBuffer;
  audioBufferNode.connect(spectrumAnalyser);

  const canvas = document.createElement('canvas');
  canvas.width = spectrumAnalyser.fftSize;
  canvas.height = spectrumAnalyser.fftSize / 2;

  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Fills in a row of the image with spectrogram data
  const audioData = new Uint8Array(spectrumAnalyser.frequencyBinCount);
  function createRowSampler(doneRatio, analyser) {
    return () => {
      analyser.getByteFrequencyData(audioData);

      for (let i = 0; i < audioData.length; i += 1) {
        const intensity = audioData[i];

        const x = i;
        const y = Math.floor(doneRatio * canvas.height);

        const ii = ((y * imageData.width) + x) * 4;
        imageData.data[ii] = intensity;
        imageData.data[ii + 1] = intensity;
        imageData.data[ii + 2] = intensity;
        imageData.data[ii + 3] = 255;
      }
    };
  }

  for (let y = 0; y < canvas.height; y += 1) {
    const doneRatio = y / canvas.height;
    const sampler = createRowSampler(doneRatio, spectrumAnalyser);

    renderContext.suspend(audioLength * doneRatio).then(() => {
      sampler();
      renderContext.resume();
    });
  }

  audioBufferNode.start(0);
  renderContext.startRendering();

  return new Promise((fulfill) => {
    renderContext.oncomplete = () => {
      ctx.putImageData(imageData, 0, 0);
      fulfill(canvas);
    };
  });
}

function map(value, low1, high1, low2, high2) {
  const normalized = (value - low1) / high1;
  const targetRange = high2 - low2;
  return low2 + (normalized * targetRange);
}

function unspin(image) {
  // Meant for hiro-disk.png
  const CENTER_RATIO = 0.37;

  // FIXME: DRY
  const workCanvas = document.createElement('canvas');
  workCanvas.width = image.width;
  workCanvas.height = image.height;

  const imageCtx = workCanvas.getContext('2d');
  imageCtx.drawImage(image, 0, 0);
  const imageData = imageCtx.getImageData(0, 0, image.width, image.height);

  const maxRadius = Math.min(imageData.width / 2, imageData.height / 2);

  const centerRadius = CENTER_RATIO * maxRadius;

  const unspunCanvas = document.createElement('canvas');
  unspunCanvas.width = Math.floor(maxRadius * Math.PI);
  unspunCanvas.height = maxRadius - centerRadius;
  const unspunCtx = unspunCanvas.getContext('2d');

  for (let y = 0; y < unspunCanvas.height; y += 1) {
    for (let x = 0; x < unspunCanvas.width; x += 1) {
      const r = map(y, 0, unspunCanvas.height, centerRadius, maxRadius);
      const a = map(x, 0, unspunCanvas.width, 0, 2 * Math.PI);

      const sx = Math.floor((imageData.width / 2) + (r * Math.cos(a)));
      const sy = Math.floor((imageData.height / 2) + (r * Math.sin(a)));

      let b = 0;
      if (sx >= 0 && sx < imageData.width && sy >= 0 && sy < imageData.height) {
        b = Math.floor(255 * brightness(imageData, sx, sy));
      } else {
        // Should never happen
        throw new Error('Sample position is out of bounds');
      }

      unspunCtx.fillStyle = `rgb(${b},${b},${b})`;
      unspunCtx.fillRect(x, y, 1, 1);
    }
  }

  return unspunCanvas;
}

function play(audioBuffer) {
  const audioBufferSourceNode = audioContext.createBufferSource();
  audioBufferSourceNode.buffer = audioBuffer;
  audioBufferSourceNode.loop = true;

  audioBufferSourceNode.connect(audioContext.destination);
  audioBufferSourceNode.start();
}

module.exports = {
  sonify,
  unspin,
  coverArt,
  play,
};

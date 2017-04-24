const MIN_FREQ = 100; // Hz
const MAX_FREQ = 10000; // Hz

// Meant for hiro-disk.png
const CENTER_RATIO = 0.37;

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

function map(value, low1, high1, low2, high2) {
  const sourceRange = high1 - low1;
  const normalized = (value - low1) / sourceRange;
  const targetRange = high2 - low2;
  return low2 + (normalized * targetRange);
}

const phaseOffsets = [];
for (let i = 0; i < 1024; i += 1) {
  phaseOffsets[i] = Math.PI * 2 * Math.random();
}

// intensities is an Array of values between 0 and 1
function smooshSines(intensities, time, minFreq, maxFreq) {
  let sum = 0;

  for (let i = 0; i < intensities.length; i += 1) {
    const freq = map(i, 0, intensities.length, minFreq, maxFreq);
    sum += intensities[i] * Math.sin((2 * Math.PI * freq * time) + phaseOffsets[i]);
  }

  return sum;
}

// Given an image (e.g. canvas) return AudioBuffer
function sonify(image) {
  const imageCtx = image.getContext('2d');
  const imageData = imageCtx.getImageData(0, 0, image.width, image.height);

  const SQUARE_IMAGE_TIME = 15; // seconds
  const frameCount = (image.width / image.height) * audioContext.sampleRate * SQUARE_IMAGE_TIME;
  const audioBuffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate);

  const audioData = audioBuffer.getChannelData(0);

  const samplesPerCol = audioData.length / image.width;

  // FIXME low frequency pulsing

  // Scan image from left to right column-by-column
  let sampleIndex = 0;
  for (let x = 0; x < imageData.width; x += 1) {
    const column = [];

    for (let y = 0; y < imageData.height; y += 1) {
      // White is usually the background, so let's make it the quietest color
      const inverted = 1 - brightness(imageData, x, y);
      const thresholded = inverted > 0.5 ? 1 : 0;
      column.push(thresholded);
    }

    for (let sliceIndex = 0; sliceIndex < samplesPerCol; sliceIndex += 1) {
      const sample = smooshSines(column, sampleIndex / audioContext.sampleRate, MIN_FREQ, MAX_FREQ);
      audioData[sampleIndex] = sample;
      sampleIndex += 1;
    }
  }

  return audioBuffer;
}

// Given an AudioBuffer, return a canvas containing a spectrogram of the audio
function spectrogram(audioBuffer, width, height) {
  const audioLength = audioBuffer.length / audioContext.sampleRate;
  const renderContext = new OfflineAudioContext(1, audioBuffer.length, audioContext.sampleRate);

  const spectrumAnalyser = renderContext.createAnalyser();
  spectrumAnalyser.smoothingTimeConstant = 0;
  spectrumAnalyser.fftSize = 512;

  const audioBufferNode = renderContext.createBufferSource();
  audioBufferNode.buffer = audioBuffer;
  audioBufferNode.connect(spectrumAnalyser);

  const canvas = document.createElement('canvas');
  canvas.width = width || Math.floor(Math.PI * 512);
  canvas.height = height || 512;

  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Fills in a row of the image with spectrogram data
  const audioData = new Uint8Array(spectrumAnalyser.frequencyBinCount);
  function createColumnSampler(doneRatio, analyser) {
    return () => {
      analyser.getByteFrequencyData(audioData);

      const x = Math.floor(doneRatio * canvas.width);

      for (let y = 0; y < canvas.height; y += 1) {
        const frequency = map(y, 0, canvas.height, MIN_FREQ, MAX_FREQ);
        const bin = Math.floor(frequency / (audioContext.sampleRate / spectrumAnalyser.fftSize));
        const intensity = audioData[bin];

        const ii = ((y * imageData.width) + x) * 4;
        imageData.data[ii] = intensity;
        imageData.data[ii + 1] = intensity;
        imageData.data[ii + 2] = intensity;
        imageData.data[ii + 3] = 255;
      }
    };
  }

  for (let x = 0; x < canvas.width; x += 1) {
    const doneRatio = x / canvas.width;
    const sampler = createColumnSampler(doneRatio, spectrumAnalyser);

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

function unspin(image) {
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

function distance(x1, y1, x2, y2) {
  return Math.sqrt(((x2 - x1) ** 2) + ((y2 - y1) ** 2));
}

function spin(image) {
  const radius = image.height;

  const disk = document.createElement('canvas');
  disk.width = radius * 2;
  disk.height = radius * 2;

  const ctx = disk.getContext('2d');

  const imageData = image.getContext('2d').getImageData(0, 0, image.width, image.height);

  const cx = disk.width / 2;
  const cy = disk.height / 2;

  for (let y = 0; y < disk.height; y += 1) {
    for (let x = 0; x < disk.width; x += 1) {
      const r = distance(cx, cy, x, y);
      const a = Math.atan2(y - cy, x - cx);

      if (a < -Math.PI || a > Math.PI) {
        throw new Error(`${x}, ${y}, ${a}`);
      }

      const sx = Math.floor(map(a, -Math.PI, Math.PI, 0, image.width));
      const sy = Math.floor(r);

      if (sx >= 0 && sx < image.width && sy >= 0 && sy < image.height) {
        const b = Math.floor(255 * brightness(imageData, sx, sy));
        ctx.fillStyle = `rgb(${b},${b},${b})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  return disk;
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
  spin,
  spectrogram,
  play,
};

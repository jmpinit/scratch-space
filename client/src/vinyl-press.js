const audioContext = new (window.AudioContext ||
  window.webkitAudioContext ||
  window.mozAudioContext ||
  window.oAudioContext ||
  window.msAudioContext)();

// thx http://danielrapp.github.io/spectroface/
function brightness(imageData, x, y) {
  const r = imageData.data[ ((imageData.width * y) + x) * 4     ]
    , g = imageData.data[ ((imageData.width * y) + x) * 4 + 1 ]
    , b = imageData.data[ ((imageData.width * y) + x) * 4 + 2 ]
    , avg = (r+b+g)/3
    , intensity = avg/255;

  return intensity;
}

// thx http://danielrapp.github.io/spectroface/
// Scales a value, where minVal <= val <= maxVal
// and returns a value r, where minScale <= r <= maxScale.
// Just uses linear scaling.
var linScale = function(val, minVal, maxVal, minScale, maxScale) {
  const ratio = (maxScale - minScale) / (maxVal - minVal);
  return minScale + ratio * (val - minVal);
};

// thx http://danielrapp.github.io/spectroface/
// Each entry in the "freqData" array is interpreted as a
// frequency, the zero:th entry represents minFreq and the last
// entry represents maxFreq and we linearly interpolate the values inbetween.
// The value at each index represents how much the sinusoid should be scaled.
var sumSines = function(t, freqData, minFreq, maxFreq) {
  var sum = 0;
  for (let i = 0; i < freqData.length; i++) {
    const freq = linScale(i, 0, freqData.length, minFreq, maxFreq);
    sum += freqData[i] * Math.sin(freq * t);
  }
  return sum;
};

// Given an image (e.g. canvas) return AudioBuffer
function sonify(image) {
  const workCanvas = document.createElement('canvas');
  workCanvas.width = image.width;
  workCanvas.height = image.height;

  const imageCtx = workCanvas.getContext('2d');
  imageCtx.drawImage(image, 0, 0);

  const imageData = imageCtx.getImageData(0, 0, image.width, image.height);

  const SQUARE_IMAGE_TIME = 5; // seconds
  const frameCount = image.width / image.height * audioContext.sampleRate * SQUARE_IMAGE_TIME;
  const audioBuffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate);

  const audioData = audioBuffer.getChannelData(0);

  const samplesPerCol = audioData.length / image.width;

  // Scan image from left to right column-by-column
  let audioBufferIndex = 0;
  for (let x = 0; x < image.width; x++) {
    const column = [];

    for (let y = 0; y < image.height; y++) {
      column.unshift(brightness(imageData, x, y));
    }

    for (let sliceIndex = 0; sliceIndex < samplesPerCol; sliceIndex++) {
      audioData[audioBufferIndex++] = sumSines(audioBufferIndex, column, 0.5, 2.0);
    }
  }

  return audioBuffer;
}

// Given an AudioBuffer, return a canvas containing a vinyl cover representing the sound
function coverArt(audioBuffer) {
  const audioLength = audioBuffer.length / audioContext.sampleRate;
  const renderContext = new OfflineAudioContext(1, audioBuffer.length, audioContext.sampleRate);

  const analyser = renderContext.createAnalyser();
  analyser.smoothingTimeConstant = 0;
  analyser.fftSize = 1024;

  const audioBufferNode = renderContext.createBufferSource();
  audioBufferNode.buffer = audioBuffer;
  audioBufferNode.connect(analyser);

  const canvas = document.createElement('canvas');
  canvas.width = analyser.fftSize;
  canvas.height = 2048;

  const ctx = canvas.getContext('2d');

  // Fills in a row of the image with spectrogram data
  function createRowSampler(doneRatio, analyser) {
    return () => {
      console.log('sampling', doneRatio);
      const audioData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(audioData);

      for (let i = 0; i < audioData.length; i++) {
        const intensity = audioData[i];

        const x = i;
        const y = Math.floor(doneRatio * canvas.height);

        ctx.fillStyle = "rgb("+intensity+", "+intensity+", "+intensity+")";
        ctx.fillRect(x, y, 1, 1);
      }
    };
  }

  for (let y = 0; y < canvas.height; y++) {
    const doneRatio = y / canvas.height;
    const frame = Math.floor(doneRatio * audioBuffer.length);
    const sampler = createRowSampler(doneRatio, analyser);

    renderContext.suspend(audioLength * doneRatio).then(() => {
      sampler();
      renderContext.resume();
    });
  }

  audioBufferNode.start(0);
  renderContext.startRendering();

  return new Promise((fulfill, reject) => {
    renderContext.oncomplete = () => fulfill(canvas);
  });
}

module.exports = {
  sonify,
  coverArt,
};

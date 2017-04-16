const video = document.createElement('video');

let localMediaStream = null;

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia || navigator.oGetUserMedia;

if (navigator.getUserMedia) {
  navigator.getUserMedia({ audio: false, video: true }, handleVideo, videoError);
}

function handleVideo(stream) {
  console.log('got video stream!', stream);
  video.src = window.URL.createObjectURL(stream);
  localMediaStream = stream;
}

function videoError(e) {
  console.log('Video error', e);
}

function snapshot() {
  if (localMediaStream) {
    const canvas = document.createElement('canvas');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    return canvas;
  }
}

module.exports = {
  snapshot,
};

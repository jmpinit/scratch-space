class Camera {
  constructor(videoElement) {
    this.video = videoElement;
    this.streaming = false;

    navigator.getUserMedia = navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia ||
      navigator.msGetUserMedia ||
      navigator.oGetUserMedia;

    const handleVideo = (stream) => {
      this.video.src = window.URL.createObjectURL(stream);
      this.streaming = true;
    };

    function videoError(e) {
      console.log('Video error', e);
    }

    if (navigator.getUserMedia) {
      navigator.getUserMedia({ audio: false, video: true }, handleVideo, videoError);
    }
  }

  snapshot() {
    if (this.streaming) {
      const canvas = document.createElement('canvas');

      canvas.width = this.video.videoWidth;
      canvas.height = this.video.videoHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(this.video, 0, 0);

      return canvas;
    }

    return undefined;
  }
}

module.exports = Camera;

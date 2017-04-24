const EventEmitter = require('events').EventEmitter;
const Camera = require('./camera');
const vinyl = require('./vinyl-press');
const util = require('./utilities');
const bufferToWav = require('audiobuffer-to-wav');

function downloadWav(audioBuffer) {
  // Create a WAV download
  const wav = bufferToWav(audioBuffer);
  const blob = new window.Blob([new DataView(wav)], {
    type: 'audio/wav',
  });

  const url = window.URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  document.body.appendChild(anchor);
  anchor.style = 'display: none';
  anchor.href = url;
  anchor.download = 'audio.wav';
  anchor.click();

  window.URL.revokeObjectURL(url);
}

function interfaceUser() {
  const uiRenderer = new EventEmitter();

  const renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setClearColor(new THREE.Color('lightgrey'), 0);

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.top = '0px';
  renderer.domElement.style.left = '0px';

  document.body.appendChild(renderer.domElement);

  // Initialize scene and camera
  const scene = new THREE.Scene();

  const ambient = new THREE.AmbientLight(0x666666);
  scene.add(ambient);

  const directionalLight = new THREE.DirectionalLight(0x887766);
  directionalLight.position.set(-1, 1, 1).normalize();
  scene.add(directionalLight);

  // Initialize a basic camera

  // Create a camera
  const camera = new THREE.Camera();
  scene.add(camera);

  // Handle arToolkitSource

  const arToolkitSource = new THREEx.ArToolkitSource({ sourceType: 'webcam' });

  // Handle resize

  arToolkitSource.init(() => arToolkitSource.onResize(renderer.domElement));

  window.addEventListener('resize', () => arToolkitSource.onResize(renderer.domElement));

  // Initialize arToolkitContext

  // Create atToolkitContext
  const arToolkitContext = new THREEx.ArToolkitContext({
    cameraParametersUrl: '/data/camera_para.dat',
    detectionMode: 'mono',
    maxDetectionRate: 30,
    canvasWidth: 80 * 3,
    canvasHeight: 60 * 3,
  });

  // Initialize it
  arToolkitContext.init(() =>
    // Copy projection matrix to camera
    camera.projectionMatrix.copy(arToolkitContext.getProjectionMatrix()));

  // update artoolkit on every frame
  uiRenderer.on('render', () => {
    if (arToolkitSource.ready === false) {
      return;
    }

    arToolkitContext.update(arToolkitSource.domElement);
  });

  // Create a ArMarkerControls

  const markerRoot = new THREE.Group();
  scene.add(markerRoot);

  const artoolkitMarker = new THREEx.ArMarkerControls(arToolkitContext, markerRoot, {
    type: 'pattern',
    patternUrl: '/data/patt.hiro',
  });

  // Add an object in the scene

  const grabScale = 2.3;

  const geometry = new THREE.CircleGeometry(grabScale, 32);
  const material = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;

  markerRoot.add(mesh);

  const upLeft = new THREE.Object3D();
  upLeft.position.set(-grabScale, 0, -grabScale);

  const upRight = new THREE.Object3D();
  upRight.position.set(grabScale, 0, -grabScale);

  const downLeft = new THREE.Object3D();
  downLeft.position.set(-grabScale, 0, grabScale);

  const downRight = new THREE.Object3D();
  downRight.position.set(grabScale, 0, grabScale);

  markerRoot.add(upLeft);
  markerRoot.add(upRight);
  markerRoot.add(downLeft);
  markerRoot.add(downRight);

  // Boring UI stuff

  let snd;
  const button = document.getElementById('run');
  button.onclick = () => {
    const canvas = document.getElementById('cover');
    const ctx = canvas.getContext('2d');

    const outCanvas = document.getElementById('output');
    const rollCanvas = document.getElementById('unrolled');
    const unspun = vinyl.unspin(outCanvas);

    rollCanvas.width = 512;//unspun.width;
    rollCanvas.height = 512;//unspun.height;
    // rollCanvas.getContext('2d').drawImage(unspun, 0, 0, rollCanvas.width, rollCanvas.height);

    snd = vinyl.sonify(unspun);
    console.log('sonified');
    // downloadWav(snd);

    vinyl.spectrogram(snd).then((spectrogram) => {
      // document.body.appendChild(spectrogram);
      const art = vinyl.spin(spectrogram);
      console.log('sonified');

      ctx.drawImage(art, 0, 0, canvas.width, canvas.height);

      scene.remove(mesh);

      const texture = new THREE.Texture(art);
      const artGeo = new THREE.CircleGeometry(grabScale, 32);
      const artMaterial = new THREE.MeshBasicMaterial({ map: texture });
      const artMesh = new THREE.Mesh(artGeo, artMaterial);
      artMesh.rotation.x = -Math.PI / 2;

      markerRoot.add(artMesh);
    });
  };

  const screechBtn = document.getElementById('screech');

  screechBtn.onclick = () => vinyl.play(snd);

  // Render the whole thing on the page

  uiRenderer.on('render', () => renderer.render(scene, camera));

  // FIXME eww
  let realCamera;
  setTimeout(() => { realCamera = new Camera(document.getElementsByTagName('video')[0]); }, 1000);

  let transform;
  const u8Img = new jsfeat.matrix_t(640, 480, jsfeat.U8_t | jsfeat.C1_t);
  const u8ImgWarp = new jsfeat.matrix_t(640, 480, jsfeat.U8_t | jsfeat.C1_t);

  // Run the rendering loop

  let lastTimeMsec = null;

  function animate(nowMsec) {
    // keep looping
    requestAnimationFrame(animate);
    // measure time
    lastTimeMsec = lastTimeMsec || nowMsec - (1000 / 60);
    const deltaMsec = Math.min(200, nowMsec - lastTimeMsec);
    lastTimeMsec = nowMsec;

    uiRenderer.emit('render', deltaMsec / 1000, nowMsec / 1000);

    if (realCamera) {
      // Apply mask
      const vinylCanvas = realCamera.snapshot();

      if (vinylCanvas && vinylCanvas.width !== 0) {
        // prep mask
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = 640;
        srcCanvas.height = 480;

        const srcCtx = srcCanvas.getContext('2d');
        srcCtx.drawImage(renderer.domElement, 0, 0, srcCanvas.width, srcCanvas.height);

        const maskData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);

        for (let i = 0; i < maskData.width * maskData.height; i += 1) {
          const imageIndex = i * 4;

          if (maskData.data[imageIndex + 3] === 0) {
            maskData.data[imageIndex + 3] = 255;
          } else {
            maskData.data[imageIndex + 3] = 0;
          }
        }

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = maskData.width;
        maskCanvas.height = maskData.height;

        const maskCtx = maskCanvas.getContext('2d');
        maskCtx.putImageData(maskData, 0, 0);

        const outCanvas = document.getElementById('output');
        outCanvas.width = 640;
        outCanvas.height = 480;
        const outCtx = outCanvas.getContext('2d');

        outCtx.drawImage(vinylCanvas, 0, 0, outCanvas.width, outCanvas.height);
        outCtx.drawImage(maskCanvas, 0, 0, outCanvas.width, outCanvas.height);

        // warp
        transform = new jsfeat.matrix_t(3, 3, jsfeat.F32_t | jsfeat.C1_t);

        const toScreen = (pos) => {
          const vector = new THREE.Vector3();
          const canvas = outCanvas;

          vector.copy(pos);

          // map to normalized device coordinate (NDC) space
          vector.project(camera);

          // map to 2D screen space
          vector.x = Math.round((vector.x + 1) * (canvas.width / 2));
          vector.y = Math.round((-vector.y + 1) * (canvas.height / 2));
          vector.z = 0;

          return vector;
        };

        const realPos = (obj) => {
          const vector = new THREE.Vector3();
          vector.setFromMatrixPosition(obj.matrixWorld);
          return vector;
        };

        const screenUpLeft = toScreen(realPos(upLeft));
        const screenUpRight = toScreen(realPos(upRight));
        const screenDownLeft = toScreen(realPos(downLeft));
        const screenDownRight = toScreen(realPos(downRight));

        jsfeat.math.perspective_4point_transform(transform,
          screenUpLeft.x, screenUpLeft.y, 0, 0,
          screenUpRight.x, screenUpRight.y, 640, 0,
          screenDownRight.x, screenDownRight.y, 640, 480,
          screenDownLeft.x, screenDownLeft.y, 0, 480);

        jsfeat.matmath.invert_3x3(transform, transform);

        const imageData = outCtx.getImageData(0, 0, outCanvas.width, outCanvas.height);
        jsfeat.imgproc.grayscale(imageData.data, maskData.width, maskData.height, u8Img);
        jsfeat.imgproc.warp_perspective(u8Img, u8ImgWarp, transform, 0);

        // Render result back to canvas
        const u32Data = new Uint32Array(imageData.data.buffer);
        const alpha = (0xff << 24);
        let pix = 0;

        for (let i = (u8ImgWarp.cols * u8ImgWarp.rows) - 1; i >= 0; i -= 1) {
          pix = u8ImgWarp.data[i];
          u32Data[i] = alpha | (pix << 16) | (pix << 8) | pix;
        }

        outCtx.putImageData(imageData, 0, 0);

        outCtx.fillStyle = '#fff';
        outCtx.fillRect(screenUpLeft.x, screenUpLeft.y, 4, 4);
        outCtx.fillRect(screenUpRight.x, screenUpRight.y, 4, 4);
        outCtx.fillRect(screenDownLeft.x, screenDownLeft.y, 4, 4);
        outCtx.fillRect(screenDownRight.x, screenDownRight.y, 4, 4);
      }
    }
  }

  // Kick it all off
  requestAnimationFrame(animate);
}

module.exports = {
  interfaceUser,
};

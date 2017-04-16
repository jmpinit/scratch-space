//////////////////////////////////////////////////////////////////////////////////
//    Init
//////////////////////////////////////////////////////////////////////////////////

const Camera = require('./camera');
const vinyl = require('./vinyl-press');;

// init renderer
var renderer  = new THREE.WebGLRenderer({
  // antialias  : true,
  alpha: true
});
renderer.setClearColor(new THREE.Color('lightgrey'), 0)
// renderer.setPixelRatio( 1/2 );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.domElement.style.position = 'absolute'
renderer.domElement.style.top = '0px'
renderer.domElement.style.left = '0px'
document.body.appendChild( renderer.domElement );

// array of functions for the rendering loop
var onRenderFcts= [];

// init scene and camera
var scene = new THREE.Scene();

var ambient = new THREE.AmbientLight( 0x666666 );
scene.add( ambient );

var directionalLight = new THREE.DirectionalLight( 0x887766 );
directionalLight.position.set( -1, 1, 1 ).normalize();
scene.add( directionalLight );

//////////////////////////////////////////////////////////////////////////////////
//    Initialize a basic camera
//////////////////////////////////////////////////////////////////////////////////

// Create a camera
var camera = new THREE.Camera();
scene.add(camera);

////////////////////////////////////////////////////////////////////////////////
//          handle arToolkitSource
////////////////////////////////////////////////////////////////////////////////

var arToolkitSource = new THREEx.ArToolkitSource({
  // to read from the webcam
  sourceType : 'webcam',

  // to read from an image
  // sourceType : 'image',
  // sourceUrl : '../../data/images/img.jpg',

  // to read from a video
  // sourceType : 'video',
  // sourceUrl : '../../data/videos/headtracking.mp4',
})

arToolkitSource.init(function onReady(){
  // handle resize of renderer
  arToolkitSource.onResize(renderer.domElement)
})

// handle resize
window.addEventListener('resize', function(){
  // handle arToolkitSource resize
  arToolkitSource.onResize(renderer.domElement)
})
////////////////////////////////////////////////////////////////////////////////
//          initialize arToolkitContext
////////////////////////////////////////////////////////////////////////////////


// create atToolkitContext
var arToolkitContext = new THREEx.ArToolkitContext({
  cameraParametersUrl: '/data/camera_para.dat',
  detectionMode: 'mono',
  maxDetectionRate: 30,
  canvasWidth: 80*3,
  canvasHeight: 60*3,
})
// initialize it
arToolkitContext.init(function onCompleted(){
  // copy projection matrix to camera
  camera.projectionMatrix.copy( arToolkitContext.getProjectionMatrix() );
})

// update artoolkit on every frame
onRenderFcts.push(function(){
  if( arToolkitSource.ready === false ) return

  arToolkitContext.update( arToolkitSource.domElement )
})


////////////////////////////////////////////////////////////////////////////////
//          Create a ArMarkerControls
////////////////////////////////////////////////////////////////////////////////

var markerRoot = new THREE.Group
scene.add(markerRoot)
var artoolkitMarker = new THREEx.ArMarkerControls(arToolkitContext, markerRoot, {
  type : 'pattern',
  patternUrl : '/data/patt.hiro'
  // patternUrl : '../../data/data/patt.kanji'
})

//////////////////////////////////////////////////////////////////////////////////
//    add an object in the scene
//////////////////////////////////////////////////////////////////////////////////

var geometry = new THREE.CircleGeometry(1, 32);
var material = new THREE.MeshBasicMaterial({ color: 0x000000 });
var mesh = new THREE.Mesh(geometry, material);
mesh.rotation.x = -Math.PI / 2;

/*
// add a torus knot
var geometry  = new THREE.CubeGeometry(1,1,1);
var material  = new THREE.MeshNormalMaterial({
  transparent : true,
  opacity: 0.5,
  side: THREE.DoubleSide
});
var mesh  = new THREE.Mesh( geometry, material );
mesh.position.y = geometry.parameters.height/2
*/

markerRoot.add( mesh );

/*
const upLeft = new THREE.Vector3(0, -0.5, -0.5);
const upRight = new THREE.Vector3(0, 0.5, -0.5);
const downLeft = new THREE.Vector3(0, -0.5, 0.5);
const downRight = new THREE.Vector3(0, 0.5, 0.5);
*/
const upLeft = new THREE.Object3D();
upLeft.position.set(-0.5, 0, -0.5);

const upRight = new THREE.Object3D();
upRight.position.set(0.5, 0, -0.5);

const downLeft = new THREE.Object3D();
downLeft.position.set(-0.5, 0, 0.5);

const downRight = new THREE.Object3D();
downRight.position.set(0.5, 0, 0.5);

markerRoot.add(upLeft);
markerRoot.add(upRight);
markerRoot.add(downLeft);
markerRoot.add(downRight);

/*
var geometry  = new THREE.TorusKnotGeometry(0.3,0.1,32,32);
var material  = new THREE.MeshNormalMaterial();
var mesh  = new THREE.Mesh( geometry, material );
mesh.position.y = 0.5
markerRoot.add( mesh );

onRenderFcts.push(function(){
  mesh.rotation.x += 0.1
})*/

// BORING UI STUFF

const button = document.getElementById('run');
button.onclick = function () {
  const canvas = document.getElementById('cover');
  const ctx = canvas.getContext('2d');

  const image = document.createElement('img');
  image.src = '/out.png';

  image.onload = function() {
    console.log('image loaded');
    vinyl.coverArt(vinyl.sonify(image)).then(art => {
      console.log('drawing art');
      ctx.drawImage(art, 0, 0);
    });
  };
};

//////////////////////////////////////////////////////////////////////////////////
//    render the whole thing on the page
//////////////////////////////////////////////////////////////////////////////////
// render the scene
onRenderFcts.push(function(){
  renderer.render( scene, camera );
});

let realCamera;
setTimeout(() => { realCamera = new Camera(document.getElementsByTagName('video')[0]); }, 1000);

var img_u8, img_u8_warp, transform;
 img_u8 = new jsfeat.matrix_t(640, 480, jsfeat.U8_t | jsfeat.C1_t);
      img_u8_warp = new jsfeat.matrix_t(640, 480, jsfeat.U8_t | jsfeat.C1_t);

// run the rendering loop
var lastTimeMsec= null
requestAnimationFrame(function animate(nowMsec){
  // keep looping
  requestAnimationFrame( animate );
  // measure time
  lastTimeMsec  = lastTimeMsec || nowMsec-1000/60
  var deltaMsec = Math.min(200, nowMsec - lastTimeMsec)
  lastTimeMsec  = nowMsec
  // call each update function
  onRenderFcts.forEach(function(onRenderFct){
    onRenderFct(deltaMsec/1000, nowMsec/1000)
  })

  if (realCamera) {
    // Apply mask
    const vinylCanvas = realCamera.snapshot();

    if (vinylCanvas && vinylCanvas.width !== 0) {
      // prep mask
      const srcCanvas = document.createElement('canvas');
      //srcCanvas.width = renderer.domElement.width;
      //srcCanvas.height = renderer.domElement.height;
      srcCanvas.width = 640;
      srcCanvas.height = 480;

      const srcCtx = srcCanvas.getContext('2d');
      srcCtx.drawImage(renderer.domElement, 0, 0, srcCanvas.width, srcCanvas.height);

      const maskData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);

      for (let i = 0; i < maskData.width * maskData.height; i++) {
        if (maskData.data[i * 4 + 3] === 0) {
          maskData.data[i * 4 + 3] = 255;
        } else {
          maskData.data[i * 4 + 3] = 0;
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

      /*jsfeat.math.perspective_4point_transform(transform, 0,   0,   50,  50,
                                                                640, 0,   550, 100,
                                                                640, 480, 300, 400,
                                                                0,   480, 100, 400);*/

      function toScreen(pos) {
        var vector = new THREE.Vector3();
        var canvas = outCanvas;

        vector.copy(pos);

        // map to normalized device coordinate (NDC) space
        vector.project( camera );

        // map to 2D screen space
        vector.x = Math.round( (   vector.x + 1 ) * canvas.width  / 2 );
        vector.y = Math.round( ( - vector.y + 1 ) * canvas.height / 2 );
        vector.z = 0;

        return vector;
      }

      function realPos(obj) {
        const vector = new THREE.Vector3();
        vector.setFromMatrixPosition(obj.matrixWorld);
        return vector;
      }

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
      jsfeat.imgproc.grayscale(imageData.data, maskData.width, maskData.height, img_u8);
      jsfeat.imgproc.warp_perspective(img_u8, img_u8_warp, transform, 0);

      // render result back to canvas
                    var data_u32 = new Uint32Array(imageData.data.buffer);
                    var alpha = (0xff << 24);
                    var i = img_u8_warp.cols*img_u8_warp.rows, pix = 0;
                    while(--i >= 0) {
                        pix = img_u8_warp.data[i];
                        data_u32[i] = alpha | (pix << 16) | (pix << 8) | pix;
                    }

                  outCtx.putImageData(imageData, 0, 0);
      //console.log(screenUpLeft);

      outCtx.fillStyle = '#fff';
      outCtx.fillRect(screenUpLeft.x, screenUpLeft.y, 4, 4);
      outCtx.fillRect(screenUpRight.x, screenUpRight.y, 4, 4);
      outCtx.fillRect(screenDownLeft.x, screenDownLeft.y, 4, 4);
      outCtx.fillRect(screenDownRight.x, screenDownRight.y, 4, 4);
    }
  }
})

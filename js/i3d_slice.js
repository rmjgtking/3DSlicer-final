// global declaration
var guiState = false;
var extrudeOject;
var mainObject;
var result1, result2;
var controls;
var transformControl, dragcontrols;
var drawState = false;
var fileOpen = false;
var splines, renderer, scene, camera, helper;
var splineHelperObjects = [];
var cameraPos = 207.28632136075476;
//end of global declaration

// @ new screen
$('#orbitCheck').attr('checked', true); // set orbitCheck checked
$("#heightSlider").slider("disable");

// mainObject Visibility checkbox event
$('#mainCheck').change(function () {
    if ($(this).prop('checked')) {
        scene.add(mainObject);
    }
    else {
        scene.remove(mainObject);
    }
    viewer3d.render();
})


// orbit checkbox event
$('#orbitCheck').change(function () {
    viewer3d.controls.enabled = $(this).prop('checked');
})

//tab event
$('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
    backState = false;
});

function fileinputBtn() {
    updateScreenUI();
    fileOpen = true;
}

$('#btstart').prop('disabled', true);
// $('#btslice').prop('disabled', true);
$('#btsave').prop('disabled', true);


// Start Draw button event
function startDraw() {
    $("#heightSlider").slider("enable");  // disable the height control slider
    $sliderInput.slider("disable");
    $('#btstart').prop('disabled', true);
    $('#btslice').prop('disabled', false);

    camera = viewer3d.camera;        //use original camera

    drawState = true;                       // makes the Slice button clickable, run the animate func
    renderer = viewer3d.renderer;        //use the original renderer
    scene = new THREE.Scene();           // use  new scene
    var curveZ = 0;

    var newLight = new THREE.AmbientLight(0xffffff);
    newLight.position.set(0, 0, 200);
    scene.add(newLight);

    var splinePointsLength = 4;
    var positions = [];
    var point = new THREE.Vector3();
    var pointGeo = new THREE.BoxBufferGeometry(1, 1, 1);
    var ARC_SEGMENTS = 200;
    var params = {
        addPoint: addPoint,
        removePoint: removePoint,
    };

    function init() {
        viewer3d.controls.enable = false;  // disabe original and use new orbit
        $('#orbitCheck').attr('checked', false);  // orbitCheck unchecked

        scene.background = new THREE.Color(0xf0f0f0);  // use new scene

        scene.add(camera);   // use the original cam
        for (var i = 0, il = shapes.length; i < il; i++) {  //adding planes to new scene for drawing curve
            scene.add(shapes[i]);
        }

        helper = new THREE.GridHelper(2000, 100); //@
        helper.position.z = - 199;
        helper.rotation.x = -0.5 * Math.PI;
        helper.material.opacity = 0.25;
        helper.material.transparent = true;
        scene.add(helper); //@  

        $viewer3d[0].appendChild(renderer.domElement); // use the original screen

        var gui = new dat.GUI({ autoPlace: false });
        gui.add(params, 'addPoint');
        gui.add(params, 'removePoint');
        var customContainer = document.getElementById('my-gui-container');  //add gui to html

        if (!guiState) { customContainer.appendChild(gui.domElement); } // avoid  repeatitive gui occur
        guiState = true;

        controls = new THREE.OrbitControls(camera, renderer.domElement);  // use new orbit control
        controls.damping = 0.2;
        controls.addEventListener('change', render);
        controls.addEventListener('start', function () {
            cancelHideTransform();
        });
        controls.addEventListener('end', function () {
            delayHideTransform();
        });
        transformControl = new THREE.TransformControls(camera, renderer.domElement);
        transformControl.addEventListener('change', render);
        transformControl.addEventListener('dragging-changed', function (event) {
            controls.enabled = !event.value;
        });
        scene.add(transformControl);
        // Hiding transform situation is a little in a mess :()
        transformControl.addEventListener('change', function () {
            cancelHideTransform();
        });
        transformControl.addEventListener('mouseDown', function () {
            cancelHideTransform();
        });
        transformControl.addEventListener('mouseUp', function () {
            delayHideTransform();
        });
        transformControl.addEventListener('objectChange', function () {
            transformControl.object.position.z = curveZ;
            updateSplineOutline();
        });
        dragcontrols = new THREE.DragControls(splineHelperObjects, camera, renderer.domElement); //
        dragcontrols.enabled = false;
        dragcontrols.addEventListener('hoveron', function (event) {
            transformControl.attach(event.object);
            cancelHideTransform();
        });

        dragcontrols.addEventListener('hoveroff', function () {
            delayHideTransform();
        });
        var hiding;
        function delayHideTransform() {
            cancelHideTransform();
            hideTransform();
        }
        function hideTransform() {
            hiding = setTimeout(function () {
                transformControl.detach(transformControl.object);
            }, 2500);
        }
        function cancelHideTransform() {
            if (hiding) clearTimeout(hiding);
        }
        // initial drawing curve
        for (var i = 0; i < splinePointsLength; i++) {
            addSplineObject(positions[i]);
        }
        positions = [];
        for (var i = 0; i < splinePointsLength; i++) {
            positions.push(splineHelperObjects[i].position);
        }
        var geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ARC_SEGMENTS * 3), 3));
        var curve = new THREE.CatmullRomCurve3(positions);
        curve.curveType = 'catmullrom';
        curve.mesh = new THREE.Line(geometry.clone(), new THREE.LineBasicMaterial({
            color: 0xff0000,
            opacity: 0.35
        }));
        curve.mesh.castShadow = true;
        splines = curve;
        scene.add(splines.mesh);
        load([new THREE.Vector3(-10, 25, curveZ),
        new THREE.Vector3(- 15, 10, curveZ),
        new THREE.Vector3(5, 10, curveZ),
        new THREE.Vector3(-5, 20, curveZ)]);
    }

    function addSplineObject(position) {
        var material = new THREE.MeshLambertMaterial({ color: 0x000000 });
        var object = new THREE.Mesh(pointGeo, material);
        if (position) {
            object.position.copy(position);
        } else {
            object.position.x = 20 + Math.random() * 10;
            object.position.y = -10 + Math.random() * 10;
            object.position.z = curveZ;
        }
        object.castShadow = true;
        object.receiveShadow = true;
        scene.add(object);
        splineHelperObjects.push(object);
        return object;
    }
    function addPoint() {
        splinePointsLength++;
        positions.push(addSplineObject().position);
        updateSplineOutline();
    }
    function removePoint() {
        if (splinePointsLength <= 4) {
            return;
        }
        splinePointsLength--;
        positions.pop();
        scene.remove(splineHelperObjects.pop());
        updateSplineOutline();
    }

    function updateSplineOutline() {
        var splineMesh = splines.mesh;
        var position = splineMesh.geometry.attributes.position;
        for (var i = 0; i < ARC_SEGMENTS; i++) {
            var t = i / (ARC_SEGMENTS - 1);
            splines.getPoint(t, point);
            position.setXYZ(i, point.x, point.y, curveZ);
        }
        position.needsUpdate = true;
    }

    function load(new_positions) {
        while (new_positions.length > positions.length) {
            addPoint();
        }
        while (new_positions.length < positions.length) {
            removePoint();
        }
        for (var i = 0; i < positions.length; i++) {
            positions[i].copy(new_positions[i]);
        }
        updateSplineOutline();
    }

    init();
    animate();
    function animate() {
        if (drawState) {
            camera.lookAt(0, 0, 0);
            camera.position.set(0, 0, cameraPos);
            camera.rotation.set(9.999744901157216e-7, -7.142772144680902e-9, -0.007142832882214021);
            controls.enabled = false;       // disable the new orbit controller
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
            console.log("curve drawing animate");
        }
    }
    function render() {
        splines.mesh.visible = true;
        renderer.render(scene, camera);
    }
} // @ end of start drawing


//////////////////////////////////////
function getBSP(m) {
    return new ThreeBSP(m);
}

function getMin(obj) {
    pts = obj.geometry.vertices;
    min = pts[0].z;
    for (var i = 1; i < pts.length; ++i) {
        if (pts[i].z < min)
            min = pts[i].z;
    }
    return min;
}


function CylinderCurvedSurfaceGeometry(pts, ) {

    var plane = new THREE.PlaneGeometry(50, 100, 50, 200);
    var index = 0;
    for (var i = 0; i <= 200; i++) {
        for (var j = 0; j <= 50; j++) {
            plane.vertices[index].x = pts[j].x;
            plane.vertices[index].y = pts[j].y;
            plane.vertices[index].z = pts[j].z + i * 0.3;
            index++;
        }
    }
    return plane;
}

// slice button event
function SliceAndShow() {
    if (drawState) {  // after Start Drawing button clicked
        $('#btstart').prop('disabled', true); // disabling Start_Drawing and Slice button 
        $('#btslice').prop('disabled', true);
        $('#btsave').prop('disabled', false);
        $('#mainCheck').prop('disabled', true);
        viewer3d.controls.enabled = false;  // use original orbit control
        controls.enabled = false;

        // disable curve drawing
        splines.mesh.position.set(10000, 0, 0);
        transformControl.enabled = false;
        transformControl.position.set(1000, 0, 0);
        dragcontrols.eanbled = false;
        for (var i = 0; i < splineHelperObjects.length; ++i) {
            splineHelperObjects[i].visible = false;
        }
        // 
        $('#orbitCheck').attr('checked', false);  // orbitCheck checked

        drawState = false; // stop Drawing the curve
        mainSlicing();
    }
}


function mainSlicing() {
    viewer3d.scene.remove.apply(viewer3d.scene, viewer3d.scene.children); // refreshing original scene


    var myGeo = new THREE.Geometry();
    myGeo.vertices = splines.getSpacedPoints(50);
    var planeGeo = CylinderCurvedSurfaceGeometry(myGeo.vertices);
    var circleMaterial = new THREE.MeshPhongMaterial({ color: 0xf000aa });
    var plane = new THREE.Mesh(planeGeo, circleMaterial);  // plane
    plane.position.setZ(-50);

    console.log('intersection begins...');
    var temp = getBSP(mainObject).subtract(getBSP(plane));

    console.log('Subtraction begins...');
    var temp1 = getBSP(mainObject).intersect(getBSP(plane));
    console.log("Loading sliced objects...");

    var geo = temp.toGeometry();
    var geo1 = temp1.toGeometry();


    result1 = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color: 0xffaa0a }));
    result2 = new THREE.Mesh(geo1, new THREE.MeshPhongMaterial({ color: 0xffaa0a }));


    // camera setting of final result show screen
    viewer3d.camera.lookAt(new THREE.Vector3(0, 0, 0));
    viewer3d.camera.position.set(0, 40, 200);
    viewer3d.scene.add(helper);

    result1.position.y += 30;  // separation of cut objects



    var lights = []; // adding light to the final scene
    lights[0] = new THREE.PointLight(0xffffff, 1, 0);
    lights[1] = new THREE.PointLight(0xffffff, 1, 0);
    lights[2] = new THREE.PointLight(0xffffff, 1, 0);
    lights[0].position.set(0, 2000, 0);
    lights[1].position.set(1000, 2000, 1000);
    lights[2].position.set(-1000, -2000, -1000);
    viewer3d.scene.add(lights[0]);
    viewer3d.scene.add(lights[1]);
    viewer3d.scene.add(lights[2]);  // add light to original scene
    viewer3d.scene.add(result1);
    viewer3d.scene.add(result2);

    // var drContronls, drGroup;   //start picking Object
    var objects = [];
    var enableSelection = false;
    var mouse = new THREE.Vector2(), raycaster = new THREE.Raycaster();
    drGroup = new THREE.Group();
    viewer3d.scene.add(drGroup);
    objects.push(result1);
    objects.push(result2);
    drContronls = new THREE.DragControls([...objects], viewer3d.camera, viewer3d.renderer.domElement);
    drContronls.addEventListener('drag', drRender);
    viewer3d.renderer.domElement.addEventListener('click', onClick, false);
    drRender();
    function onClick(event) {
        event.preventDefault();
        if (enableSelection === true) {
            var draggableObjects = drContronls.getObjects();
            draggableObjects.length = 0;
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, viewer3d.camera);
            var intersections = raycaster.intersectObjects(objects, true);
            if (intersections.length > 0) {
                var object = intersections[0].object;
                if (drGroup.children.includes(object) === true) {
                    object.material.emissive.set(0x000000);
                    viewer3d.scene.attach(object);
                } else {
                    object.material.emissive.set(0xaaaaaa);
                    drGroup.attach(object);
                }
                drContronls.transformGroup = true;
                draggableObjects.push(drGroup);
            }
            if (group.children.length === 0) {
                drContronls.transformdrGroup = false;
                draggableObjects.push(...objects);
            }
        }
        drRender();
    }
    function drRender() {
        viewer3d.render(viewer3d.scene, viewer3d.camera);
    }  // end of picking
}

// Save STL button event
function exportASCII() {
    $('#btsave').prop('disabled', true);   // disable save button
    var group = new THREE.Group();
    group.add(result1);
    group.add(result2);
    var exporter = new THREE.STLExporter();
    var rr = exporter.parse(group);
    saveString(rr, 'SlicedObjects.stl');
    console.log('stl successfully saved..');
    fileopen = false;
}
var link = document.createElement('a');
link.style.display = 'none';
document.body.appendChild(link);

function save(blob, filename) {
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}
function saveString(text, filename) {
    save(new Blob([text], { type: 'text/plain' }), filename);
}
function saveArrayBuffer(buffer, filename) {
    save(new Blob([buffer], { type: 'application/octet-stream' }), filename);
}
//end of save



function removeLines() {
    if (lines && lines.length) {
        for (var i = 0, il = lines.length; i < il; i++) {
            viewer3d.removeObject(lines[i]);
        }
    }
}// @

function drawVertices(points) {
    var sphere, sphereGeometry, sphereMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff
    });
    for (i = 0, il = points.length; i < il; i++) {
        sphereGeometry = new THREE.SphereGeometry(1);
        sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.copy(points[i]);
        viewer3d.scene.add(sphere);
    }
}
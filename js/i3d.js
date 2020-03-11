var i3dsettings = new xyzslicer.I3DSettings({

    slicer: {
        layers: {
            height: 100 // μm
        },
        light: {
            on: 1000,
            off: 500
        },
        zip: true,
        svg: false,
        png: true,
        speed: false,
        speedDelay: 10, // ms
        panel: {
            collapsed: false,
            position: 1
        },
        lifting: {
            speed: 50, // mm/min
            height: 3,  // mm
        }
    },
    mesh: {
        panel: {
            collapsed: false,
            position: 2
        }
    },
    file: {
        panel: {
            collapsed: false,
            position: 0
        }
    },
    change: {
        panel: {
            collapsed: false,
            position: 3
        },
        mirror: false
    },
    buildVolume: {
        size: { x: 100, y: 100, z: 100 }, // mm
        unit: 'mm',                         // mm or in
        color: 0xcccccc,
        opacity: 0.1,
        panel: {
            collapsed: false,
            position: 4
        }
    },

    display: {
        width: window.display.width,
        height: window.display.height,
        diagonal: { size: 22, unit: 'in' },
        panel: {
            collapsed: false,
            position: 6
        }
    },
    bleached: {
        mesh: '#044EB7',
        slice: '#88ee11',
        panel: {
            collapsed: false,
            position: 7
        }
    },
    amber: {
        density: 1.1, // g/cm3
        price: 50,   // $
        panel: {
            collapsed: false,
            position: 5
        }
    },
    viewer3d: {
        color: 0xdddddd
    }
});

// -----------------------------------------------------------------------------
// Error handler
// -----------------------------------------------------------------------------
function errorHandler(error) {
    console.error(error);
}
//handle button

// -----------------------------------------------------------------------------
// XYZSlicer
// -----------------------------------------------------------------------------
var slicer = new xyzslicer.XYZSlicer();
var shapes, slices, lines;
function removeSlices() {
    if (slices && slices.length) {
        for (var i = 0, il = slices.length; i < il; i++) {
            viewer2d.removeObject(slices[i]);
        }
    }

    sliceImage('none');
}

function removeShapes() {
    if (shapes && shapes.length) {
        for (var i = 0, il = shapes.length; i < il; i++) {
            viewer3d.removeObject(shapes[i]);
        }
    }
}


function hexToDec(hex) {
    return parseInt(hex.toString().replace('#', ''), 16);
}



function getSlice(layerNumber) {
    // remove old shapes
    removeLines();
    removeSlices();
    removeShapes();

    // ...
    $slicerLayerValue.html(layerNumber);

    if (layerNumber < 1) {
        viewer2d.render();
        viewer3d.render();
        return;
    }

    if (transformations.update) {
        throw 'transformations not applyed...';
    }

    // get position
    layerHeight = i3dsettings.get('slicer.layers.height') / 1000;
    zPosition = layerNumber * layerHeight;

    // get faces
    var faces = slicer.getFaces(zPosition);
    var linePos = faces.shapes;//@



    // get new shapes list
    shapes = faces.meshes;
    zPosition -= viewer3d.buildVolume.size.z / 2;

    // slices
    slices = [];
    lines = [];//@
    var slice, shape;
    var sliceColor = hexToDec(i3dsettings.get('bleached.slice'));

    // add new shapes
    for (var i = 0, il = shapes.length; i < il; i++) {
        shape = shapes[i];
        slice = shape.clone();

        slice.material = slice.material.clone();
        slice.material.color.setHex(0xdddddd);
        viewer2d.addObject(slice);
        slices.push(slice);

        shape.material.color.setHex(sliceColor);
        shape.material.depthTest = false;
        shape.position.z = zPosition;
        // @ 
        var extrudeSettings = { amount: 0.1, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 1, bevelThickness: 0.1 };
        var panel = new THREE.Mesh(new THREE.ExtrudeBufferGeometry(linePos[i], extrudeSettings), new THREE.MeshBasicMaterial({ color: 0x00f0f0 }));
        panel.position.z = zPosition;
        lines.push(panel);
        viewer3d.scene.add(panel);
        //@
        viewer3d.scene.add(shape);
    }

    // render 3D view
    viewer3d.render();

    // render 2D view
    viewer2d.screenshot(function (dataURL) {
        sliceImage(dataURL);

        if (PNGExport) {
            var fileName = layerNumber + '.png';
            var imgData = dataURL.substr(dataURL.indexOf(',') + 1);
            zipFolder.file(fileName, imgData, { base64: true });
        }
    });

    // SVG export
    if (SVGExport) {
        // offset for positive coords
        var xOffset = Math.abs(slicer.mesh.geometry.boundingBox.min.x);
        var yOffset = Math.abs(slicer.mesh.geometry.boundingBox.min.y);

        function SVGPath(actions, dir) {
            var path = [];
            var area = 0;
            var a, b, c, x, y;

            if (dir != 'ccw') {
                dir = 'cw';
            }

            actions.push({ action: 'lineTo', args: actions[0].args });

            for (var i = 0, il = actions.length; i < il; i++) {
                a = actions[i];

                if (i > 0) {
                    b = actions[i - 1];
                    area += a.args[0] * b.args[1];
                    area -= b.args[0] * a.args[1];
                }

                c = a.action == 'moveTo' ? 'M' : 'L';
                x = (a.args[0] + xOffset);
                y = (a.args[1] + yOffset);

                path.push(c + x + ' ' + y);
            }

            if (dir == 'cw' && area < 0 || dir == 'ccw' && area > 0) {
                path = path.reverse();
                path[0] = path[0].replace(/^L/, 'M');
                path[actions.length - 1] = path[actions.length - 1].replace(/^M/, 'L');
            }

            return path.join(' ') + ' Z ';
        }

        // svg start
        var size = slicer.mesh.getSize();
        var svg = '<svg version="1.1" width="' + size.x + '" height="' + size.y + '" baseProfile="full" xmlns="http://www.w3.org/2000/svg">\n';

        // svg background
        svg += '<rect x="0" y="0" width="100%" height="100%" style="fill:black; stroke:none"/>\n';

        // fix coordinate system (rotate 180°)
        svg += '<g change="translate(0, ' + size.y + ') scale(1, -1)">\n';

        // draw main paths
        var actions;
        for (var i = 0, il = faces.shapes.length; i < il; i++) {
            actions = faces.shapes[i].actions;

            // path start
            svg += '<path d="';

            // main paths
            svg += SVGPath(actions, 'cw');

            // holes paths
            var holes = faces.shapes[i].holes;
            for (var j = 0, jl = holes.length; j < jl; j++) {
                svg += SVGPath(holes[j].actions, 'ccw');
            }

            // path end
            svg += '" style="fill:white; stroke:none" />\n';
        }

        // svg end
        svg += '</g>';
        svg += '</svg>';

        // add svg file to zip
        zipFolder.file(layerNumber + '.svg', svg);
    }
}

function sliceImage(dataURL) {
    i3dsettings.set('slice.dataURL', dataURL || 'none');
}

// -----------------------------------------------------------------------------
// UI
// -----------------------------------------------------------------------------
// Main container
var $main = $('#main');

// I3DViewer 3D
var $viewer3d = $('#viewer3d');
var viewer3d = new xyzslicer.I3DViewer3D({
    color: i3dsettings.get('viewer3d.color'),
    buildVolume: i3dsettings.get('buildVolume'),
    target: $viewer3d[0]
});

// Triangulation algorithm
//THREE.Triangulation.setTimer(true);
THREE.Triangulation.setLibrary('earcut');
//THREE.Triangulation.setLibrary('libtess');
//THREE.Triangulation.setLibrary('poly2tri');

// I3DViewer 2D
var viewer2dWin = null;
var $openViewer2D = $('#open-viewer-2d');

var viewer2d = new xyzslicer.I3DViewer2D({
    target: null, // off-display
    color: 0x000000,
    buildPlate: {
        size: i3dsettings.get('buildVolume.size'),
        unit: i3dsettings.get('buildVolume.unit'),
        color: 0x000000,
        opacity: 0 // hide build plate
    },
    size: i3dsettings.get('display')
});

$openViewer2D.click(function (e) {
    if (viewer2dWin == null || viewer2dWin.closed) {
        var display = i3dsettings.get('display');
        var size = 'width=' + display.width + ', height=' + display.height;
        var opts = 'menubar=0, toolbar=0, location=0, directories=0, personalbar=0, status=0, resizable=1, dependent=0'

        viewer2dWin = window.open('viewer2d.html', 'SliderViewer2D', size + ', ' + opts);

        $(viewer2dWin).on('beforeunload', function (e) {
            viewer2dWin = null;
        })
            .load(function (e) {
                getSlice($sliderInput.slider('getValue'));
            });
    }
    else {
        viewer2dWin.focus();
    }

    return false;
});

// Slider
var $sliderInput = $('#slider input');

$sliderInput.slider({ reversed: true }).on('change', function (e) {
    if (fileOpen) {
        $('#btstart').prop('disabled', false);
        getSlice(e.value.newValue);
    }
});

var $sliderElement = $('#slider .slider');
var $sliderMaxValue = $('#slider .max');
//@ 
$('#heightSlider').slider({ reversed: false }).on('change', function (e) {
    if (fileOpen) {
        // the changing value of slider
        // getSlice(e.value.newValue);
        cameraPos = 207.28632136075476 - e.value.newValue;
    }
});//@

function updateSliderUI() {
    var layersHeight = i3dsettings.get('slicer.layers.height') / 1000;
    var layersNumber = Math.floor(slicer.mesh.getSize().z / layersHeight);
    $sliderInput.slider('setAttribute', 'max', layersNumber);
    $sliderMaxValue.html(layersNumber);
    $slicerLayersValue.html(layersNumber);
    // $('#heightSlider').slider('setAttribute', 'max', layersNumber); //@
}

// Sidebar
var $sidebar = $('#sidebar');
var $panels = $sidebar.find('.panel');

$sidebar.sortable({
    axis: 'y',
    handle: '.panel-heading',
    cancel: '.panel-toggle',
    placeholder: 'panel-placeholder', forcePlaceholderSize: true,
    // update panel position
    stop: function (e, ui) {
        $sidebar.find('.panel').each(function (i, element) {
            i3dsettings.set(_.camelCase(element.id) + '.panel.position', i);
        });
    }
});

// Sort panels
var panels = [];
var panel;

_.forEach(i3dsettings.i3dsettings, function (item, namespace) {
    if (item && item.panel) {
        panels[item.panel.position] = $('#' + _.kebabCase(namespace));
    }
});

for (var i in panels) {
    $sidebar.append(panels[i]);
}

// Init panel
function initPanel(name) {
    var id = _.kebabCase(name);
    var name = _.camelCase(name);
    var $body = $('#' + id + '-body');

    $body.on('hidden.bs.collapse', function () {
        i3dsettings.set(name + '.panel.collapsed', true);
    });

    $body.on('shown.bs.collapse', function () {
        i3dsettings.set(name + '.panel.collapsed', false);
    });

    if (i3dsettings.get(name + '.panel.collapsed')) {
        $body.collapse('hide');
    }

    return $body;
}

// Unit converter
function parseUnit(value, unit) {
    return parseFloat(unit == 'in' ? (value / 25.4) : (value * 25.4));
}

// File panel
var $fileBody = initPanel('document');
var $fileInput = $fileBody.find('#document-input');
var loadedFile = null;

$fileInput.on('change', function (e) {
    resetTransformValues();
    loadedFile = e.target.files[0];
    loader.loadFile(loadedFile);
});

// Mesh panel
var $meshBody = initPanel('collaps');
var $meshFaces = $meshBody.find('#collaps-faces');
var $meshVolume = $meshBody.find('#collaps-volume');
var $meshWeight = $meshBody.find('#collaps-weight');
var $meshCost = $meshBody.find('#collaps-cost');
var $meshSizeX = $meshBody.find('#collaps-size-x');
var $meshSizeY = $meshBody.find('#collaps-size-y');
var $meshSizeZ = $meshBody.find('#collaps-size-z');
var $meshSizeUnit = $meshBody.find('.collaps-size-unit');

function updateMeshInfoUI() {
    var mesh = slicer.mesh;
    var size = mesh.getSize();
    var unit = i3dsettings.get('buildVolume.unit');

    updateSliderUI();

    $meshSizeUnit.html(unit);

    if (unit == 'in') {
        size.x = parseUnit(size.x, 'in');
        size.y = parseUnit(size.y, 'in');
        size.z = parseUnit(size.z, 'in');
    }

    $meshSizeX.html(size.x.toFixed(2));
    $meshSizeY.html(size.y.toFixed(2));
    $meshSizeZ.html(size.z.toFixed(2));

    var volume = parseInt(mesh.getVolume() / 1000);                   // cm3/ml
    var weight = (volume * i3dsettings.get('amber.density')).toFixed(2); // g
    var cost = volume * i3dsettings.get('amber.price') / 1000;

    $meshFaces.html(mesh.geometry.faces.length);
    $meshVolume.html(volume);
    $meshWeight.html(weight);
    $meshCost.html(cost);
}

// XYZSlicer panel
var $slicerBody = initPanel('canvas');
var $slicerLayerHeight = $slicerBody.find('#canvas-layers-height');
var $slicerLayersValue = $slicerBody.find('#canvas-layers-value');
var $slicerLayerValue = $slicerBody.find('#canvas-layer-value');
var $slicerLightOff = $slicerBody.find('#canvas-light-off');
var $slicerLightOn = $slicerBody.find('#canvas-light-on');

var $slicerLiftingSpeed = $slicerBody.find('#canvas-lifting-speed');
var $slicerLiftingHeight = $slicerBody.find('#canvas-lifting-height');

var $slicerExportPNG = $slicerBody.find('#canvas-image-extension-png');
var $slicerExportSVG = $slicerBody.find('#canvas-image-extension-svg');

var $slicerSpeedYes = $slicerBody.find('#canvas-speed-yes');
var $slicerSpeedNo = $slicerBody.find('#canvas-speed-no');
var $slicerSpeedDelay = $slicerBody.find('#canvas-speed-delay');
var $slicerMakeZipYes = $slicerBody.find('#canvas-make-zip-yes');
var $slicerMakeZipNo = $slicerBody.find('#canvas-make-zip-no');
var $sliceButton = $sidebar.find('#canvas-button');
var $abortButton = $sidebar.find('#cancel-button');
var $zipButton = $sidebar.find('#compress-button');

function updateSlicerUI() {
    var slicer = i3dsettings.get('slicer');

    $slicerSpeedDelay.val(slicer.speedDelay);
    $slicerLayerHeight.val(slicer.layers.height);
    $slicerLightOff.val(slicer.light.off);
    $slicerLightOn.val(slicer.light.on);

    $slicerLiftingSpeed.val(slicer.lifting.speed);
    $slicerLiftingHeight.val(slicer.lifting.height);
}

function updateSlicerSettings() {
    i3dsettings.set('slicer.layers.height', $slicerLayerHeight.val());
    i3dsettings.set('slicer.light.off', $slicerLightOff.val());
    i3dsettings.set('slicer.light.on', $slicerLightOn.val());

    i3dsettings.set('slicer.lifting.speed', $slicerLiftingSpeed.val());
    i3dsettings.set('slicer.lifting.height', $slicerLiftingHeight.val());

    i3dsettings.set('slicer.png', $slicerExportPNG[0].checked);
    i3dsettings.set('slicer.svg', $slicerExportSVG[0].checked);

    i3dsettings.set('slicer.zip', $slicerMakeZipYes[0].checked);
    i3dsettings.set('slicer.speed', $slicerSpeedYes[0].checked);
    i3dsettings.set('slicer.speedDelay', $slicerSpeedDelay.val());

    getSlice($sliderInput.slider('getValue'));

    updateSliderUI();
}

var sliceInterval;
var expectedSliceInterval;
var currentSliceNumber;
var slicesNumber;
var zipFile;
var zipFolder;

var SVGExport;
var PNGExport;

var layerHeight;
var zPosition;

var exposureTime;
var liftingSpeed;
var liftingHeight;
var liftingTime;
var estimatedTime;

function endSlicing() {
    sliceImage('none');
    $sidebar.find('input, button').prop('disabled', false);
    $sliderInput.slider('enable');
    $abortButton.addClass('hidden');
    $sliceButton.removeClass('hidden');
    $zipButton.attr('disabled', !$slicerMakeZipYes[0].checked);
}



function slice() {
    currentSliceNumber++;

    if (currentSliceNumber > slicesNumber) {
        return endSlicing();
    }

    getSlice(currentSliceNumber);
    $sliderInput.slider('setValue', currentSliceNumber);

    var time = Date.now();
    var diff = time - expectedSliceInterval;

    !i3dsettings.get('slicer.speed') && viewer2dWin && setTimeout(function () {
        sliceImage('none');
    }, i3dsettings.get('slicer.light.on'));

    expectedSliceInterval += sliceInterval;
    setTimeout(slice, Math.max(0, sliceInterval - diff));
}


function startSlicing() {
    var times = i3dsettings.get('slicer.light');
    if (i3dsettings.get('slicer.speed')) {
        sliceInterval = parseInt(i3dsettings.get('slicer.speedDelay'));
    }
    else {
        sliceInterval = parseInt(times.on) + parseInt(times.off);
    }
    expectedSliceInterval = Date.now() + sliceInterval;
    slicesNumber = parseInt($slicerLayersValue.html());
    currentSliceNumber = 0;

    zipFile = null;
    zipFolder = null;
    SVGExport = null;
    PNGExport = null;

    if (i3dsettings.get('slicer.zip')) {
        zipFile = new JSZip();
        zipFolder = zipFile.folder('slices');
        // zipFile.file("README.txt", 'Generated by xyzslicer.js\r\nhttp://lautr3k.github.io/xyzslicer.js/\r\n');
        zipFile.file("xyzslicer.json", JSON.stringify({
            imageExtension: i3dsettings.get('slicer.png') ? 'png' : 'svg',
            imageDirectory: 'slices',
            displayWidth: i3dsettings.get('display.width'),
            displayHeight: i3dsettings.get('display.height'),
            displaySize: i3dsettings.get('display.diagonal.size'),
            displayUnit: i3dsettings.get('display.diagonal.unit'),
            layersNumber: slicesNumber,
            layersHeight: i3dsettings.get('slicer.layers.height') / 1000,     // mm
            exposureTime: parseInt(i3dsettings.get('slicer.light.on')),       // ms
            liftingSpeed: parseInt(i3dsettings.get('slicer.lifting.speed')),  // mm/min
            liftingHeight: parseInt(i3dsettings.get('slicer.lifting.height'))  // mm
        }, null, 2));
        SVGExport = i3dsettings.get('slicer.svg');
        PNGExport = i3dsettings.get('slicer.png');
    }

    slicesNumber && slice();
}

$zipButton.on('click', function (e) {
    if (zipFile) {
        var name = 'xyzslicer';
        if (loadedFile && loadedFile.name) {
            name = loadedFile.name;
        }
        saveAs(zipFile.generate({ type: 'blob' }), name + '.zip');
    }
});


$abortButton.on('click', function (e) {
    currentSliceNumber = slicesNumber + 1;
    endSlicing();
});



$sliceButton.on('click', function (e) {
    $sidebar.find('input, button').prop('disabled', true);
    $('.panel-heading button').prop('disabled', false);
    $openViewer2D.prop('disabled', false);
    $sliderInput.slider('disable');
    $abortButton.prop('disabled', false);
    $abortButton.removeClass('hidden');
    $sliceButton.addClass('hidden');
    startSlicing();
});


$('#canvas-image-extension-' + (i3dsettings.get('slicer.png') ? 'png' : 'svg')).prop('checked', true);
$('#canvas-make-zip-' + (i3dsettings.get('slicer.zip') ? 'yes' : 'no')).prop('checked', true);
$('#canvas-speed-' + (i3dsettings.get('slicer.speed') ? 'yes' : 'no')).prop('checked', true);
$('#canvas input').on('input, change', updateSlicerSettings);
updateSlicerUI();

// Build volume panel
var $buildVolumeBody = initPanel('buildVolume');
var $buildVolumeX = $buildVolumeBody.find('#make-vol-x');
var $buildVolumeY = $buildVolumeBody.find('#make-vol-y');
var $buildVolumeZ = $buildVolumeBody.find('#make-vol-z');

function updateBuildVolumeSizeStep() {
    var step = (i3dsettings.get('buildVolume.unit') == 'in') ? 0.01 : 1;

    $buildVolumeX.prop('step', step);
    $buildVolumeY.prop('step', step);
    $buildVolumeZ.prop('step', step);
}

function updateBuildVolumeUI() {
    var buildVolume = i3dsettings.get('buildVolume');

    $buildVolumeX.val(buildVolume.size.x);
    $buildVolumeY.val(buildVolume.size.y);
    $buildVolumeZ.val(buildVolume.size.z);

    updateBuildVolumeSizeStep();
}


function updateBuildVolumeSettings() {
    var unit = $('#make-vol input[type=radio]:checked').val();

    if (unit != i3dsettings.get('buildVolume.unit')) {
        var size = i3dsettings.get('buildVolume.size');

        $buildVolumeX.val(parseUnit(size.x, unit));
        $buildVolumeY.val(parseUnit(size.y, unit));
        $buildVolumeZ.val(parseUnit(size.z, unit));
    }

    i3dsettings.set('buildVolume', {
        size: {
            x: $buildVolumeX.val(),
            y: $buildVolumeY.val(),
            z: $buildVolumeZ.val()
        },
        unit: unit
    });

    viewer3d.setBuildVolume(i3dsettings.get('buildVolume'));
    slicer.mesh && viewer3d.dropObject(slicer.mesh);
    viewer3d.render();

    size && updateMeshInfoUI();

    updateBuildVolumeSizeStep();
    getSlice($sliderInput.slider('getValue'));
}

$('#make-vol-unit-' + i3dsettings.get('buildVolume.unit')).prop('checked', true);
$('#make-vol input[type=radio]').on('change', updateBuildVolumeSettings);
$('#make-vol input').on('input', updateBuildVolumeSettings);
updateBuildVolumeUI();

// Resin panel
var $amberBody = initPanel('amber');
var $amberPrice = $amberBody.find('#amber-price');
var $amberDensity = $amberBody.find('#amber-density');

function updateResinSettings() {
    i3dsettings.set('amber.price', $amberPrice.val());
    i3dsettings.set('amber.density', $amberDensity.val());
    updateMeshInfoUI();
}


function updateResinUI() {
    var amber = i3dsettings.get('amber');

    $amberDensity.val(amber.density);
    $amberPrice.val(amber.price);
}


$('#amber input').on('input', updateResinSettings);
updateResinUI();

// Screen
var $displayBody = initPanel('display');
var $displayWidth = $displayBody.find('#display-width');
var $displayHeight = $displayBody.find('#display-height');
var $displayDiagonalSize = $displayBody.find('#display-diagonal-size');
var $displayDotPitch = $displayBody.find('#display-dot-pitch');

function updateScreenUI() {
    var display = i3dsettings.get('display');
    $displayWidth.val(display.width);
    $displayHeight.val(display.height);
    $displayDiagonalSize.val(display.diagonal.size);
    $displayDotPitch.html(viewer2d.dotPitch.toFixed(2));

    viewer2d.setScreenResolution(display);
}

function updateScreenSettings() {
    var unit = $('#display input[type=radio]:checked').val();

    if (unit != i3dsettings.get('display.diagonal.unit')) {
        $displayDiagonalSize.val(
            parseUnit(i3dsettings.get('display.diagonal.size'), unit)
        );
    }

    i3dsettings.set('display', {
        width: $displayWidth.val(),
        height: $displayHeight.val(),
        diagonal: {
            size: $displayDiagonalSize.val(),
            unit: unit
        }
    });

    viewer2d.setScreenResolution(i3dsettings.get('display'));
    $displayDotPitch.html(viewer2d.dotPitch.toFixed(2));

    getSlice($sliderInput.slider('getValue'));
}

$('#display-diagonal-unit-' + i3dsettings.get('display.diagonal.unit')).prop('checked', true);
$('#display input[type=radio]').on('change', updateScreenSettings);
$('#display input').on('input', updateScreenSettings);
updateScreenUI();

// Colors
var $bleachedBody = initPanel('bleached');
var $meshColor = $bleachedBody.find('#mesh-color');
var $sliceColor = $bleachedBody.find('#slice-color');

function updateColorsUI() {
    var bleached = i3dsettings.get('bleached');

    $meshColor.val(bleached.mesh);
    $sliceColor.val(bleached.slice);
}

updateColorsUI();
$meshColor.colorpicker({ format: 'hex' });
$sliceColor.colorpicker({ format: 'hex' });

$sliceColor.colorpicker().on('changeColor.colorpicker', function (e) {
    if (shapes && shapes.length) {
        var hexString = e.color.toHex();
        var hexInteger = hexToDec(hexString);
        i3dsettings.set('bleached.slice', hexString);
        for (var i = 0, il = shapes.length; i < il; i++) {
            shapes[i].material.color.setHex(hexInteger);
        }
        viewer3d.render();
    }
});

$meshColor.colorpicker().on('changeColor.colorpicker', function (e) {
    if (slicer.mesh && slicer.mesh.material) {
        var hexString = e.color.toHex();
        var hexInteger = hexToDec(hexString);
        i3dsettings.set('bleached.mesh', hexString);
        slicer.mesh.material.color.setHex(hexInteger);
        viewer3d.render();
    }
});


// Alert
var $alertPanel = $('#alert');
var $alertMessage = $alertPanel.find('.message');

// Transform
var $transformBody = initPanel('change');
var $transformAction = $transformBody.find('#change-action');
var $transformUniform = $transformBody.find('#change-uniform');
var $transformX = $transformBody.find('#change-x');
var $transformY = $transformBody.find('#change-y');
var $transformZ = $transformBody.find('#change-z');
var $transformButtons = $transformBody.find('button');

var $transformMirrorYes = $transformBody.find('#change-mirror-yes');
var $transformMirrorNo = $transformBody.find('#change-mirror-no');

var transformAction, transformations;

function resetTransformValues() {
    transformAction = 'scale';
    transformations = {
        scale: { x: 1, y: 1, z: 1 },
        rotate: { x: 0, y: 0, z: 0 },
        translate: { x: 0, y: 0, z: 0 }
    };
    updateTransformAction();
}

function updateTransformAction() {
    transformAction = $transformAction.val();

    var axis = transformations[transformAction];

    var min, max, step;

    if (transformAction == 'scale') {
        min = 0.01;
        max = 999;
        step = 0.01;
    }
    else if (transformAction == 'rotate') {
        min = 0;
        max = 360;
        step = 1;
    }
    else {
        min = -9999;
        max = 9999;
        step = 1;
    }

    $transformUniform.toggleClass('hidden', transformAction != 'scale');
    $transformZ.parent().toggleClass('hidden', transformAction == 'translate');

    $transformX.prop('min', min);
    $transformY.prop('min', min);
    $transformZ.prop('min', min);
    $transformX.prop('max', max);
    $transformY.prop('max', max);
    $transformZ.prop('max', max);
    $transformX.prop('step', step);
    $transformY.prop('step', step);
    $transformZ.prop('step', step);
    $transformX.val(axis.x);
    $transformY.val(axis.y);
    $transformZ.val(axis.z);
}

function updateTransformValues() {
    var current = transformations[transformAction];
    var uniform = $('#change-uniform input[type=radio]:checked').val() == 'yes';
    var input = {
        x: parseFloat($transformX.val()),
        y: parseFloat($transformY.val()),
        z: parseFloat($transformZ.val())
    };

    input.x = isNaN(input.x) ? current.x : input.x;
    input.y = isNaN(input.y) ? current.y : input.y;
    input.z = isNaN(input.z) ? current.z : input.z;

    $transformX.val(input.x);
    $transformY.val(input.y);
    $transformZ.val(input.z);

    if (transformAction == 'scale') {
        if (uniform) {
            if (input.x != current.x) {
                var ratio = current.x / input.x;
                input.y = (current.y / ratio).toFixed(2);
                input.z = (current.z / ratio).toFixed(2);
                $transformY.val(input.y);
                $transformZ.val(input.z);
            }
            else if (input.y != current.y) {
                var ratio = current.y / input.y;
                input.x = (current.x / ratio).toFixed(2);
                input.z = (current.z / ratio).toFixed(2);
                $transformX.val(input.x);
                $transformZ.val(input.z);
            }
            else if (input.z != current.z) {
                var ratio = current.z / input.z;
                input.x = (current.x / ratio).toFixed(2);
                input.y = (current.y / ratio).toFixed(2);
                $transformX.val(input.x);
                $transformY.val(input.y);
            }
        }

        input.x <= 0 && (input.x = 1);
        input.y <= 0 && (input.y = 1);
        input.z <= 0 && (input.z = 1);

        slicer.mesh.geometry.scale(
            input.x / current.x,
            input.y / current.y,
            input.z / current.z
        );
    }
    else if (transformAction == 'rotate') {
        var deg = Math.PI / 180;
        var offsets = {
            x: input.x - current.x,
            y: input.y - current.y,
            z: input.z - current.z
        };

        slicer.mesh.geometry.rotateX(offsets.x * deg);
        slicer.mesh.geometry.rotateY(offsets.y * deg);
        slicer.mesh.geometry.rotateZ(offsets.z * deg);
    }
    else {
        var offsets = {
            x: input.x - current.x,
            y: input.y - current.y
        };

        slicer.mesh.geometry.translate(offsets.x, offsets.y, 0);
    }

    current.x = input.x;
    current.y = input.y;
    current.z = input.z;

    if (transformAction != 'translate') {
        loadGeometry(slicer.mesh.geometry, false);
        // stay at current position
        var current = transformations['translate'];
        slicer.mesh.geometry.translate(current.x, current.y, current.z);
    }

    getSlice($sliderInput.slider('getValue'));
}

$transformButtons.on('click', function (e) {
    var $this = $(this);
    var axis = $this.data('axis');
    var action = $this.data('action');
    var value = transformations[transformAction][axis];
    var $target = $transformBody.find('#change-' + axis);

    $target.val(value + (action == '+' ? 1 : -1));
    updateTransformValues();
});

function flipGeometry() {
    i3dsettings.set('change.mirror', $transformMirrorYes[0].checked);
    loadGeometry(slicer.mesh.geometry, true);
    getSlice($sliderInput.slider('getValue'));
}

$transformMirrorYes.on('change', flipGeometry);
$transformMirrorNo.on('change', flipGeometry);

$('#change-mirror-' + (i3dsettings.get('change.mirror') ? 'yes' : 'no')).prop('checked', true);
$('#change select').on('change', updateTransformAction);
$('#change input').on('change', updateTransformValues);
resetTransformValues();

// UI resize
function resizeUI() {
    var width = $main.width();
    var height = $main.height();
    $sliderElement.height(height - 80);
    viewer3d.setSize({ width: width, height: height });
    viewer3d.render();
}

$(window).resize(resizeUI);
resizeUI();

// -----------------------------------------------------------------------------
// STL loader
// -----------------------------------------------------------------------------
// Loader instance
var loader = new MeshesJS.STLLoader($main[0]); // drop target

// Load an geometry
function loadGeometry(geometry, mirror) {
    try {
        // remove old mesh and plane
        slicer.mesh && viewer3d.removeObject(slicer.mesh);

        // remove old shapes
        removeShapes();

        // flip geometry
        if (mirror) {
            geometry.applyMatrix(new THREE.Matrix4().makeScale(-1, 1, 1));
        }

        // load new mesh in slicer
        slicer.loadMesh(new xyzslicer.Mesh(geometry, new THREE.MeshPhongMaterial({
            color: hexToDec(i3dsettings.get('bleached.mesh')), side: THREE.DoubleSide
        })));

        // add new mesh and render view
        viewer3d.addObject(slicer.mesh);
        mainObject = slicer.mesh;
        viewer3d.render();

        // update mesh info
        updateMeshInfoUI();

        // get first slice
        //getSlice(1);
    }
    catch (e) {
        errorHandler(e);
    }
}

function ultraMegaDirtyFix() {
    $transformBody.find('#change-x').val(1.1);
    $transformBody.find('#change-y').val(1.1);
    $transformBody.find('#change-z').val(1.1);
    updateTransformValues();
    $transformBody.find('#change-x').val(1);
    $transformBody.find('#change-y').val(1);
    $transformBody.find('#change-z').val(1);
    updateTransformValues();
}

// On Geometry loaded
loader.onGeometry = function (geometry) {
    resetTransformValues();
    loadGeometry(geometry, i3dsettings.get('change.mirror'));
    ultraMegaDirtyFix();
};

// On loading error
loader.onError = errorHandler;

// -----------------------------------------------------------------------------
// load example
// -----------------------------------------------------------------------------
// example STL file
//var stl = 'stl/Octocat-v2.stl';
// var stl = 'stl/STL_sample.stl.stl';
//var stl = 'stl/xyzslicer.stl';

// File url
// var url = 'http://' + window.location.hostname + window.location.pathname + stl;
// var url = window.location.href + stl;
// Create http request object
// var xmlhttp = new XMLHttpRequest();

// Get the file contents
// xmlhttp.open("GET", url);

// xmlhttp.onreadystatechange = function() {
//     if (xmlhttp.readyState == XMLHttpRequest.DONE) {
//         if(xmlhttp.status == 200){
//             loader.loadString(xmlhttp.responseText);
//         }else{
//             errorHandler('xmlhttp: ' + xmlhttp.statusText);
//         }
//     }
// }

// xmlhttp.send();

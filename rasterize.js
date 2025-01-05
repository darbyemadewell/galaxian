/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
var defaultEye = vec3.fromValues(0.5,0.5,-0.5); // default eye position in world space
var defaultCenter = vec3.fromValues(0.5,0.5,0.5); // default view direction in world space
var defaultUp = vec3.fromValues(0,1,0); // default view up vector
var lightAmbient = vec3.fromValues(1,1,1); // default light ambient emission
var lightDiffuse = vec3.fromValues(1,1,1); // default light diffuse emission
var lightSpecular = vec3.fromValues(1,1,1); // default light specular emission
var lightPosition = vec3.fromValues(-0.5,1.5,-0.5); // default light position
var rotateTheta = Math.PI/50; // how much to rotate models by with each key press

/* webgl and geometry data */
var gl = null; // the all powerful gl object. It's all here folks!
var inputTriangles = []; // the triangle data as loaded from input files
var numTriangleSets = 0; // how many triangle sets in input scene
var vertexBuffers = []; // this contains vertex coordinate lists by set, in triples
var normalBuffers = []; // this contains normal component lists by set, in triples
var triSetSizes = []; // this contains the size of each triangle set
var triangleBuffers = []; // lists of indices into vertexBuffers by set, in triples
// _P1: declare uv buffer
var uvBuffers = [];

/* shader parameter locations */
var vPosAttribLoc; // where to put position for vertex shader
var vNormAttribLoc; //where to put normal for vertex shader
var mMatrixULoc; // where to put model matrix for vertex shader
var pvmMatrixULoc; // where to put project model view matrix for vertex shader
var ambientULoc; // where to put ambient reflecivity for fragment shader
var diffuseULoc; // where to put diffuse reflecivity for fragment shader
var specularULoc; // where to put specular reflecivity for fragment shader
var shininessULoc; // where to put specular exponent for fragment shader
//Parker's UV texture
var uvPosAttribLoc; //where to pout the uv position for vertex shader
var uSamplerLocation;
var mixingModeULoc;
var mixingModeState = 0;
var alphaULoc;

/* interaction variables */
var Eye = vec3.clone(defaultEye); // eye position in world space
var Center = vec3.clone(defaultCenter); // view direction in world space
var Up = vec3.clone(defaultUp); // view up vector in world space
var viewDelta = 0; // how much to displace view with each key press
var translatingRight = false; 
var translatingLeft = false;

/* animations */
const RIGHT = UP = 1;
const LEFT = DOWN = -1;
const HALF_SPEED = 0.5;
const FULL_SPEED = 1;
const ONE_AND_A_HALF_SPEED = 1.5;
const DOUBLE_SPEED = 2;
const MAX_MARCHING_TRANSLATION = 0.25;
var alienMarchDirection = RIGHT;
var currentAlienMarch = 0;
var alienAnimationIntervals = [];
var alienAnimationDirections = [];
var projectileAnimationIntervals = [];
var spaceBarEnabled = true;
var alienProjectileEnabled = [];

// interesting output
var interesting = false;

// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input json file

// GAME FUNCTIONS

function translateModelRightLeft(index, direction=RIGHT, multiplier=ONE_AND_A_HALF_SPEED) {
    // set up needed view params
    var lookAt = vec3.create(), viewRight = vec3.create(), temp = vec3.create(); // lookat, right & temp vectors
    lookAt = vec3.normalize(lookAt,vec3.subtract(temp,Center,Eye)); // get lookat vector
    viewRight = vec3.normalize(viewRight,vec3.cross(temp,lookAt,Up)); // get view right vector

    vec3.add(inputTriangles[index].translation,inputTriangles[index].translation,vec3.scale(temp,viewRight,direction*viewDelta*multiplier));
}

function translateModelUpDown(index, direction=UP, multiplier=ONE_AND_A_HALF_SPEED) {
    // set up needed view params
    var lookAt = vec3.create(), viewRight = vec3.create(), temp = vec3.create(); // lookat, right & temp vectors
    lookAt = vec3.normalize(lookAt,vec3.subtract(temp,Center,Eye)); // get lookat vector
    viewRight = vec3.normalize(viewRight,vec3.cross(temp,lookAt,Up)); // get view right vector

    vec3.add(inputTriangles[index].translation,inputTriangles[index].translation,vec3.scale(temp,Up,direction*viewDelta*multiplier));
}

function determineMarchingDirection(currentTranslation, currentDirection) {
    if(currentDirection == RIGHT && currentTranslation <= -1*MAX_MARCHING_TRANSLATION) {
        return LEFT;
    } else if (currentDirection == LEFT && currentTranslation >= MAX_MARCHING_TRANSLATION) {
        return RIGHT;
    } else {
        return currentDirection;
    }
}

function determineFallingDirection(currentDirection) {
    const randomInt = getRandomIntInclusive(0,50);

    if(randomInt === 0) {
        return -1*currentDirection;
    } else {
        return currentDirection;
    }
}

function marchAliensLeftRight() {
    currentAlienMarch += -1 * alienMarchDirection * DOUBLE_SPEED * viewDelta;
    alienMarchDirection = determineMarchingDirection(currentAlienMarch, alienMarchDirection);

    var checkAlienMarch = 0;
    for(var index=1; index<16; index++) {
        if(isFalling(index) === false) {
            checkAlienMarch = inputTriangles[index].translation[0];
            break;
        }
    }

    console.log(currentAlienMarch, checkAlienMarch);

    for(var index = 1; index <= 16; index++) {
        if(isFalling(index) === false && !isEliminated(index)) {
            if(isFalling(index) === false && alienAnimationDirections[index] !== null) {
                inputTriangles[index].translation = vec3.fromValues(currentAlienMarch,0,0);
                alienAnimationDirections[index] = null;
            }
            translateModelRightLeft(index, alienMarchDirection, DOUBLE_SPEED);
            inputTriangles[index].scale = !inputTriangles[index].scale;
        } 
    }
}

function isFalling(index) {
    return alienAnimationIntervals[index] !== null;
}

function isEliminated(index) {
    return inputTriangles[index].eliminated;
}

// Pulled from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
function getRandomIntInclusive(min, max) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled); // The maximum is inclusive and the minimum is inclusive
}

function getIsCollision(index1, index2, isGameOver=false) {
    // Assuming axis-aligned squares
    // X values
    const leftX1 = inputTriangles[index1].vertices[0][0] + inputTriangles[index1].translation[0];
    const rightX1 = inputTriangles[index1].vertices[2][0] + inputTriangles[index1].translation[0];
    const leftX2 = inputTriangles[index2].vertices[0][0] + inputTriangles[index2].translation[0];
    const rightX2 = inputTriangles[index2].vertices[2][0] + inputTriangles[index2].translation[0];
    // Y values
    const higherY1 = inputTriangles[index1].vertices[1][1] + inputTriangles[index1].translation[1];
    const lowerY1 = inputTriangles[index1].vertices[0][1] + inputTriangles[index1].translation[1];
    const higherY2 = inputTriangles[index2].vertices[1][1] + inputTriangles[index2].translation[1];
    const lowerY2 = inputTriangles[index2].vertices[0][1] + inputTriangles[index2].translation[1];

    var isYCollision = false;
    var isXCollision = false;

    if((rightX1 >= leftX2 && rightX1 <= rightX2) || (leftX1 >= leftX2 && leftX1 <= rightX2)) {
        isXCollision = true;
    }

    if((higherY1 >= lowerY2 && higherY1 <= higherY2) || (lowerY1 >= lowerY2 && lowerY1 <= higherY2)) {
        isYCollision = true;
    }

    if(isXCollision && isYCollision) {
        if(isGameOver) {
            window.alert("GAME OVER");
            location.reload();
        }
        return true;
    }
    return false;
}

function rotateModel(index,axis,direction) {
    var newRotation = mat4.create();

    mat4.fromRotation(newRotation,direction*rotateTheta,axis); // get a rotation matrix around passed axis
    vec3.transformMat4(inputTriangles[index].xAxis,inputTriangles[index].xAxis,newRotation); // rotate model x axis tip
    vec3.transformMat4(inputTriangles[index].yAxis,inputTriangles[index].yAxis,newRotation); // rotate model y axis tip
} // end rotate model

function incrementFall(index) {
    getIsCollision(index, 0, true);
    if(inputTriangles[index].center[1] + inputTriangles[index].translation[1] < -0.675) {
        clearInterval(alienAnimationIntervals[index]);
        alienAnimationIntervals[index] = null;
    }
    alienAnimationDirections[index] = determineFallingDirection(alienAnimationDirections[index])
    translateModelRightLeft(index, alienAnimationDirections[index], HALF_SPEED);
    translateModelUpDown(index, DOWN, HALF_SPEED);
    if(interesting) {
        rotateModel(index,Up,1);
    }

    // falling projectiles
    if((inputTriangles[index].center[1] + inputTriangles[index].translation[1] < 0.5) && alienProjectileEnabled[index]) {
        alienProjectileEnabled[index] = false;
        animateProjectileDown(index, alienAnimationDirections[index]);
        setTimeout(() => {
            alienProjectileEnabled[index] = true;
        }, 2000)
    }
}

function animateRandomAlienFalling() {
    const selectedAlien = getRandomIntInclusive(1,16);
    const alreadyAnimated = isFalling(selectedAlien);
    const randomDirection = Math.random(0, 10) % 2;

    // Get count of already animated aliens
    var numAlreadyAnimated = 0;
    for(var index=0; index<17; index++) {
        if(isFalling(index) === true) {
            numAlreadyAnimated++;
        }
    }

    if(alreadyAnimated === false && numAlreadyAnimated <= 4) {
        var secondAlien = 0;

        // Get a second random alien that isn't already animated
        while(secondAlien === 0) {
            const randomSecondAlien = getRandomIntInclusive(1,16);
            if(randomSecondAlien !== selectedAlien && isFalling(randomSecondAlien) === false) {
                secondAlien = randomSecondAlien;
            }
        }

        // Set direction
        alienAnimationDirections[selectedAlien] = randomDirection == 1 ? randomDirection : -1;
        alienAnimationDirections[secondAlien] = randomDirection == 1 ? randomDirection : -1;

        // Drop alien
        alienAnimationIntervals[selectedAlien] = setInterval(() => {
            incrementFall(selectedAlien);
        }, 20);
    }
}

function incrementProjectileUp(projectileIndex) {
    translateModelUpDown(projectileIndex, UP);

    for(var index=1; index<17; index++) {
        isCollision = getIsCollision(projectileIndex, index);
        if(isCollision) {
            inputTriangles[index].hitsTaken++;
            clearInterval(projectileAnimationIntervals[projectileIndex]);
            inputTriangles[projectileIndex].translation = vec3.fromValues(0,0,0);
            if(interesting) {
                if(inputTriangles[index].hitsTaken >= inputTriangles[index].hitsNeeded) {
                    eliminateAlien(index);
                }
            } else {
                eliminateAlien(index);
            }
        }
    }

    if (inputTriangles[projectileIndex].center[1] + inputTriangles[projectileIndex].translation[1] > 1.7) {
        inputTriangles[projectileIndex].translation = vec3.fromValues(0,0,0);
            clearInterval(projectileAnimationIntervals[projectileIndex]);
    }
}

function incrementProjectileDown(projectileIndex, direction) {
    translateModelUpDown(projectileIndex, DOWN, 1);
    translateModelRightLeft(projectileIndex, direction, HALF_SPEED);

    const isCollision = getIsCollision(projectileIndex, 0, true);

    if (inputTriangles[projectileIndex].center[1] + inputTriangles[projectileIndex].translation[1] < -0.675) {
        inputTriangles[projectileIndex].translation = vec3.fromValues(0,0,0);
            clearInterval(projectileAnimationIntervals[projectileIndex]);
    }
}

function animateProjectileUp() {
    const projectileIndex = getAvailableProjectile();
    inputTriangles[projectileIndex].translation = vec3.fromValues(inputTriangles[0].translation[0], 0.5, 0);

    projectileAnimationIntervals[projectileIndex] = setInterval(() => {
        incrementProjectileUp(projectileIndex);
    }, 50);  
}

function animateProjectileDown(alienIndex, currentDirection) {
    const projectileIndex1 = getAvailableProjectile();
    
    const currentAlienX = inputTriangles[alienIndex].center[0] + inputTriangles[alienIndex].translation[0];
    const currentAlienY = inputTriangles[alienIndex].center[1] + inputTriangles[alienIndex].translation[1];
    const currentProjectileX = inputTriangles[projectileIndex1].center[0] + inputTriangles[projectileIndex1].translation[0];
    const currentProjectileY = inputTriangles[projectileIndex1].center[1] + inputTriangles[projectileIndex1].translation[1];
    const xDifference = currentAlienX - currentProjectileX;
    const yDifference = currentAlienY - currentProjectileY;

    inputTriangles[projectileIndex1].translation = vec3.fromValues(xDifference, yDifference, 0);
    
    projectileAnimationIntervals[projectileIndex1] = setInterval(() => {
        incrementProjectileDown(projectileIndex1, currentDirection);
    }, 20);  
}

function getAvailableProjectile() {
    for(var index=17; index<numTriangleSets; index++) {
        if(inputTriangles[index].translation[1] === 0) {
            return index;
        }
    }
}

function isProjectileAvailable(projectileIndex) {
    return inputTriangles[projectileIndex].translation[1] === 0;
}

function eliminateAlien(index) {
    const randomNumber = getRandomIntInclusive(0,1);
    if(interesting && randomNumber === 0) {
        console.log("eliminate 2");
        inputTriangles[index-1].eliminated = true;
        clearInterval(alienAnimationIntervals[index-1]);
        alienAnimationDirections[index-1] = null;
        inputTriangles[index-1].translation = vec3.fromValues(0, -10, 0);
    }
    inputTriangles[index].eliminated = true;
    clearInterval(alienAnimationIntervals[index]);
    alienAnimationDirections[index] = null;
    inputTriangles[index].translation = vec3.fromValues(0, -10, 0);
}

function handleKeyDown(event) {
    switch (event.code) {
        case "ArrowRight": // move right
            translatingRight = true;
            break;
        case "ArrowLeft": // move left
            translatingLeft = true;
            break;
        case "Space":
            if(spaceBarEnabled) {
                animateProjectileUp();
                spaceBarEnabled = false;
                projectileDebounceTimeout = setTimeout(() => {
                    spaceBarEnabled = true;
                }, 500);
            }
        case "Digit1": 
        if (event.getModifierState("Shift")) {
            interesting = true;
            console.log(interesting);
        }
    }
}

function handleKeyUp(event) {
    switch(event.code) {
        case "ArrowRight":
            translatingRight = false;
            break;
        case "ArrowLeft":
            translatingLeft = false;
            break;
    }
}

function controlLoop() {
    const currentTranslation = inputTriangles[0].translation[0] || 0;
    if(translatingLeft) {
        if(currentTranslation <= 0.85) {
            translateModelRightLeft(0,LEFT,HALF_SPEED);
        }
    } else if(translatingRight) {
        if(currentTranslation >= -0.85) {
            translateModelRightLeft(0,RIGHT,HALF_SPEED);
        }
    }
}

// set up the webGL environment
function setupWebGL() {
    for(var index=0; index<17; index++) {
        alienAnimationIntervals[index] = null;
        alienProjectileEnabled[index] = true;
    }

    setInterval(() => {
        controlLoop();
    }, 15);

    setInterval(() => {
        marchAliensLeftRight();
    }, 500);

    setInterval(() => {
        const randomInt = getRandomIntInclusive(0,2);
        if (randomInt == 0) {
            animateRandomAlienFalling();
        }
    }, 2000);
    
    // Set up keys
    document.onkeydown = handleKeyDown; // call this when key pressed
    document.onkeyup = handleKeyUp; // call this when key released

      // Get the image canvas, render an image in it
     var imageCanvas = document.getElementById("myImageCanvas"); // create a 2d canvas
      var cw = imageCanvas.width, ch = imageCanvas.height; 
      imageContext = imageCanvas.getContext("2d"); 
      var bkgdImage = new Image(); 
      //bkgdImage.crossOrigin = "Anonymous";
      bkgdImage.src = "https://darbyemadewell.github.io/galaxian/textures/back.png";
      bkgdImage.onload = function(){
          var iw = bkgdImage.width, ih = bkgdImage.height;
          imageContext.drawImage(bkgdImage,0,0,iw,ih,0,0,cw,ch);   
     } // end onload callback
    
     // create a webgl canvas and set it up
     var webGLCanvas = document.getElementById("myWebGLCanvas"); // create a webgl canvas
     gl = webGLCanvas.getContext("webgl"); // get a webgl object from it
     try {
       if (gl == null) {
         throw "unable to create gl context -- is your browser gl ready?";
       } else {
         //gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
         gl.clearDepth(1.0); // use max when we clear the depth buffer
         gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
       }
     } // end try
     
     catch(e) {
       console.log(e);
     } // end catch
} // end setupWebGL

var listOfTextures = ["sprites/Ship_1.png", "sprites/Ship_5.png", "spr_bullet_3.png", "sprites/Ship_2.png"];

//load textures, pixels at first with actual models being loded in
function loadTextures() {

    for(var i = 0; i < listOfTextures.length; i++){
        var textureName = listOfTextures[i];

        gl.activeTexture(gl.TEXTURE0 + i); //switch to correct active texture

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
        const pixelTex = new Uint8Array([100, 0, 0, 255]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixelTex);
        if(textureName != false){
        const image = new Image();
            // onload function was modifed from MDN texture tutorial
            //https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL
            image.onload = function() {
                // alert(this.index);
                gl.activeTexture(gl.TEXTURE0+this.index); //switch to correct active texture
                gl.bindTexture(gl.TEXTURE_2D, texture); //already bound no need to bind again
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                
            };
            image.crossOrigin = "Anonymous";
            image.index = i;
            image.src = "https://darbyemadewell.github.io/galaxian/textures/" + textureName;
        }
    }
}

//part of mdn tutorial cited above
function isPowerOf2(value) {
    return (value & (value - 1)) == 0;
}

// read models in, load them into webgl buffers
function loadModels() {
    inputTriangles = JSON.parse(data);

    try {
        if (inputTriangles == String.null)
            throw "Unable to load triangles file!";
        else {
            var whichSetVert; // index of vertex in current triangle set
            var whichSetTri; // index of triangle in current triangle set
            var vtxToAdd; // vtx coords to add to the coord array
            var normToAdd; // vtx normal to add to the coord array
            var uvToAdd; // uv coords to add to the uv arry
            var triToAdd; // tri indices to add to the index array
            var temp = vec3.create(); // an intermediate vec3
            var maxCorner = vec3.fromValues(Number.MIN_VALUE,Number.MIN_VALUE,Number.MIN_VALUE); // bbox corner
            var minCorner = vec3.fromValues(Number.MAX_VALUE,Number.MAX_VALUE,Number.MAX_VALUE); // other corner
        
            // process each triangle set to load webgl vertex and triangle buffers
            numTriangleSets = inputTriangles.length; // remember how many tri sets
            for (var whichSet=0; whichSet<numTriangleSets; whichSet++) { // for each tri set
                
                // set up hilighting, modeling translation and rotation
                inputTriangles[whichSet].center = vec3.fromValues(0,0,0);  // center point of tri set
                inputTriangles[whichSet].on = false; // not highlighted
                inputTriangles[whichSet].translation = vec3.fromValues(0,0,0); // no translation
                inputTriangles[whichSet].xAxis = vec3.fromValues(1,0,0); // model X axis
                inputTriangles[whichSet].yAxis = vec3.fromValues(0,1,0); // model Y axis 

                // set up the vertex and normal arrays, define model center and axes
                inputTriangles[whichSet].glVertices = []; // flat coord list for webgl
                inputTriangles[whichSet].glNormals = []; // flat normal list for webgl
                inputTriangles[whichSet].glUVs = []; // flat normal list for webgl

                // animation info
                inputTriangles[whichSet].eliminated = false;
                if(whichSet %2 === 1) {
                    inputTriangles[whichSet].scale = true;
                } else {
                    inputTriangles[whichSet].scale = false;
                }
                inputTriangles[whichSet].hitsTaken = 0;
                if(whichSet >= 13 && whichSet <= 16) {
                    inputTriangles[whichSet].hitsNeeded = 3;
                } else {
                    inputTriangles[whichSet].hitsNeeded = 1;
                }

                var numVerts = inputTriangles[whichSet].vertices.length; // num vertices in tri set
                for (whichSetVert=0; whichSetVert<numVerts; whichSetVert++) { // verts in set
                    vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert]; // get vertex to add
                    normToAdd = inputTriangles[whichSet].normals[whichSetVert]; // get normal to add
                    uvToAdd = inputTriangles[whichSet].uvs[whichSetVert]; // get iv to add

                    inputTriangles[whichSet].glVertices.push(vtxToAdd[0],vtxToAdd[1],vtxToAdd[2]); // put coords in set coord list
                    inputTriangles[whichSet].glNormals.push(normToAdd[0],normToAdd[1],normToAdd[2]); // put normal in set coord list
                    inputTriangles[whichSet].glUVs.push(uvToAdd[0], uvToAdd[1]);
                    vec3.max(maxCorner,maxCorner,vtxToAdd); // update world bounding box corner maxima
                    vec3.min(minCorner,minCorner,vtxToAdd); // update world bounding box corner minima
                    vec3.add(inputTriangles[whichSet].center,inputTriangles[whichSet].center,vtxToAdd); // add to ctr sum
                } // end for vertices in set
                vec3.scale(inputTriangles[whichSet].center,inputTriangles[whichSet].center,1/numVerts); // avg ctr sum

                // send the vertex coords and normals to webGL
                vertexBuffers[whichSet] = gl.createBuffer(); // init empty webgl set vertex coord buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inputTriangles[whichSet].glVertices),gl.STATIC_DRAW); // data in
                normalBuffers[whichSet] = gl.createBuffer(); // init empty webgl set normal component buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inputTriangles[whichSet].glNormals),gl.STATIC_DRAW); // data in
               
                // _P1:
                uvBuffers[whichSet] = gl.createBuffer(); 
                gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inputTriangles[whichSet].glUVs),gl.STATIC_DRAW); //assign

                // set up the triangle index array, adjusting indices across sets
                inputTriangles[whichSet].glTriangles = []; // flat index list for webgl
                triSetSizes[whichSet] = inputTriangles[whichSet].triangles.length; // number of tris in this set
                for (whichSetTri=0; whichSetTri<triSetSizes[whichSet]; whichSetTri++) {
                    triToAdd = inputTriangles[whichSet].triangles[whichSetTri]; // get tri to add
                    inputTriangles[whichSet].glTriangles.push(triToAdd[0],triToAdd[1],triToAdd[2]); // put indices in set list
                } // end for triangles in set

                // send the triangle indices to webGL
                triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(inputTriangles[whichSet].glTriangles),gl.STATIC_DRAW); // data in

            } // end for each triangle set 

            viewDelta = vec3.length(vec3.subtract(temp,maxCorner,minCorner)) / 200; // set global

        } // end if triangle file loaded
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end load models

// setup the webGL shaders
function setupShaders() {
    
    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 aVertexPosition; // vertex position
        attribute vec3 aVertexNormal; // vertex normal
        attribute vec2 aVertexTextureUV; //vertex uv
        
        uniform mat4 umMatrix; // the model matrix
        uniform mat4 upvmMatrix; // the project view model matrix
        
        varying vec3 vWorldPos; // interpolated world position of vertex
        varying vec3 vVertexNormal; // interpolated normal for frag shader
        varying vec2 uvPosition;

        void main(void) {
            
            // vertex texture
            uvPosition = aVertexTextureUV;

            // vertex position
            vec4 vWorldPos4 = umMatrix * vec4(aVertexPosition, 1.0);
            vWorldPos = vec3(vWorldPos4.x,vWorldPos4.y,vWorldPos4.z);
            gl_Position = upvmMatrix * vec4(aVertexPosition, 1.0);

            // vertex normal (assume no non-uniform scale)
            vec4 vWorldNormal4 = umMatrix * vec4(aVertexNormal, 0.0);
            vVertexNormal = normalize(vec3(vWorldNormal4.x,vWorldNormal4.y,vWorldNormal4.z)); 
        }
    `;
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        precision mediump float; // set float to medium precision

        // eye location
        uniform vec3 uEyePosition; // the eye's position in world
        
        // light properties
        uniform vec3 uLightAmbient; // the light's ambient color
        uniform vec3 uLightDiffuse; // the light's diffuse color
        uniform vec3 uLightSpecular; // the light's specular color
        uniform vec3 uLightPosition; // the light's position
        
        // texture properties
        varying vec2 uvPosition;
        uniform sampler2D uSampler;
        
        // material properties
        uniform vec3 uAmbient; // the ambient reflectivity
        uniform vec3 uDiffuse; // the diffuse reflectivity
        uniform vec3 uSpecular; // the specular reflectivity
        uniform float uShininess; // the specular exponent
        uniform float uAlpha; // the specular exponent

        //mixing mode property
        uniform float uMixingMode;
        
        // geometry properties
        varying vec3 vWorldPos; // world xyz of fragment
        varying vec3 vVertexNormal; // normal of fragment
            
        void main(void) {
        
            // ambient term
            vec3 ambient = uAmbient*uLightAmbient; 
            
            // diffuse term
            vec3 normal = normalize(vVertexNormal); 
            vec3 light = normalize(uLightPosition - vWorldPos);
            float lambert = max(0.0,dot(normal,light));
            vec3 diffuse = uDiffuse*uLightDiffuse*lambert; // diffuse term
            
            // specular term
            vec3 eye = normalize(uEyePosition - vWorldPos);
            vec3 halfVec = normalize(light+eye);
            float highlight = pow(max(0.0,dot(normal,halfVec)),uShininess);
            vec3 specular = uSpecular*uLightSpecular*highlight; // specular term
            
            // combine to output color
            vec3 colorOut = ambient + diffuse + specular; // no specular yet
            //gl_FragColor = vec4(colorOut, 1.0); 
            vec2 whyIsItReversed = vec2(1.0-uvPosition.x, 1.0-uvPosition.y);
            vec4 colorTexture = texture2D(uSampler, whyIsItReversed);
            //at this point colorOut represents Cf and colorTexture represents Ct
            vec4 color;         
            if(uMixingMode == 0.0){
                color = colorTexture;
            }else if(uMixingMode == 1.0){
                color = vec4(colorOut.x*colorTexture.x,
                    colorOut.y*colorTexture.y,
                    colorOut.z*colorTexture.z,
                    colorTexture.w);
            }else if(uMixingMode == 2.0){
                color = vec4(colorOut.x*colorTexture.x,
                    colorOut.y*colorTexture.y,
                    colorOut.z*colorTexture.z,
                    uAlpha*colorTexture.w);
            }


            if(color.a == 0.0)
                discard;
            gl_FragColor = color;
            //gl_FragColor = vec4(uvPosition, 0.0, 1.0); //uv map
        }
    `;
    
    try {
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                
                // locate and enable vertex attributes
                vPosAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexPosition"); // ptr to vertex pos attrib
                gl.enableVertexAttribArray(vPosAttribLoc); // connect attrib to array
                vNormAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexNormal"); // ptr to vertex normal attrib
                gl.enableVertexAttribArray(vNormAttribLoc); // connect attrib to array
                // _P1: uv positions for vertices
                uvPosAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexTextureUV");
                gl.enableVertexAttribArray(uvPosAttribLoc); 
                
                // locate vertex uniforms
                mMatrixULoc = gl.getUniformLocation(shaderProgram, "umMatrix"); // ptr to mmat
                pvmMatrixULoc = gl.getUniformLocation(shaderProgram, "upvmMatrix"); // ptr to pvmmat
                
                // locate fragment uniforms
                var eyePositionULoc = gl.getUniformLocation(shaderProgram, "uEyePosition"); // ptr to eye position
                var lightAmbientULoc = gl.getUniformLocation(shaderProgram, "uLightAmbient"); // ptr to light ambient
                var lightDiffuseULoc = gl.getUniformLocation(shaderProgram, "uLightDiffuse"); // ptr to light diffuse
                var lightSpecularULoc = gl.getUniformLocation(shaderProgram, "uLightSpecular"); // ptr to light specular
                var lightPositionULoc = gl.getUniformLocation(shaderProgram, "uLightPosition"); // ptr to light position
                ambientULoc = gl.getUniformLocation(shaderProgram, "uAmbient"); // ptr to ambient
                diffuseULoc = gl.getUniformLocation(shaderProgram, "uDiffuse"); // ptr to diffuse
                specularULoc = gl.getUniformLocation(shaderProgram, "uSpecular"); // ptr to specular
                shininessULoc = gl.getUniformLocation(shaderProgram, "uShininess"); // ptr to shininess
                
                // pass global constants into fragment uniforms
                gl.uniform3fv(eyePositionULoc,Eye); // pass in the eye's position
                gl.uniform3fv(lightAmbientULoc,lightAmbient); // pass in the light's ambient emission
                gl.uniform3fv(lightDiffuseULoc,lightDiffuse); // pass in the light's diffuse emission
                gl.uniform3fv(lightSpecularULoc,lightSpecular); // pass in the light's specular emission
                gl.uniform3fv(lightPositionULoc,lightPosition); // pass in the light's position
                
                uSamplerLocation = gl.getUniformLocation(shaderProgram, 'uSampler');
                gl.uniform1i(uSamplerLocation, 0);
                mixingModeULoc = gl.getUniformLocation(shaderProgram, "uMixingMode");
                gl.uniform1f(mixingModeULoc, 0);
                alphaULoc = gl.getUniformLocation(shaderProgram, "uAlpha"); // ptr to shininess

                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                // gl.depthMask(false);
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end setup shaders

// render the loaded model
function renderModels() {
     gl.enable(gl.DEPTH_TEST);
    // construct the model transform matrix, based on model state
    function makeModelTransform(currModel) {
        var zAxis = vec3.create(), sumRotation = mat4.create(), temp = mat4.create(), negCtr = vec3.create();

        // move the model to the origin
        mat4.fromTranslation(mMatrix,vec3.negate(negCtr,currModel.center)); 
        
        // scale for highlighting if needed
        if (currModel.scale)
            mat4.multiply(mMatrix,mat4.fromScaling(temp,vec3.fromValues(1.1,1.1,1.1)),mMatrix); // S(1.2) * T(-ctr)
        
        // rotate the model to current interactive orientation
        vec3.normalize(zAxis,vec3.cross(zAxis,currModel.xAxis,currModel.yAxis)); // get the new model z axis
        mat4.set(sumRotation, // get the composite rotation
            currModel.xAxis[0], currModel.yAxis[0], zAxis[0], 0,
            currModel.xAxis[1], currModel.yAxis[1], zAxis[1], 0,
            currModel.xAxis[2], currModel.yAxis[2], zAxis[2], 0,
            0, 0,  0, 1);
        mat4.multiply(mMatrix,sumRotation,mMatrix); // R(ax) * S(1.2) * T(-ctr)
        
        // translate back to model center
        mat4.multiply(mMatrix,mat4.fromTranslation(temp,currModel.center),mMatrix); // T(ctr) * R(ax) * S(1.2) * T(-ctr)

        // translate model to current interactive orientation
        mat4.multiply(mMatrix,mat4.fromTranslation(temp,currModel.translation),mMatrix); // T(pos)*T(ctr)*R(ax)*S(1.2)*T(-ctr)
        
    } // end make model transform
    
    // var hMatrix = mat4.create(); // handedness matrix
    var pMatrix = mat4.create(); // projection matrix
    var vMatrix = mat4.create(); // view matrix
    var mMatrix = mat4.create(); // model matrix
    var pvMatrix = mat4.create(); // hand * proj * view matrices
    var pvmMatrix = mat4.create(); // hand * proj * view * model matrices
    
    window.requestAnimationFrame(renderModels); // set up frame render callback
    
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    
    // set up projection and view
    // mat4.fromScaling(hMatrix,vec3.fromValues(-1,1,1)); // create handedness matrix
    mat4.perspective(pMatrix,0.5*Math.PI,1,0.1,10); // create projection matrix
    mat4.lookAt(vMatrix,Eye,Center,Up); // create view matrix
    mat4.multiply(pvMatrix,pvMatrix,pMatrix); // projection
    mat4.multiply(pvMatrix,pvMatrix,vMatrix); // projection * view

    gl.depthMask(true); 
    //DRAW OPAQUES
    {
        // render each triangle set
        var currSet; // the tri set and its material properties
        for (var whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++) {
            currSet = inputTriangles[whichTriSet];
            
            if(currSet.material.alpha == 1.0){
                // make model transform, add to view project
                makeModelTransform(currSet);
                mat4.multiply(pvmMatrix,pvMatrix,mMatrix); // project * view * model
                gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in the m matrix
                gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in the hpvm matrix
                
                // reflectivity: feed to the fragment shader
                gl.uniform3fv(ambientULoc,currSet.material.ambient); // pass in the ambient reflectivity
                gl.uniform3fv(diffuseULoc,currSet.material.diffuse); // pass in the diffuse reflectivity
                gl.uniform3fv(specularULoc,currSet.material.specular); // pass in the specular reflectivity
                gl.uniform1f(shininessULoc,currSet.material.n); // pass in the specular exponent
                gl.uniform1f(alphaULoc,currSet.material.alpha);
                
                // vertex buffer: activate and feed into vertex shader
                gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichTriSet]); // activate
                gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed
                gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[whichTriSet]); // activate
                gl.vertexAttribPointer(vNormAttribLoc,3,gl.FLOAT,false,0,0); // feed
                gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffers[whichTriSet]); // activate
                gl.vertexAttribPointer(uvPosAttribLoc,2,gl.FLOAT,false,0,0); // feed

                //which texture to use
                var posInList = listOfTextures.indexOf(currSet.material.texture);
                if(posInList > -1)
                    gl.uniform1i(uSamplerLocation, posInList);

                // triangle buffer: activate and render
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[whichTriSet]); // activate
                gl.drawElements(gl.TRIANGLES,3*triSetSizes[whichTriSet],gl.UNSIGNED_SHORT,0); // render
            }
            
        } // end for each triangle set
        
    }

    gl.depthMask(false);
    //DRAW transparency
    {

        for (var whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++) {
            var currSet = inputTriangles[whichTriSet];

            currSet.distanceFromEye = vec3.distance(Eye, currSet.center);
            currSet.originalIndex = whichTriSet;
        }

        var cloneTris = inputTriangles.slice(0);
        //sort triangles by distance
        cloneTris.sort(function(a, b){
            return b.distanceFromEye - a.distanceFromEye ;
        });

        // render each triangle set
        for (var whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++) {
            var currSet = cloneTris[whichTriSet];
            
            if(currSet.material.alpha < 1.0){
                // make model transform, add to view project
                makeModelTransform(currSet);
                mat4.multiply(pvmMatrix,pvMatrix,mMatrix); // project * view * model
                gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in the m matrix
                gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in the hpvm matrix
                
                // reflectivity: feed to the fragment shader
                gl.uniform3fv(ambientULoc,currSet.material.ambient); // pass in the ambient reflectivity
                gl.uniform3fv(diffuseULoc,currSet.material.diffuse); // pass in the diffuse reflectivity
                gl.uniform3fv(specularULoc,currSet.material.specular); // pass in the specular reflectivity
                gl.uniform1f(shininessULoc,currSet.material.n); // pass in the specular exponent
                gl.uniform1f(alphaULoc,currSet.material.alpha);
                
                // vertex buffer: activate and feed into vertex shader
                gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[currSet.originalIndex]); // activate
                gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed
                gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[currSet.originalIndex]); // activate
                gl.vertexAttribPointer(vNormAttribLoc,3,gl.FLOAT,false,0,0); // feed
                gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffers[currSet.originalIndex]); // activate
                gl.vertexAttribPointer(uvPosAttribLoc,2,gl.FLOAT,false,0,0); // feed

                //which texture to use
                var posInList = listOfTextures.indexOf(currSet.material.texture);
                //console.log(posInList);
                gl.uniform1i(uSamplerLocation, posInList);

                // triangle buffer: activate and render
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[currSet.originalIndex]); // activate
                gl.drawElements(gl.TRIANGLES,3*triSetSizes[currSet.originalIndex],gl.UNSIGNED_SHORT, 0); // render
            }
            
        } // end for each triangle set
        
    }
} // end render model


/* MAIN -- HERE is where execution begins after window load */

function main() {
  
  setupWebGL(); // set up the webGL environment
  loadModels(); // load in the models from tri file
  loadTextures();
  setupShaders(); // setup the webGL shaders
  renderModels(); // draw the triangles using webGL
  
} // end main

data = `[
    {
      "material": {"ambient": [0.1,0.1,0.1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "sprites/Ship_5.png"}, 
      "vertices": [[0.4, -0.4, 0.65],[0.4, -0.2, 0.65],[0.6,-0.2,0.65],[0.6,-0.4,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [0.1,0.1,0.1], "diffuse": [0.1,0.1,0.1], "specular": [0.3,0.3,0.3], "n":1, "alpha": 1, "texture": "sprites/Ship_2.png"}, 
      "vertices": [[1.025, 0.6, 0.65],[1.025, 0.8, 0.65],[1.225,0.8,0.65],[1.225,0.6,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [0.1,0.1,0.1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "sprites/Ship_2.png"}, 
      "vertices": [[0.775, 0.6, 0.65],[0.775, 0.8, 0.65],[0.975,0.8,0.65],[0.975,0.6,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [0.1,0.1,0.1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "sprites/Ship_2.png"}, 
      "vertices": [[0.525, 0.6, 0.65],[0.525, 0.8, 0.65],[0.725,0.8,0.65],[0.725,0.6,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [0.1,0.1,0.1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "sprites/Ship_2.png"}, 
      "vertices": [[0.275, 0.6, 0.65],[0.275, 0.8, 0.65],[0.475,0.8,0.65],[0.475,0.6,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [0.1,0.1,0.1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "sprites/Ship_2.png"}, 
      "vertices": [[0.025, 0.6, 0.65],[0.025, 0.8, 0.65],[0.225,0.8,0.65],[0.225,0.6,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [0.1,0.1,0.1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "sprites/Ship_2.png"}, 
      "vertices": [[-0.225, 0.6, 0.65],[-0.225, 0.8, 0.65],[-0.025,0.8,0.65],[-0.025,0.6,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [0.1,0.1,0.1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "sprites/Ship_2.png"}, 
      "vertices": [[1.025, 0.85, 0.65],[1.025, 1.05, 0.65],[1.225,1.05,0.65],[1.225,0.85,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [0.1,0.1,0.1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "sprites/Ship_2.png"}, 
      "vertices": [[0.775, 0.85, 0.65],[0.775, 1.05, 0.65],[0.975,1.05,0.65],[0.975,0.85,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [0.1,0.1,0.1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "sprites/Ship_2.png"}, 
      "vertices": [[0.525, 0.85, 0.65],[0.525, 1.05, 0.65],[0.725,1.05,0.65],[0.725,0.85,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [0.1,0.1,0.1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "sprites/Ship_2.png"}, 
      "vertices": [[0.275, 0.85, 0.65],[0.275, 1.05, 0.65],[0.475,1.05,0.65],[0.475,0.85,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [0.1,0.1,0.1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "sprites/Ship_2.png"}, 
      "vertices": [[0.025, 0.85, 0.65],[0.025, 1.05, 0.65],[0.225,1.05,0.65],[0.225,0.85,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [0.1,0.1,0.1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "sprites/Ship_2.png"}, 
      "vertices": [[-0.225, 0.85, 0.65],[-0.225, 1.05, 0.65],[-0.025,1.05,0.65],[-0.025,0.85,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [0.1,0.1,0.1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "sprites/Ship_1.png"}, 
      "vertices": [[0.775, 1.1, 0.65],[0.775, 1.3, 0.65],[0.975,1.3,0.65],[0.975,1.1,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [0.1,0.1,0.1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "sprites/Ship_1.png"}, 
      "vertices": [[0.525, 1.1, 0.65],[0.525, 1.3, 0.65],[0.725,1.3,0.65],[0.725,1.1,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [0.1,0.1,0.1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "sprites/Ship_1.png"}, 
      "vertices": [[0.275, 1.1, 0.65],[0.275, 1.3, 0.65],[0.475,1.3,0.65],[0.475,1.1,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [0.1,0.1,0.1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "sprites/Ship_1.png"}, 
      "vertices": [[0.025, 1.1, 0.65],[0.025, 1.3, 0.65],[0.225,1.3,0.65],[0.225,1.1,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    },
    {
      "material": {"ambient": [1,1,1], "diffuse": [0.6,0.6,0.4], "specular": [0.3,0.3,0.3], "n":17, "alpha": 0.3, "texture": "spr_bullet_3.png"}, 
      "vertices": [[0.5, -0.75, 0.65],[0.5, -0.7, 0.65],[0.55,-0.7,0.65],[0.55,-0.75,0.65]],
      "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1],[0, 0, -1]],
      "uvs": [[0,0], [0,1], [1,1], [1,0]],
      "triangles": [[0,1,2],[2,3,0]]
    }
  ]`;
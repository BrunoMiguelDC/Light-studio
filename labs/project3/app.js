import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";
import { ortho, lookAt, flatten, perspective, scale,mult, inverse,normalMatrix, vec2, vec3, vec4, rotate, subtract, length, equal } from "../../libs/MV.js";
import {modelView, loadMatrix,multRotationX, multRotationY, multRotationZ, multScale, multTranslation, popMatrix, pushMatrix} from "../../libs/stack.js";

import * as DAT from '../../libs/dat.gui.module.js';


import * as CUBE from '../../libs/cube.js';
import * as CYLINDER from '../../libs/cylinder.js';
import * as PYRAMID from '../../libs/pyramid.js';
import * as SPHERE from '../../libs/sphere.js';
import * as TORUS from '../../libs/torus.js';

const SPHERE_ID = 0;
const CUBE_ID = 1;
const PYRAMID_ID = 2;
const TORUS_ID = 3;
const CYLINDER_ID = 4;

const X_ROTATION_ID = 0;
const Y_ROTATION_ID = 1;
const Z_ROTATION_ID = 2;

const MAX_LIGHTS = 7;
const LIGHT = [0.05, 0.05, 0.05];
const FLOOR = [3, 0.1, 3];

const BG_COLOR = [20/255, 20/255, 20/255];
const ALT_BG_COLOR = [0/255, 0/255, 0/255];

const FLOOR_MATERIAL = {
    ka: [40,0,0],
    kd: [100,0,0],
    ks: [255,255,255],
    shininess: 50.0
}

/** @type WebGLRenderingContext */
let gl;

let time = 1/60.0;

let options = {
    backfaceCulling: true,
    depthCulling: true,
    showLights:true
};

let camera = {
    eye: [0,1,5],
    at: [0,0,0],
    up: [0,1,0],
    fovy: 45,
    near: 0.1,
    far: 20,
    aspect: 0
};

let lights = [];

let material = {
    object: SPHERE_ID,
    ka: [0,0,30],
    kd: [0,15,255],
    ks: [255,255,255],
    shininess: 50.0
}

let errorMessageOpacity;
let mode; 
let mouseDown;   
let lastX;
let lastY;

function setup(shaders){
    let canvas = document.getElementById("gl-canvas");

    gl = setupWebGL(canvas);

    camera.aspect = canvas.width/canvas.height;  

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);
    let lightProgram = buildProgramFromSources(gl, shaders["shader.vert"], shaders["light_shader.frag"]);

    let mProjection;
    let mView;

    mode = gl.LINES; 

    SPHERE.init(gl);
    CUBE.init(gl);
    CYLINDER.init(gl);
    PYRAMID.init(gl);
    TORUS.init(gl);

    resize_canvas();
    
    // GUI construction

    const gui = new DAT.GUI();

    const optionsFolder = gui.addFolder("Options");
    optionsFolder.add(options, "backfaceCulling").name("Backface Culling");
    optionsFolder.add(options, "depthCulling").name("Depth Culling");
    optionsFolder.add(options, "showLights").name("Show Lights");
    
    const cameraFolder = gui.addFolder("camera");
    cameraFolder.add(camera, "fovy").min(1).max(100).listen();
    cameraFolder.add(camera, "near").min(0.1).max(camera.far - 0.1).listen();
    cameraFolder.add(camera, "far").min(camera.near + 0.1).max(20).listen();
    cameraFolder.open();

    const eyeFolder = cameraFolder.addFolder("eye");
    eyeFolder.add(camera.eye, 0).step(0.05).min(-10).max(10).name("x").listen();
    eyeFolder.add(camera.eye, 1).step(0.05).min(-10).max(10).name("y").listen();
    eyeFolder.add(camera.eye, 2).step(0.05).min(-10).max(10).name("z").listen();
    eyeFolder.open();

    const atFolder = cameraFolder.addFolder("at");
    atFolder.add(camera.at, 0).step(0.05).name("x").listen().domElement.style.pointerEvents = "none";
    atFolder.add(camera.at, 1).step(0.05).name("y").listen().domElement.style.pointerEvents = "none";
    atFolder.add(camera.at, 2).step(0.05).name("z").listen().domElement.style.pointerEvents = "none";

    const upFolder = cameraFolder.addFolder("up");
    upFolder.add(camera.up, 0).min(-1).max(1).step(0.05).name("x").listen();
    upFolder.add(camera.up, 1,).min(-1).max(1).step(0.05).name("y").listen();
    upFolder.add(camera.up, 2).min(-1).max(1).step(0.05).name("z").listen();  

    const lightsFolder = gui.addFolder("Lights");
    lightsFolder.open();
    let addButton = { add:function(){ 
            if(lights.length < MAX_LIGHTS) {
                addLight([0,1,0]);
            } else {
                let errorP = document.getElementById("error-message");
                errorP.innerHTML = "MAXIMUM LIGHTS REACHED!";
                errorMessageOpacity = 1.0;
            }
        }
    };
    lightsFolder.add(addButton,'add').name("Add Light");

    let remButton = { rem:function(){
        if(lights.length>0){
            lightsFolder.removeFolder(lights[lights.length-1].gui);
            lights.pop();
        }          
    }};
    lightsFolder.add(remButton,'rem').name("Remove Light");

    const objectGui = new DAT.GUI();
    const objectOptions = objectGui.addFolder("Object options");
    objectOptions.open();

    objectOptions.add(material, "object", {Sphere: SPHERE_ID, Cube: CUBE_ID, Pyramid: PYRAMID_ID,
         Torus: TORUS_ID, Cylinder: CYLINDER_ID}).name("Object").listen();

    const materialOptions = objectOptions.addFolder("Material");
    materialOptions.open();
    materialOptions.addColor(material, "ka");
    materialOptions.addColor(material, "kd");
    materialOptions.addColor(material, "ks");
    materialOptions.add(material, "shininess").min(1).max(100).name("Shininess").listen();    

    // Event listeners

    window.addEventListener("resize", resize_canvas);

    window.addEventListener('wheel', function(event){
        const factor = 1 - event.deltaY/1000;
        camera.fovy = Math.max(1, Math.min(100, camera.fovy/factor));
    });

    window.addEventListener('mousedown', (event) => {
        lastX = event.offsetX;
        lastY = event.offsetY;
        
            mouseDown = true;
            gl.clearColor(ALT_BG_COLOR[0], ALT_BG_COLOR[1], ALT_BG_COLOR[2], 1.0);
        
    });

    window.addEventListener('mouseup', () => {
        mouseDown = false; 
        gl.clearColor(BG_COLOR[0], BG_COLOR[1], BG_COLOR[2], 1.0);
    });
    
    function inCameraSpace(m){
        const mInView = inverse(mView);
        return mult(mInView, mult(m, mView))
    }

    window.addEventListener('mousemove', function(event){
        if(mouseDown){
            const dx = event.offsetX - lastX;
            const dy = event.offsetY - lastY;

            if(dx!=0 || dy!=0){
                const d = vec2(dx, dy);
                const axis = vec3(-dy, -dx, 0);

                const rotation = rotate(length(d), axis);

                let eyeAt = subtract(camera.eye, camera.at);
                eyeAt = vec4(eyeAt[0], eyeAt[1], eyeAt[2], 0);
                let newUp = vec4(camera.up[0], camera.up[1], camera.up[2], 0);

                eyeAt = mult(inCameraSpace(rotation), eyeAt);
                newUp = mult(inCameraSpace(rotation), newUp);

                camera.eye[0] = camera.at[0] + eyeAt[0];
                camera.eye[1] = camera.at[1] + eyeAt[1];
                camera.eye[2] = camera.at[2] + eyeAt[2];

                camera.up[0] = newUp[0];
                camera.up[1] = newUp[1];
                camera.up[2] = newUp[2];

                lastX = event.offsetX;
                lastY = event.offsetY;
            }
        }
    });
   
    document.getElementById("easterEgg").addEventListener("click", function() {
        if(lights.length==3){
            for(let i=0; i <lights.length; i++){
                lights[i].pos = [0, 0.6, 1.5];
                lights[i].isRotating = true;
                lights[i].direction= Y_ROTATION_ID;
                lights[i].speed= 200;
                lights[i].rotation= i*360/lights.length;
                if(i%3==0){
                    lights[i].Is= [255,0,0];
                }else if(i%3==1){ 
                    lights[i].Is= [0,255,0];
                }else{
                    lights[i].Is= [0,0,255];
                }
                material.object = TORUS_ID;
                material.shininess = 1;
            }
        }   
    });   

    // Helper functions

    function resize_canvas(event){
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        camera.aspect = canvas.width / canvas.height;

        gl.viewport(0,0,canvas.width, canvas.height);
        mProjection = perspective(camera.fovy, camera.aspect, camera.near, camera.far);
    }

    function uploadModelView(prog){
        let mModelView = modelView();
        let mNormals = normalMatrix(mModelView);//inverse(transpose(mModelView))
        gl.uniformMatrix4fv(gl.getUniformLocation(prog, "mModelView"), false, flatten(mModelView));
        gl.uniformMatrix4fv(gl.getUniformLocation(prog, "mNormals"), false, flatten(mNormals));
    }

    function addLight(position){
        let object ={
            pos: position,
            rPos: [...position],
            Ia: [75,75,75],
            Id: [175,175,175],
            Is: [255,255,255],
            isDirectional: false,
            isActive:true,
            isRotating: false,
            direction: X_ROTATION_ID,
            speed: 20,
            rotation: 0
        }

        let lightGUI = lightsFolder.addFolder("Light "+(lights.length+1));
        //lightGUI.open();
        lightGUI.add(object.pos, 0).min(-2).max(2).step(0.05).name("x").listen();
        lightGUI.add(object.pos, 1).min(-2).max(2).step(0.05).name("y").listen();
        lightGUI.add(object.pos, 2).min(-2).max(2).step(0.05).name("z").listen();
        lightGUI.addColor(object, "Ia").name("Ambient");
        lightGUI.addColor(object, "Id").name("Diffuse");
        lightGUI.addColor(object, "Is").name("Specular").listen();
        lightGUI.add(object, "isDirectional").name("Diretional");
        lightGUI.add(object, "isActive").name("Active");
        lightGUI.add(object, "isRotating").name("Rotation").listen();
        lightGUI.add(object, "direction", {X: X_ROTATION_ID, Y: Y_ROTATION_ID,
             Z: Z_ROTATION_ID}).name("Direction").listen();
        lightGUI.add(object, "speed").min(0).max(200).name("Speed").listen();

        object.gui = lightGUI;
        lights.push(object);
    }

    // Initial lights position
    addLight([-1.5, 0.6, 0]);
    addLight([0, 0.6, 1.5]);
    addLight([1.5, 0.6, 0]);

    function setupUniform1f(program, uName, uValue){
        const uLoc = gl.getUniformLocation(program, uName);
        gl.uniform1f(uLoc, uValue);
    }

    function setupUniform1i(program, uName, uValue){
        const uLoc = gl.getUniformLocation(program, uName);
        gl.uniform1i(uLoc, uValue);
    }

    function setupUniform3fv(program, uName, uValue){
        const uLoc =  gl.getUniformLocation(program, uName);
        gl.uniform3fv(uLoc, uValue);
    }

    function setupLightsUniforms(){
        setupUniform1i(program, "uNLights", lights.length);
        for(let i=0; i< lights.length; i++){
            if(!lights[i].isRotating)
                setupUniform3fv(program, "uLight["+i+"].pos", lights[i].pos);
            else   
                setupUniform3fv(program, "uLight["+i+"].pos", lights[i].rPos);
            
            setupUniform3fv(program, "uLight["+i+"].Ia", scale(1.0/255.0, lights[i].Ia));
            setupUniform3fv(program, "uLight["+i+"].Id", scale(1.0/255.0, lights[i].Id));
            setupUniform3fv(program, "uLight["+i+"].Is", scale(1.0/255.0, lights[i].Is));

            setupUniform1f(program, "uLight["+i+"].isDirectional", lights[i].isDirectional);
            setupUniform1f(program, "uLight["+i+"].isActive", lights[i].isActive);
        }
    }

    function setupMaterialUniforms(object){
        setupUniform3fv(program, "uMaterial.Ka", scale(1.0/255.0, object.ka));
        setupUniform3fv(program, "uMaterial.Kd", scale(1.0/255.0, object.kd));
        setupUniform3fv(program, "uMaterial.Ks", scale(1.0/255.0, object.ks));
        setupUniform1f(program, "uMaterial.shininess", object.shininess);
    }

    function Floor(){
        multTranslation([0, -FLOOR[1]/2 -0.5, 0]);
        multScale(FLOOR);

        setupMaterialUniforms(FLOOR_MATERIAL);

        uploadModelView(program);

        CUBE.draw(gl, program, mode);
    }
    
    function Object(){
        //multTranslation([0, 0.7, 0]);

        setupMaterialUniforms(material);

        uploadModelView(program);

        mode = gl.TRIANGLES;
        
        switch(parseInt(material.object)){    
            case SPHERE_ID:
                SPHERE.draw(gl, program, mode);
                break;
            case CUBE_ID:
                CUBE.draw(gl, program, mode);  
                break;
            case PYRAMID_ID:
                PYRAMID.draw(gl, program, mode);
                break;
            case TORUS_ID:
                TORUS.draw(gl, program, mode);
                break;     
            case CYLINDER_ID:
                CYLINDER.draw(gl, program, mode);
                break;           
        }
    }
    
    function Light(index) {
        multTranslation(lights[index].pos);

        multScale(LIGHT);

        uploadModelView(lightProgram);

        setupUniform3fv(lightProgram, "uLightIs", scale(1.0/255.0, lights[index].Is));

        if(options.showLights)
            SPHERE.draw(gl, lightProgram, gl.LINES);
    }
    
    function Lights(){
        for(let i = 0; i < lights.length; i++){
            pushMatrix();
                if(lights[i].isRotating){
                    switch(parseInt(lights[i].direction)){
                        case X_ROTATION_ID:
                            multRotationX(lights[i].rotation*lights[i].speed);
                            break;
                        case Y_ROTATION_ID:
                            multRotationY(lights[i].rotation*lights[i].speed);
                            break;
                        case Z_ROTATION_ID:
                            multRotationZ(lights[i].rotation*lights[i].speed);
                            break;
                    }
                    lights[i].rotation += time;  
                } else {
                    lights[i].rotation=0;
                }
                
                Light(i);

                let wc1 = mult(inverse(mView), modelView());
                let pos = mult(wc1, [0.0, 0.0, 0.0, 1.0]);
                
                lights[i].rPos[0] = pos[0];
                lights[i].rPos[1] = pos[1];
                lights[i].rPos[2] = pos[2];
      
            popMatrix();
        }
    }
    
    gl.clearColor(BG_COLOR[0], BG_COLOR[1], BG_COLOR[2], 1.0);

    window.requestAnimationFrame(render);

    function render() {
        window.requestAnimationFrame(render);

        if(options.depthCulling)
            gl.enable(gl.DEPTH_TEST);//    Enables Z-buffer depth test   
        else
            gl.disable(gl.DEPTH_TEST);

        if(options.backfaceCulling){
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl.BACK);
        } else {
            gl.disable(gl.CULL_FACE);
        }

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        if(lights.length == MAX_LIGHTS && errorMessageOpacity >=0){
            let errorP = document.getElementById("error-message");
            errorMessageOpacity-=0.004;
            errorP.style.opacity = errorMessageOpacity;
        }

        gl.useProgram(program);
        
        mProjection = perspective(camera.fovy, camera.aspect, camera.near, camera.far);
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));

        mView = lookAt(camera.eye, camera.at, camera.up);
        loadMatrix(mView);

        let mViewNormals = normalMatrix(mView)  //inverse(transpose(modelViewMatrix));
        
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mView"), false, flatten(mView));
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mViewNormals"), false, flatten(mViewNormals));
        
        setupLightsUniforms();
        
        pushMatrix();
            Floor();
        popMatrix();
        pushMatrix();
            Object();
        popMatrix();
        
        gl.useProgram(lightProgram);
        gl.uniformMatrix4fv(gl.getUniformLocation(lightProgram, "mProjection"), false, flatten(mProjection));
        Lights();
    }

}

const urls = ["shader.vert", "shader.frag", "light_shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders));

import { mat4 } from 'gl-matrix'

import { Vec3 } from './Types' 
import { Helper } from './Helper'


export class GalaxyRendererConfig {
    public cvid : string = "";
}

export class GalaxyRenderer {
    private config : GalaxyRendererConfig;
    private canvas : HTMLCanvasElement;
    private gl : WebGLRenderingContext;
    private vertDensityWaves : any;

    private fov : number = 0;

    private matProjection : mat4 = mat4.create();
	private matView : mat4 = mat4.create();

	private camPos : Vec3 = new Vec3();
	private camLookAt : Vec3 = new Vec3();
	private camOrient : Vec3 = new Vec3();

    public constructor(cfg : any) {
        this.config = cfg;

        this.canvas = document.getElementById(cfg.cvid) as HTMLCanvasElement;
        if (this.canvas === null)
            throw new Error("Canvas " + cfg.cvid + " not found!");

        this.gl = this.canvas.getContext("webgl") as WebGLRenderingContext;
        if (this.gl === null)
            throw new Error("Unable to initialize WebGL. Your browser or machine may not support it.");

        this.initGL(this.gl);
    }

    private initGL(gl : WebGLRenderingContext) : void {
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(this.gl.COLOR_BUFFER_BIT);

        // GL initialization
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        //	    this.vertDensityWaves.initialize();
	    //this.vertAxis.Initialize();
	    // this.vertVelocityCurve.Initialize();
	    // this.vertStars.Initialize();

    	gl.disable(gl.DEPTH_TEST);
	    gl.clearColor(0.0, .0, 0.08, 0.0);
	    this.setCameraOrientation(new Vec3(0, 1, 0));
    }

    private setCameraOrientation(orient : Vec3) : void {   
	    this.camOrient = orient;
	    this.adjustCamera();
    }

    private adjustCamera() : void {
	    let l : number = this.fov / 2.0;
	    let aspect : number = this.canvas.width / this.canvas.height;

	    mat4.ortho(
            this.matProjection,
    	 	-l * aspect, l * aspect, 
	     	-l, l, 
		    -l, l);
	
    	// glm::dvec3 camPos(_camPos.x, _camPos.y, _camPos.z);
    	// glm::dvec3 camLookAt(_camLookAt.x, _camLookAt.y, _camLookAt.z);
	    // glm::dvec3 camOrient(_camOrient.x, _camOrient.y, _camOrient.z);
        // _matView = glm::lookAt(camPos, camLookAt, camOrient);
    }

}

import { mat4 } from 'gl-matrix'

import { Vec3 } from './Types' 
import { Helper } from './Helper'
import { VertexBufferLines } from './VertexBufferLines'
import { VertexBufferStars } from './VertexBufferStars';
import { Galaxy } from './Galaxy'

export class GalaxyRendererConfig {
    public cvid : string = "";
}


enum DisplayItem {
    NONE          = 0,
    AXIS          = 0b0000000001,
    STARS         = 0b0000000010,
    HELP          = 0b0000001000,
    DENSITY_WAVES = 0b0000100000,
    VELOCITY      = 0b0001000000,
    DUST          = 0b0010000000,
    H2            = 0b0100000000,
    FILAMENTS     = 0b1000000000,
}


enum RenderUpdateHint {
    NONE = 0,
    DENSITY_WAVES = 1 << 1,
    AXIS = 1 << 2,
    STARS = 1 << 3,
    DUST = 1 << 4,
    CREATE_VELOCITY_CURVE = 1 << 5,
    CREATE_TEXT = 1 << 7
}


export class GalaxyRenderer {
    private config : GalaxyRendererConfig;
    private canvas : HTMLCanvasElement;
    private gl : WebGLRenderingContext;

	private vertDensityWaves : VertexBufferLines | null = null;
	private vertAxis : VertexBufferLines | null = null;
	private vertVelocityCurve : VertexBufferLines| null = null;
    private vertStars : VertexBufferStars | null = null;

    private fov : number = 0;

    private matProjection : mat4 = mat4.create();
	private matView : mat4 = mat4.create();

	private camPos : Vec3 = new Vec3();
	private camLookAt : Vec3 = new Vec3();
	private camOrient : Vec3 = new Vec3();

    private time : number = 0;
    private flags : number = 0;

    private renderUpdateHint : number = 0;

    private galaxy : Galaxy = new Galaxy();

    private readonly TimeStepSize : number = 100000.0;

    public constructor(cfg : any) {
        this.config = cfg;

        this.canvas = document.getElementById(cfg.cvid) as HTMLCanvasElement;
        if (this.canvas === null)
            throw new Error("Canvas " + cfg.cvid + " not found!");

        this.gl = this.canvas.getContext("webgl") as WebGLRenderingContext;
        if (this.gl === null)
            throw new Error("Unable to initialize WebGL. Your browser or machine may not support it.");

//	    this.vertDensityWaves.initialize();
        this.vertAxis = new VertexBufferLines(this.gl, 1, this.gl.STATIC_DRAW);
//        this.vertDensityWaves = new VertexBufferLines(this.gl, 2, this.gl.STATIC_DRAW);
//	    this.vertVelocityCurve = new VertexBufferLines(this.gl, 1, this.gl.DYNAMIC_DRAW);

        this.initGL(this.gl);
    }

    private initGL(gl : WebGLRenderingContext) : void {
        if (this.vertAxis==null)
            throw new Error("initGL(): vertAxis is null!");

        this.vertAxis.initialize();
//	    this.vertVelocityCurve.initialize();
//	    this.vertStars.initialize();

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(this.gl.COLOR_BUFFER_BIT);

        // GL initialization
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);

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

    private updateAxis() : void {
    }

    private updateDensityWaves() : void {
    }

    private updateStars() : void {
    }

    private updateVelocityCurve(updateOnly : boolean) : void {
    }

    private updateText() : void {
    }

    private update() : void {
        this.time += this.TimeStepSize;
            
        if ((this.renderUpdateHint & RenderUpdateHint.AXIS) != 0)
            this.updateAxis();

        if ((this.renderUpdateHint & RenderUpdateHint.DENSITY_WAVES) != 0)
            this.updateDensityWaves();

        if ((this.renderUpdateHint & RenderUpdateHint.STARS) != 0)
            this.updateStars();

        if ((this.renderUpdateHint & RenderUpdateHint.CREATE_VELOCITY_CURVE) != 0)
            this.updateVelocityCurve(false);

        if ((this.flags & DisplayItem.VELOCITY) != 0)
            this.updateVelocityCurve(true); // Update Data Only, no buffer recreation!

        if ((this.renderUpdateHint & RenderUpdateHint.CREATE_TEXT) != 0)
            this.updateText();

        this.camOrient = new Vec3(0, 1, 0 );
        this.camPos = new Vec3(0, 0, 5000);
        this.camLookAt = new Vec3(0, 0, 0);
    }

    private render() {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        this.adjustCamera();

        if (this.vertAxis!=null && this.flags & DisplayItem.AXIS)
        {
            this.vertAxis.draw(this.matView, this.matProjection);
//            this.textAxisLabel.draw(_width, _height, _matView, _matProjection);
        }

        let features : number = 0;
        if (this.flags & DisplayItem.STARS)
            features |= 1 << 0;
    
        if (this.flags & DisplayItem.DUST)
            features |= 1 << 1;
    
        if (this.flags & DisplayItem.FILAMENTS)
            features |= 1 << 2;
    
        if (this.flags & DisplayItem.H2)
            features |= 1 << 3;

        if (this.vertStars!=null && features != 0)
        {
            this.vertStars.updateShaderVariables(this.time, this.galaxy.pertN, this.galaxy.pertAmp, this.galaxy.dustRenderSize, features);
            this.vertStars.draw(this.matView, this.matProjection);
        }

        if (this.vertDensityWaves!=null && this.flags & DisplayItem.DENSITY_WAVES)
        {
            this.vertDensityWaves.draw(this.matView, this.matProjection);
//            this.textGalaxyLabels.Draw(this.canvas.width, this.canvas.height, this.matView, this.matProjection);
        }
    
        if (this.vertVelocityCurve!=null && this.flags & DisplayItem.VELOCITY)
        {
//            this.gl.pointSize(2);
            this.vertVelocityCurve.draw(this.matView, this.matProjection);
        }
    
        // if (this.flags & DisplayItem.HELP)
        // {
        //     this.textHelp.draw(this.canvas.width, this.canvas.height, this.matView, this.matProjection);
        // }
    
//        SDL_GL_SwapWindow(_pSdlWnd);
//        SDL_Delay(1);
    }

    public mainLoop() {
        let running = true;
        while(running) {
            this.update();
            this.render();
        }
    }

}

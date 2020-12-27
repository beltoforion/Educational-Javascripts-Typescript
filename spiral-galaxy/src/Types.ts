export class Vec2 {
    public x : number = 0;
    public y : number = 0;
}

export class Vec3 {
    constructor(x : number = 0, y : number = 0,z : number = 0)
    {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    public x : number = 0;
    public y : number = 0;
    public z : number = 0;
}

export class Color {
    constructor(r: number, g:number, b:number, a:number = 0)
    {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }

    public r : number = 0;
    public g : number = 0;
    public b : number = 0;
    public a : number = 0;
}

export class Star {
	public theta0 : number = 0;    // initial angular position on the ellipse
	public velTheta: number = 0;   // angular velocity
	public tiltAngle: number = 0;  // tilt angle of the ellipse
	public a: number = 0;          // kleine halbachse
	public b: number = 0;          // große halbachse
	public temp: number = 0;       // star temperature
	public  mag: number = 0;       // brightness;
	public type: number = 0;	   // Type 0:star, 1:dust, 2 and 3: h2 regions	
}

export class GalaxyParam {
    public rad : number = 0;
    public radCore : number = 0;
    public deltaAng : number = 0;
    public ex1 : number = 0;
    public ex2 : number = 0;
    public numStars : number = 0;
    public hasDarkMatter : boolean = true;
    public pertN : number = 0;
    public pertAmp : number = 0;
    public dustRenderSize : number = 0;
    public baseTemp : number = 0;
}

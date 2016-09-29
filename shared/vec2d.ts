class Vec2d  {
	public x : number;
	public y : number;

	constructor(x : number, y : number) {
		this.x = x;
		this.y = y;
	}

	public clone() : Vec2d {
		return new Vec2d(this.x, this.y);
	}

	public length() : number {
		return Math.sqrt(this.x*this.x + this.y*this.y);
	}

	public lengthSqr() : number {
		return this.x * this.x + this.y * this.y;
	}

	public add(v : Vec2d) : Vec2d  {
		this.x += v.x;
		this.y += v.y;
		return this;
	}

	public subtract(v : Vec2d) : Vec2d {
		this.x -= v.x;
		this.y -= v.y;
		return this;
	}

	public rotate(angle : number) : Vec2d {
        var fi = angle*Math.PI/180;
        this.x = this.x*Math.cos(fi) - this.y*Math.sin(fi);
        this.y = this.x*Math.sin(fi) + this.y*Math.cos(fi);
		return this;
	}

	public orthoNormal() : Vec2d {
		var ret = new Vec2d(this.y, this.x);
		return ret.multiplyValue(ret.length());
	}

	// Angle towards the positive y axis in radians
	public verticalAngle() : number {
		return Math.PI - Math.atan2(this.x, this.y);
	}

	// Angle towards the positive y axis in radians
	public verticalAngleDeg() : number {
		return this.verticalAngle() * 180.0 / Math.PI;
	}

	public addXY(x : number, y : number) : Vec2d {
		this.x += x;
		this.y += y;
		return this;
	}

	public normalize() : Vec2d {
		var l = this.length();
		this.divideValue(l);
		return this;
	}

	public multiplyValue(s : number) : Vec2d {
		this.x *= s;
		this.y *= s;
		return this;
	}

	public divideValue(s : number) : Vec2d {
		this.x /= s;
		this.y /= s;
		return this;
	}

	//-------------------------------------------------------------------------------------------------
	// Static functions that do not alter the arguments
	//-------------------------------------------------------------------------------------------------

	public rotateEx(angle : number) : Vec2d {
        var fi = angle*Math.PI/180;
        var v = new Vec2d(this.x*Math.cos(fi) - this.y*Math.sin(fi),
                          this.x*Math.sin(fi) + this.y*Math.cos(fi));
		return v;
	}

	public static subtractEx(v1 : Vec2d, v2 : Vec2d) : Vec2d {
		return new Vec2d(v1.x - v2.x, v1.y - v2.y);
	}

	public static addEx(v1 : Vec2d, v2 : Vec2d) : Vec2d {
		return new Vec2d(v1.x + v2.x, v1.y + v2.y);
	}
}
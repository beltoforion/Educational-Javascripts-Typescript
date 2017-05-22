/// <reference path="./vec2d.ts"/>

class Box2d {
	public ll : Vec2d = new Vec2d(0, 0);

	public ur : Vec2d = new Vec2d(0, 0);

	public set(ll : Vec2d, ur : Vec2d) {
		this.ll = ll;
		this.ur = ur;
	}

	public width() : number {
		return Math.abs(this.ll.x - this.ur.x);
	}

	public height() : number {
		return Math.abs(this.ll.y - this.ur.y);
	}
}
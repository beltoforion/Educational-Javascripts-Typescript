
/// <reference path="../shared/phaser-2.6.2/typescript/phaser.d.ts"/> 

class Chart {
    private width : number;

    private height : number;

    public xpos : number;

    public ypos : number;

    private game : Phaser.Game;

    private grafix : Phaser.Graphics;

    private lines : Phaser.Polygon;

    private colAxis : number = 0xffd900;

    private colCurve : number = 0x0085ff; // 0xd900ff;

    private ymin : number = 0;

    private ymax : number = 1;

    public constructor(game : Phaser.Game,  width : number, height : number) {
        this.width = width;
        this.height = height;
        this.game = game;
    }

    public setYRange(ymin : number, ymax : number) {
        this.ymin = ymin;
        this.ymax = ymax;
    }

    public create(xpos : number, ypos : number) {
        this.xpos = xpos;
        this.ypos = ypos;
        this.grafix = this.game.add.graphics(this.xpos, this.ypos);
    }

    private renderAxis() {
        this.grafix.lineStyle(3, this.colAxis, 1);
        this.grafix.moveTo(0, 0);
        this.grafix.lineTo(0, this.height);
        this.grafix.lineTo(this.width, this.height);

        let arrow_size = 5;
        this.grafix.beginFill(this.colAxis);
        this.grafix.lineStyle(3, this.colAxis, 1);
        this.grafix.moveTo(0, 0);
        this.grafix.lineTo(-arrow_size, 0);
        this.grafix.lineTo(0, -2*arrow_size);
        this.grafix.lineTo(arrow_size, 0);
        this.grafix.endFill();

        this.grafix.beginFill(this.colAxis);
        this.grafix.moveTo(this.width, this.height);
        this.grafix.lineStyle(3, this.colAxis, 1);
        this.grafix.lineTo(this.width, this.height - arrow_size);
        this.grafix.lineTo(this.width + 2*arrow_size, this.height);
        this.grafix.lineTo(this.width, this.height + arrow_size);
        this.grafix.endFill();
    }

    public update(data : Array<Phaser.Point>) {

    }

    public render(data : Array<Phaser.Point>) {
        let n = data.length;
 
        let yrng = (this.ymax - this.ymin);
        let scale = this.height / yrng;

        if (n>2) {
            let x0 = data[n-2].x;
            let y0 = (data[n-2].y - this.ymin) * scale;
            let x1 = data[n-1].x;
            let y1 = (data[n-1].y - this.ymin) * scale;
            
            this.grafix.moveTo(x0, this.height - y0);
            this.grafix.lineTo(x1, this.height - y1);
        } else if (n==2) {
            this.grafix.clear();
            this.renderAxis();
            this.grafix.lineStyle(3, this.colCurve, 1);
        }
    }
}

/// <reference path="../shared/phaser-2.6.2/typescript/phaser.d.ts"/> 

class Chart {
    private width : number;

    private height : number;

    public xpos : number;

    public ypos : number;

    private game : Phaser.Game;

    private grafix : Phaser.Graphics;

    private lines : Phaser.Polygon;

    private colAxis : number = 0xffffff;

    private ymin : number = 0;

    private ymax : number = 1;

    private xmin : number = 0;

    private xmax : number = 1;

    private xAxisTitle : Phaser.Text;

    private yAxisTitle : Phaser.Text;

    private font : string;

    public constructor(game : Phaser.Game,  width : number, height : number, font : string) {
        this.width = width;
        this.height = height;
        this.game = game;
        this.font = font;
    }

    public setYTitle(title : string) : void {
        this.yAxisTitle.text = title;
    }

    public setXTitle(title : string) : void {
        this.xAxisTitle.text = title;
    }

    public setYRange(ymin : number, ymax : number) : void {
        this.ymin = ymin;
        this.ymax = ymax;
    }

    public setXRange(xmin : number, xmax : number) : void {
        this.xmin = xmin;
        this.xmax = xmax;
    }

   public getXMax() : number {
        return this.xmax;
    }

    public create(xpos : number, ypos : number) : void  {
        this.xpos = xpos;
        this.ypos = ypos;
        this.grafix = this.game.add.graphics(this.xpos, this.ypos);
        
        var style = { font: this.font, fill: "#ffffff", wordWrap: true, align: "center", backgroundColor: "#000000" };
        let dummy = this.game.add.text(-100, -100, "foobar", style);

        this.xAxisTitle = this.game.add.text(this.xpos + this.width/2, this.ypos + this.height + dummy.height, "X-Axis", style);
        this.xAxisTitle.anchor = new Phaser.Point(0.5, 0.5);  
        
        this.yAxisTitle = this.game.add.text(this.xpos - dummy.height, this.ypos + this.height/2, "Y-Axis", style);
        this.yAxisTitle.anchor = new Phaser.Point(0.5, 0.5);
        this.yAxisTitle.angle = 270;

        this.renderAxis();
    }

    private renderAxis() : void {
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

    public update(data : Array<Phaser.Point>) : void {

    }

    public clear() : void {
        this.grafix.clear();
        this.renderAxis();
    }

    public render(data : Array<Phaser.Point>, color : number) : void {
        let n = data.length;
        if (n<2)
            return;

        let yrng = (this.ymax - this.ymin);
        let scale_y = this.height / yrng;
 
        let xrng = (this.xmax - this.xmin);
        let scale_x = this.width / xrng;

        this.grafix.lineStyle(2, color, 1);
        for (var i=2; i<data.length; ++i)
        {
            let x0 = (data[i-2].x - this.xmin) * scale_x;
            let y0 = (data[i-2].y - this.ymin) * scale_y;
            let x1 = (data[i-1].x - this.xmin) * scale_x;
            let y1 = (data[i-1].y - this.ymin) * scale_y;
        
            this.grafix.moveTo(x0, this.height - y0);
            this.grafix.lineTo(x1, this.height - y1);
        }
    }

    public render2(data : Array<Phaser.Point>, color : number, data2 : Array<Phaser.Point>, color2 : number) : void {
        let n = data.length;
        if (n<2)
            return;

        let yrng = (this.ymax - this.ymin);
        let scale_y = this.height / yrng;
 
        let xrng = (this.xmax - this.xmin);
        let scale_x = this.width / xrng;

        this.grafix.lineStyle(2, color, 1);
        let x0 = (data[n-2].x - this.xmin) * scale_x;
        let y0 = (data[n-2].y - this.ymin) * scale_y;
        let x1 = (data[n-1].x - this.xmin) * scale_x;
        let y1 = (data[n-1].y - this.ymin) * scale_y;
        
        this.grafix.moveTo(x0, this.height - y0);
        this.grafix.lineTo(x1, this.height - y1);

        //
        //  curve 2
        //

        this.grafix.lineStyle(2, color2, 1);
        x0 = (data2[n-2].x - this.xmin) * scale_x;
        y0 = (data2[n-2].y - this.ymin) * scale_y;
        x1 = (data2[n-1].x - this.xmin) * scale_x;
        y1 = (data2[n-1].y - this.ymin) * scale_y;
        
        this.grafix.moveTo(x0, this.height - y0);
        this.grafix.lineTo(x1, this.height - y1);
    }
}

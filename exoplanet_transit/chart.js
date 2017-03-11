/// <reference path="../shared/phaser-2.6.2/typescript/phaser.d.ts"/> 
var Chart = (function () {
    function Chart(game, width, height, font) {
        this.colAxis = 0xffffff;
        this.colCurve = 0x0085ff; // 0xd900ff;
        this.ymin = 0;
        this.ymax = 1;
        this.width = width;
        this.height = height;
        this.game = game;
        this.font = font;
    }
    Chart.prototype.setYRange = function (ymin, ymax) {
        this.ymin = ymin;
        this.ymax = ymax;
    };
    Chart.prototype.create = function (xpos, ypos) {
        this.xpos = xpos;
        this.ypos = ypos;
        this.grafix = this.game.add.graphics(this.xpos, this.ypos);
        var style = { font: this.font, fill: "#ffffff", wordWrap: true, align: "center", backgroundColor: "#000000" };
        var dummy = this.game.add.text(-100, -100, "foobar", style);
        this.xAxisTitle = this.game.add.text(this.xpos + this.width / 2, this.ypos + this.height + dummy.height, "Zeit", style);
        this.xAxisTitle.anchor = new Phaser.Point(0.5, 0.5);
        this.yAxisTitle = this.game.add.text(this.xpos - dummy.height, this.ypos + this.height / 2, "Helligkeit", style);
        this.yAxisTitle.anchor = new Phaser.Point(0.5, 0.5);
        this.yAxisTitle.angle = 270;
    };
    Chart.prototype.renderAxis = function () {
        this.grafix.lineStyle(3, this.colAxis, 1);
        this.grafix.moveTo(0, 0);
        this.grafix.lineTo(0, this.height);
        this.grafix.lineTo(this.width, this.height);
        var arrow_size = 5;
        this.grafix.beginFill(this.colAxis);
        this.grafix.lineStyle(3, this.colAxis, 1);
        this.grafix.moveTo(0, 0);
        this.grafix.lineTo(-arrow_size, 0);
        this.grafix.lineTo(0, -2 * arrow_size);
        this.grafix.lineTo(arrow_size, 0);
        this.grafix.endFill();
        this.grafix.beginFill(this.colAxis);
        this.grafix.moveTo(this.width, this.height);
        this.grafix.lineStyle(3, this.colAxis, 1);
        this.grafix.lineTo(this.width, this.height - arrow_size);
        this.grafix.lineTo(this.width + 2 * arrow_size, this.height);
        this.grafix.lineTo(this.width, this.height + arrow_size);
        this.grafix.endFill();
    };
    Chart.prototype.update = function (data) {
    };
    Chart.prototype.render = function (data) {
        var n = data.length;
        var yrng = (this.ymax - this.ymin);
        var scale = this.height / yrng;
        if (n > 2) {
            var x0 = data[n - 2].x;
            var y0 = (data[n - 2].y - this.ymin) * scale;
            var x1 = data[n - 1].x;
            var y1 = (data[n - 1].y - this.ymin) * scale;
            this.grafix.moveTo(x0, this.height - y0);
            this.grafix.lineTo(x1, this.height - y1);
        }
        else if (n == 2) {
            this.grafix.clear();
            this.renderAxis();
            this.grafix.lineStyle(3, this.colCurve, 1);
        }
    };
    return Chart;
}());
//# sourceMappingURL=chart.js.map
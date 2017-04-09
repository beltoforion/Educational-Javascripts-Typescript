/// <reference path="../shared/phaser-2.6.2/typescript/phaser.d.ts"/> 
var Chart = (function () {
    function Chart(game, width, height, font) {
        this.colAxis = 0xffffff;
        this.ymin = 0;
        this.ymax = 1;
        this.xmin = 0;
        this.xmax = 1;
        this.width = width;
        this.height = height;
        this.game = game;
        this.font = font;
    }
    Chart.prototype.setYTitle = function (title) {
        this.yAxisTitle.text = title;
    };
    Chart.prototype.setXTitle = function (title) {
        this.xAxisTitle.text = title;
    };
    Chart.prototype.setYRange = function (ymin, ymax) {
        this.ymin = ymin;
        this.ymax = ymax;
    };
    Chart.prototype.setXRange = function (xmin, xmax) {
        this.xmin = xmin;
        this.xmax = xmax;
    };
    Chart.prototype.getXMax = function () {
        return this.xmax;
    };
    Chart.prototype.create = function (xpos, ypos) {
        this.xpos = xpos;
        this.ypos = ypos;
        this.grafix = this.game.add.graphics(this.xpos, this.ypos);
        var style = { font: this.font, fill: "#ffffff", wordWrap: true, align: "center", backgroundColor: "#000000" };
        var dummy = this.game.add.text(-100, -100, "foobar", style);
        this.xAxisTitle = this.game.add.text(this.xpos + this.width / 2, this.ypos + this.height + dummy.height, "X-Axis", style);
        this.xAxisTitle.anchor = new Phaser.Point(0.5, 0.5);
        this.yAxisTitle = this.game.add.text(this.xpos - dummy.height, this.ypos + this.height / 2, "Y-Axis", style);
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
    Chart.prototype.clear = function () {
        this.grafix.clear();
        this.renderAxis();
    };
    Chart.prototype.render = function (data, color) {
        var n = data.length;
        if (n < 2)
            return;
        var yrng = (this.ymax - this.ymin);
        var scale_y = this.height / yrng;
        var xrng = (this.xmax - this.xmin);
        var scale_x = this.width / xrng;
        this.grafix.lineStyle(2, color, 1);
        for (var i = 2; i < data.length; ++i) {
            var x0 = (data[i - 2].x - this.xmin) * scale_x;
            var y0 = (data[i - 2].y - this.ymin) * scale_y;
            var x1 = (data[i - 1].x - this.xmin) * scale_x;
            var y1 = (data[i - 1].y - this.ymin) * scale_y;
            this.grafix.moveTo(x0, this.height - y0);
            this.grafix.lineTo(x1, this.height - y1);
        }
    };
    Chart.prototype.render2 = function (data, color, data2, color2) {
        var n = data.length;
        if (n < 2)
            return;
        var yrng = (this.ymax - this.ymin);
        var scale_y = this.height / yrng;
        var xrng = (this.xmax - this.xmin);
        var scale_x = this.width / xrng;
        this.grafix.lineStyle(2, color, 1);
        for (var i = 2; i < data.length; ++i) {
            var x0 = (data[i - 2].x - this.xmin) * scale_x;
            var y0 = (data[i - 2].y - this.ymin) * scale_y;
            var x1 = (data[i - 1].x - this.xmin) * scale_x;
            var y1 = (data[i - 1].y - this.ymin) * scale_y;
            this.grafix.moveTo(x0, this.height - y0);
            this.grafix.lineTo(x1, this.height - y1);
        }
        //
        //  curve 2
        //
        this.grafix.lineStyle(2, color2, 1);
        for (var i = 2; i < data2.length; ++i) {
            var x0 = (data2[i - 2].x - this.xmin) * scale_x;
            var y0 = (data2[i - 2].y - this.ymin) * scale_y;
            var x1 = (data2[i - 1].x - this.xmin) * scale_x;
            var y1 = (data2[i - 1].y - this.ymin) * scale_y;
            this.grafix.moveTo(x0, this.height - y0);
            this.grafix.lineTo(x1, this.height - y1);
        }
    };
    return Chart;
}());
//# sourceMappingURL=chart.js.map
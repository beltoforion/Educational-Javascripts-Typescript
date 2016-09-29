var Context2d = (function () {
    function Context2d() {
    }
    Context2d.Create = function (cv) {
        var ctx = cv.getContext("2d");
        // Extend the context with a draw arrow function
        ctx.drawVector = function (x, y, vx, vy, len, w, col) {
            var x1 = x;
            var y1 = y;
            var x2 = x1 + vx;
            var y2 = y1 + vy;
            var a = Math.atan2(y2 - y1, x2 - x1);
            this.beginPath();
            this.moveTo(x1, y1);
            this.lineTo(x2, y2);
            this.lineTo(x2 - len * Math.cos(a - Math.PI / 6), y2 - len * Math.sin(a - Math.PI / 7));
            this.moveTo(x2, y2);
            this.lineTo(x2 - len * Math.cos(a + Math.PI / 6), y2 - len * Math.sin(a + Math.PI / 7));
            this.lineWidth = (w != null) ? w : 2;
            this.strokeStyle = (col != null) ? col : 'yellow';
            this.stroke();
            this.closePath();
        };
        ctx.drawArrow = function (x1, y1, x2, y2, len, w, col) {
            var a = Math.atan2(y2 - y1, x2 - x1);
            this.beginPath();
            this.moveTo(x1, y1);
            this.lineTo(x2, y2);
            this.lineTo(x2 - len * Math.cos(a - Math.PI / 6), y2 - len * Math.sin(a - Math.PI / 7));
            this.moveTo(x2, y2);
            this.lineTo(x2 - len * Math.cos(a + Math.PI / 6), y2 - len * Math.sin(a + Math.PI / 7));
            this.lineWidth = (w != null) ? w : 2;
            this.strokeStyle = (col != null) ? col : 'yellow';
            this.stroke();
            this.closePath();
        };
        ctx.drawCross = function (x, y, w, l, color) {
            this.beginPath();
            this.moveTo(x - l, y);
            this.lineTo(x + l, y);
            this.moveTo(x, y - l);
            this.lineTo(x, y + l);
            this.strokeStyle = color;
            this.lineWidth = w;
            this.stroke();
            this.closePath();
        };
        ctx.drawCircle = function (pos, r, a1, a2, color, colorOutline, lineWidth) {
            this.beginPath();
            this.arc(pos.x, pos.y, r, a1, a2);
            if (color != null) {
                this.fillStyle = color;
                this.fill();
            }
            this.lineWidth = (lineWidth != null) ? lineWidth : 2;
            this.strokeStyle = colorOutline;
            this.stroke();
            this.closePath();
        };
        ctx.drawCenterOfMass = function (pos, r) {
            this.fillStyle = 'white';
            this.beginPath();
            this.arc(pos.x, pos.y, r, 0, Math.PI / 2);
            this.lineTo(pos.x, pos.y);
            this.closePath();
            this.fill();
            this.fillStyle = 'black';
            this.beginPath();
            this.arc(pos.x, pos.y, r, Math.PI / 2, Math.PI);
            this.lineTo(pos.x, pos.y);
            this.closePath();
            this.fill();
            this.fillStyle = 'white';
            this.beginPath();
            this.arc(pos.x, pos.y, r, Math.PI, 1.5 * Math.PI);
            this.lineTo(pos.x, pos.y);
            this.closePath();
            this.fill();
            this.fillStyle = 'black';
            this.beginPath();
            this.arc(pos.x, pos.y, r, 1.5 * Math.PI, 2 * Math.PI);
            this.lineTo(pos.x, pos.y);
            this.closePath();
            this.fill();
        };
        return ctx;
    };
    return Context2d;
}());
//# sourceMappingURL=context2d.js.map
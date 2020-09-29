var DampedHarmonicOscillator = /** @class */ (function () {
    function DampedHarmonicOscillator(containerId) {
        this.container = document.getElementById(containerId);
    }
    DampedHarmonicOscillator.prototype.update = function (x0, v0, w0, delta) {
        this.any(x0, v0, w0, delta);
    };
    DampedHarmonicOscillator.prototype.updateFromControls = function (x0, v0, w0, delta) {
        this.any(Number(document.getElementById(x0).value), Number(document.getElementById(v0).value), Number(document.getElementById(w0).value), Number(document.getElementById(delta).value));
    };
    DampedHarmonicOscillator.prototype.any = function (x0, v0, w0, delta) {
        if (w0 == delta) {
            this.critical(x0, v0, w0, delta);
        }
        else if (w0 > delta) {
            this.underdamped(x0, v0, w0, delta);
        }
        else if (w0 < delta) {
            this.overdamped(x0, v0, w0, delta);
        }
    };
    DampedHarmonicOscillator.prototype.critical = function (x0, v0, w0, delta) {
        var graph1 = [];
        var graph2 = [];
        if (w0 != delta) {
            alert('Kein aperiodischer Grenzfall! omega0 != delta!');
        }
        var c1 = x0;
        var c2 = v0 + delta * x0;
        var maxx = 10;
        var n = 100;
        var ds = maxx / n;
        var yaxismin = 10000;
        var yaxismax = -10000;
        for (var i = 0; i < n; ++i) {
            var t = i * ds;
            var x = (c1 + c2 * t) * Math.exp(-delta * t);
            graph1.push([t, x]);
            graph2.push([t, v0 * t * Math.exp(-delta * t)]); // Referenzlösung zum testen für x(0) = 0, v(0) = v0
            yaxismax = Math.max(yaxismax, Math.max(Math.abs(x)));
        }
        yaxismax *= 1.1;
        yaxismin = -yaxismax;
        var graph = Flotr.draw(this.container, [graph1], {
            colors: ['#000000', '#CCEECC'],
            xaxis: {
                minorTickFreq: 4,
                min: 0,
                max: maxx,
                showLabels: true
            },
            yaxis: {
                showLabels: true,
                min: yaxismin,
                max: yaxismax
            },
            grid: {
                minorVerticalLines: true
            }
        });
    };
    DampedHarmonicOscillator.prototype.overdamped = function (x0, v0, w0, delta) {
        var graph1 = [];
        var graph2 = [];
        var graph3 = [];
        var graph4 = [];
        var alpha = Math.sqrt(delta * delta - w0 * w0);
        var l1 = -delta + alpha;
        var l2 = -delta - alpha;
        if (l1 > 0 || l2 > 0) {
            alert('Kein Kriechfall! Lambdas größer 0!');
        }
        var c2 = (x0 * l1 - v0) / (l1 - l2);
        var c1 = x0 - c2;
        function sinh(x) {
            return 0.5 * (Math.exp(x) - Math.exp(-x));
        }
        var maxx = 10;
        var n = 100;
        var ds = maxx / n;
        var yaxismin = 10000;
        var yaxismax = -10000;
        for (var i = 0; i < n; ++i) {
            var t = i * ds;
            var x1 = c1 * Math.exp(-Math.abs(l1) * t);
            var x2 = c2 * Math.exp(-Math.abs(l2) * t);
            graph1.push([t, x1]);
            graph2.push([t, x2]);
            graph3.push([t, x1 + x2]);
            // Referenzlösung zum testen für x(0) = 0, v(0) = v0
            //graph4.push([t, (v0/alpha) * Math.exp(-delta*t) * sinh(alpha*t)]);	
            /*			yaxismax =  Math.max(yaxismax, Math.max(Math.abs(x1)));
                        yaxismax =  Math.max(yaxismax, Math.max(Math.abs(x2)));*/
            yaxismax = Math.max(yaxismax, Math.max(Math.abs(x1 + x2)));
        }
        yaxismax *= 1.1;
        yaxismin = -yaxismax;
        var graph = Flotr.draw(this.container, [graph1, graph2, graph3], {
            colors: ['#EECCCC', '#CCEECC', '#000000', '#4DA74D', '#9440ED'],
            xaxis: {
                minorTickFreq: 4,
                min: 0,
                max: maxx,
                showLabels: true
            },
            yaxis: {
                showLabels: true,
                min: yaxismin,
                max: yaxismax
            },
            grid: {
                minorVerticalLines: true
            }
        });
    };
    DampedHarmonicOscillator.prototype.underdamped = function (x0, v0, w0, delta) {
        var graph1 = [];
        var graph2 = [];
        var graph3 = [];
        var graph4 = [];
        if (w0 <= delta) {
            alert('Kein Schwingfall');
        }
        var w = Math.sqrt(w0 * w0 - delta * delta);
        var xx = Math.sqrt(2 * delta * v0 * x0 + Math.pow(v0, 2) + Math.pow(delta * x0, 2) + Math.pow(x0 * w, 2));
        var A = -xx / (2 * w);
        var phi = 2 * (Math.PI + Math.atan((-v0 - delta * x0) / (x0 * w - xx)));
        var maxx = 10;
        var n = 100;
        var ds = maxx / n;
        var yaxismin = 10000;
        var yaxismax = -10000;
        for (var i = 0; i < n; ++i) {
            var t = i * ds;
            var x1 = Math.exp(-delta * t) * 2 * A * Math.cos(phi + w * t);
            var x2 = Math.exp(-delta * t) * 2 * A;
            var x3 = -Math.exp(-delta * t) * 2 * A;
            graph1.push([t, x1]);
            graph2.push([t, x2]);
            graph3.push([t, x3]);
            yaxismax = Math.max(yaxismax, Math.max(Math.abs(x1)));
        }
        yaxismax *= 1.1;
        yaxismin = -yaxismax;
        var graph = Flotr.draw(this.container, [graph2, graph3, graph1], {
            colors: ['#EECCCC', '#EECCCC', '#000000'],
            xaxis: {
                minorTickFreq: 4,
                min: 0,
                max: maxx,
                showLabels: true
            },
            yaxis: {
                showLabels: true,
                min: yaxismin,
                max: yaxismax
            },
            grid: {
                minorVerticalLines: true
            }
        });
    };
    return DampedHarmonicOscillator;
}()); // end of class
//# sourceMappingURL=damped_harmonic_oscillator.js.map
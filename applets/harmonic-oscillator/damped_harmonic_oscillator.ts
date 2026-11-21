declare var Flotr : any;
declare var document : Document;

class DampedHarmonicOscillator {

	private container : any;

	constructor(containerId : string) {
		this.container = document.getElementById(containerId);
	}

	public update(x0 : number, v0 : number,  w0 : number, delta : number) : void {
		this.any(x0, v0, w0, delta);
	}

	public updateFromControls(x0 : string, v0 : string,  w0 : string, delta : string) : void {
		this.any(Number((<HTMLInputElement>document.getElementById(x0)).value),
                 Number((<HTMLInputElement>document.getElementById(v0)).value),
                 Number((<HTMLInputElement>document.getElementById(w0)).value),
                 Number((<HTMLInputElement>document.getElementById(delta)).value));
	}

	public any(x0 : number, v0 : number, w0 : number, delta : number) : void {
		if (w0 == delta) {
			this.critical(x0, v0, w0, delta);
		} else if (w0 > delta) {
			this.underdamped(x0, v0, w0, delta);
		} else if (w0 < delta) {
			this.overdamped(x0, v0, w0, delta);
		}
	}

	public critical(x0 : number, v0 : number, w0 : number, delta : number) : void {
		var graph1 : Array<any> = [];
		var graph2 : Array<any> = [];

		if (w0 != delta) {
			alert('Kein aperiodischer Grenzfall! omega0 != delta!');
		}

		let c1 = x0;
		let c2 = v0 + delta * x0;
		let maxx = 10;
		let n = 100;
		let ds = maxx / n;
		let yaxismin = 10000;
		let yaxismax = -10000;

		for (let i = 0; i < n; ++i) {
			let t = i * ds;
			let x = (c1 + c2*t) * Math.exp(-delta*t);

        	graph1.push([t, x]);
        	graph2.push([t, v0*t * Math.exp(-delta*t)]);  // Referenzlösung zum testen für x(0) = 0, v(0) = v0

			yaxismax =  Math.max(yaxismax, Math.max(Math.abs(x)));
		}

		yaxismax *= 1.1;
		yaxismin = -yaxismax;

		var graph = Flotr.draw(this.container, [graph1], {
			colors: ['#000000', '#CCEECC'],
	        xaxis: {
				minorTickFreq: 4,
				min : 0,
				max : maxx,
				showLabels:true
	        },
			yaxis: {
				showLabels:true,
				min : yaxismin,
				max : yaxismax
			},
	        grid: {
			minorVerticalLines: true
	        }
		});
	}


	public overdamped(x0 : number, v0 : number, w0 : number, delta : number) : void {
		var graph1 : Array<any> = [];
    	var graph2 : Array<any> = [];
		var graph3 : Array<any> = [];
		var graph4 : Array<any> = [];
	
		let alpha = Math.sqrt(delta*delta - w0*w0)
		let l1 = -delta + alpha;
		let l2 = -delta - alpha;
		if (l1>0 || l2>0) {
			alert('Kein Kriechfall! Lambdas größer 0!');
		}

		let c2 = (x0*l1 - v0) / (l1-l2);
		let c1 = x0 - c2;

		function sinh(x : number) {
			return 0.5 * (Math.exp(x) - Math.exp(-x));
		}

		let maxx = 10;
		let n = 100;
		let ds = maxx / n;
		let yaxismin = 10000;
		let yaxismax = -10000;
		for (let i = 0; i < n; ++i) {
			let t = i * ds
			let x1 = c1*Math.exp(-Math.abs(l1)*t)
			let x2 = c2*Math.exp(-Math.abs(l2)*t)
        	
			graph1.push([t, x1]);
        	graph2.push([t, x2]);
        	graph3.push([t, x1 + x2 ]);
			// Referenzlösung zum testen für x(0) = 0, v(0) = v0
        	//graph4.push([t, (v0/alpha) * Math.exp(-delta*t) * sinh(alpha*t)]);	

/*			yaxismax =  Math.max(yaxismax, Math.max(Math.abs(x1)));
			yaxismax =  Math.max(yaxismax, Math.max(Math.abs(x2)));*/
			yaxismax =  Math.max(yaxismax, Math.max(Math.abs(x1 + x2)));
		}

		yaxismax *= 1.1;
		yaxismin = -yaxismax;

		var graph : any = Flotr.draw(this.container, [graph1, graph2, graph3], {
			colors: ['#EECCCC', '#CCEECC', '#000000', '#4DA74D', '#9440ED'],
	    	    xaxis: {
				minorTickFreq: 4,
				min : 0,
				max : maxx,
				showLabels:true
	        	},
			yaxis: {
				showLabels:true,
				min : yaxismin,
				max : yaxismax
			},
	        grid: {
				minorVerticalLines: true
	        }
		});
	}

	public underdamped(x0 : number, v0 : number, w0 : number, delta : number) : void {
		var graph1 : Array<any> = [];
		var graph2 : Array<any> = [];
		var graph3 : Array<any> = [];
		var graph4 : Array<any> = [];

		if (w0 <= delta) {
			alert('Kein Schwingfall');
		}
	
		let w   =   Math.sqrt(w0*w0 - delta*delta);
		let xx  =   Math.sqrt(2*delta*v0*x0 + Math.pow(v0,2) + Math.pow(delta*x0, 2) + Math.pow(x0*w, 2));
		let A   = - xx / (2*w);
		let phi = 2 * (Math.PI + Math.atan((-v0-delta*x0) / (x0*w - xx)));

		let maxx = 10;
		let n = 100;
		let ds = maxx / n;
		let yaxismin = 10000;
		let yaxismax = -10000;
		for (let i = 0; i < n; ++i) {
			let t = i * ds

			let x1 =  Math.exp(-delta*t) * 2*A*Math.cos(phi + w*t);
			let x2 =  Math.exp(-delta*t) * 2*A;
			let x3 = -Math.exp(-delta*t) * 2*A;
        	graph1.push([t, x1 ]);
        	graph2.push([t, x2 ]);
        	graph3.push([t, x3 ]);

			yaxismax =  Math.max(yaxismax, Math.max(Math.abs(x1)));
		}

		yaxismax *= 1.1;
		yaxismin = -yaxismax;

		var graph : any = Flotr.draw(this.container, [graph2, graph3, graph1], {
			colors: ['#EECCCC', '#EECCCC', '#000000'],
		        xaxis: {
				minorTickFreq: 4,
				min : 0,
				max : maxx,
				showLabels:true
			},
			yaxis: {
				showLabels:true,
				min : yaxismin,
				max : yaxismax
			},
	        grid: {
				minorVerticalLines: true
	        }
		});
	}
} // end of class
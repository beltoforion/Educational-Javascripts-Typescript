/// <reference path="./IIntegrator.ts"/>
/// <reference path="./IModel.ts"/>

class IntegratorRK4 implements IIntegrator {
    
    private h : number;

    private model : IModel;

    private time : number;

    private state : number [] = [];

    private tmp : number [] = [];

    private k1 : number [] = [];

    private k2 : number [] = [];

    private k3 : number [] = [];

    private k4 : number [] = [];

    public setStepSize(h : number) : void {
        this.h = h;
    }

    public setModel(model : IModel) : void {
        this.model = model;
    }

    public singleStep() : number [] {

        let dim = this.state.length;

        // k1
        this.model.eval(this.state, this.time, this.k1);
        for (var i=0; i < dim; ++i)
            this.tmp[i] = this.state[i] + this.h * 0.5 * this.k1[i];

        // k2
        this.model.eval(this.tmp, this.time + this.h * 0.5, this.k2);
        for (var i=0; i < dim; ++i)
            this.tmp[i] = this.state[i] + this.h * 0.5 * this.k2[i];

        // k3
        this.model.eval(this.tmp, this.time + this.h * 0.5, this.k3);
        for (var i=0; i < dim; ++i)
            this.tmp[i] = this.state[i] + this.h * this.k3[i];

        // k4
        this.model.eval(this.tmp, this.time + this.h, this.k4);
        for (var i=0; i < dim; ++i)
            this.state[i] += this.h/6 * (this.k1[i] + 2*(this.k2[i]+this.k3[i]) + this.k4[i]);

        this.time += this.h;

        return this.state;
    }

    public setInitialState(state : number []) : void {
        for (var i=0; i<state.length; ++i) {
            this.state[i] = state[i];
            this.k1[i] = 0;
            this.k2[i] = 0;
            this.k3[i] = 0;
            this.k4[i] = 0;
        }

        this.time = 0;
    }

    constructor(model : IModel) {
        this.h = 0.05;
        this.time = 0;
        this.model = model;
        model.setEngine(this);
    }
}
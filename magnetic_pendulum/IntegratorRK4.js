/// <reference path="./IIntegrator.ts"/>
/// <reference path="./IModel.ts"/>
var IntegratorRK4 = (function () {
    function IntegratorRK4(model) {
        this.state = [];
        this.tmp = [];
        this.k1 = [];
        this.k2 = [];
        this.k3 = [];
        this.k4 = [];
        this.h = 2;
        this.time = 0;
        this.model = model;
    }
    IntegratorRK4.prototype.setStepSize = function (h) {
        this.h = h;
    };
    IntegratorRK4.prototype.setModel = function (model) {
        this.model = model;
    };
    IntegratorRK4.prototype.singleStep = function () {
        var dim = this.state.length;
        // k1
        this.model.eval(this.state, this.time, this.k1);
        for (var i = 0; i < dim; ++i)
            this.tmp[i] = this.state[i] + this.h * 0.5 * this.k1[i];
        // k2
        this.model.eval(this.tmp, this.time + this.h * 0.5, this.k2);
        for (var i = 0; i < dim; ++i)
            this.tmp[i] = this.state[i] + this.h * 0.5 * this.k2[i];
        // k3
        this.model.eval(this.tmp, this.time + this.h * 0.5, this.k3);
        for (var i = 0; i < dim; ++i)
            this.tmp[i] = this.state[i] + this.h * this.k3[i];
        // k4
        this.model.eval(this.tmp, this.time + this.h, this.k4);
        for (var i = 0; i < dim; ++i)
            this.state[i] += this.h / 6 * (this.k1[i] + 2 * (this.k2[i] + this.k3[i]) + this.k4[i]);
        this.time += this.h;
        return this.state;
    };
    IntegratorRK4.prototype.setInitialState = function (state) {
        for (var i = 0; i < state.length; ++i) {
            this.state[i] = state[i];
            this.k1[i] = 0;
            this.k2[i] = 0;
            this.k3[i] = 0;
            this.k4[i] = 0;
        }
        this.time = 0;
    };
    return IntegratorRK4;
}());
//# sourceMappingURL=IntegratorRK4.js.map
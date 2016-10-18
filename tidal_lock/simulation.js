var Simulation = (function () {
    function Simulation() {
    }
    Simulation.prototype.suspend = function () {
        if (this.isSuspended) {
            return;
        }
        this.isSuspended = true;
    };
    Simulation.prototype.continue = function () {
        if (!this.isSuspended) {
            return;
        }
        this.isSuspended = false;
    };
    Simulation.prototype.tick = function () {
        this.update();
        this.render();
    };
    return Simulation;
}());
//# sourceMappingURL=simulation.js.map
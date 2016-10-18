abstract class Simulation {

    private isSuspended : boolean;

    protected abstract update() : void;
    protected abstract render() : void;

    constructor() {

    }

    public suspend() : void {
        if (this.isSuspended) {
            return;
        }

        this.isSuspended = true;
    }

    public continue() : void {
        if (!this.isSuspended) {
            return;
        }

        this.isSuspended = false;
    }

    protected tick() : void {
        this.update();
        this.render();
    }
}
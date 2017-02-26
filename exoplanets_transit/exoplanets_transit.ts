/// <reference path="../shared/phaser-2.6.2/typescript/phaser.d.ts"/> 
/// <reference path="./chart.ts"/>

class TransitSimulator {
    private game : Phaser.Game;

    private jupiter : any;

    private sun  : any;

    private world : any;

    private chart : Chart;

    private curve : Array<Phaser.Point>;

    private sizeSun : number = 300;
    
    private sizeJupiter : number = 40;

    private relArea : number;

    public constructor() {
      this.game = new Phaser.Game(800, 
                                  600, 
                                  Phaser.CANVAS, 
                                  'transit-simulator', 
                                  { 
                                    preload: () => this.preload(), 
                                    create:  () => this.create(), 
                                    update:  () => this.update(), 
                                    render:  () => this.render() 
                                  });
    }

    private preload() {
      this.game.load.image('jupiter', 'assets/sprites/jupiter.png');
      this.game.load.image('sun', 'assets/sprites/sun.png');
    }

    private create() {

      this.relArea = (this.sizeJupiter * this.sizeJupiter) / (this.sizeSun * this.sizeSun);

      this.sun = this.game.add.sprite(100, 100, 'sun');
      this.sun.anchor = new Phaser.Point(0.5, 0.5);  
      this.sun.scale.setTo(this.sizeSun/this.sun.width, this.sizeSun/this.sun.width);
      this.sun.x = this.game.world.centerX;
      this.sun.y = this.game.world.centerY - 100;

      this.jupiter = this.game.add.sprite(100, 100, 'jupiter');
      this.jupiter.anchor = new Phaser.Point(0.5, 0.5);  
      this.jupiter.scale.setTo(this.sizeJupiter/this.jupiter.width, this.sizeJupiter/this.jupiter.width);
      this.jupiter.y = this.sun.y;

      let margin = 50;
      let height = 200;
      this.chart = new Chart(this.game, this.game.world.width - 2*margin, height);
      this.chart.create(margin, this.game.world.height - margin - height);
      this.chart.setYRange(0.96, 1.01);

      this.curve = new Array<Phaser.Point>();
    }

    private calcBrightness(xpos : number, ypos : number) {
      let dist = Math.sqrt(Math.pow(this.sun.x - this.jupiter.x, 2) + Math.pow(this.sun.y - this.jupiter.y, 2));
      let radSun = this.sizeSun/2;
      let radJup = this.sizeJupiter/2; 

      let areaSun = Math.PI * radSun * radSun;
      let areaJup = Math.PI * radJup * radJup;

      let distSurface = dist-radSun;

      let maxBri : number = 1;
      let minBri : number = 1 - (areaJup / areaSun);
      let noise : number = 0.005;

      if ( distSurface > radJup) {
        // Full brightness 
        return maxBri + noise * this.game.rnd.frac();
      } else if (distSurface > 0 && distSurface <= radJup) {
        let perc =  (distSurface / radJup);
        let delta = (maxBri-minBri)
//        let v = (1 - perc);

        let v =  Math.pow((1-perc) , 4);

        // transition zone
        return maxBri - v * delta + noise * this.game.rnd.frac();
      } else {
        return minBri + noise * this.game.rnd.frac();
      }
    }

    private update() {
      this.jupiter.x += 1;

      if (this.jupiter.x > 800) {
        this.jupiter.x = 0;
        this.curve = [];
      }

      if (this.jupiter.x > this.chart.xpos && this.jupiter.x < (this.game.world.width - this.chart.xpos)) {
        let bri = this.calcBrightness(this.jupiter.x, this.jupiter.y);
        this.curve.push(new Phaser.Point(this.jupiter.x - 50, bri));
      }
    }

    private render() {
      if (this.jupiter.x > this.chart.xpos && this.jupiter.x < (this.game.world.width - this.chart.xpos)) {
        this.chart.render(this.curve);
      }
    }
}

//
// Start the simulation
// 

window.onload = () => {
  var game = new TransitSimulator();
};

/// <reference path="../shared/phaser-ce-2.14.0/typescript/phaser.d.ts"/> 
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

    private tick : number = 0;

    private config : any;

    private colCurve : number = 0x0085ff;

    public constructor(cfg : any) {

      this.config = cfg;

      if (cfg.sizeSun!=null) {
        this.sizeSun = cfg.sizeSun;
      }

      if (cfg.sizePlanet!=null) {
        this.sizeJupiter = cfg.sizePlanet;
      }
      
      this.game = new Phaser.Game(cfg.width, 
                                  cfg.height, 
                                  Phaser.CANVAS,
                                  cfg.cvid, 
                                  { 
                                    preload: () => this.preload(), 
                                    create:  () => this.create(), 
                                    update:  () => this.update(), 
                                    render:  () => this.render() 
                                  });

//      this.game.stage.disableVisibilityChange = true;
    }

    private preload() : void {
      this.game.load.image('jupiter', this.config.assetpath + 'assets/sprites/jupiter.png');
      this.game.load.image('sun', this.config.assetpath + 'assets/sprites/sun.png');
    }

    private create() : void {

      this.relArea = (this.sizeJupiter * this.sizeJupiter) / (this.sizeSun * this.sizeSun);

      this.sun = this.game.add.sprite(100, 100, 'sun');
      this.sun.anchor = new Phaser.Point(0.5, 0.5);  
      this.sun.scale.setTo(this.sizeSun/this.sun.width, this.sizeSun/this.sun.width);
      this.sun.x = this.game.world.centerX;
      this.sun.y = this.game.world.centerY - 150;

      this.jupiter = this.game.add.sprite(100, 100, 'jupiter');
      this.jupiter.anchor = new Phaser.Point(0.5, 0.5);  
      this.jupiter.scale.setTo(this.sizeJupiter/this.jupiter.width, this.sizeJupiter/this.jupiter.width);
      this.jupiter.y = this.sun.y;
      this.jupiter.x = 70;

      let margin = 70;
      let height = 200;
      this.chart = new Chart(this.game, this.game.world.width - 2*margin, height, this.config.font);
      this.chart.create(margin, this.game.world.height - margin - height);
      this.chart.setYRange(0.9, 1.05);
      this.chart.setXRange(margin, this.game.world.width - margin);
      this.chart.setXTitle("Zeit");
      this.chart.setYTitle("Helligkeit");

      this.curve = new Array<Phaser.Point>();
    }

    private calcBrightness(xpos : number, ypos : number) : number {
      let dist = Math.sqrt(Math.pow(this.sun.x - this.jupiter.x, 2) + Math.pow(this.sun.y - this.jupiter.y, 2));
      let radSun = this.sizeSun/2;
      let radJup = this.sizeJupiter/2; 

      let areaSun = Math.PI * radSun * radSun;
      let areaJup = Math.PI * radJup * radJup;

      let distSurface = dist-radSun;

      let maxBri : number = 1;
      let minBri : number = 1 - (areaJup / areaSun);
      let noise : number = 0.01;

      if ( distSurface > radJup) {
        // Full brightness 
        return maxBri + noise * this.game.rnd.frac();
      } else if (distSurface > 0 && distSurface <= radJup) {
        let perc =  (distSurface / radJup);
        let v =  Math.pow((1-perc) , 4);
        let delta = (maxBri-minBri)
        return maxBri - v * delta + noise * this.game.rnd.frac();
      } else {
        let x = this.jupiter.x - this.sun.x;
        let c = Math.sqrt(Math.pow(this.sizeSun/2,2) - Math.pow(x, 2)) * 0.0005; 
        return minBri - c + noise * this.game.rnd.frac();
      }
    }

    private update() : void {
      this.jupiter.x += 1;
      this.tick += 1;

      if (this.jupiter.x > this.config.width) {
        this.jupiter.x = 0;
        this.curve = [];
      }

      if (   this.tick % 5 == 0 
          && this.jupiter.x > this.chart.xpos 
          && this.jupiter.x < (this.game.world.width - this.chart.xpos)) {
          let bri = this.calcBrightness(this.jupiter.x, this.jupiter.y);
          this.curve.push(new Phaser.Point(this.jupiter.x, bri));
      }
    }

    private render() : void {
      this.chart.clear();
      this.chart.render(this.curve, this.colCurve);
    }
}

/// <reference path="../shared/phaser-2.6.2/typescript/phaser.d.ts"/> 
/// <reference path="./chart.ts"/>

class PulsarTimingSimulator {
    private game : Phaser.Game;

    private planet : Phaser.Sprite;

    private earth_left : Phaser.Sprite;

    private earth_right : Phaser.Sprite;

    private earthSensor : any;

    private beam_left : Phaser.Sprite;

    private beam_right : Phaser.Sprite;

    private chart : Chart;

    private curve : Array<Phaser.Point>;

    private curve2 : Array<Phaser.Point>;

    private pulsar_left : Phaser.Sprite;

    private pulsar_right : Phaser.Sprite;

    private center_of_mass : Phaser.Sprite;

    private orbits : Phaser.Graphics;

    private mask_left : Phaser.Graphics;

    private mask_right : Phaser.Graphics;

    private colOrbits : number = 0x886633;

    private colTintBeamLeft : number = 0xFFFF33;

    private world : any;

    private centerOfMassY = 250;

    // distance of the star from the center of mass
    private distStar = 70;

    // Distance of the Planet from the center of mass
    private distPlanet = 140;

    // render size of the center of mass
    private sizeCenterOfMass = 10;

    // render size of the star
    private sizeStar : number = 70;
    
    // render size of the planet
    private sizeExoplanet : number = 20;

    private sizeEarth : number = 50;

    private deltaV : number;

    private tick : number = 0;

    private chart_x : number = 0;

    private font : string = "30px Arial";

    private fontHeight : number = 0;

    private caption_left : Phaser.Text;

    private caption_right : Phaser.Text;

    private config : any;

    public constructor(cfg : any) {

      this.config = cfg;

      if (cfg.noDeltaV==null) {
        cfg.noDeltaV = false;
      }

      if (cfg.noSpectrum==null) {
        cfg.noSpectrum = false;
      }

      if (cfg.sizeStar!=null) {
        this.sizeStar = cfg.sizeStar;
      }

      if (cfg.sizeExoplanet!=null) {
        this.sizeExoplanet = cfg.sizeExoplanet;
      }

      if (cfg.distStar!=null) {
        this.distStar = cfg.distStar;
      }

      if (cfg.distPlanet!=null) {
        this.distPlanet = cfg.distPlanet;
      }

      if (cfg.font!=null) {
        this.font = cfg.font;
      }

      if (cfg.centerOfMassY!=null) {
        this.centerOfMassY = cfg.centerOfMassY; 
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
                                  },
                                  cfg.noBackground!=null && cfg.noBackground);
    }

    private preload() : void {
      this.game.load.image('beam', this.config.assetpath + 'assets/sprites/beam.png');
      this.game.load.image('beam2', this.config.assetpath + 'assets/sprites/beam2.png');      
      this.game.load.image('planet', this.config.assetpath + 'assets/sprites/planet.png');
      this.game.load.image('earth', this.config.assetpath + 'assets/sprites/earth.png');
      this.game.load.image('planet_shadow', this.config.assetpath + 'assets/sprites/planet_shadow.png');
      this.game.load.image('pulsar', this.config.assetpath + 'assets/sprites/pulsar.png');
      this.game.load.image('center_of_mass', this.config.assetpath + 'assets/sprites/center_of_mass.png');

    }

    private create() : void {

      let center_left_x = this.game.world.width/2 - 250;
      let center_right_x = this.game.world.width/2 + 250;
      let center_y = this.centerOfMassY;

      // 
      // Left Side
      //
      var style = { font: this.font, fill: "#ffffff", wordWrap: false, align: "center", backgroundColor: "#000000" };
      this.caption_left = this.game.add.text(0, 0, "Pulsar mit Exoplanet", style);

      this.mask_left = this.game.add.graphics(0,0);
      this.mask_left.drawRect(0, 0, this.game.width/2, this.game.height / 2 + 100); 

      this.orbits = this.game.add.graphics(0, 0);
      this.orbits.alpha = 0.5;
      this.orbits.lineStyle(2, this.colOrbits, 1);
      this.orbits.drawCircle(center_left_x, center_y, 2 * this.distStar);
      this.orbits.drawCircle(center_left_x, center_y, 2 * this.distPlanet);

      this.beam_left = this.game.add.sprite(100, 100, 'beam');
      this.beam_left.anchor = new Phaser.Point(0.5, 0.5);
      this.beam_left.scale.setTo(1.5, 1);  
      this.beam_left.x = this.game.world.centerX;
      this.beam_left.y = this.game.world.centerY - 100;
      this.beam_left.mask = this.mask_left;

      this.pulsar_left = this.game.add.sprite(100, 100, 'pulsar');
      this.pulsar_left.anchor = new Phaser.Point(0.5, 0.5);  
      this.pulsar_left.scale.setTo(this.sizeStar / this.pulsar_left.width, this.sizeStar / this.pulsar_left.width);
      this.pulsar_left.x = this.beam_left.x;
      this.pulsar_left.y = this.beam_left.y;

      this.earth_left = this.game.add.sprite(200, 200, 'earth');
      this.earth_left.anchor = new Phaser.Point(0.5, 0.5);  
      this.earth_left.scale.setTo(this.sizeEarth/this.earth_left.width, this.sizeEarth/this.earth_left.width);
      this.earth_left.y = center_y + 300;
      this.earth_left.x = center_left_x;

      this.center_of_mass = this.game.add.sprite(100, 100, 'center_of_mass');
      this.center_of_mass.scale.setTo(this.sizeCenterOfMass/this.center_of_mass.width, this.sizeCenterOfMass/this.center_of_mass.width);
      this.center_of_mass.anchor = new Phaser.Point(0.5, 0.5);
      this.center_of_mass.x = center_left_x;
      this.center_of_mass.y = center_y;

      this.planet = this.game.add.sprite(100, 100, 'planet');
      this.planet.anchor = new Phaser.Point(0.5, 0.5);  
      this.planet.scale.setTo(this.sizeExoplanet/this.planet.width, this.sizeExoplanet/this.planet.width);
      this.planet.y = this.pulsar_left.y;
      this.planet.x = center_left_x;

      //
      // Right Side
      //
       
      this.caption_right = this.game.add.text(this.game.width/2, 0, "Pulsar ohne Exoplanet", style);
      this.mask_right = this.game.add.graphics(0,0);
      this.mask_right.drawRect(this.game.width/2, 0, this.game.width/2, this.mask_left.height); 

      this.beam_right = this.game.add.sprite(100, 100, 'beam2');
      this.beam_right.anchor = new Phaser.Point(0.5, 0.5);
      this.beam_right.scale.setTo(1.5, 1);  
      this.beam_right.x = center_right_x;
      this.beam_right.y = center_y;
      this.beam_right.mask = this.mask_right;

      this.pulsar_right = this.game.add.sprite(100, 100, 'pulsar');
      this.pulsar_right.anchor = new Phaser.Point(0.5, 0.5);  
      this.pulsar_right.scale.setTo(this.sizeStar / this.pulsar_right.width, this.sizeStar / this.pulsar_right.width);
      this.pulsar_right.x = this.beam_right.x;
      this.pulsar_right.y = this.beam_right.y;

      this.earth_right = this.game.add.sprite(200, 200, 'earth');
      this.earth_right.anchor = new Phaser.Point(0.5, 0.5);  
      this.earth_right.scale.setTo(this.sizeEarth/this.earth_right.width, this.sizeEarth/this.earth_right.width);
      this.earth_right.y = this.earth_left.y;
      this.earth_right.x = center_right_x;

      // 
      // Chart
      //

      let margin = 60;
      let height = 200;
      this.chart = new Chart(this.game, this.game.world.width - 2 * margin, height, this.config.font);
      this.chart.create(margin, this.game.world.height - margin - height);
      this.chart.setYRange(0.0, 1.1);
      this.chart.setXRange(0, 300);
      this.chart.setXTitle("Zeit");
      this.chart.setYTitle("Amplitude");

      this.curve = new Array<Phaser.Point>();
      this.curve2 = new Array<Phaser.Point>();
    }

    private addData() : void {
      if (this.chart_x > this.chart.getXMax())
      {
          this.curve = new Array<Phaser.Point>();
          this.curve2 = new Array<Phaser.Point>();
          this.chart_x = 0;
      }

      let speed = 0.3;
      let delta = 5;
      let detectionAngle = 90 - Math.atan2(this.earth_left.x - this.pulsar_left.x, this.earth_left.y - 50 - this.pulsar_left.y) * 180 / Math.PI;
      let val = 0;
      if (Math.abs(this.beam_left.angle) > Math.abs(detectionAngle - delta) && Math.abs(this.beam_left.angle) < Math.abs(detectionAngle + delta))
      {
          val = 0.7;
          speed = 1;
      } 
      else
      {
          val = 0.3;
      }

      this.curve.push(new Phaser.Point(this.chart_x, val));

      let detectionAngle2 = 90 - Math.atan2(this.earth_right.x - this.pulsar_right.x, this.earth_right.y - 50 - this.pulsar_right.y) * 180 / Math.PI;
      let val2 = 0;
      if (Math.abs(this.beam_right.angle) > Math.abs(detectionAngle2 - delta) && Math.abs(this.beam_right.angle) < Math.abs(detectionAngle2 + delta))
      {
          val2 = 0.7;
          speed = 1;
      } 
      else
      {
          val2 = 0.3;
      }

      this.chart_x += speed;
      this.curve2.push(new Phaser.Point(this.chart_x, val2));
    }

    private update() : void {
      this.tick += 1;

      let c1 : number = 0.005;

      let angle = this.tick * c1;
      let newX : number = this.center_of_mass.x + this.distStar * Math.sin(angle);
      let newY : number = this.center_of_mass.y + this.distStar * Math.cos(angle);

      this.pulsar_left.x = newX;
      this.pulsar_left.y = newY;

      this.beam_right.angle -= 3;
      this.beam_left.angle -= 3;
      this.beam_left.x = this.pulsar_left.x;
      this.beam_left.y = this.pulsar_left.y;

      this.planet.x = this.center_of_mass.x - this.distPlanet * Math.sin(angle);
      this.planet.y = this.center_of_mass.y - this.distPlanet * Math.cos(angle);
      this.planet.angle = -angle * 180 / Math.PI + 180;

      // beam detection
      this.addData();

    }

    private render() : void {
        this.chart.clear();
        this.chart.render2(this.curve, 0x0085ff, this.curve2, 0x00ff85);
    }
}

/// <reference path="../shared/phaser-2.6.2/typescript/phaser.d.ts"/> 
class RadialVelocitySimulator {
    private game : Phaser.Game;

    private spectrum : Phaser.Sprite;

    private background : Phaser.Sprite;

    private spectrum_lines : Phaser.Sprite;

    private jupiter : Phaser.Sprite;

    private planet_shadow : Phaser.Sprite;

    private sun : Phaser.Sprite;

    private titleSpectrum : Phaser.Text;

    private titleDeltaV : Phaser.Text;

    private center_of_mass : Phaser.Sprite;

    private arrow : Phaser.Graphics;

    private colArrow : number = 0xffffff;

    private world : any;

    private centerOfMassY = 250;

    // Distance between Planet and Star in Pixel
    private distance = 200;

    // distance of the star from the center of mass
    private distStar = 30;

    // Distance of the Planet from the center of mass
    private distPlanet = 120;

    // render size of the center of mass
    private sizeCenterOfMass = 10;

    // render size of the star
    private sizeStar : number = 70;
    
    // render size of the planet
    private sizePlanet : number = 20;

    private deltaV : number;

    private tick : number = 0;

    private fontHeight : number = 0;

    private config : any;

    public constructor(cfg : any) {

      this.config = cfg;

      if (cfg.sizeStar!=null) {
        this.sizeStar = cfg.sizeStar;
      }

      if (cfg.sizePlanet!=null) {
        this.sizePlanet = cfg.sizePlanet;
      }

      if (cfg.distStar!=null) {
        this.distStar = cfg.distStar;
      }

      if (cfg.distPlanet!=null) {
        this.distPlanet = cfg.distPlanet;
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
      this.game.load.image('planet', this.config.assetpath + 'assets/sprites/planet.png');
      this.game.load.image('planet_shadow', this.config.assetpath + 'assets/sprites/planet_shadow.png');
      this.game.load.image('sun', this.config.assetpath + 'assets/sprites/sun.png');
      this.game.load.image('center_of_mass', this.config.assetpath + 'assets/sprites/center_of_mass.png');
      this.game.load.image('spectrum', this.config.assetpath + 'assets/sprites/spectrum.png');
      this.game.load.image('spectrum_lines', this.config.assetpath + 'assets/sprites/spectrum_lines.png');
      this.game.load.image('background', this.config.assetpath + 'assets/sprites/sternwarte.png');
    }

    private create() : void {

    if (this.config.noBackground==null || !this.config.noBackground) {
        this.background = this.game.add.sprite(100, 100, 'background');
        let scale = this.game.world.width / this.background.width;
        this.background.anchor = new Phaser.Point(0.5, 1);  
        this.background.scale.setTo(scale, scale);
        this.background.x = this.game.world.centerX;
        this.background.y = this.game.world.height + 40;
      }

      this.sun = this.game.add.sprite(100, 100, 'sun');
      this.sun.anchor = new Phaser.Point(0.5, 0.5);  
      this.sun.scale.setTo(this.sizeStar/this.sun.width, this.sizeStar/this.sun.width);
      this.sun.x = this.game.world.centerX;
      this.sun.y = this.game.world.centerY - 100;

      this.jupiter = this.game.add.sprite(100, 100, 'planet');
      this.jupiter.anchor = new Phaser.Point(0.5, 0.5);  
      this.jupiter.scale.setTo(this.sizePlanet/this.jupiter.width, this.sizePlanet/this.jupiter.width);
      this.jupiter.y = this.sun.y;

      this.planet_shadow = this.game.add.sprite(100, 100, 'planet_shadow');
      this.planet_shadow.anchor = new Phaser.Point(0.5, 0.5);  
      this.planet_shadow.scale.setTo(this.sizePlanet/this.planet_shadow.width, this.sizePlanet/this.planet_shadow.width);
      this.planet_shadow.y = this.jupiter.y;

      this.center_of_mass = this.game.add.sprite(100, 100, 'center_of_mass');
      this.center_of_mass.scale.setTo(this.sizeCenterOfMass/this.center_of_mass.width, this.sizeCenterOfMass/this.center_of_mass.width);
      this.center_of_mass.anchor = new Phaser.Point(0.5, 0.5);
      this.center_of_mass.x = this.game.world.width/2;
      this.center_of_mass.y = this.centerOfMassY;

      var style = { font: this.config.font, fill: "#ffffff", wordWrap: true, align: "center" };
      this.titleSpectrum = this.game.add.text(this.game.world.width/2, 40, "Sternenspektrum", style);
      this.titleSpectrum.anchor = new Phaser.Point(0.5, 0.5);  

      style = { font: this.config.font, fill: "#ffffff", wordWrap: true, align: "center" };    
      this.titleDeltaV = this.game.add.text(40, this.center_of_mass.y, "Radialgeschwindigkeit", style);
      this.titleDeltaV.anchor = new Phaser.Point(0.5, 0.5);
      this.titleDeltaV.angle = 270;  

      this.spectrum = this.game.add.sprite(100, 100, 'spectrum');
      this.spectrum.anchor = new Phaser.Point(0.5, 0.5);  
      this.spectrum.y = this.titleSpectrum.y + this.titleDeltaV.height*1.3;
      this.spectrum.x = this.game.world.width/2;

      this.spectrum_lines = this.game.add.sprite(100, 100, 'spectrum_lines');
      this.spectrum_lines.anchor = new Phaser.Point(0.5, 0.5);  
      this.spectrum_lines.y = this.spectrum.y;
      this.spectrum_lines.x = this.spectrum.x;


      this.arrow = this.game.add.graphics(0, 0);
    }

    private colorFromDeltaV(deltaV : number) : number {
      let r : number = 200 + Math.round(deltaV * 60);
      let g : number = 200;
      let b : number = 200 - Math.round(deltaV * 60);
      let color : number = b | g<<8  | r << 16;
      let dbg1 : number = 0xbbbbff; 
      let dbg2 : number = 0xffbbbb;
      return color;
    }

    private update() : void {
      this.tick += 1;
      let c1 : number = 0.015;
      let c2 : number = 100;
      let c3 : number = 40;

      let angle = this.tick * c1;
      let newX : number = this.center_of_mass.x + this.distStar * Math.sin(angle);
      let newY : number = this.center_of_mass.y + this.distStar * Math.cos(angle);

      let deltaV : number = this.sun.y - newY;
      this.sun.tint = this.colorFromDeltaV(deltaV);

      this.sun.x = newX;
      this.sun.y = newY;

      this.jupiter.x = this.center_of_mass.x - this.distPlanet * Math.sin(angle);
      this.jupiter.y = this.center_of_mass.y - this.distPlanet * Math.cos(angle);
      this.jupiter.angle = -angle * 180 / Math.PI + 180;

      this.planet_shadow.x = this.jupiter.x;
      this.planet_shadow.y = this.jupiter.y;
      this.planet_shadow.angle = -angle * 180 / Math.PI + 180;

      // spectrum
      this.spectrum_lines.x = this.spectrum.x + deltaV * c3;

      // Delta - V
      let arrow_size : number = 10;

      let x1 : number = this.titleDeltaV.x + this.titleDeltaV.height;
      let y1 : number = this.center_of_mass.y;
      let x2 : number = x1;
      let y2 : number = this.center_of_mass.y - deltaV * c2;

      this.arrow.clear();
      this.arrow.beginFill(this.colArrow);
      this.arrow.lineStyle(3, this.colArrow, 1);
      this.arrow.moveTo(x1, y1);
      this.arrow.lineTo(x2, y2);

      if (deltaV>0) {
        this.arrow.lineTo(x2 - arrow_size/2, y2);
        this.arrow.lineTo(x2, y2 - arrow_size);
        this.arrow.lineTo(x2 + arrow_size/2, y2);
        this.arrow.lineTo(x2, y2);
      } else {
        this.arrow.lineTo(x2 - arrow_size/2, y2);
        this.arrow.lineTo(x2, y2 + arrow_size);
        this.arrow.lineTo(x2 + arrow_size/2, y2);
        this.arrow.lineTo(x2, y2);
      }

      this.arrow.endFill();
    }

    private render() : void {
    }
}

//
// Start the simulation
// 

/*
window.onload = () => {
  var game = new TransitSimulator();
};
*/

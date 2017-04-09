/// <reference path="../shared/phaser-2.6.2/typescript/phaser.d.ts"/> 
class GalaxySimulator {
    private game : Phaser.Game;

    private world : any;

    private config : any;

    public constructor(cfg : any) {

      this.config = cfg;

      this.game = new Phaser.Game(cfg.width, 
                                  cfg.height, 
                                  Phaser.WEBGL,
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
//      this.game.load.image('planet', this.config.assetpath + 'assets/sprites/planet.png');
    }

    private create() : void {
      // this.sun = this.game.add.sprite(100, 100, 'sun');
      // this.sun.anchor = new Phaser.Point(0.5, 0.5);  
      // this.sun.scale.setTo(this.sizeStar/this.sun.width, this.sizeStar/this.sun.width);
      // this.sun.x = this.game.world.centerX;
      // this.sun.y = this.game.world.centerY - 100;
    }

    private update() : void {
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

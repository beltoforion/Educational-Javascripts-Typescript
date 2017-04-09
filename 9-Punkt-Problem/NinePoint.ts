/// <reference path="../shared/phaser-2.6.2/typescript/phaser.d.ts"/> 
class NinePoint {
    private game : Phaser.Game;

    private world : any;

    private config : any;

    private points : Array<Phaser.Sprite>;

    public constructor(cfg : any) {

      this.config = cfg;

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

      this.game.stage.disableVisibilityChange = true;
    }

    private preload() : void {
      this.game.load.image('point', this.config.assetpath + 'assets/sprites/point.png');
    }

    private create() : void {
      this.game.world.setBounds(-100, -100, 200, 200);
      this.points = new Array<Phaser.Sprite>(9);
      for (var i=0; i<3; ++i)
      {
        for (var j=0; j<3; ++j)
        {
          let s : Phaser.Sprite = this.game.add.sprite((i-1)*20, (j-1)*20, 'point');
          s.anchor = new Phaser.Point(0.5, 0.5);  
          s.scale.setTo(10/s.width, 10/s.width);
          this.points[i*3+j] = s;
        }
      }
    }

    private update() : void {

    }

    private render() : void {
    }
}

class GameOfLife {
    
    public static CMD : string = "";

    // Settings
    private is_running : boolean;
    private is_toroidal : boolean;
    private cells_x : number;
    private cells_y : number;

    // Canvas, Drawing Context and Backbuffer
    private cv : any;
    private ctx : any;
    private cvBack : any;
    private ctxBack : any; 

    // Colors and Styles
    private rgbaDead : Array<number> = [30, 30, 35, 255];
    private rgbaAlive : Array<number> = [255, 255, 105, 255];
    private colGrid : string = "#202040";
    private colGrid2 : string ="#252540";

    private presets : Array<any>;

    // Geometry of the simulation domain
    private cell_width : number;   // Width of a single cell in pixel
    private cell_height : number;  // Height of a single cell in pixel 

    private world_data : any;
    private world_img : any;

    public constructor(cfg : any, pat : any)
    {
      // Settings
      this.is_running  = cfg.is_running;
      this.is_toroidal = cfg.is_toroidal;
      this.cells_x     = cfg.cells_x;
      this.cells_y     = cfg.cells_y;

      this.presets = this.initPresets();

      // Canvas, Drawing Context and Backbuffer
      this.cv =  <HTMLCanvasElement>  document.getElementById(cfg.cvid);
      this.cv.addEventListener('mousedown', this.mouseDown, false);

      this.cell_width = this.cv.width / this.cells_x;    // Width of a single cell in pixel
      this.cell_height = this.cv.height / this.cells_y;  // Height of a single cell in pixel 

      this.ctx = this.cv.getContext("2d");

      this.world_data = [ new Uint8Array(this.cells_x * this.cells_y), new Uint8Array(this.cells_x * this.cells_y)];
      this.world_img = this.ctx.createImageData(this.cells_x, this.cells_y);

      this.cvBack  = document.createElement("canvas");
      this.cvBack.id = "cvBack";
      this.cvBack.width = this.cells_x;
      this.cvBack.height = this.cells_y;
      this.cvBack.style.display="none";

      var body = document.getElementsByTagName("body")[0];
      body.appendChild(this.cvBack);

      this.ctxBack = this.cvBack.getContext("2d"); 

      // Set the initial Pattern
      if (pat!=null) {
        this.initWithPattern(pat);
      } else {
        this.initWithPattern(this.presets[8]);
      }

      window.setInterval(this.tick.bind(this), cfg.delay);
    }

    private mouseDown(evt : any) {
      var mousePos = this.getMousePos(this.cv, evt);
      var x = Math.floor(mousePos.x / this.cell_width);
      var y = Math.floor(mousePos.y / this.cell_height);
      var v = this.getCellValue(0, x, y); 
      this.setCellValue(x, y, (v==1) ? 0 : 1);
    }

     private getMousePos(canvas : any, evt : any) {
      var rect = canvas.getBoundingClientRect();
      return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
      };
    }

    private setCellValue(x : number, y : number, v : number) {
        this.world_data[0][y*this.cells_x + x] = v;
        if (v==0) {
          this.world_img.data[4*(y*this.cells_x + x)    ] =  this.rgbaDead[0]; //20;
          this.world_img.data[4*(y*this.cells_x + x) + 1] =  this.rgbaDead[1]; //20;
          this.world_img.data[4*(y*this.cells_x + x) + 2] =  this.rgbaDead[2]; //50;
          this.world_img.data[4*(y*this.cells_x + x) + 3] =  this.rgbaDead[3]; //255;
       } else {
          this.world_img.data[4*(y*this.cells_x + x)    ] = this.rgbaAlive[0]; //255;
          this.world_img.data[4*(y*this.cells_x + x) + 1] = this.rgbaAlive[1]; //255;
          this.world_img.data[4*(y*this.cells_x + x) + 2] = this.rgbaAlive[2]; //150;
          this.world_img.data[4*(y*this.cells_x + x) + 3] = this.rgbaAlive[3]; //255;
       }
    }

   private getCellValue(i : number, x : number, y : number) {
    if (!this.is_toroidal) {
	    if (x<0 || x>=this.cells_x || y<0 || y>=this.cells_y) {
            return 0;
      }
    } else {
          if (x==-1) {
            x = this.cells_x -1;
          }

          if (x==this.cells_x) {
            x = 0;
          }

          if (y==-1) {
            y = this.cells_y -1;
          }

          if (y==this.cells_y) {
            y = 0;
          }
       }

       return  this.world_data[i][y*this.cells_x + x];
  }

  private initPresets() : Array<any> { 
      var p = new Array();
      var i = 0;

      // R-pentomino
      p[i++] = { name : "R-pentomino", 
                 xpos : 100, //45,
                 ypos : 75, //35,
                 rle  : "5b$2b2ob$b2o2b$2bo2b$5b!",
                 torodial : true };

      // Glider
      p[i++] = { name : "Glider", 
                 xpos : 10,
                 ypos : 10,
                 rle  : "bob$2bo$3o!",
                 torodial : true };


      // Spaceship B3/S23 ok
      p[i++] = { name : "Spaceship", 
                 xpos : 10,
                 ypos : 75,
                 rle  : "bo2bo$o4b$o3bo$4o!",
                 torodial : true };


      p[i++] = { name : "Trans Queen Bee Shuttle", 
                 xpos : 90,
                 ypos : 75,
                 rle  : "9bo12b$7bobo12b$6bobo11b2o$2o3bo2bo11b2o$2o4bobo13b$7bobo12b$9bo!",
                 torodial : true };


      p[i++] = { name : "Queen Bee Loop", 
                 xpos : 80,
                 ypos : 65,
                 rle  : "12bo11b$12bobo9b$13bobo8b$13bo2bo7b$13bobo8b$12bobo9b$12bo11b$3bo20b$"
                      + "2bobo19b$bo3bo18b$2b3o19b$2o3b2o17b$17b2o3b2o$19b3o2b$18bo3bob$19bobo"
                      + "2b$20bo3b$11bo12b$9bobo12b$8bobo13b$7bo2bo13b$8bobo13b$9bobo12b$11bo!",
                 torodial : true };


      // partial queen bee loop
      p[i++] = { name : "Partial Queen Bee Loop", 
                 xpos : 80,
                 ypos : 65,
                 rle  : "20b2o2b$20b2o2b$2b2o20b$2b2o20b4$3bo20b$2bobo19b$bo3bo18b$2b3o19b$2o3b"
                      + "2o17b$17b2o3b2o$19b3o2b$18bo3bob$19bobo2b$20bo3b$11bo12b$9bobo12b$8bob"
                      + "o13b$7bo2bo13b$8bobo13b$9bobo12b$11bo!",
                 torodial : true };

      p[i++] = { name : "Tagalong for two lightweight spaceships", 
                 xpos : 10,
                 ypos : 70,
                 rle  : "21bo3b$18b4o3b$13bo2bob2o5b$13bo11b$4o8bo3bob2o5b$o3bo5b2ob2obobob5o$o"
                      + "9b2obobobo2b5o$bo2bo2b2o2bo3b3o2bob2ob$6bo2bob2o12b$6bo4b2o12b$6bo2bob"
                      + "2o12b$bo2bo2b2o2bo3b3o2bob2ob$o9b2obobobo2b5o$o3bo5b2ob2obobob5o$4o8bo"
                      + "3bob2o5b$13bo11b$13bo2bob2o5b$18b4o3b$21bo!",
                 torodial : true };

      p[i++] = { name : "Glider Duplicator", 
                 xpos : 12,
                 ypos : 42,
                 rle  : "44b2o4b$44b2o4b9$41b2obob2o2b2$41bo5bo2b2$42b2ob2o3b$44bo5b3$38b2o6bo"
                      + "3b$37bobo5bobo2b$12bo26bo4bo3bob$13bo30b5ob$11b3o29b2o3b2o$44b5ob$45b"
                      + "3o2b$46bo3b$24b2o4b3o17b$24b2o6bo17b$31bo18b5$23b2o25b$22bobo21b2o2b$"
                      + "24bo21b2o2b$13bo36b$12b4o34b$11b2obobo6bobo24b$2o8b3obo2bo3bo3bo24b$2o"
                      + "9b2obobo4bo28b$12b4o4bo4bo24b$13bo7bo28b$21bo3bo6b2o16b$23bobo6bobo15b"
                      + "$34bo15b$34b2o!",
                 torodial : false };

      p[i++] = { name : "Twogun", 
                 xpos : 12,
                 ypos : 12,
                 rle  : "27bo11b$25bobo11b$15b2o6b2o12b2o$14bo3bo4b2o12b2o$3b2o8bo5bo3b2o14b$3b"
                      + "2o8bo3bob2o4bobo11b$13bo5bo7bo11b$14bo3bo20b$15b2o22b$26bo12b$27b2o10b"
                      + "$26b2o11b4$21b2o16b$9bobo10b2o15b$9bo2bo8bo17b$2o10b2o11b2o12b$2o8bo3b"
                      + "2o8bobo12b$5b2o5b2o9bo6b2o7b$4bo4bo2bo10bo2bo2bo2bo6b$9bobo11bo6b3o6b$"
                      + "24bobo5b3o4b$25b2o6bobo3b$35bo3b$35b2o!",
                 torodial : false };

      p[i++] = { name : "Newgun", 
                 xpos : 12,
                 ypos : 12,
                 rle  : "23b2o24b2o$23b2o24b2o$41b2o8b$40bo2bo7b$41b2o8b2$36b3o12b$36bobo12b$9b"
                      + "2o25b3o12b$9b2o25b2o13b$8bo2bo23b3o13b$8bo2bob2o20bobo13b$8bo4b2o20b3o"
                      + "13b$10b2ob2o36b$31b2o18b$21b2o7bo2bo17b$21b2o8b2o18b$49b2o$49b2o2$4b2o"
                      + "18bo26b$2o4b4o10b2o2b2ob3o21b$2o2b2ob3o10b2o4b4o21b$4bo19b2o!",
                 torodial : false };

      p[i++] = { name : "Block-laying switch engine ", 
                 xpos : 150,
                 ypos : 110,
                 rle  : "18bo10b$b3o8bo5bo10b$o3bo6bo7bo9b$b2o9b4o2b2o9b$3b2ob2o9b3o9b$5b2o11bo"
                      + "bo8b$19bo7b2o$19bo7b2o11$7b2o20b$7b2o20b7$15b2o12b$15b2o!",
                 torodial : true };

      // source: http://www.conwaylife.com/forums/viewtopic.php?p=4610#p4610
      p[i++] = { name : "18-cell 40514-generation methuselah", 
                 xpos : 90,
                 ypos : 55,
                 rle  : "77bo$77bo$77bo21$3o20$3bo$3bo$3bo5$20b3o$9b3o10bo$22bo$21bo!",
                 torodial : false };
      return p;
    }

    private randomCells() {
      for (var i=0; i < this.cells_x; ++i) {
        for (var j=0; j < this.cells_y; ++j) {
          this.setCellValue(i, j, Math.round(Math.random()));
        }
      }
    
      this.world_data[1].set(this.world_data[0]);
    }

    private clearCells() {
      for (var i=0; i < this.cells_x; ++i) {
        for (var j=0; j < this.cells_y; ++j) {
          this.setCellValue(i, j, 0);
        }
      }
      this.world_data[1].set(this.world_data[0]);
    }

    private draw() {
      this.ctxBack.putImageData(this.world_img, 0, 0);

      // Scale and copy to the main canvas. Then scale back
      this.ctx.scale(this.cell_width, this.cell_height);
      this.ctx.drawImage(this.cvBack, 0, 0);
      this.ctx.scale(1/this.cell_width, 1/this.cell_height);

      if (this.cell_width>2) {
        this.drawGrid();
      }
    }

    private drawGrid() {
      this.ctx.beginPath();
      for (var i=0; i < this.cells_x; ++i) {
          this.ctx.moveTo(i * this.cell_width, 0);
          this.ctx.lineTo(i * this.cell_width, this.cells_y * this.cell_height);
      }

      for (var j=0; j < this.cells_y; ++j) {
          this.ctx.moveTo(0, j * this.cell_height);
          this.ctx.lineTo(this.cells_x * this.cell_width, j * this.cell_height);
      }
      this.ctx.strokeStyle = this.colGrid;
      this.ctx.stroke();

      this.ctx.beginPath();
      for (var i=0; i < this.cells_x; i+=10) {
          this.ctx.moveTo(i * this.cell_width, 0);
          this.ctx.lineTo(i * this.cell_width, this.cells_y * this.cell_height);
      }

      for (var j=0; j < this.cells_y; j+=10) {
          this.ctx.moveTo(0, j * this.cell_height);
          this.ctx.lineTo(this.cells_x * this.cell_width, j * this.cell_height);
      }
      
      this.ctx.strokeStyle = this.colGrid2;
      this.ctx.stroke();
    }


    // Initialize with a RLE encoded Pattern
    private initWithPattern(p : any) { 
      this.clearCells();

      this.rleDecode(p.xpos, p.ypos, p.rle);
      this.is_toroidal = p.torodial;

      this.world_data[1].set(this.world_data[0]);

      // Update the checkbox in the html document
      var c=<HTMLInputElement>document.getElementById('cbToroidal');
      if (c!=null) {
         c.checked = this.is_toroidal;
      }
    }

    private rleDecode(xpos : number, ypos : number, str : string) {
      var buf = "";
      var line = "";
      
      var col = xpos;
      var row = ypos;      

      this.setCellValue(null, null, null);
      for (var i=0; i < str.length; ++i) {
        var c = str[i];
        var n = 0;
 
        switch(c) {
          case 'b': // tote zelle
             n = (buf.length>0) ? parseInt(buf) : 1;		            
             buf = "";
             for (var k=0; k < n; ++k) {
               this.setCellValue(col+k, row, 0);
             }
	           col += n;
             break;

        case 'o': // lebende zelle
             n = (buf.length>0) ? parseInt(buf) : 1;		            
             buf = "";
             for (var k=0; k < n; ++k) { 
               this.setCellValue(col+k, row, 1);
             }  
	           col += n;
             break;

        case '$': // zeilenende
             n = (buf.length>0) ? parseInt(buf) : 1;
             buf = "";
             line = "";
             row+=n;
             col = xpos;
            break;

        case '!': // patternende
             buf = "";
             line = "";
             break;

        default:
           // zahl parsen
           buf += str[i];
           break;
        }
      }
    }

    private move() {
      // copy world data
      this.world_data[1].set(this.world_data[0]);

      var ct = 0
      var v : number;
      for (var x=0; x < this.cells_x; ++x) {
        for (var y=0; y < this.cells_y; ++y) {
           // How many neighbor cells are alive?
           ct = 0;
           ct += this.getCellValue(1, x-1, y-1);
           ct += this.getCellValue(1, x,   y-1);
           ct += this.getCellValue(1, x+1, y-1);
           ct += this.getCellValue(1, x-1, y);
           ct += this.getCellValue(1, x+1, y);
           ct += this.getCellValue(1, x-1, y+1);
           ct += this.getCellValue(1, x,   y+1);
           ct += this.getCellValue(1, x+1, y+1);

           // cell value		
	        v = this.getCellValue(1, x, y);           

          if (v==1) {		
		        if (ct<2 || ct>3) {
              // death by underpopulation
              this.setCellValue(x, y, 0);
            } else {
              // Live to see another day
		          this.setCellValue(x, y, 1);
            } 
          } else if (v==0) {
             if (ct==3) {
               // Give birth to a new cell
               this.setCellValue(x, y, 1);
             } else {
               // remain dead
               this.setCellValue(x, y, 0);
             }
           }
        } // for y ...
      } // for x ...
    }

    private tick() {
      switch(GameOfLife.CMD) {
      case "pat1":   this.initWithPattern(this.presets[0]); break;
      case "pat2":   this.initWithPattern(this.presets[1]); break;
      case "pat3":   this.initWithPattern(this.presets[2]); break;
      case "pat4":   this.initWithPattern(this.presets[3]); break;
      case "pat5":   this.initWithPattern(this.presets[4]); break;
      case "pat6":   this.initWithPattern(this.presets[5]); break;
      case "pat7":   this.initWithPattern(this.presets[6]); break;
      case "pat8":   this.initWithPattern(this.presets[7]); break;
      case "pat9":   this.initWithPattern(this.presets[8]); break;
      case "pat10":  this.initWithPattern(this.presets[9]); break;
      case "pat11":  this.initWithPattern(this.presets[10]); break;
      case "pat12":  this.initWithPattern(this.presets[11]); break;
      case 'single': this.is_running = false;  
                     this.move(); 
                     this.draw(); 
                     break;
      case "run":    this.is_running = true; break;
      case "clear":  this.clearCells();     break;
      case "random": this.randomCells();    break;
      case 'update': {
                       var c=<HTMLInputElement>document.getElementById('cbToroidal');
                       this.is_toroidal = c.checked;
                     }
                     break;

      default:  GameOfLife.CMD = "";
                this.draw();
                if (this.is_running) {
                   this.move();
                }
		            break;
      }

      GameOfLife.CMD = "";
    }
}
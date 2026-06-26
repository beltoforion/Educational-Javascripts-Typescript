  var spawn_strategy = 0;

  function main()
  {
    // Geometry of the simulation domain
    var cells_x = 400; // Number of Cells in x direction
    var cells_y = 300; // Number of cells in y direction

    // Colors
    var colMicrobe = "rgb(50,100,255)";
    var colBack = "rgb(0,0,0)";
    var colFood = "rgb(0,0,0)";

    // The primary drawing canvas
    var cv = document.getElementById("cvMain");
    var ctx = cv.getContext("2d");

    // Set up a secondary canvas for food rendering. This is done in order to optimize drawing speed.
    var cvFood = document.createElement("canvas");
    cvFood.id = "cvFood";
    cvFood.width = cells_x;
    cvFood.height = cells_y;
    cvFood.style.display="none";
    var body = document.getElementsByTagName("body")[0];
    body.appendChild(cvFood);
    var ctxFood = cvFood.getContext("2d"); 

    var cell_width = cv.width / cells_x;    // Width of a single cell in pixel
    var cell_height = cv.height / cells_y;  // Height of a single cell in pixel 

    // Other simulation parameters
    var food_spawn_per_tick = 2;     // spawn that many new algea per simulation tick
    var energy_per_food = 40;         // If microbes eat increase energy by that amount
    var energy_max = 1500;	      // Microbes stop eating once they reach this energy value
    var energy_to_reproduce = 1000;   // This amount of energy is necessary for reproduction
    var initial_microbe_num = 10;
    var microbe_num = 0;

    // Microbe Motion Table. One Entry per Motion Direction
    var motion_tab = [ [-1.0,  1.0], [0.0,  1.0], [1.0,  1.0],
                       [-1.0,  0.0],              [1.0,  0.0],
                       [-1.0, -1.0], [0.0, -1.0], [1.0, -1.0] ];

    // Ammount of energy subtracted from the microbe depending on the change in movement direction
    // (there is a price for taking hard turns)
    var steering_cost = [ [0], [1], [2], [4], [8], [4], [2], [1] ];

    // data arrays
    var imgfood = ctx.createImageData(cells_x, cells_y);
    var food = new Uint8Array(cells_x * cells_y); // Array for storing food data (width x height x 8 bits per entry);
    var microbe_first; 
    var timer;

    init();

    function microbe_die(m) {
      if (m==null) {
        alert("Internal Errorin microbe_die: m==null!");
      }
  
      microbe_num -= 1;
      if (microbe_num<0) {
        alert("Internal Error in microbe_die: microbe_num<0!");
      }

      //  The microbe just starved to death remove it from the list
      if (m==microbe_first) {
        microbe_first = m.next;
      }

      if (m.prev!=null) {
        m.prev.next = m.next;
      }

      if (m.next!=null) {
        m.next.prev = m.prev;
      }

      m.next = null;
      m.prev = null;
    }

    function microbe_spawn(m) {
      if (m==null) {
        alert("Internal Error in microbe_spawn");
      }

      m_new = microbe_create(m);
    }

    function microbe_move(m) {
      if (m==null) {
        alert("Internal Error in microbe_move!");
      }

      var num_genes = m.genes.length;

      m.age += 1;    // increase the age
      m.energy -= 1; // subtract energy

      // Check for food
      var nx = m.x + motion_tab[m.dir][0];
      var ny = m.y + motion_tab[m.dir][1];
      var f = food[ny*cells_x + nx];
      if (f>0 && m.energy<energy_max) {
        m.energy += energy_per_food;
        remove_food(nx, ny);
      }

      // Randomly change direction according to the probabilities defined by the genes
      var rnd = Math.random(); // create Random number between 0 and 1
      var energy_for_dir_change = 0;
      var sum = 0;
      for (var i=0; i<num_genes; ++i) {
        sum += m.genes[i];
        if (rnd<sum) {
          var new_dir = (m.dir + i) % num_genes;                               // assign the new direction
          energy_for_dir_change = ((new_dir + num_genes) - m.dir) % num_genes; // how much of a directional change is that?
          m.dir = new_dir;
          break;
        }
      }
/*
            console.debug("dir=" + this.dir + "; rnd=" + rnd.toFixed(2)
                                            + "; i=" + i
                                            + "; energy_for_dir_change=" + energy_for_dir_change
                                            + "; steering_cost[energy_for_dir_change]=" + steering_cost[energy_for_dir_change]
                                            + "; gen[0]="  + this.genes[0].toFixed(2)
                                            + "; gen[1]="  + this.genes[1].toFixed(2)
                                            + "; gen[2]="  + this.genes[2].toFixed(2)
                                            + "; gen[3]="  + this.genes[3].toFixed(2)
                                            + "; gen[4]="  + this.genes[4].toFixed(2)
                                            + "; gen[5]="  + this.genes[5].toFixed(2)
                                            + "; gen[6]="  + this.genes[6].toFixed(2)
                                            + "; gen[7]="  + this.genes[7].toFixed(2)
                                            + "; new_dir=" + new_dir
                                            + "; energy="  + this.energy
                                            + "; age="     + this.age);
*/
      // boundary checks
      if (nx >= cells_x) { nx = 0; }
      if (nx < 0)        { nx = cells_x-1; }
      if (ny >= cells_y) { ny = 0; }
      if (ny < 0 )       { ny = cells_y-1; }

      m.x = nx;
      m.y = ny;
      m.energy -= steering_cost[energy_for_dir_change];

      // Check Energy, die if energy drops below zero	
      var next = m.next;

      if (m.energy<0) {
        microbe_die(m)
      }

      if (m.energy>energy_to_reproduce) {
        microbe_spawn(m);
      }	

      return next;
    }

    function create_random_genes() {
      // compute the cumulative probabilities for the motion directions
      var genes = new Float64Array(8);
      var sum = 0;
      for (var i=0; i<genes.length; ++i) {
        genes[i] = Math.random();
        sum += genes[i]; 
      }

      // Normalize the probabilities so that the sum equals one
      for (var i=0; i<genes.length; ++i) {
        genes[i] = genes[i] / sum;
      }

      return genes;
    }

    function mutate_genes(genes) {

      // clone the genes
      var new_genes = new Float64Array(genes);

      // mutate a single gene
      var n = Math.floor(Math.random() * new_genes.length);

      new_genes[n] += (Math.random() - 0.5);

      // make sure the gene is never below
      if (new_genes[n]<0)
      {
        new_genes[n] = 0;
      }

      // normalize the genes again
      var sum = 0;
      for (var i=0; i<genes.length; ++i) {
        sum += new_genes[i]; 
      }

      // Normalize the probabilities so that the sum equals one
      for (var i=0; i<genes.length; ++i) {
        new_genes[i] = new_genes[i] / sum;
      }
/*
      console.debug("gen[0]="  + new_genes[0].toFixed(2)
                  + "; gen[1]="  + new_genes[1].toFixed(2)
                  + "; gen[2]="  + new_genes[2].toFixed(2)
                  + "; gen[3]="  + new_genes[3].toFixed(2)
                  + "; gen[4]="  + new_genes[4].toFixed(2)
                  + "; gen[5]="  + new_genes[5].toFixed(2)
                  + "; gen[6]="  + new_genes[6].toFixed(2)
                  + "; gen[7]="  + new_genes[7].toFixed(2));
*/
      return new_genes;
    }

    function microbe_create(parent) {
      // Generate the genes for the movement:
      microbe_num += 1;

      if (parent==null) {
        // If there is no parent assume this is an entirely new microbe
        var m = {
          x:   Math.floor(Math.random() * cells_x),       // Position of the microbe
          y:   Math.floor(Math.random() * cells_y),       // Position of the microbe
          dir: Math.floor(Math.random()*8),               // Direction of microbe motion                 
          energy: microbe_num + 100 /*200 + Math.floor(Math.random() * 1000)*/, // Engergy of the microbe
          age:    0,                                      // The age of the microbe
          genes:  create_random_genes(),                  // Genes of the microbe
          next: microbe_first,
          prev: null
        }
      } else {
        // there is a parent. This is a spawned version of said parent. 

        // Copy genes
        var new_genes = mutate_genes(parent.genes);

        // Modify a single gene and normalize genes again
        var m = {
          x: parent.x, 
          y: parent.y,
          dir: Math.floor(Math.random()*8), // Direction of microbe motion                 
          energy: parent.energy/2,          // Engergy of the microbe
          age:    0,                        // The age of the microbe
          genes:  new_genes,                 // Genes of the microbe
          next: microbe_first,              // insert as root microbe
          prev: null
        }

        parent.energy = parent.energy / 2;
      }

      // Make the new microbe the first one
      if (microbe_first!=null) {
        microbe_first.prev = m;
      }
      microbe_first = m;
    }
    
    function microbe_draw(m) {
        ctx.fillStyle = colMicrobe; 
        ctx.fillRect(m.x * cell_width  - 2*cell_width, 
                     m.y * cell_height - 2*cell_height, 
                     cell_width  * 4, 
                     cell_height * 4);
    }

    function init() {
      // initialize microbes
      for (var i=0; i<initial_microbe_num; ++i) {
        microbe_create(null);
      }

      // initialize food
      for (var i=1; i<40000; ++i) {
        put_food(Math.round(Math.random()*cells_x), 
                 Math.round(Math.random()*cells_y));
      }

      timer = window.setInterval(tick, 2);
    }
   
    function put_food(x, y) {
        food[y*cells_x + x] = 1;
        imgfood.data[4*(y*cells_x + x)    ] =   0;
        imgfood.data[4*(y*cells_x + x) + 1] = 200;
        imgfood.data[4*(y*cells_x + x) + 2] =   0;
        imgfood.data[4*(y*cells_x + x) + 3] = 255;
    }
   
    function remove_food(x, y) {
        food[y*cells_x + x] = 0;
        imgfood.data[4*(y*cells_x + x)    ] =   0;
        imgfood.data[4*(y*cells_x + x) + 1] =   0;
        imgfood.data[4*(y*cells_x + x) + 2] =   0;
        imgfood.data[4*(y*cells_x + x) + 3] = 255;
    }
    
    function spawn_food_normal() { 
        for (var i=0; i<food_spawn_per_tick; ++i) {
          var x = Math.floor(Math.random() * cells_x);
          var y = Math.floor(Math.random() * cells_y);
          put_food(x, y);
        }
    }

    function spawn_food_box() { 
        var cx = cells_x/2;
        var cy = cells_y/2;

        for (var i=0; i<food_spawn_per_tick/4; ++i) {
          var x = Math.floor(Math.random() * cells_x);
          var y = Math.floor(Math.random() * cells_y);
          if (Math.abs(cx-x)>100 || Math.abs(cy-y)>100) {
            put_food(x, y);
          }
        }

        var w = cells_x/8;
        var h = cells_y/8;
        for (var i=0; i<food_spawn_per_tick; ++i) {
          var x = cx + Math.floor(Math.random() * w - w/2);
          var y = cy + Math.floor(Math.random() * h - h/2);
          put_food(x, y);
        }
    }

    function spawn_food_lines() { 
        for (var i=0; i<food_spawn_per_tick/10; ++i) {
          var x = Math.floor(Math.random() * cells_x);
          var y = Math.floor(Math.random() * cells_y);
          put_food(x, y);
        }

        var cx = cells_x/2;
        var cy = cells_y/2;
        var w = cells_x/6;
        var h = cells_y/6;
        for (var i=0; i<food_spawn_per_tick/2; ++i) {
          var x = Math.floor(Math.random() * cells_x);
          var y = cy;
          put_food(x, y);
          put_food(x, y+50);
          put_food(x, y-50);
          put_food(x, y+100);
          put_food(x, y-100);

          put_food(y, x);
          put_food(y+50,x);
          put_food(y-50,x);
          put_food(y+100,x);
          put_food(y-100,x);
        }
    }

    function spawn_food() { 
        if (spawn_strategy==0) {
          spawn_food_normal();
        } else if (spawn_strategy==1) {
          spawn_food_lines();
        } else if (spawn_strategy==2) {
          spawn_food_box();
        }
    }

    function tick() {
      ctx.fillStyle = colBack
      ctx.fillRect(0,0, cv.width, cv.height);
      spawn_food();
      draw_food();

      var m = microbe_first
      while (m!=null) {
        var next = microbe_move(m);
        microbe_draw(m)
        m = next;
      }

      console.debug("num=" + microbe_num);
    }

    function draw_food() {
     // render into the dedicated food canvas
     ctxFood.putImageData(imgfood,0,0);

     // Scale and copy to the main canvas. Then scale back
     ctx.scale(cell_width, cell_height);
     ctx.drawImage(cvFood, 0, 0);
     ctx.scale(1/cell_width, 1/cell_height);
    }

    function startAgeOfLines() {
	spawn_food = spawn_food_lines;
    }

    function startAgeOfRectangle() {
	spawn_food = spawn_food_normal;
    }
  }

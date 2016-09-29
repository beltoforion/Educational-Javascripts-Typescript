var SimulatedEvolution = (function () {
    function SimulatedEvolution(cfg) {
        // Colors
        this.colMicrobe = "rgb(50,100,255)";
        this.colBack = "rgb(0,0,0)";
        this.colFood = "rgb(0,0,0)";
        // Other simulation parameters
        this.food_spawn_per_tick = 2; // spawn that many new algea per simulation tick
        this.energy_per_food = 40; // If microbes eat increase energy by that amount
        this.energy_max = 1500; // Microbes stop eating once they reach this energy value
        this.energy_to_reproduce = 1000; // This amount of energy is necessary for reproduction
        this.initial_microbe_num = 10;
        this.microbe_num = 0;
        // Microbe Motion Table. One Entry per Motion Direction
        this.motion_tab = [[-1.0, 1.0], [0.0, 1.0], [1.0, 1.0],
            [-1.0, 0.0], [1.0, 0.0],
            [-1.0, -1.0], [0.0, -1.0], [1.0, -1.0]];
        // Ammount of energy subtracted from the microbe depending on the change in movement direction
        // (there is a price for taking hard turns)
        this.steering_cost = [[0], [1], [2], [4], [8], [4], [2], [1]];
        // Copy simulation parameters
        this.food_spawn_per_tick = cfg.food_spawn_per_tick;
        this.energy_per_food = cfg.energy_per_food;
        this.energy_max = cfg.energy_max;
        this.energy_to_reproduce = cfg.energy_to_reproduce;
        this.initial_microbe_num = cfg.initial_microbe_num;
        this.cv = document.getElementById(cfg.cvid);
        // Number of cells based on the scale
        this.cells_x = this.cv.width / cfg.cellsize;
        this.cells_y = this.cv.height / cfg.cellsize;
        this.ctx = this.cv.getContext("2d");
        // Set up a secondary canvas for food rendering. This is done in order to optimize drawing speed.
        this.cvFood = document.createElement("canvas");
        this.cvFood.id = "cvFood";
        this.cvFood.width = this.cells_x;
        this.cvFood.height = this.cells_y;
        this.cvFood.style.display = "none";
        var body = document.getElementsByTagName("body")[0];
        body.appendChild(this.cvFood);
        this.ctxFood = this.cvFood.getContext("2d");
        this.cell_width = this.cv.width / this.cells_x; // Width of a single cell in pixel
        this.cell_height = this.cv.height / this.cells_y; // Height of a single cell in pixel 
        this.imgfood = this.ctx.createImageData(this.cells_x, this.cells_y);
        this.food = new Uint8Array(this.cells_x * this.cells_y); // Array for storing food data (width x height x 8 bits per entry);
        // create initial population
        for (var i = 0; i < this.initial_microbe_num; ++i) {
            this.microbe_create(null);
        }
        // initialize food
        for (var i = 1; i < 40000; ++i) {
            this.put_food(Math.round(Math.random() * this.cells_x), Math.round(Math.random() * this.cells_y));
        }
        // start the timer
        window.setInterval(this.tick.bind(this), 2);
    }
    SimulatedEvolution.prototype.put_food = function (x, y) {
        this.food[y * this.cells_x + x] = 1;
        this.imgfood.data[4 * (y * this.cells_x + x)] = 0;
        this.imgfood.data[4 * (y * this.cells_x + x) + 1] = 200;
        this.imgfood.data[4 * (y * this.cells_x + x) + 2] = 0;
        this.imgfood.data[4 * (y * this.cells_x + x) + 3] = 255;
    };
    SimulatedEvolution.prototype.remove_food = function (x, y) {
        this.food[y * this.cells_x + x] = 0;
        this.imgfood.data[4 * (y * this.cells_x + x)] = 0;
        this.imgfood.data[4 * (y * this.cells_x + x) + 1] = 0;
        this.imgfood.data[4 * (y * this.cells_x + x) + 2] = 0;
        this.imgfood.data[4 * (y * this.cells_x + x) + 3] = 255;
    };
    SimulatedEvolution.prototype.tick = function () {
        this.ctx.fillStyle = this.colBack;
        this.ctx.fillRect(0, 0, this.cv.width, this.cv.height);
        this.spawn_food();
        this.draw_food();
        var m = this.microbe_first;
        while (m != null) {
            var next = this.microbe_move(m);
            this.microbe_draw(m);
            m = next;
        }
    };
    SimulatedEvolution.prototype.spawn_food_normal = function () {
        for (var i = 0; i < this.food_spawn_per_tick; ++i) {
            var x = Math.floor(Math.random() * this.cells_x);
            var y = Math.floor(Math.random() * this.cells_y);
            this.put_food(x, y);
        }
    };
    SimulatedEvolution.prototype.spawn_food_box = function () {
        var cx = this.cells_x / 2;
        var cy = this.cells_y / 2;
        for (var i = 0; i < this.food_spawn_per_tick / 4; ++i) {
            var x = Math.floor(Math.random() * this.cells_x);
            var y = Math.floor(Math.random() * this.cells_y);
            if (Math.abs(cx - x) > 100 || Math.abs(cy - y) > 100) {
                this.put_food(x, y);
            }
        }
        var w = this.cells_x / 8;
        var h = this.cells_y / 8;
        for (var i = 0; i < this.food_spawn_per_tick; ++i) {
            var x = cx + Math.floor(Math.random() * w - w / 2);
            var y = cy + Math.floor(Math.random() * h - h / 2);
            this.put_food(x, y);
        }
    };
    SimulatedEvolution.prototype.spawn_food_lines = function () {
        for (var i = 0; i < this.food_spawn_per_tick / 10; ++i) {
            var x = Math.floor(Math.random() * this.cells_x);
            var y = Math.floor(Math.random() * this.cells_y);
            this.put_food(x, y);
        }
        var cx = this.cells_x / 2;
        var cy = this.cells_y / 2;
        var w = this.cells_x / 6;
        var h = this.cells_y / 6;
        for (var i = 0; i < this.food_spawn_per_tick / 2; ++i) {
            var x = Math.floor(Math.random() * this.cells_x);
            var y = cy;
            this.put_food(x, y);
            this.put_food(x, y + 50);
            this.put_food(x, y - 50);
            this.put_food(x, y + 100);
            this.put_food(x, y - 100);
            this.put_food(y, x);
            this.put_food(y + 50, x);
            this.put_food(y - 50, x);
            this.put_food(y + 100, x);
            this.put_food(y - 100, x);
        }
    };
    SimulatedEvolution.prototype.spawn_food = function () {
        if (SimulatedEvolution.SPAWN_STRATEGY == 0) {
            this.spawn_food_normal();
        }
        else if (SimulatedEvolution.SPAWN_STRATEGY == 1) {
            this.spawn_food_lines();
        }
        else if (SimulatedEvolution.SPAWN_STRATEGY == 2) {
            this.spawn_food_box();
        }
    };
    SimulatedEvolution.prototype.microbe_create = function (parent) {
        // Generate the genes for the movement:
        this.microbe_num += 1;
        if (parent == null) {
            // If there is no parent assume this is an entirely new microbe
            var m = {
                x: Math.floor(Math.random() * this.cells_x),
                y: Math.floor(Math.random() * this.cells_y),
                dir: Math.floor(Math.random() * 8),
                energy: this.microbe_num + 100,
                age: 0,
                genes: this.create_random_genes(),
                next: this.microbe_first,
                prev: null
            };
        }
        else {
            // there is a parent. This is a spawned version of said parent. 
            // Copy genes
            var new_genes = this.mutate_genes(parent.genes);
            // Modify a single gene and normalize genes again
            var m = {
                x: parent.x,
                y: parent.y,
                dir: Math.floor(Math.random() * 8),
                energy: parent.energy / 2,
                age: 0,
                genes: new_genes,
                next: this.microbe_first,
                prev: null
            };
            parent.energy = parent.energy / 2;
        }
        // Make the new microbe the first one
        if (this.microbe_first != null) {
            this.microbe_first.prev = m;
        }
        this.microbe_first = m;
    };
    SimulatedEvolution.prototype.microbe_die = function (m) {
        if (m == null) {
            alert("Internal Errorin microbe_die: m==null!");
        }
        this.microbe_num -= 1;
        if (this.microbe_num < 0) {
            alert("Internal Error in microbe_die: microbe_num<0!");
        }
        //  The microbe just starved to death remove it from the list
        if (m == this.microbe_first) {
            this.microbe_first = m.next;
        }
        if (m.prev != null) {
            m.prev.next = m.next;
        }
        if (m.next != null) {
            m.next.prev = m.prev;
        }
        m.next = null;
        m.prev = null;
    };
    SimulatedEvolution.prototype.microbe_move = function (m) {
        if (m == null) {
            alert("Internal Error in microbe_move!");
        }
        var num_genes = m.genes.length;
        m.age += 1; // increase the age
        m.energy -= 1; // subtract energy
        // Check for food
        var nx = m.x + this.motion_tab[m.dir][0];
        var ny = m.y + this.motion_tab[m.dir][1];
        var f = this.food[ny * this.cells_x + nx];
        if (f > 0 && m.energy < this.energy_max) {
            m.energy += this.energy_per_food;
            this.remove_food(nx, ny);
        }
        // Randomly change direction according to the probabilities defined by the genes
        var rnd = Math.random(); // create Random number between 0 and 1
        var energy_for_dir_change = 0;
        var sum = 0;
        for (var i = 0; i < num_genes; ++i) {
            sum += m.genes[i];
            if (rnd < sum) {
                var new_dir = (m.dir + i) % num_genes; // assign the new direction
                energy_for_dir_change = ((new_dir + num_genes) - m.dir) % num_genes; // how much of a directional change is that?
                m.dir = new_dir;
                break;
            }
        }
        // boundary checks
        if (nx >= this.cells_x) {
            nx = 0;
        }
        if (nx < 0) {
            nx = this.cells_x - 1;
        }
        if (ny >= this.cells_y) {
            ny = 0;
        }
        if (ny < 0) {
            ny = this.cells_y - 1;
        }
        m.x = nx;
        m.y = ny;
        m.energy -= this.steering_cost[energy_for_dir_change];
        // Check Energy, die if energy drops below zero	
        var next = m.next;
        if (m.energy < 0) {
            this.microbe_die(m);
        }
        if (m.energy > this.energy_to_reproduce) {
            this.microbe_spawn(m);
        }
        return next;
    };
    SimulatedEvolution.prototype.create_random_genes = function () {
        // compute the cumulative probabilities for the motion directions
        var genes = new Float64Array(8);
        var sum = 0;
        for (var i = 0; i < genes.length; ++i) {
            genes[i] = Math.random();
            sum += genes[i];
        }
        // Normalize the probabilities so that the sum equals one
        for (var i = 0; i < genes.length; ++i) {
            genes[i] = genes[i] / sum;
        }
        return genes;
    };
    SimulatedEvolution.prototype.draw_food = function () {
        // render into the dedicated food canvas
        this.ctxFood.putImageData(this.imgfood, 0, 0);
        // Scale and copy to the main canvas. Then scale back
        this.ctx.scale(this.cell_width, this.cell_height);
        this.ctx.drawImage(this.cvFood, 0, 0);
        this.ctx.scale(1 / this.cell_width, 1 / this.cell_height);
    };
    SimulatedEvolution.prototype.mutate_genes = function (genes) {
        // clone the genes
        var new_genes = new Float64Array(genes);
        // mutate a single gene
        var n = Math.floor(Math.random() * new_genes.length);
        new_genes[n] += (Math.random() - 0.5);
        // make sure the gene is never below
        if (new_genes[n] < 0) {
            new_genes[n] = 0;
        }
        // normalize the genes again
        var sum = 0;
        for (var i = 0; i < genes.length; ++i) {
            sum += new_genes[i];
        }
        // Normalize the probabilities so that the sum equals one
        for (var i = 0; i < genes.length; ++i) {
            new_genes[i] = new_genes[i] / sum;
        }
        return new_genes;
    };
    SimulatedEvolution.prototype.microbe_draw = function (m) {
        this.ctx.fillStyle = this.colMicrobe;
        this.ctx.fillRect(m.x * this.cell_width - 2 * this.cell_width, m.y * this.cell_height - 2 * this.cell_height, this.cell_width * 4, this.cell_height * 4);
    };
    SimulatedEvolution.prototype.microbe_spawn = function (m) {
        if (m == null) {
            alert("Internal Error in microbe_spawn");
        }
        this.microbe_create(m);
    };
    SimulatedEvolution.SPAWN_STRATEGY = 0;
    return SimulatedEvolution;
}());
//# sourceMappingURL=simulated_evolution.js.map
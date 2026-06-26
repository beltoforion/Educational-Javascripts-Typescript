<?php
include ("../../pagebuilderbase.php"); 

// 
// Exoplanetenent
//

class PageBuilder extends PageBuilderBase {

    function __construct() {
		parent::__construct();
		
		$this->about = 'Diese ist eine private Webseite über Galaxiensimulation mit dem Barnes-Hut-Algorithmus.';
	}

	function build_side_panel_navbar() {
		echo '<nav id="menu">'.PHP_EOL;
		echo '	<header class="major">'.PHP_EOL;
		echo '		<h2>Applets</h2>'.PHP_EOL;
		echo '	</header>'.PHP_EOL;
		echo '	<ul>'.PHP_EOL;

		echo '				<li>'.PHP_EOL;
		$this->build_link('Übersicht', 'index', 'idStart');
		echo "				</li>".PHP_EOL;

		echo '				<li>'.PHP_EOL;
		$this->build_link('Magnetisches Pendel', 'index', 'idMagPend');
		echo "				</li>".PHP_EOL;

		echo '				<li>'.PHP_EOL;
		$this->build_link('Wa-Tor', 'index', 'idWator');
		echo "				</li>".PHP_EOL;

		echo '				<li>'.PHP_EOL;
		$this->build_link('Planetenscheibe', 'index', 'idDisk');
		echo "				</li>".PHP_EOL;

		echo '	</ul>'.PHP_EOL;
		echo '</nav>'.PHP_EOL;
	}

	function build_side_panel_gallery() {
	}
  }

  $page = new PageBuilder();
?>
# Educational JavaScripts (TypeScript versions)

Source code of the educational applets used on [beltoforion.de](https://beltoforion.de/en/).
Every applet has a demo page that runs straight from disk: open `index.html` in the
main folder for an overview, or the `index.html` inside an applet's folder.

## Applets

| Folder | What it shows | Article | Build |
|---|---|---|---|
| [`applets/doppler-effect`](applets/doppler-effect) | Doppler effect of a moving light source | [Radial velocity method](https://beltoforion.de/en/exoplanets/radial-velocity-method.php) | TypeScript |
| [`applets/exoplanet-atlas`](applets/exoplanet-atlas) | Atlas of all known exoplanets (`atlas.html`) and the mass/period diagram (`index.html`) | [Atlas of Exoplanets](https://beltoforion.de/en/exoplanets/atlas/), [History](https://beltoforion.de/en/exoplanets/history.php) | none |
| [`applets/exoplanet-pulsar-timing`](applets/exoplanet-pulsar-timing) | Finding planets by pulsar timing | [Pulsar Timing](https://beltoforion.de/en/exoplanets/pulsar-timing.php) | TypeScript |
| [`applets/exoplanet-radial-velocity`](applets/exoplanet-radial-velocity) | Finding planets by the radial velocity of their star | [Radial Velocity Method](https://beltoforion.de/en/exoplanets/radial-velocity-method.php) | TypeScript |
| [`applets/exoplanet-transit`](applets/exoplanet-transit) | Finding planets by transits | [Transit Method](https://beltoforion.de/en/exoplanets/transit-method.php) | TypeScript |
| [`applets/game-of-life`](applets/game-of-life) | John Conway's Game of Life | [Conway's Game of Life](https://beltoforion.de/en/game_of_life) | TypeScript |
| [`applets/harmonic-oscillator`](applets/harmonic-oscillator) | Analytic solution of the damped harmonic oscillator | [Damped Harmonic Oscillator](https://beltoforion.de/en/harmonic_oscillator) | TypeScript |
| [`applets/magnetic-pendulum`](applets/magnetic-pendulum) | Basins of attraction of a pendulum over magnets | [The Magnetic Pendulum](https://beltoforion.de/en/magnetic-pendulum) | none |
| [`applets/planetary-disk`](applets/planetary-disk) | Dust disk around the Sun with Lagrange points and Trojans | – | none |
| [`applets/protoplanetary-disk`](applets/protoplanetary-disk) | A cloud of gas and dust settles into a disk and forms protoplanets (WebGL2) | – | none |
| [`applets/simulated-evolution`](applets/simulated-evolution) | Microbes evolving their movement patterns | [Simulating Evolution](https://beltoforion.de/en/simulated-evolution) | none |
| [`applets/tides`](applets/tides) | Tidal forces of Moon and Sun | [Tides Explained](https://beltoforion.de/en/tides) | webpack |
| [`applets/wator`](applets/wator) | Wa-Tor predator-prey simulation | [World of Wator](https://beltoforion.de/en/wator) | none |

## Layout

```
index.html           overview with a link to every demo page
applets/<name>/      one folder per applet, always the version in use
originals/<name>/    earlier hand-written versions that have been replaced
shared/              code used by several applets
  demo/              stand-in for the website's page environment (applet.js, applet.css)
third-party/         libraries by others (Phaser CE 2.14.0, Flotr2)
```

Conventions:

- The applet is the unit of order, not the technology it is built with. `applets/<name>`
  always holds the current version. When an applet is rewritten, the previous version
  moves to `originals/<name>` and the new one takes its place.
- Folder names and new file names use hyphens. Script files keep the names under
  which the website includes them (for example `MagPendGPU.js`, `exoplanet_transit.js`).
- Every applet folder has exactly one demo page named `index.html`. The demo pages are
  written in German.
- `originals/` currently holds the TypeScript versions of the magnetic pendulum and of
  the simulated evolution. The original Wa-Tor was a C++ program and lives in its own
  repository.

## Running

No web server and no build are needed to try the applets: the compiled JavaScript is
checked in. Open the main folder in Visual Studio Code, pick an applet in the
*Run and Debug* list and press F5, or open the HTML file in a browser.

## Building

Only needed after changing a `.ts` file.

```
npm install          # once, installs TypeScript 4.9
npm run build        # all TypeScript applets
npm run build:game-of-life
```

The tides applet is bundled with webpack and has its own dependencies:

```
cd applets/tides
npm install
npm run build
```

TypeScript is pinned to 4.9 because the applets target ES5 and use the type
definitions of Phaser 2, which newer compilers no longer accept. The common compiler
settings are in `tsconfig.base.json`; each applet's `tsconfig.json` only lists its
deviations.

The protoplanetary disk is developed in a separate working folder and copied here
as a whole; change it there, not in this repository. It needs WebGL2 with
`EXT_color_buffer_float`. Gravity is summed directly over all pairs, so the cost grows
with the square of the particle count; `?n=<count>` picks the count (64 to 65 536).
The scripts in `js/` are plain scripts under the global namespace `Disk`, loaded in a
fixed order by `index.html`: `experiment.js` bundles the core (initial cloud,
`simulation.js` with the leapfrog step and merging, the clock in `sim-driver.js`,
`diagnostics.js`) without any dependency on page, camera or picture; `renderer.js`,
`hud.js` and the chart files draw, and only `controls.js` and `main.js` know the page's
element ids. The simulation runs as fast as the GPU allows, independent of the frame
rate. `headless.html?n=4096&seed=22&steps=2000` computes without a picture and prints
the result as JSON (also with `chromium --headless --dump-dom`). In the console, `sim`
gives access for experiments (`sim.reset(seed)`, `sim.step(n)`, `sim.diagnose()`,
`sim.checksum()`, `sim.pauseAtStep(n)`). Different browsers may give slightly different
numbers for the same cloud; within one browser a run is repeatable.

The exoplanet atlas has its own maintenance scripts (`update-data.js`,
`atlas/update-index.js`); see the comments at the top of `applets/exoplanet-atlas/atlas.html`.

## License

MIT, see [LICENSE](LICENSE). The libraries in `third-party/` are under their own
licenses (Phaser CE: MIT, see `third-party/phaser/license.txt`; Flotr2: MIT).

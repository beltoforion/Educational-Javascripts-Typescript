import { GalaxyRenderer } from './GalaxyRenderer'

export var galaxy : GalaxyRenderer | null = null;

try
{
    // The html code must contain a canvas named "cvGalaxy"
    var canvas = document.getElementById('cvGalaxy') as HTMLCanvasElement;
    if (canvas==null)
    {
        throw Error('"The galaxy renderer needs a canvas object with id "cvGalaxy"');
    }

    galaxy = new GalaxyRenderer(canvas);
}
catch(Error)
{
  alert(Error.message);
}
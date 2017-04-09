/// <reference path="../shared/phaser-2.6.2/typescript/phaser.d.ts"/> 
class Galaxy {
  private m_elEx1 : number;          ///< Excentricity of the innermost ellipse
  private m_elEx2 : number;          ///< Excentricity of the outermost ellipse

  private m_velOrigin : number;      ///< Velovity at the innermost core in km/s
  private m_velInner : number;       ///< Velocity at the core edge in km/s
  private m_velOuter : number;       ///< Velocity at the edge of the disk in km/s

  private m_angleOffset : number;    ///< Angular offset per parsec

  private m_radCore : number;        ///< Radius of the inner core
  private m_radGalaxy : number;      ///< Radius of the galaxy
  private m_radFarField : number;    ///< The radius after which all density waves must have circular shape
  private m_sigma : number;          ///< Distribution of stars
  private m_velAngle : number;       ///< Angular velocity of the density waves
  
  private m_dustRenderSize : number;
  
  private m_numStars : number;          ///< Total number of stars
  private m_numDust : number;           ///< Number of Dust Particles
  private m_numH2 : number;             ///< Number of H2 Regions

  private m_pertN : number;
  private m_pertAmp : number;
  
  private m_time : number;
  private m_timeStep : number;
  
  private m_bHasDarkMatter : boolean;

//  private m_numberByRad[100];           ///< Historgramm showing distribution of stars

//  private Vec2D m_pos;             ///< Center of the galaxy
//  private Star *m_pStars;          ///< Pointer to an array of star data
//  private Star *m_pDust;           ///< Pointer to an array of dusty areas
//  private Star *m_pH2;  
}
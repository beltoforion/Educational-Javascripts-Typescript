/// <reference path="../shared/vec2d.ts"/>
/// <reference path="../shared/box2d.ts"/>

interface IModel {
    
    eval(state : any, time : number, deriv : any) : void;
    
    create() : void;

    getName() : string;
    
    getDim() : number;

    setEngine(engine : IIntegrator) : void;
    
    isFinished(state : number[]) : boolean;
}
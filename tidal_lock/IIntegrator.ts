/// <reference path="./IModel.ts"/>

interface IIntegrator
{
    setStepSize(h : number) : void;
    setModel(model : IModel) : void;
    singleStep() : number [];
    setInitialState(state : number []) : void;
}
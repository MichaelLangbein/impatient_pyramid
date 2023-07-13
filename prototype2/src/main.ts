// /**
//  * @TODOs
//  * - StreamFunction: use generic, not number
//  * - Name streams and stream-func arguments
//  */

// interface Result {
//     degree: number,
//     estimate: number
// }

// type StreamFunction = (inputs: number[]) => number;

// interface IResultStream {
//     next(): Result
// }

// class ResultStream implements IResultStream {
//     private degree = 0;
//     private estimate = 0;

//     constructor(
//         readonly func: StreamFunction,
//         readonly inputs: IResultStream[]
//     ) {}

//     public next(): Result {
//         if (this.degree >= 1) return {degree: 1, estimate: this.estimate};

//         const inputResults = this.inputs.map(i => i.next());
//         const degrees = inputResults.map(r => r.degree);
//         const estimates = inputResults.map(r => r.estimate);
//         const degree = degrees.reduce((prev, current) => current * prev, 1);
//         const estimate = this.func(estimates);

//         this.degree = degree;
//         this.estimate = estimate;
//         return {degree, estimate};
//     }
// }

// class IdentityStream implements IResultStream {
//     constructor(private value: number) {}

//     public next(): Result {
//         return {degree: 1, estimate: this.value};
//     }
// }



type ZXY = {z: number, x: number, y: number};

class Pyramid {
    constructor(readonly nrLevels: number) {}

    public isBottom(location: ZXY): boolean {
        return location.z >= this.nrLevels;
    }

    public getChildren(location: ZXY): {tl: ZXY, tr: ZXY, br: ZXY, bl: ZXY} {

    }
}

const pyramid = new Pyramid(8);



// function pyramidEstimate(location: ZXY, mapFunction: CallableFunction, reduceFunction, spatialArgs, nonSpatialArgs): ResultStream {
//     if (pyramid.isBottom(location)) {
//         const estimate = mapFunction()
//     } else {
//         const childEstimateStreams: ResultStream[] = [];
//         for (const [direction, child] of Object.entries(pyramid.getChildren(location))) {
//             const estimateStream = pyramidEstimate(child, mapFunction, reduceFunction, spatialArgs, nonSpatialArgs);
//             childEstimateStreams.push(estimateStream);
//         }
//         return new ResultStream(reduceFunction, childEstimateStreams);
//     }
// }



interface PyramidValue {
    getValueAt(location: ZXY): number;
}

interface Estimate {
    degree: number, 
    estimate: number
}

interface IEstimateStream {
    next(): Estimate;
}

class IdentityEstimateStream implements IEstimateStream {
    constructor(private value: number) {}
    next() {
        return {degree: 1, estimate: this.value};
    }
}

class CachedEstimateStream implements IEstimateStream {
    
    private lastEstimate: Estimate = {degree: 0, estimate: 0};

    constructor(private makeEstimateFunction: () => Estimate) {}

    next(): Estimate {
        if (this.lastEstimate.degree >= 1) return this.lastEstimate;
        const newEstimate = this.makeEstimateFunction();
        this.lastEstimate = newEstimate;
        return newEstimate;
    }
}


function pyramidEstimate(location: ZXY, func: CallableFunction, inputs: PyramidValue[], reduceFunc: CallableFunction): IEstimateStream {
    if (pyramid.isBottom(location)) {
        const inputValues = inputs.map(i => i.getValueAt(location));
        const estimate = func(inputValues);
        return new IdentityEstimateStream(estimate);
        /*
        * planning ahead: 
        * In a second step, I'll change IPyramid value from `getValueAt(ZXY) -> number`
        * to `getEstimateAt(ZXY) -> EstimateStream`
        * 
        * Then this section will change to:
        * const makeEstimateFunction = () => {
        *   const inputStreams = inputs.map(i => i.getEstimateAt(location));
        *   const inputs = inputStreams.map(s => s.next());
        *   const degrees = inputs.map(i => i.degree);
        *   const estimates = inputs.map(i => i.estimate);
        *   const degree = degrees.reduce((last, curr) => last * curr, 1);
        *   const estimate = func(estimates);
        *   return degree, estimate;
        * }
        * return new CachedEstimateStream(makeEstimateFunction)
        * 
        * A pyramid value will then have to be implemented like so:
        * class PyramidValue implements IPyramidValue {
        *    constuctor(private: func, private inputs, private reduce) {}
        *    getEstimateAt(location: ZXY) {
        *       return pyramidEstimate(location, this.func, this.inputs, this.reduce);
        *    }
        * }
        * class ConcretePyramidValue implements IPyramidValue {
        *    constructor(private raster) {}
        *    getEstimateAt(location: ZXY) {
        *       const value = this.getGridValueAt(location);
        *       return IdentityEstimateStream(value);
        *    }
        * }
        */
    }
    else {
        const makeEstimateFunction = () => {
            const childLocations = pyramid.getChildren(location);

            const childEstimateStreams: {[direction: string]: IEstimateStream} = {};
            for (const [direction, childLocation] of Object.entries(childLocations)) {
                const childEstimateStream = pyramidEstimate(childLocation, func, inputs, reduceFunc);
                childEstimateStreams[direction] = childEstimateStream;
            }

            const degrees = [];
            const estimates = [];
            for (const [direction, childLocation] of Object.entries(childLocations)) {
                const {degree, estimate} = childEstimateStreams[direction].next();
                degrees.push(degree);
                estimates.push(estimate);
            }

            const degree = degrees.reduce((prev, curr) => prev * curr, 1);
            const estimate = reduceFunc(estimates);
            return {degree, estimate};
        };

        return new CachedEstimateStream(makeEstimateFunction);
    }
}






interface DamageStates {
    d1: number,
    d2: number,
    d3: number,
    d4: number
}
interface Exposure {
    wooden: DamageStates,
    brick: DamageStates,
    steal: DamageStates
}

function updateExposure(intensity: number, exposure: Exposure, fragility: Fragility): Exposure {
    for (const [buildingType, state] of Object.entries(exposure)) {
        for (const [damageState, count] of Object.entries(state)) {
            probD1, probD2, probD3, probD4 = fragility(buildingType, damageState, intensity);
        }
    }
    return exposure;
}

function calcMean() {

}

const zxy: ZXY = {z: 4, x: 52, y: 41};
const estimateStream = pyramidEstimate(zxy, updateExposure, [intensityPyramid, exposurePyramid], calcMean);
let degree = 0;
while (degree < 1) {
    let {degree, estimate} = estimateStream.next();
    console.log({degree, estimate});
}
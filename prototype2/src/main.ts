/**
 * @TODOs
 * - StreamFunction: use generic, not number
 * - Name streams and stream-func arguments
 */

interface Result {
    degree: number,
    estimate: number
}

type StreamFunction = (inputs: number[]) => number;

interface IResultStream {
    next(): Result
}

class ResultStream implements IResultStream {
    private degree = 0;
    private estimate = 0;

    constructor(
        readonly func: StreamFunction,
        readonly inputs: IResultStream[]
    ) {}

    public next(): Result {
        if (this.degree >= 1) return {degree: 1, estimate: this.estimate};

        const inputResults = this.inputs.map(i => i.next());
        const degrees = inputResults.map(r => r.degree);
        const estimates = inputResults.map(r => r.estimate);
        const degree = degrees.reduce((prev, current) => current * prev, 1);
        const estimate = this.func(estimates);

        this.degree = degree;
        this.estimate = estimate;
        return {degree, estimate};
    }
}

class IdentityStream implements IResultStream {
    constructor(private value: number) {}

    public next(): Result {
        return {degree: 1, estimate: this.value};
    }
}



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



function pyramidEstimate(location: ZXY, mapFunction: CallableFunction, reduceFunction, spatialArgs, nonSpatialArgs): ResultStream {
    if (pyramid.isBottom(location)) {
        const estimate = mapFunction()
    } else {
        const childEstimateStreams: ResultStream[] = [];
        for (const [direction, child] of Object.entries(pyramid.getChildren(location))) {
            const estimateStream = pyramidEstimate(child, mapFunction, reduceFunction, spatialArgs, nonSpatialArgs);
            childEstimateStreams.push(estimateStream);
        }
        return new ResultStream(reduceFunction, childEstimateStreams);
    }
}


const intensity = raster2pyramid("intensity")
const exposure  = vector2pyramid("exposure")

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




const zxy: ZXY = {z: 4, x: 52, y: 41};
const estimateStream = pyramidEstimate(zxy, updateExposure, calcMean, {intensity, exposure}, {fragility});
let degree = 0;
while (degree < 1) {
    let {degree, estimate} = estimateStream.next();
    console.log({degree, estimate});
}
type ZXY = {z: number, x: number, y: number};

class Pyramid {
    constructor(readonly nrLevels: number) {}

    public isBottom(location: ZXY): boolean {
        return location.z >= this.nrLevels;
    }

    public getChildren(location: ZXY): {tl: ZXY, tr: ZXY, br: ZXY, bl: ZXY} {
        if (location.z > this.nrLevels) throw Error(`No children below level ${this.nrLevels}. Requested level ${location.z}.`);
        const br = {z: location.z + 1, x: 2 * location.x, y: 2 * location.y};
        const bl = {...br, x: br.x - 1};
        const tl = {...bl, y: bl.y - 1};
        const tr = {...tl, x: tl.x + 1};
        return {tl, tr, br, bl};
    }
}


interface IPyramidValue {
    getValueAt(location: ZXY): number;
}


class PyramidValue implements IPyramidValue {
    // @TODO: reduce should be mean() by default
    constuctor (private func: CallableFunction, private inputs: IPyramidValue[], private reduce: CallableFunction) {}

    getEstimateAt(location: ZXY) {
        return pyramidEstimate(location, this.func, this.inputs, this.reduce);
    }
}

class RasterPyramidValue {
    constructor (private pyramid: Pyramid, private raster: number[][]) {}

    getEstimateAt(location: ZXY) {
        const value = this.getGridValueAt(location);
        return new IdentityEstimateStream(value);
    }

    private getGridValueAt(location: ZXY) {
        // @TODO: account for z. Aggreagate through mean, I guess.
        // Also, should probably somehow use this.pyramid
        return this.raster[location.y][location.x];
    }
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
        const makeEstimateFunction = () => {
           const inputStreams = inputs.map(i => i.getEstimateAt(location));
           const inputEstimates = inputStreams.map(s => s.next());
           const degrees = inputEstimates.map(i => i.degree);
           const estimates = inputEstimates.map(i => i.estimate);
           const degree = degrees.reduce((last, curr) => last * curr, 1);
           const estimate = func(estimates);
           return {degree, estimate};
         }
         return new CachedEstimateStream(makeEstimateFunction)
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






const pyramid = new Pyramid(8);

const loc: ZXY = {z: 4, x: 52, y: 41};

const intensityPyramid = new RasterPyramidValue(pyramid, [
    [0, 1, 1, 1],
    [1, 2, 3, 2],
    [2, 3, 4, 3],
    [1, 2, 3, 2]
]);

const exposurePyramid = new RasterPyramidValue(pyramid, [
    [2, 1, 0, 0],
    [3, 2, 1, 0],
    [2, 3, 2, 1],
    [1, 2, 3, 1]
]);

function updateExposure(intensity: number, exposure: number): number {
    return intensity * exposure;
}

function calcMean(estimates: number[]) {
    const sum = estimates.reduce((last, curr) => last + curr, 0);
    const count = estimates.length;
    return sum / count;
}

const updatedExposurePyramid = new PyramidValue(updateExposure, [intensityPyramid, exposurePyramid], calcMean);

const estimateStream = updatedExposurePyramid.getEstimateAt(loc);

let degree = 0;
while (degree < 1) {
    let {degree, estimate} = estimateStream.next();
    console.log({degree, estimate});
}

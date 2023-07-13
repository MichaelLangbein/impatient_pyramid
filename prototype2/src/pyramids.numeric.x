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
    getEstimateAt(location: ZXY): IEstimateStream;
}

interface IPyramidValue {
    getEstimateAt(location: ZXY): IEstimateStream;
}

class PyramidValue implements IPyramidValue {
    // @TODO: reduce should be mean() by default
    constructor (private func: CallableFunction, private inputs: IPyramidValue[]) {}

    getEstimateAt(location: ZXY) {
        return pyramidEstimate(location, this.func, this.inputs);
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
        return this.raster[location.y - 1][location.x - 1];
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

function randomlyPickDirection(directionData: {'tl': Estimate, 'tr': Estimate, 'br': Estimate, 'bl': Estimate}) {
    // Picks directions of lower degree with higher likelihood - and those with degree 1 with prob = 0

    const probTlNonNorm = (1 - directionData['tl'].degree);
    const probTrNonNorm = (1 - directionData['tr'].degree);
    const probBrNonNorm = (1 - directionData['br'].degree);
    const probBlNonNorm = (1 - directionData['bl'].degree);
    const sum = probTlNonNorm + probTrNonNorm + probBrNonNorm + probBlNonNorm;
    const probTl = probTlNonNorm / sum;
    const probTr = probTrNonNorm / sum;
    const probBr = probBrNonNorm / sum;
    const probBl = probBlNonNorm / sum;


    const randnum = Math.random();

    if (randnum < probTl) return 'tl';
    if (randnum < probTl + probTr) return 'tr';
    if (randnum < probTl + probTr + probBr) return 'br';
    if (randnum < probTl + probTr + probBr + probBl) return 'bl';

    throw Error(`This line should be unreachable`);
}

function pyramidEstimate(location: ZXY, func: CallableFunction, inputs: IPyramidValue[]): IEstimateStream {

    // Case 1: we're at bottom of pyramid. Get estimates from other pyramids and evaluate.
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
         return new CachedEstimateStream(makeEstimateFunction);
    }

    // Case 2: we're high up in the pyramid. Pick *some* sub-pyramid and recurse. Remember previous evaluations' results for later to update degree and estimate.
    else {
        const childLocations = pyramid.getChildren(location);

        const childEstimateStreams: {[direction: string]: IEstimateStream} = {};
        for (const [direction, childLocation] of Object.entries(childLocations)) {
            const childEstimateStream = pyramidEstimate(childLocation, func, inputs);
            childEstimateStreams[direction] = childEstimateStream;
        }

        const latestResults: {'tl': Estimate, 'tr': Estimate, 'br': Estimate, 'bl': Estimate} = {'tl': {degree: 0, estimate: 0 }, 'tr': {degree: 0, estimate: 0 }, 'br': {degree: 0, estimate: 0 }, 'bl': {degree: 0, estimate: 0 }};

        const makeEstimateFunction = () => {

            const randomlyPickedDirection = randomlyPickDirection(latestResults);
            const result = childEstimateStreams[randomlyPickedDirection].next();
            latestResults[randomlyPickedDirection] = result;

            let degreeTotal = 0;
            let estimateTotal = 0;
            for (const [direction, latestEstimate] of Object.entries(latestResults)) {
                const {degree, estimate} = latestEstimate;
                estimateTotal += degree * estimate / 4;
                degreeTotal   += degree / 4;
            }

            return {degree: degreeTotal, estimate: estimateTotal};
        };

        return new CachedEstimateStream(makeEstimateFunction);
    }
}




const pyramid = new Pyramid(3);

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

function updateExposure([intensity, exposure]: number[]): number {
    return intensity * exposure;
}

const loc: ZXY = {z: 2, x: 1, y: 2};

const updatedExposurePyramid = new PyramidValue(updateExposure, [intensityPyramid, exposurePyramid]);

const estimateStream = updatedExposurePyramid.getEstimateAt(loc);

const cutoff = 0.95;
var degree = 0;
var estimate = 0;
while (degree < cutoff) {
    var {degree, estimate} = estimateStream.next();
    console.log({degree, estimate});
}


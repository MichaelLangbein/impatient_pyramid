export type ZXY = {z: number, x: number, y: number};

export class Grid {
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

    public countBottomUnder(location: ZXY) {
        const deltaZ = this.nrLevels - location.z;
        return Math.pow(4, deltaZ);
    }

    public tilesAtLevel(z: number) {
        return Math.pow(4, z-1);
    }

    public rowsColsAtLevel(z: number) {
        const tiles = this.tilesAtLevel(z);
        const rows = Math.round(Math.sqrt(tiles));
        const cols = rows;
        return {rows, cols};
    }

}



export type MapFunction<T> = (args: any[], loc: ZXY) => T;
export type ReduceFunction<T> = (arg: DirectionEstimates<T>, loc: ZXY) => T;


export interface Estimate<T> {
    degree: number, 
    estimate: T
}

export interface IEstimateStream<T> {
    next(): Estimate<T>;
}

class IdentityEstimateStream<T> implements IEstimateStream<T> {
    constructor(private value: T) {}
    next() {
        return {degree: 1, estimate: this.value};
    }
}

class FiniteEstimateStream<T> implements IEstimateStream<T> {
    private lastValue: undefined | Estimate<T> = undefined;
    
    constructor(private makeEstimateFunction: () => Estimate<T>, private location: ZXY) {}

    next(): Estimate<T> {
        if (this.lastValue && this.lastValue.degree >= 1) return this.lastValue;
        const newEstimate = this.makeEstimateFunction();
        if (newEstimate.degree >= 1.0) this.lastValue = newEstimate;
        return newEstimate;
    }
}


export interface IPyramid<T> {
    getEstimateStreamAt(location: ZXY): IEstimateStream<T>
}

export class Pyramid<T> implements IPyramid<T> {
    private streams = new Map<string, IEstimateStream<T>>()

    constructor(
        readonly grid: Grid,
        private func: MapFunction<T>,
        private inputs: IPyramid<any>[], 
        private aggregationFunction: ReduceFunction<T>
    ) {}

    getEstimateStreamAt(location: ZXY) {
        const key = `${location.z}/${location.x}/${location.y}`;
        const cacheHit = this.streams.get(key);
        if (cacheHit) return cacheHit;
        const stream = this.pyramidEstimate(location);
        this.streams.set(key, stream);
        return stream;
    }

    private pyramidEstimate(location: ZXY): IEstimateStream<T> {
        // Case 1: we're at bottom of pyramid. Get estimates from other pyramids and evaluate.
        if (this.grid.isBottom(location)) {
            return this.bottomStream(location);
        }
        // Case 2: we're high up in the pyramid. Pick *some* sub-pyramid and recurse. Remember previous evaluations' results for later to update degree and estimate.
        else {
            return this.recurseDown(location);
        }
    }

    private recurseDown(location: ZXY) {
        const childLocations = this.grid.getChildren(location);

        const latestResults: DirectionEstimates<T> = {
            'tl': {degree: 0, estimate: undefined },
            'tr': {degree: 0, estimate: undefined },
            'br': {degree: 0, estimate: undefined },
            'bl': {degree: 0, estimate: undefined }
        };

        const makeEstimateFunction = () => {

            const randomlyPickedDirection = randomlyPickDirection(latestResults);
            const location = childLocations[randomlyPickedDirection];
            const childStream = this.getEstimateStreamAt(location);
            const result = childStream.next();
            latestResults[randomlyPickedDirection] = result;

            let degreeTotal = 0;
            for (const [direction, latestEstimate] of Object.entries(latestResults)) {
                const {degree, estimate} = latestEstimate;
                degreeTotal   += degree / 4;
            }
            let estimateTotal = this.aggregationFunction(latestResults, location);

            return {degree: degreeTotal, estimate: estimateTotal};
        };

        return new FiniteEstimateStream<T>(makeEstimateFunction, location);
    }

    private bottomStream(location: ZXY) {
        const makeEstimateFunction = () => {
            const inputStreams = this.inputs.map(i => i.getEstimateStreamAt(location));
            const inputEstimates = inputStreams.map(s => s.next());
            const degrees = inputEstimates.map(i => i.degree);
            const estimates = inputEstimates.map(i => i.estimate);
            const degree = degrees.reduce((last, curr) => last * curr, 1);
            const estimate = this.func(estimates, location);
            return {degree, estimate};
        }
        return new FiniteEstimateStream(makeEstimateFunction, location);
    }
}


export class RasterPyramid<T> extends Pyramid<T> {
    
    constructor(grid: Grid, private raster: T[][], aggrFunc: ReduceFunction<T>) {

        const mapFunc = (args: any[], location: ZXY) => {
            return this.raster[location.y - 1][location.x - 1];
        }

        super(grid, mapFunc, [], aggrFunc);
    }

    getEstimateStreamAt(location: ZXY) {
        return super.getEstimateStreamAt(location);
    }

}

export const meanFunction: ReduceFunction<number> = (args: DirectionEstimates<number>, loc: ZXY) => {
    const estimates = Object.entries(args).map(e => e[1]);
    const len = estimates.length;
    const validEstimates = estimates.filter(e => e.degree >= 0 && e.estimate !== undefined);
    let mean = 0;
    for (const {degree, estimate} of validEstimates) {
        mean += degree * estimate! / len;
    }
    return mean;
}


export type DirectionEstimates<T> = {'tl': Estimate<T | undefined>, 'tr': Estimate<T | undefined>, 'br': Estimate<T | undefined>, 'bl': Estimate<T | undefined>};

function randomlyPickDirection(directionData: DirectionEstimates<any>) {
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


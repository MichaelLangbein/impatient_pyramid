export type ZXY = {z: number, x: number, y: number};

export class Pyramid {
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
}



export type MapFunction<T> = (args: any[]) => T;
export type ReduceFunction<T> = (arg: DirectionEstimates<T>) => T;

export type LocationToEstimateStream<T> = (location: ZXY) => IEstimateStream<T>;


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

class Cache {
    private data = new Map<string, Estimate<any>>();

    public get<T>(location: ZXY, func: () => Estimate<T>): Estimate<T> | undefined {
        const key = this.makeKey(location, func);
        const hit = this.data.get(key);
        if (hit) console.log(`Cache hit at level ${location.z}`);
        return hit;
    }

    public set<T>(location: ZXY, func: () => Estimate<T>, data: Estimate<T>) {
        const key = this.makeKey(location, func);
        this.data.set(key, data);
    }

    private makeKey<T>(location: ZXY, func: () => Estimate<T>): string {
        const key = `${location.z}/${location.x}/${location.y}/` + func;
        return key;
    }
}

const cache = new Cache();

class CachedEstimateStream<T> implements IEstimateStream<T> {
    
    constructor(private makeEstimateFunction: () => Estimate<T>, private location: ZXY) {}

    next(): Estimate<T> {
        const cacheHit = cache.get(this.location, this.makeEstimateFunction);
        if (cacheHit) return cacheHit;
        const newEstimate = this.makeEstimateFunction();
        if (newEstimate.degree >= 1.0) cache.set(this.location, this.makeEstimateFunction, newEstimate);
        return newEstimate;
    }
}


export function createRasterStream<T>(raster: T[][]): LocationToEstimateStream<T> {
    return (location: ZXY) => {
        return new IdentityEstimateStream(raster[location.y - 1 ][location.x - 1]);
    }
}

export function createEstimateStream<T>(func: MapFunction<T>, inputs: LocationToEstimateStream<any>[], aggregationFunction: ReduceFunction<T>, pyramid: Pyramid): LocationToEstimateStream<T> {
    return (location: ZXY) => {
        return pyramidEstimate<T>(location, func, inputs, aggregationFunction, pyramid)
    }
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

function pyramidEstimate<T>(location: ZXY, func: MapFunction<T>, inputs: LocationToEstimateStream<any>[], aggregationFunction: ReduceFunction<T>, pyramid: Pyramid): IEstimateStream<T> {

    // Case 1: we're at bottom of pyramid. Get estimates from other pyramids and evaluate.
    // Inputs to `makeEstimateFunction` are `input: IPyramidValue[]` - we always consider all of them.
    if (pyramid.isBottom(location)) {
        const makeEstimateFunction = () => {
           const inputStreams = inputs.map(i => i(location));
           const inputEstimates = inputStreams.map(s => s.next());
           const degrees = inputEstimates.map(i => i.degree);
           const estimates = inputEstimates.map(i => i.estimate);
           const degree = degrees.reduce((last, curr) => last * curr, 1);
           const estimate = func(estimates);
           return {degree, estimate};
         }
         return new CachedEstimateStream(makeEstimateFunction, location);
    }

    // Case 2: we're high up in the pyramid. Pick *some* sub-pyramid and recurse. Remember previous evaluations' results for later to update degree and estimate.
    // Inputs to `makeEstimateFunction` are `childEstimateStreams` - we always consider only one of them at random.
    // We also maintain a cache
    else {
        const childLocations = pyramid.getChildren(location);

        const childEstimateStreams: {[direction: string]: IEstimateStream<T>} = {};
        for (const [direction, childLocation] of Object.entries(childLocations)) {
            const childEstimateStream = pyramidEstimate<T>(childLocation, func, inputs, aggregationFunction, pyramid);
            childEstimateStreams[direction] = childEstimateStream;
        }

        const latestResults: DirectionEstimates<T> = {
            'tl': {degree: 0, estimate: undefined },
            'tr': {degree: 0, estimate: undefined },
            'br': {degree: 0, estimate: undefined },
            'bl': {degree: 0, estimate: undefined }
        };

        const makeEstimateFunction = () => {

            const randomlyPickedDirection = randomlyPickDirection(latestResults);
            const result = childEstimateStreams[randomlyPickedDirection].next();
            latestResults[randomlyPickedDirection] = result;

            let degreeTotal = 0;
            for (const [direction, latestEstimate] of Object.entries(latestResults)) {
                const {degree, estimate} = latestEstimate;
                degreeTotal   += degree / 4;
            }
            let estimateTotal = aggregationFunction(latestResults);

            return {degree: degreeTotal, estimate: estimateTotal};
        };

        return new CachedEstimateStream<T>(makeEstimateFunction, location);
    }
}

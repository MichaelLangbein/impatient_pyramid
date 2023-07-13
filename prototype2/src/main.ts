import { ZXY, Pyramid, PyramidValue, RasterPyramidValue, DirectionEstimates } from './pyramids.generic';



function sum(data: any[]) {
    return data.reduce((l, c) => l+c, 0);
}

function weightedSum(data: any[], weights: number[]) {
    const wSum = sum(weights);
    let out = 0;
    for (let i = 0; i < data.length; i++) {
        out += data[i] * weights[i] / wSum;
    }
    return out;
}


interface DamageDegrees {
    d0: number,
    d1: number,
    d2: number,
    d3: number,
}

interface Exposure {
    nrBuildings: {
        wood: number,
        brick: number,
        steel: number
    }
    damage: {
        wood: DamageDegrees,
        brick: DamageDegrees,
        steel: DamageDegrees
    }
}

function createFloatRaster(rows: number, cols: number): number[][] {
    const matrix = [];
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            row.push(Math.random());
        }
        matrix.push(row);
    }
    return matrix;
}

function createExposureRaster(rows: number, cols: number): Exposure[][] {
    const matrix = [];
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            const expo: Exposure = {
                nrBuildings: {
                    wood: Math.random() * 100,
                    brick: Math.random() * 100,
                    steel: Math.random() * 100
                },
                damage: {
                    wood:  { d0: 1, d1: 0, d2: 0, d3: 0 },
                    brick: { d0: 1, d1: 0, d2: 0, d3: 0 },
                    steel: { d0: 1, d1: 0, d2: 0, d3: 0 }
                }
            }
            row.push(expo);
        }
        matrix.push(row);
    }
    return matrix;
}




const level = 6;
const rows = Math.pow(4, level-1);
const cols = rows;

const pyramid = new Pyramid(level);

const intensityPyramid = new RasterPyramidValue(pyramid, createFloatRaster(rows, cols));

const exposurePyramid = new RasterPyramidValue(pyramid, createExposureRaster(rows, cols));

function fragility(intensity: number, state: DamageDegrees, material: 'wood' | 'brick' | 'steel'): DamageDegrees {
    const newDamages: DamageDegrees = {
        d0: state.d0 / intensity,
        d1: state.d1 + 1,
        d2: state.d2 + 2,
        d3: state.d3 + 1
    };
    return newDamages;
}

function updateExposure([intensity, exposure]: [number, Exposure]): Exposure {
    const newExposure: Exposure = {
        nrBuildings: {
            wood: exposure.nrBuildings.wood,
            brick: exposure.nrBuildings.brick,
            steel: exposure.nrBuildings.steel,
        },
        damage: {
            wood:  fragility(intensity, exposure.damage.wood, 'wood'),
            brick: fragility(intensity, exposure.damage.brick, 'brick'),
            steel: fragility(intensity, exposure.damage.steel, 'steel'),
        }
    };
    return newExposure;
}

function reduce(directionEstimates: DirectionEstimates<Exposure>): Exposure {
    const results = Object.values(directionEstimates);
    const estimates = results.map(r => r.estimate).filter(e => e !== undefined);
    const aggregatedExposure: Exposure = {
        nrBuildings: {
            wood:  sum(estimates.map(e => e!.nrBuildings.wood)),
            brick: sum(estimates.map(e => e!.nrBuildings.brick)),
            steel: sum(estimates.map(e => e!.nrBuildings.steel)),
        },
        damage: {
            wood:  {
                d0: weightedSum(estimates.map(e => e!.damage.wood.d0), estimates.map(e => e!.nrBuildings.wood)),
                d1: weightedSum(estimates.map(e => e!.damage.wood.d1), estimates.map(e => e!.nrBuildings.wood)),
                d2: weightedSum(estimates.map(e => e!.damage.wood.d2), estimates.map(e => e!.nrBuildings.wood)),
                d3: weightedSum(estimates.map(e => e!.damage.wood.d3), estimates.map(e => e!.nrBuildings.wood)),
            },
            brick: {
                d0: weightedSum(estimates.map(e => e!.damage.brick.d0), estimates.map(e => e!.nrBuildings.brick)),
                d1: weightedSum(estimates.map(e => e!.damage.brick.d1), estimates.map(e => e!.nrBuildings.brick)),
                d2: weightedSum(estimates.map(e => e!.damage.brick.d2), estimates.map(e => e!.nrBuildings.brick)),
                d3: weightedSum(estimates.map(e => e!.damage.brick.d3), estimates.map(e => e!.nrBuildings.brick)),
            },
            steel: {
                d0: weightedSum(estimates.map(e => e!.damage.steel.d0), estimates.map(e => e!.nrBuildings.steel)),
                d1: weightedSum(estimates.map(e => e!.damage.steel.d1), estimates.map(e => e!.nrBuildings.steel)),
                d2: weightedSum(estimates.map(e => e!.damage.steel.d2), estimates.map(e => e!.nrBuildings.steel)),
                d3: weightedSum(estimates.map(e => e!.damage.steel.d3), estimates.map(e => e!.nrBuildings.steel)),
            },
        }
    };
    return aggregatedExposure;
}

const loc: ZXY = {z: 1, x: 1, y: 1};

const updatedExposurePyramid = new PyramidValue(updateExposure as any, [intensityPyramid, exposurePyramid], reduce, pyramid);

const estimateStream = updatedExposurePyramid.getEstimateAt(loc);

let samples = 0;
const cutoff = 0.99;
var degree = 0;
while (degree < cutoff) {
    var {degree, estimate} = estimateStream.next();
    console.log(degree);
    samples += 1;
}
console.log(`Done after ${samples} samples, out of ${rows * cols} pixels`);
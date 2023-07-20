import { DirectionEstimates } from "./pyramids";


const maxIntensity = 30;

export function sum(data: any[]) {
    return data.reduce((l, c) => l+c, 0);
}

export function weightedSum(data: any[], weights: number[]) {
    const wSum = sum(weights);
    let out = 0;
    for (let i = 0; i < data.length; i++) {
        out += data[i] * weights[i] / wSum;
    }
    return out;
}

export interface DamageDegrees {
    d0: number,
    d1: number,
    d2: number,
    d3: number,
}

export interface Exposure {
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

export function createIntensityRaster(rows: number, cols: number): number[][] {
    const centerRow = 0.3 * rows; 
    const centerCol = 0.6 * cols;
    const range = rows * 0.4;
    const matrix = [];
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            const distance = Math.sqrt(Math.pow(c - centerCol, 2) + Math.pow(r - centerRow, 2));
            const maxVal = maxIntensity * Math.max(range - distance, 0) / range;
            row.push(Math.random() * maxVal);
        }
        matrix.push(row);
    }
    return matrix;
}

export function createExposureRaster(rows: number, cols: number): Exposure[][] {
    const centerRow = 0.6 * rows;
    const centerCol = 0.5 * cols;
    const radiusFirstRing = 0.2 * rows;
    const radiusSecondRing = 0.4 * rows;
    const range = rows * 0.3;
    const matrix = [];
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            const distanceCenter = Math.sqrt(Math.pow(c - centerCol, 2) + Math.pow(r - centerRow, 2));
            const distanceFirstRing = Math.abs(distanceCenter - radiusFirstRing);
            const distanceSecondRing = Math.abs(distanceCenter - radiusSecondRing);
            const maxNrWood = 30 * Math.max(range - distanceSecondRing, 0) / range;
            const maxNrBrick = 30 * Math.max(range - distanceFirstRing, 0) / range;
            const maxNrSteel = 30 * Math.max(range - distanceCenter, 0) / range;
            const expo: Exposure = {
                nrBuildings: {
                    wood: Math.random() * maxNrWood,
                    brick: Math.random() * maxNrBrick,
                    steel: Math.random() * maxNrSteel
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

export function fragility(intensity: number, state: DamageDegrees, material: 'wood' | 'brick' | 'steel'): DamageDegrees {
    function normalizedTriangle(x: number, xMin: number, xPeak: number, xMax: number) {
        const bottom = xMax - xMin;
        const heightPeak = 2 / bottom;
        if (x < xPeak) {
            const heightX = heightPeak * (x - xMin) / (xPeak - xMin);
            return heightX;
        } else {
            const heightX = heightPeak * (1 - (xMax - x) / (xMax - xPeak));
            return heightX;
        }
    }
    function pTransition(stateFrom: number, stateTo: number, intensity: number, material: 'wood' | 'brick' | 'steel'): number {
        if (stateFrom > stateTo) return 0;
        const nrClassesJumped = stateTo - stateFrom;
        const nrClassesPossible = 3 - stateFrom;
        const intensityNorm = intensity / maxIntensity;
        if (material === 'wood') {
            const nrClassesExpected = Math.min(intensityNorm * 2, nrClassesPossible);
            return normalizedTriangle(nrClassesJumped, 0, nrClassesExpected, nrClassesPossible);
        }
        else if (material === 'brick') {
            const nrClassesExpected = Math.min(intensityNorm * 1, nrClassesPossible);
            return normalizedTriangle(nrClassesJumped, 0, nrClassesExpected, nrClassesPossible);
        }
        else {
            const nrClassesExpected = Math.min(intensityNorm * 0.5, nrClassesPossible);
            return normalizedTriangle(nrClassesJumped, 0, nrClassesExpected, nrClassesPossible);
        }
    }
    const newDamages: DamageDegrees = {
        d0: state.d0 * pTransition(0, 0, intensity, material),
        d1: state.d0 * pTransition(0, 1, intensity, material) + state.d1 * pTransition(1, 1, intensity, material),
        d2: state.d0 * pTransition(0, 2, intensity, material) + state.d1 * pTransition(1, 2, intensity, material) + state.d2 * pTransition(2, 2, intensity, material),
        d3: state.d0 * pTransition(0, 3, intensity, material) + state.d1 * pTransition(1, 3, intensity, material) + state.d2 * pTransition(2, 3, intensity, material) + state.d3 * pTransition(3, 3, intensity, material),
    };
    return newDamages;
}

export function updateExposure([intensity, exposure]: [number, Exposure]): Exposure {
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

export function aggregateExposure(directionEstimates: DirectionEstimates<Exposure>): Exposure {
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


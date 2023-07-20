import { createExposureRaster, createIntensityRaster, aggregateExposure, updateExposure } from './businessLogic';
import { ZXY, Grid, RasterPyramid, Pyramid, meanFunction } from './pyramids';



const level = 5;
const rows = Math.pow(2, level-1);
const cols = rows;

const grid = new Grid(level);

const intensity$ = new RasterPyramid(grid, createIntensityRaster(rows, cols), meanFunction);

const exposure$ = new RasterPyramid(grid, createExposureRaster(rows, cols), aggregateExposure);

const updatedExposure$ = new Pyramid(grid, updateExposure as any, [intensity$, exposure$], aggregateExposure);

const updatedExposureAt$ = updatedExposure$.getEstimateStreamAt({z: 1, x: 1, y: 1});



let samples = 0;
const cutoff = 0.125;
var degree = 0;
while (degree < cutoff) {
    var {degree, estimate} = updatedExposureAt$.next();
    console.log(degree);
    samples += 1;
}
console.log(`Done after ${samples} samples, out of ${rows * cols} pixels`);


const loc2: ZXY = {z: 4, x: 2, y: 4};

const updatedExposure2$ = updatedExposure$.getEstimateStreamAt(loc2);

samples = 0;
var degree = 0;
while (degree < cutoff) {
    var {degree, estimate} = updatedExposure2$.next();
    console.log(degree);
    samples += 1;
}
console.log(`Done after ${samples} samples, out of ${rows * cols} pixels`);

// @ts-ignore
console.log([...updatedExposure$.streams.keys()].sort())


/**
 * TODO's:
 *  - only reduce at every `m`'th step
 *  - do real fragility calculation
 *  - example of how `updatedExposurePyramid` can itself be used as another input without evaluating it beforehand.
 * 
 * tests:
 * - get estimate for raster
 * - get estimate for calculated value
 * - verify that cache activates when a sub-pyramid to a previous request is requested
 * - verify that one calculated pyramid can depend on another as input
 *  - and that the input is then 
 */


import { createExposureRaster, createFloatRaster, aggregateExposure, updateExposure } from './businessLogic';
import { ZXY, Grid, RasterPyramid, Pyramid, meanFunction } from './pyramids.generic';



const level = 5;
const rows = Math.pow(2, level-1);
const cols = rows;

const grid = new Grid(level);

const intensity$ = new RasterPyramid(grid, createFloatRaster(rows, cols), meanFunction);

const exposure$ = new RasterPyramid(grid, createExposureRaster(rows, cols), aggregateExposure);

const updatedExposure$ = new Pyramid(grid, updateExposure as any, [intensity$, exposure$], aggregateExposure);

const updatedExposureAt$ = updatedExposure$.getEstimateStreamAt({z: 1, x: 1, y: 1});



let samples = 0;
const cutoff = 0.5;
var degree = 0;
while (degree < cutoff) {
    var {degree, estimate} = updatedExposureAt$.next();
    console.log(degree);
    samples += 1;
}
console.log(`Done after ${samples} samples, out of ${rows * cols} pixels`);


const loc2: ZXY = {z: 1, x: 1, y: 1};

const updatedExposure2$ = updatedExposure$.getEstimateStreamAt(loc2);

samples = 0;
var degree = 0;
while (degree < cutoff) {
    var {degree, estimate} = updatedExposure2$.next();
    console.log(degree);
    samples += 1;
}
console.log(`Done after ${samples} samples, out of ${rows * cols} pixels`);



/**
 * TODO's:
 *  - only reduce at every `m`'th step
 *  - do real fragility calculation
 *  - example of how `updatedExposurePyramid` can itself be used as another input without evaluating it beforehand.
 */
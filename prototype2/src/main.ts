import { createExposureRaster, createFloatRaster, reduce, updateExposure } from './busineslogic';
import { ZXY, Pyramid, createRasterStream, createEstimateStream } from './pyramids.generic';



const level = 5;
const rows = Math.pow(2, level-1);
const cols = rows;

const pyramid = new Pyramid(level);

const intensity$ = createRasterStream(createFloatRaster(rows, cols));

const exposure$ = createRasterStream(createExposureRaster(rows, cols));


const loc: ZXY = {z: 1, x: 1, y: 1};

const updatedExposure$ = createEstimateStream(updateExposure as any, [intensity$, exposure$], reduce, pyramid);
const expoAtLoc = updatedExposure$(loc);

let samples = 0;
const cutoff = 0.5;
var degree = 0;
while (degree < cutoff) {
    var {degree, estimate} = expoAtLoc.next();
    console.log(degree);
    samples += 1;
}
console.log(`Done after ${samples} samples, out of ${rows * cols} pixels`);


const loc2: ZXY = {z: 1, x: 1, y: 1};

const expoAtLoc2 = updatedExposure$(loc2);

samples = 0;
var degree = 0;
while (degree < cutoff) {
    var {degree, estimate} = expoAtLoc2.next();
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
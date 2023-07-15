import { createExposureRaster, createFloatRaster, aggregateExposure, updateExposure } from "./businessLogic";
import { Grid, Pyramid, IPyramid, RasterPyramid, meanFunction, ZXY } from "./pyramids.generic"

interface Bbox {
    latMin: number,
    lonMin: number,
    latMax: number,
    lonMax: number
}

class GeoGrid extends Grid {
    constructor(nrLevels: number, private bbox: Bbox) {
        super(nrLevels);
    }

    public getTilesInside(bbox: Bbox, z?: number): ZXY[] {
        if (!z) { 
            // if not given, pick z such that you return x by 8 or 8 by x tiles
            return this.getTilesInside(bbox, z);
        }
        // @TODO
        return [
            {z: 2, x: 1, y: 1},
            {z: 2, x: 1, y: 2},
            {z: 2, x: 2, y: 1},
            {z: 2, x: 2, y: 2}
        ];
    }
}

const worldBbox = {latMin: -90, lonMin: -180, latMax: 90, lonMax: 180};

const grid = new GeoGrid(12, worldBbox);

const nrPixels = grid.countBottomUnder({z: 1, x: 1, y: 1});
const rows = Math.round(Math.sqrt(nrPixels));
const cols = rows;

const intensity$ = new RasterPyramid(grid, createFloatRaster(rows, cols), meanFunction);

const exposure$ = new RasterPyramid(grid, createExposureRaster(rows, cols), aggregateExposure);

const updatedExposure$ = new Pyramid(grid, updateExposure as any, [intensity$, exposure$], aggregateExposure);


export type ProductName = "intensity" | "exposure" | "updatedExposure";

function getPyramid(productName: ProductName): IPyramid<any> {
    switch (productName) {
        case "exposure":
            return exposure$;
        case "intensity":
            return intensity$;
        case "updatedExposure":
            return updatedExposure$;
    }
}


function getDataForBbox(ws: WebSocket, productName: ProductName, bbox: Bbox) {
    const locations = grid.getTilesInside(bbox);
    const pyramid = getPyramid(productName);
    const streams = locations.map(l => {
        return { location: l, stream: pyramid.getEstimateStreamAt(l) };
    });

    // function loop() {
    //     const estimates = streams.map(s => {
    //         return {location: s.location, estimate: s.stream.next()}
    //     });
    //     ws.send(JSON.stringify(estimates));
    //     setTimeout(loop, 100);
    // }
    // loop();

}


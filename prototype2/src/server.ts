import { createExposureRaster, createFloatRaster, reduce, updateExposure } from "./busineslogic";
import { IEstimateStream, LocationToEstimateStream, Grid, createEstimateStream, createRasterStream } from "./pyramids.generic"

interface Bbox {
    latMin: number,
    lonMin: number,
    latMax: number,
    lonMax: number
}

class GeoPyramid extends Grid {
    constructor(nrLevels: number, private bbox: Bbox) {
        super(nrLevels);
    }

    public getTilesInside(bbox: Bbox): ZXY[] {
        
    }
}


const worldBbox = {latMin: -90, lonMin: -180, latMax: 90, lonMax: 180};

const pyramid = new GeoPyramid(12, worldBbox);




function getDataForBbox(ws: WebSocket, productName: ProductName, bbox: Bbox) {
    const locations = pyramid.getTilesInside(bbox);
    const streamFactory = getStreamFactory(productName);
    const streams = locations.map(l => {
        return { location: l, stream: streamFactory(l) };
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

export type ProductName = "intensity" | "exposure" | "updatedExposure";

function getStreamFactory(productName: ProductName): LocationToEstimateStream<any> {
    switch (productName) {
        case "exposure":
            return exposure$;
        case "intensity":
            return intensity$;
        case "updatedExposure":
            return updatedExposure$;
    }
}

const nrPixels = pyramid.countBottomUnder({z: 1, x: 1, y: 1});
const rows = Math.round(Math.sqrt(nrPixels));
const cols = rows;

const intensity$ = createRasterStream(createFloatRaster(rows, cols));

const exposure$ = createRasterStream(createExposureRaster(rows, cols));

const updatedExposure$ = createEstimateStream(updateExposure as any, [intensity$, exposure$], reduce, pyramid);
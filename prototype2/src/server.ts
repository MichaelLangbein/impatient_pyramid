import { createExposureRaster, createFloatRaster, aggregateExposure, updateExposure } from "./businessLogic";
import { Grid, Pyramid, IPyramid, RasterPyramid, meanFunction, ZXY } from "./pyramids.generic"
import express from 'express';


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
            // @TODO: if not given, pick z such that you return x by 8 or 8 by x tiles
            z = 4;
            return this.getTilesInside(bbox, z);
        }
        // @TODO
        return [
            {z, x: 1, y: 1},
            {z, x: 1, y: 2},
            {z, x: 2, y: 1},
            {z, x: 2, y: 2}
        ];
    }

    
    public getBboxFor(location: ZXY): Bbox {
        const {rows, cols} = this.rowsColsAtLevel(location.z);

        const widthTotal = this.bbox.lonMax - this.bbox.lonMin;
        const width = widthTotal / cols;
        const startW = this.bbox.lonMin + location.x * width;

        const heightTotal = this.bbox.latMax - this.bbox.latMin;
        const height = heightTotal / rows;
        const startH = this.bbox.latMin + location.x * height;

        return {
            lonMin: startW,
            lonMax: startW + width,
            latMin: startH,
            latMax: startH + height
        };
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


function getDataForBbox(productName: ProductName, bbox: Bbox) {
    const pyramid = getPyramid(productName);
    const locations = grid.getTilesInside(bbox);
    const results = locations.map(l => {
        return { 
            location: l, 
            bbox: grid.getBboxFor(l),
            estimate: pyramid.getEstimateStreamAt(l).next() 
        };
    });
    return results;
}


const server = express();

function parseStringToProductName(str: string): ProductName | undefined {
    switch (str) {
        case "exposure":
            return "exposure";
        case "intensity":
            return "intensity";
        case "updatedExposure":
            return "updatedExposure";
        default:
            return undefined;
    }
}

function parseStringToBbox(str: any): Bbox | undefined {
    if (typeof str !== "string") return undefined;
    try {
        const [lonMin, latMin, lonMax, latMax] = str.split(',').map(v => parseFloat(v));
        const bbox = {latMin, lonMin, latMax, lonMax};
        return bbox;   
    } catch (error) {
        return undefined;
    }
}

server.get(`/:productName`, (req, res) => {
    const productName = parseStringToProductName(req.params.productName);
    if (!productName) res.send(`Unknown product ${req.params.productName}`);
    const bbox = parseStringToBbox(req.query.bbox);
    if (!bbox) res.send(`Couldn't parse bbox: ${req.query.bbox}`);
    const data = getDataForBbox(productName!, bbox!);

    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.header("Access-Control-Allow-HEADERS", "*");
    res.send(data);
});

server.listen(3000, () => console.log(`Server listening on port 3000`));


// const server = new WebSocketServer({
//     port: 1234
// });
// server.on('connection', (socket, request) => {
//     socket.onmessage = (ev) => {
//         const {product, bbox} = JSON.parse(ev.data.toString());
//         const response = getDataForBbox(product, bbox);
//         socket.send(JSON.stringify(response));
//     }
// });

// const client = new WebSocket(`ws://localhost:1234`);
// client.onopen = (ev) => {
//     console.log("Client has connected");
//     client.send(JSON.stringify({ product: "exposure", bbox: worldBbox }));
// }

import { createExposureRaster, createIntensityRaster, aggregateExposure, updateExposure } from "./businessLogic";
import { Grid, Pyramid, IPyramid, RasterPyramid, meanFunction, ZXY } from "./pyramids"
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

    public getTilesInside(bbox: Bbox, z: number): ZXY[] {
/**
 *              bbox.lonMin         bbox.lonMax 
 *                        |          |             
 *    fullBbox.lonMin     |          |                       fullBbox.latMin
 *    |-------------------|----------|-----------------------|
 *    0                                                      cols
 * 
 *    colStart = bbox.lonMin / (fullBbox.lonMax - fullBbox.lonMin) * cols
 */

        const fullBbox = this.bbox;
        const {rows, cols} = this.rowsColsAtLevel(z);
        let colStart = Math.floor(cols * (bbox.lonMin - fullBbox.lonMin) / (fullBbox.lonMax - fullBbox.lonMin) );
        let colEnd   = Math.ceil( cols * (bbox.lonMax - fullBbox.lonMin) / (fullBbox.lonMax - fullBbox.lonMin) );
        let rowStart = Math.floor(rows * (bbox.latMin - fullBbox.latMin) / (fullBbox.latMax - fullBbox.latMin) );
        let rowEnd   = Math.ceil( rows * (bbox.latMax - fullBbox.latMin) / (fullBbox.latMax - fullBbox.latMin) );
        colStart     = Math.max(colStart, 1);
        colEnd       = Math.min(colEnd, cols);
        rowStart     = Math.max(rowStart, 1);
        rowEnd       = Math.min(rowEnd, rows);

        const locations: ZXY[] = [];
        for (let row = rowStart; row <= rowEnd; row++) {
            for (let col = colStart; col <= colEnd; col++) {
                locations.push({z, x: col, y: row});
            }
        }

        return locations;
    }

    
    public getBboxFor(location: ZXY): Bbox {
        const {rows, cols} = this.rowsColsAtLevel(location.z);

        const widthTotal = this.bbox.lonMax - this.bbox.lonMin;
        const width = widthTotal / cols;
        const startW = this.bbox.lonMin + location.x * width;

        const heightTotal = this.bbox.latMax - this.bbox.latMin;
        const height = heightTotal / rows;
        const startH = this.bbox.latMin + location.y * height;

        return {
            lonMin: startW,
            lonMax: startW + width,
            latMin: startH,
            latMax: startH + height
        };
    }
}

const worldBbox = {latMin: -10, lonMin: -10, latMax: 10, lonMax: 10};

const grid = new GeoGrid(12, worldBbox);

const nrPixels = grid.countBottomUnder({z: 1, x: 1, y: 1});
const rows = Math.round(Math.sqrt(nrPixels));
const cols = rows;

const intensity$ = new RasterPyramid(grid, createIntensityRaster(rows, cols), meanFunction);

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


function getDataForBbox(productName: ProductName, bbox: Bbox, z: number) {
    const pyramid = getPyramid(productName);
    const locations = grid.getTilesInside(bbox, z);
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

function parseStringIntoZ(str: any): number | undefined {
    return parseFloat(str);
}

server.get(`/:productName`, (req, res) => {
    const productName = parseStringToProductName(req.params.productName);
    if (!productName) res.send(`Unknown product ${req.params.productName}`);
    const bbox = parseStringToBbox(req.query.bbox);
    if (!bbox) res.send(`Couldn't parse bbox: ${req.query.bbox}`);
    const z = parseStringIntoZ(req.query.z);
    if (!z) res.send(`Couldn't parse z: ${req.query.z}`);
    const data = getDataForBbox(productName!, bbox!, z!);

    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.header("Access-Control-Allow-HEADERS", "*");
    res.send(data);
});

server.listen(3000, () => console.log(`Server listening on port 3000`));


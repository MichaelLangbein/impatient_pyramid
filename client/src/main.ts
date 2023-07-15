import './style.css';
import 'ol/ol.css';
import { Feature, Map, MapBrowserEvent, Overlay, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import config from "./config.json";





/**********************************************
 *   STATE
 *********************************************/

interface State {
  layer: "exposure" | "intensity" | "updatedExposure"
}

const state: State = {
  layer: "exposure"
};

/**********************************************
 *   INTERACTIVE COMPONENTS
 *********************************************/


const appDiv                = document.getElementById("app") as HTMLDivElement;
const popupDiv              = document.getElementById("popup") as HTMLDivElement;
const exposureDiv           = document.getElementById("controlExposure") as HTMLDivElement;
const intensityDiv          = document.getElementById("controlIntensity") as HTMLDivElement;
const updatedExposureDiv    = document.getElementById("controlUpdatedExposure") as HTMLDivElement;

/**********************************************
 *   SETUP
 *********************************************/


const baseLayer = new TileLayer({
  source: new OSM({
    // url: "https://tile-{a-c}.openstreetmap.fr/hot/{z}/{x}/{y}.png"
  }),
  className: 'bw',
  opacity: 0.7
});


const exposureLayer = new VectorLayer({
  source: new VectorSource({}),
  opacity: 0.8
});

const intensityLayer = new VectorLayer({
  source: new VectorSource({}),
  opacity: 0.8
});

const updatedExposureLayer = new VectorLayer({
  source: new VectorSource({}),
  opacity: 0.8
});


const view = new View({
  center: [0, 0],
  zoom: 1,
  projection: 'EPSG:4326'
});

const popupOverlay = new Overlay({
  element: popupDiv
});

const map = new Map({
  view, layers: [
    // baseLayer,
    exposureLayer,
    intensityLayer,
    updatedExposureLayer
  ],
    overlays: [popupOverlay], target: appDiv
});


async function loop() {
  const [lonMin, latMin, lonMax, latMax] = view.calculateExtent(map.getSize());
  const bboxString = `${lonMin},${latMin},${lonMax},${latMax}`;
  
  const response = await fetch(`${config.server}/${state.layer}?bbox=${bboxString}`);
  const parsedResponse = await response.json();
  
  const geoJson = parseTilesIntoFeatures(parsedResponse);
  
  const newSource = new VectorSource({
    features: new GeoJSON().readFeatures(geoJson)
  });
  if (state.layer === "exposure") exposureLayer.setSource(newSource);
  if (state.layer === "intensity") intensityLayer.setSource(newSource);
  if (state.layer === "updatedExposure") updatedExposureLayer.setSource(newSource);
  
  setTimeout(loop, 5000);
}
loop();


interface ZXY {
  x: number, y: number, z: number
}
interface Bbox {
  latMin: number, lonMin: number, latMax: number, lonMax: number
}
interface Estimate {
  degree: number, estimate: any
}
interface LocatedEstimate {
  location: ZXY, estimate: Estimate, bbox: Bbox
}

function parseTilesIntoFeatures(inputs: LocatedEstimate[]): Feature[] {
  const collection: any = {type: "FeatureCollection", features: []};
  for (const input of inputs) {
    const feature = {
      type: "Feature",
      properties: input.estimate,
      geometry: {
        type: "Polygon",
        coordinates: [[
          [input.bbox.lonMin, input.bbox.latMin],
          [input.bbox.lonMax, input.bbox.latMin],
          [input.bbox.lonMax, input.bbox.latMax],
          [input.bbox.lonMin, input.bbox.latMax],
          [input.bbox.lonMin, input.bbox.latMin]
        ]]
      }
    };
    collection.features.push(feature);
  }
  return collection;
}

/**********************************************
 *   EVENTS
 *********************************************/


map.on("click", (evt: MapBrowserEvent<any>) => handleMapClick(evt));
exposureDiv.addEventListener("click", () => handleActivation("exposure"));
intensityDiv.addEventListener("click", () => handleActivation("intensity"));
updatedExposureDiv.addEventListener("click", () => handleActivation("updatedExposure"));


/**********************************************
 *   ACTIONS -> STATE
 *********************************************/


function handleMapClick(evt: MapBrowserEvent<any>) {

}

function handleActivation(layer: State["layer"]) {
  state.layer = layer;
  updateMap(state);
}

/**********************************************
 *   STATE -> UI
 *********************************************/

function updateMap(state: State) {
  if (state.layer === "exposure") {
    exposureLayer.setVisible(true);
    intensityLayer.setVisible(false);
    updatedExposureLayer.setVisible(false);
  }
  else if (state.layer === "intensity") {
    exposureLayer.setVisible(false);
    intensityLayer.setVisible(true);
    updatedExposureLayer.setVisible(false);
  }
  else if (state.layer === "updatedExposure") {
    exposureLayer.setVisible(false);
    intensityLayer.setVisible(false);
    updatedExposureLayer.setVisible(true);
  }
}


/**********************************************
 *   HELPERS
 *********************************************/

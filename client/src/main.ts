import './style.css';
import 'ol/ol.css';
import { Feature, Map, MapBrowserEvent, Overlay, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import config from "./config.json";
import Style from 'ol/style/Style';
import Fill from 'ol/style/Fill';
import Text from 'ol/style/Text';
import { ObjectEvent } from 'ol/Object';





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
  style: (feature) => {
    const props = feature.getProperties();
    return new Style({
      fill: new Fill({ color: `rgb(100, 100, 100)` }),
      text: new Text({
        text: `
        ${feature.getId()} \n
         degree: ${(props.degree * 100).toFixed(4)}%
        `,
        fill: new Fill({ color: `rgb(256, 256, 256)` }),
      })
    })
  },
  opacity: 0.6
});

const intensityLayer = new VectorLayer({
  source: new VectorSource({}),
  style: (feature) => {
    const props = feature.getProperties();
    const {r, g, b} = colorScale(props.estimate, 0, 1);
    return new Style({
      fill: new Fill({ color: `rgb(${r}, ${g}, ${b})` }),
      text: new Text({
        text: `
          ${feature.getId()} \n
          degree: ${(props.degree * 100).toFixed(4)}% \n
          intensity: ${props.estimate.toFixed(4)}
        `,
        fill: new Fill({ color: `rgb(256, 256, 256)` }),
      })
    })
  },
  opacity: 0.6,
});

const updatedExposureLayer = new VectorLayer({
  source: new VectorSource({}),
  style: (feature) => {
    const props = feature.getProperties();

    const sums = {d0: 0, d1: 0, d2: 0, d3: 0};
    for (const [material, states] of Object.entries(props.estimate.damage)) {
      const count = props.estimate.nrBuildings[material];
      for (const [damageClass, degree] of Object.entries(states as any)) {
        // @ts-ignore
        sums[damageClass] += degree * count;
      }
    }
    const countTotal = (Object.values(props.estimate.nrBuildings) as number[]).reduce((last, curr) => last + curr, 0);
    const damageClass = ((1 * sums.d0 + 2 * sums.d1 + 3 * sums.d2 + 4 * sums.d3) / countTotal) - 1;

    const {r, g, b} = colorScale(damageClass, 0, 3);
    return new Style({
      fill: new Fill({ color: `rgb(${r}, ${g}, ${b})` }),
      text: new Text({
        text: `
          ${feature.getId()} \n
          degree: ${(props.degree * 100).toFixed(4)}% \n
          Damage class: ${damageClass.toFixed(2)}
        `,
        fill: new Fill({ color: `rgb(256, 256, 256)` }),
      })
    })
  },
  opacity: 0.6
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

  try {
    const z = Math.round(view.getZoom() || 1) + 1;
    const [lonMin, latMin, lonMax, latMax] = view.calculateExtent(map.getSize());
    const bboxString = `${lonMin},${latMin},${lonMax},${latMax}`;
    
    const response = await fetch(`${config.server}/${state.layer}?bbox=${bboxString}&z=${z}`);
    const parsedResponse = await response.json();
    
    const geoJson = parseTilesIntoFeatures(parsedResponse);
    
    const newSource = new VectorSource({
      features: new GeoJSON().readFeatures(geoJson)
    });
    if (state.layer === "exposure") exposureLayer.setSource(newSource);
    if (state.layer === "intensity") intensityLayer.setSource(newSource);
    if (state.layer === "updatedExposure") updatedExposureLayer.setSource(newSource);    
  } 
  catch (error) {
    console.warn(error);
  }
  
  setTimeout(loop,1000);
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
      id: `${input.location.z}/${input.location.x}/${input.location.y}`,
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
  updateControl(state);
}

/**********************************************
 *   STATE -> UI
 *********************************************/

function updateControl(state: State) {
  if (state.layer === "exposure") {
    exposureDiv.classList.replace('inactive', 'active');
    intensityDiv.classList.replace('active', 'inactive');
    updatedExposureDiv.classList.replace('active', 'inactive');
  }
  else if (state.layer === "intensity") {
    exposureDiv.classList.replace('active', 'inactive');
    intensityDiv.classList.replace('inactive', 'active');
    updatedExposureDiv.classList.replace('active', 'inactive');
  }
  else if (state.layer === "updatedExposure") {
    exposureDiv.classList.replace('active', 'inactive');
    intensityDiv.classList.replace('active', 'inactive');
    updatedExposureDiv.classList.replace('inactive', 'active');
  }
}

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


function colorScale(val: number, from: number, to: number) {
  let r, g, b = 0;
  const degree = (val - from) / (to - from);
  r = 255 * degree;
  g = 255 * (1 - degree);
  return {r, g, b};
}

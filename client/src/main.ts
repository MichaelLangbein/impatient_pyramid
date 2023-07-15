import './style.css';
import 'ol/ol.css';
import { Map, MapBrowserEvent, Overlay, View } from 'ol';
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
  center: [11.3, 48.08],
  zoom: 14,
  projection: 'EPSG:4326'
});

const popupOverlay = new Overlay({
  element: popupDiv
});

const map = new Map({
  view, layers: [baseLayer, exposureLayer, intensityLayer, updatedExposureLayer], overlays: [popupOverlay], target: appDiv
});


async function loop() {
  const bbox = view
  const bboxString = `${},${},${},${}`;
  const response = await fetch(`${config.server}/${state.layer}?bbox=${bboxString}`);
  const parsedResponse = response.json();
  console.log(parsedResponse);
  setTimeout(loop, 5000);
}
loop();


/**********************************************
 *   EVENTS
 *********************************************/


map.on("click", (evt: MapBrowserEvent) => handleMapClick(evt));
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
    exposureLayer.visible(true);
    intensityLayer.visible(false);
    updatedExposureLayer.visible(false);
  }
  else if (state.layer === "intensity") {
    exposureLayer.visible(false);
    intensityLayer.visible(true);
    updatedExposureLayer.visible(false);
  }
  else if (state.layer === "updatedExposure") {
    exposureLayer.visible(false);
    intensityLayer.visible(false);
    updatedExposureLayer.visible(true);
  }
}


/**********************************************
 *   HELPERS
 *********************************************/

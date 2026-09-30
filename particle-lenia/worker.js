import {advance} from './core.js';
onmessage=({data})=>{try{const t=performance.now();const points=advance(data.points,data.params);postMessage({points,ms:performance.now()-t});}catch(e){postMessage({error:e.message});}};

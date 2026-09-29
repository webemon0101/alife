import {step} from './core.js';
onmessage=e=>{const {id,state,p,seed}=e.data;try{const result=step(state,p,seed);postMessage({id,state:result},result?[result.buffer]:[]);}catch(error){postMessage({id,error:String(error)});}};

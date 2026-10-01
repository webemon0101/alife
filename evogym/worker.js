import {evaluate,breed,validGenome} from './core.js';
// One candidate per task yields to the event loop; the UI can terminate the worker.
onmessage=async({data:d})=>{
  try{
    const start=performance.now();
    if(d.type==='validate'){
      if(!validGenome(d.genome))throw Error('Invalid creature');
      postMessage({type:'validated',...evaluate(d.genome)});return;
    }
    if(!Array.isArray(d.pop)||![12,24,48].includes(d.pop.length))throw Error('Invalid population');
    const rank=[];
    for(let i=0;i<d.pop.length;i++){
      const g=d.pop[i],r=evaluate(g);rank.push({g,...r});
      postMessage({type:'progress',done:i+1,total:d.pop.length});
      if(performance.now()-start>6000)throw Error('高負荷で停止。集団サイズを下げてください / High load: reduce population.');
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    rank.sort((a,b)=>b.score-a.score);const valid=rank.filter(r=>r.valid);
    postMessage({type:'generation',pop:breed(rank,rank.length,d.seed,d.rate,d.morph),best:valid[0]?.g||null,score:valid[0]?.score??null,mean:valid.length?valid.reduce((s,v)=>s+v.score,0)/valid.length:null,failed:rank.length-valid.length,ms:performance.now()-start});
  }catch(e){postMessage({type:'error',error:e.message});}
};

import {VERSION,DT,STEPS,COLORS,templates,validBody,validGenome,copy,initialPopulation,create,step,center,snapshot,parseSnapshot} from './core.js';
const $=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d');
let initial=templates.walker.slice(),draft=initial.slice(),pop=[],best=null,baseline=null,score=null,baselineScore=null,generation=0,history=[],baseSeed=42;
let running=false,busy=false,worker=null,timer,epoch=0,nextAt=0,slow=0,progress=0,failed=0;
let bodies=[],replayStep=0,replaying=!matchMedia('(prefers-reduced-motion: reduce)').matches,last=0,acc=0,loadId=0,validationWorker=null,validationTimer;
function notice(s){$('notice').textContent=s;$('notice').hidden=!s;}
function sync(){
  $('play').textContent=running?'進化を停止 / Pause':'進化を開始 / Start';
  $('progress').textContent=`世代 / Generation ${generation}${busy?' · 評価 / Evaluating '+progress+'/'+pop.length:''}${failed?' · 無効 / Invalid '+failed:''}`;
  $('scoreLabel').textContent=best?`Best ${score.toFixed(3)} · Baseline ${baselineScore.toFixed(3)} voxels`: '右へ進む体を探します / Find a body that travels right';
  $('bar').max=pop.length||24;$('bar').value=busy?progress:0;$('save').disabled=!best;
  $('replay').textContent=replaying?'再生を止める / Pause replay':'再生 / Replay';
}
function cancel(){epoch++;clearTimeout(timer);worker?.terminate();worker=null;busy=false;progress=0;}
function stop(){running=false;cancel();sync();}
function cancelLoad(){loadId++;clearTimeout(validationTimer);validationWorker?.terminate();validationWorker=null;$('importing').textContent='';$('play').disabled=$('step').disabled=false;}
function resetReplay(){const a=baseline||pop[0],b=best||pop[0];bodies=[create(a),create(b)];replayStep=0;acc=0;draw();}
function reset(){cancelLoad();stop();baseSeed=+$('seed').value;if(!Number.isInteger(baseSeed)||baseSeed<0||baseSeed>4294967295){baseSeed=42;$('seed').value='42';}pop=initialPopulation(initial,+$('population').value,baseSeed);best=baseline=null;score=baselineScore=null;generation=0;history=[];failed=0;slow=0;nextAt=0;notice('');resetReplay();sync();drawChart();}
function request(){
  if(busy||document.hidden||validationWorker)return;
  busy=true;progress=0;const token=epoch;worker=new Worker('./worker.js',{type:'module'});
  worker.onerror=()=>{if(token!==epoch)return;stop();notice('計算エラー。開始で再試行 / Calculation error; retry Start.');};
  worker.onmessage=({data:d})=>{
    if(token!==epoch)return;
    if(d.type==='progress'){progress=d.done;sync();return;}
    clearTimeout(timer);worker.terminate();worker=null;busy=false;
    if(d.type==='error'){stop();notice(d.error);return;}
    if(d.type!=='generation')return;
    pop=d.pop;generation++;failed=d.failed;
    if(d.best){if(!baseline){baseline=copy(d.best);baselineScore=d.score;}if(!best||d.score>score){const firstBest=!best;best=copy(d.best);score=d.score;if(firstBest||!replaying)resetReplay();}history.push([d.score,d.mean]);if(history.length>500)history.shift();}
    else {stop();notice('有効な個体がありません。別の体かシードで初期化してください / No valid creatures; try another body or seed.');}
    slow=d.ms>1000?slow+d.ms:Math.max(0,slow-500);nextAt=performance.now()+Math.max(250,d.ms);
    if(slow>5000){stop();notice('高負荷で停止。集団サイズ12で試してください / High load: try population 12.');}
    sync();drawChart();draw();
  };
  timer=setTimeout(()=>{stop();notice('評価が応答しないため停止 / Evaluation timeout');},8000);
  worker.postMessage({type:'generation',pop,rate:+$('mutation').value,morph:$('morph').checked,seed:(baseSeed+Math.imul(generation+1,2654435761))>>>0});sync();
}
function draw(){
  const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2),w=r.width,h=r.height;
  if(canvas.width!==Math.round(w*d)||canvas.height!==Math.round(h*d)){canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);}
  ctx.setTransform(d,0,0,d,0,0);ctx.fillStyle='#0b0d12';ctx.fillRect(0,0,w,h);
  const panel=Math.max(100,(h-180)/2),scale=Math.min(48,w/8,(panel-50)/5);
  bodies.forEach((b,j)=>{
    const top=55+j*panel,ground=top+panel-38,com=center(b),camera=com.x;
    ctx.fillStyle=j?'#5ad1c7':'#aab6c9';ctx.font='13px system-ui';ctx.fillText(j?(best?'最優秀の再生 / Champion replay':'初期体 / Starting body'):(baseline?'初代・比較の基準 / Baseline':'初期体 / Starting body'),14,top+12);
    ctx.font='11px system-ui';ctx.fillStyle='#8b93a3';ctx.fillText(`${(com.x-b.start).toFixed(2)} voxels  ·  ${b.cells.length} cells`,14,top+31);
    ctx.strokeStyle='#2c3747';ctx.beginPath();ctx.moveTo(0,ground);ctx.lineTo(w,ground);ctx.stroke();
    for(let k=Math.floor(camera-w/scale/2);k<camera+w/scale/2+1;k++){const x=w/2+(k-camera)*scale;ctx.fillStyle='#354253';ctx.fillRect(x,ground,1,7);ctx.font='10px monospace';ctx.fillText(k,x+2,ground+19);}
    const coords=b.points.map(p=>[w/2+(p.x-camera)*scale,ground-p.y*scale]);
    for(const cell of b.cells){const q=cell.ids.map(i=>coords[i]);ctx.beginPath();ctx.moveTo(...q[0]);for(let i=1;i<4;i++)ctx.lineTo(...q[i]);ctx.closePath();ctx.fillStyle=COLORS[cell.type];ctx.globalAlpha=j?.88:.6;ctx.fill();ctx.globalAlpha=1;ctx.strokeStyle='#101925';ctx.lineWidth=1.5;ctx.stroke();
      if(cell.type>=3){const a=cell.type===3?[0,3]:[0,1],z=cell.type===3?[1,2]:[3,2];ctx.strokeStyle='#ffffff66';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo((q[a[0]][0]+q[a[1]][0])/2,(q[a[0]][1]+q[a[1]][1])/2);ctx.lineTo((q[z[0]][0]+q[z[1]][0])/2,(q[z[0]][1]+q[z[1]][1])/2);ctx.stroke();}
    }
    // Fixed design thumbnail makes morphology changes visible during motion.
    const s=6,x=w-43,y=top+2;b.g.body.forEach((v,i)=>{ctx.fillStyle=COLORS[v];ctx.fillRect(x+(i%5)*s,y+Math.floor(i/5)*s,s-1,s-1);});
    if(b.invalid){ctx.fillStyle='#eeac54';ctx.fillText('無効な形 / Invalid physics',14,top+48);}
  });
  $('stats').textContent=best?`${replaying?'Replay':'Paused'} · ${(replayStep*DT).toFixed(1)} / 6.0 s`:'体を描く、または進化を開始 / Draw a body or start evolution';
}
function drawChart(){const c=$('chart'),x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);if(!history.length)return;const lo=Math.min(0,...history.flat()),hi=Math.max(.1,...history.flat());for(let j=1;j>=0;j--){x.strokeStyle=j?'#8994a6':'#5ad1c7';x.beginPath();history.forEach((v,i)=>{const px=8+i/Math.max(1,history.length-1)*264,py=105-(v[j]-lo)/(hi-lo)*86;i?x.lineTo(px,py):x.moveTo(px,py);});x.stroke();}x.fillStyle='#8994a6';x.font='10px system-ui';x.fillText(hi.toFixed(2)+' voxels',5,11);}
function editor(){const el=$('editor');el.replaceChildren();draft.forEach((v,i)=>{const b=document.createElement('button');b.type='button';b.style.background=COLORS[v];b.textContent=['','■','~','↔','↕'][v];b.setAttribute('aria-label',`Row ${Math.floor(i/5)+1}, column ${i%5+1}, ${['empty','rigid','soft','horizontal','vertical'][v]}`);b.onclick=()=>{draft[i]=+$('material').value;editor();$('editor').children[i].focus();};el.append(b);});}
function frame(t){const dt=Math.min(80,t-last);last=t;
  if(!document.hidden){if(running&&!busy&&t>=nextAt)request();if(replaying&&best){const start=performance.now();acc=Math.min(80,acc+dt);let n=0;while(acc>=DT*1000&&n++<20){step(bodies[0]);step(bodies[1]);replayStep++;acc-=DT*1000;if(replayStep>=STEPS){resetReplay();break;}}if(performance.now()-start>80){replaying=false;stop();notice('再生の負荷が高いため停止 / Replay paused under high load');sync();}draw();}}
  requestAnimationFrame(frame);
}
$('play').onclick=()=>{if(running)stop();else{running=true;slow=0;notice('');sync();}};
$('step').onclick=()=>{stop();request();};$('reset').onclick=reset;$('population').onchange=reset;
$('mutation').oninput=()=>$('mutationVal').value=(+$('mutation').value).toFixed(2);
$('template').onchange=()=>{draft=templates[$('template').value].slice();editor();};
$('apply').onclick=()=>{if(!validBody(draft)){notice('体は辺でつながる4セル以上＋筋肉1個以上にしてください / Use 4+ connected cells with a muscle.');return;}initial=draft.slice();reset();};
$('replay').onclick=()=>{replaying=!replaying;acc=0;sync();draw();};
$('menuToggle').onclick=()=>{const open=$('sidebar').classList.toggle('open');$('sidebarBackdrop').classList.toggle('open',open);$('menuToggle').setAttribute('aria-expanded',open);};
function closeMenu(){$('sidebar').classList.remove('open');$('sidebarBackdrop').classList.remove('open');$('menuToggle').setAttribute('aria-expanded','false');}
$('sidebarBackdrop').onclick=closeMenu;addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});addEventListener('resize',draw);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancel();cancelLoad();}acc=0;sync();});
$('save').onclick=()=>{if(!best)return;const data={...snapshot(best),baseline:copy(baseline)},url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='voxel-creature-'+generation+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function restore(data,id){
  let g,base;try{g=parseSnapshot(data);base=data.baseline===undefined?copy(g):data.baseline;if(!validGenome(base))throw Error('Invalid baseline');}catch(e){if(id===loadId)notice(e.message);return;}
  if(id!==loadId)return;stop();$('importing').textContent='個体を検証中 / Checking creature…';$('play').disabled=$('step').disabled=true;
  validationWorker=new Worker('./worker.js',{type:'module'});const results=[];let stage=0;
  const fail=msg=>{if(id!==loadId)return;cancelLoad();notice(msg);sync();};
  validationWorker.onerror=()=>fail('個体の検証に失敗しました / Validation failed');
  validationWorker.onmessage=({data:d})=>{
    if(id!==loadId)return;if(d.type==='error'||!d.valid){fail('この個体は物理検証に失敗しました。現在の個体は保持 / Invalid physics; current creature retained.');return;}
    results.push(d.score);if(stage++===0){validationWorker.postMessage({type:'validate',genome:base});return;}
    cancelLoad();best=copy(g);baseline=copy(base);score=results[0];baselineScore=results[1];initial=g.body.slice();draft=initial.slice();pop=Array.from({length:+$('population').value},()=>copy(g));generation=0;history=[];failed=0;slow=0;resetReplay();editor();sync();drawChart();notice('個体を復元。開始するとこの体と脳から新しく進化 / Loaded. Start a new search from this creature.');
  };
  validationTimer=setTimeout(()=>fail('個体の検証がタイムアウト / Validation timeout'),8000);validationWorker.postMessage({type:'validate',genome:g});
}
async function load(file){cancelLoad();const id=loadId;try{if(!file||file.size>100000)throw Error('ファイルが大きすぎます / File too large');const d=JSON.parse(await file.text());if(id===loadId)restore(d,id);}catch{if(id===loadId)notice('対応するJSON個体ファイルを選んでください / Choose a valid creature JSON file.');}}
$('open').onclick=()=>$('file').click();$('file').onchange=()=>{load($('file').files[0]);$('file').value='';};
addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();});addEventListener('drop',e=>{if(e.dataTransfer.files.length){e.preventDefault();if(e.dataTransfer.files.length===1)load(e.dataTransfer.files[0]);else notice('1個のJSONファイルをドロップしてください / Drop one JSON file');}});
$('demo').onclick=async()=>{cancelLoad();const id=loadId;try{const response=await fetch('./example.json');if(!response.ok)throw Error();const data=await response.json();if(id===loadId)restore(data,id);}catch{if(id===loadId)notice('進化例を読み込めませんでした / Could not load example.');}};
editor();reset();requestAnimationFrame(frame);

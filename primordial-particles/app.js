import {initial,random} from './core.js';
const $=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d'),colors=['#73d595','#b58650','#69b9ff','#ffd269','#e887d8'];
let state=new Float64Array(),p={w:160,h:160,r:5,alpha:180,beta:17,v:.67,loop:true,sequential:true},epoch=0,busy=false,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,steps=0,seed=8128,dirty=true,last=null,acc=0,slow=0,interval=1000/30,gpu=null,gpuChecked=false,worker=null,pending=null,seeds=null,zoom=1;
const presets={colony:['生態系 / Ecosystem',2048,160,'細胞が育った状態から観察。形の維持・分裂・崩壊を追えます。 / A developed ecosystem.'],soup:['原始のスープ / Primordial soup',2048,160,'ランダムな粒子から自然発生を観察。数百〜数千ステップかかります。 / Start from random particles.'],spore:['胞子 / Spore',500,100,'密な小さな塊から観察。周囲の密度によって成長や崩壊が変わります。 / A compact spore in a sparse habitat.'],ring:['リング状細胞 / Ring cell',500,100,'輪状の構造を観察。ズームすると粒子の動きが見えます。 / Inspect a ring-shaped cell.'],triangle:['三角形細胞 / Triangle cell',500,100,'内側と外側の粒子からなる細胞の一例。形は変化します。 / A triangular cell; its shape evolves.']};
for(const [value,[name]] of Object.entries(presets))$('preset').add(new Option(name,value));
function usingGPU(){return !p.sequential&&gpu&&$('compute').value!=='cpu';}
function status(){ $('backend').textContent=p.sequential?'CPU · 原論文方式 / Sequential':usingGPU()?'GPU · 同時更新 / Synchronous':gpuChecked?'CPU · 同時更新 / Synchronous':'GPU確認中 / Checking GPU…';$('gpuOption').disabled=!gpu;$('ruleNote').textContent=p.sequential?'原論文と同じく、順番を毎回シャッフルして1粒子ずつ更新。 / Random sequential updates.':'同時更新の派生版です。原論文方式とは構造や寿命が変わります。 / Synchronous variant: patterns and lifetimes differ.';}
function invalidate(){epoch++;acc=0;last=null;dirty=true;slow=0;}
function play(value){paused=value;invalidate();$('play').textContent=paused?'▶ 再生 / Play':'⏸ 一時停止 / Pause';}
function warn(text){play(true);$('noticeText').textContent=text;$('notice').hidden=false;}
function clearNotice(){$('notice').hidden=true;}
function fallback(){const active=usingGPU(),old=gpu;gpu=null;old?.destroy();gpuChecked=true;if(!active){status();return;}$('compute').value='cpu';status();warn('GPUが応答しないため、状態を保持してCPUへ切り替えました。再生で再開できます。 / GPU unavailable; paused on CPU.');}
function cpuStep(a,params,id){
 if(!worker){worker=new Worker('./worker.js',{type:'module'});worker.onmessage=e=>{if(pending&&pending.id===e.data.id){const done=pending;pending=null;e.data.error?done.reject(Error(e.data.error)):done.resolve(e.data.state);}};worker.onerror=()=>{if(pending){pending.reject(Error('CPU worker failed'));pending=null;}worker?.terminate();worker=null;};}
 return new Promise((resolve,reject)=>{pending={id,resolve,reject};worker.postMessage({id,state:a,p:params,seed:seed+steps});});
}
async function update(single=false){
 if(busy||(!single&&paused)||document.hidden||!state.length)return;
 busy=true;const token=epoch,engine=usingGPU()?gpu:null,started=performance.now();let timedOut=false;
 const timeout=setTimeout(()=>{timedOut=true;if(engine&&gpu===engine)fallback();else{worker?.terminate();worker=null;if(pending){pending.reject(Error('CPU timeout'));pending=null;}warn('計算に時間がかかったため停止しました。粒子を減らして再開してください。 / Calculation timed out.');}},2000);
 try{
  const next=engine?await engine.step(state,p):await cpuStep(state,{...p},token);
  if(token!==epoch||document.hidden||timedOut)return;
  if(!next){warn('計算負荷が高いため停止しました。粒子を減らして再開してください。 / High load; reduce particles.');return;}
  state=next;steps++;dirty=true;const elapsed=performance.now()-started;
  if(elapsed>50){interval=Math.min(200,Math.max(interval,elapsed*1.25));slow+=elapsed;}else slow=Math.max(0,slow-50);
  if(elapsed>500||slow>3000)warn('計算負荷が高いため停止しました。粒子を減らして再開できます。 / Paused due to sustained load.');
 }catch(e){if(token===epoch&&!timedOut){if(engine&&gpu===engine)fallback();else warn('計算を停止しました。リセットまたは粒子を減らして再開してください。 / Calculation stopped.');}}
 finally{clearTimeout(timeout);busy=false;}
}
function labels(){for(const id of ['count','size','alpha','beta','radius','velocity','rate','zoom'])$(id+'Val').textContent=$(id).value;$('density').textContent=`密度 / Density ${(state.length/4/(p.w*p.h)).toFixed(3)} · ${p.w.toFixed(1)} × ${p.h.toFixed(1)}`;}
function reset(){
 if(!seeds)return;invalidate();clearNotice();steps=0;interval=1000/Number($('rate').value);const name=$('preset').value,[,n,w,note]=presets[name];p={...p,w,h:w,r:5,alpha:180,beta:17,v:.67};
 $('count').value=n;$('alpha').value=180;$('beta').value=17;$('radius').value=5;$('velocity').value=.67;zoom=1;$('zoom').value=1;
 if(name==='colony')state=new Float64Array(seeds.colony);else{state=initial(n,w,w,seed);if(seeds[name]){const data=seeds[name],rng=random(seed+2);for(let i=0;i<n;i++){while(Math.hypot(state[i*4]-w/2,state[i*4+1]-w/2)<12){state[i*4]=rng()*w;state[i*4+1]=rng()*w;}}for(let i=0;i<data.length;i+=4){state[i]=data[i]+w/2;state[i+1]=data[i+1]+w/2;state[i+2]=data[i+2];state[i+3]=data[i+3];}}}
 $('presetNote').textContent=note;labels();status();
}
function resizeCount(n){invalidate();clearNotice();const a=initial(n,p.w,p.h,++seed);a.set(state.subarray(0,Math.min(a.length,state.length)));state=a;$('count').value=n;labels();}
function render(){const w=canvas.width,h=canvas.height,s=Math.min(w/p.w,h/p.h)*zoom,ox=w/2-p.w*s/2,oy=h/2-p.h*s/2;ctx.fillStyle='#070b11';ctx.fillRect(0,0,w,h);ctx.save();ctx.beginPath();ctx.rect(Math.max(0,ox),Math.max(0,oy),Math.min(w,p.w*s),Math.min(h,p.h*s));ctx.clip();
 for(let c=0;c<colors.length;c++){ctx.fillStyle=colors[c];ctx.beginPath();for(let i=0;i<state.length;i+=4){if(state[i+3]!==c)continue;const x=ox+state[i]*s,y=oy+state[i+1]*s,r=Number($('size').value)*Math.min(devicePixelRatio||1,2);if(x< -r||x>w+r||y< -r||y>h+r)continue;ctx.moveTo(x+r,y);ctx.arc(x,y,r,0,Math.PI*2);}ctx.fill();}ctx.restore();ctx.strokeStyle='#293746';ctx.strokeRect(ox,oy,p.w*s,p.h*s);$('stats').textContent=`${paused?'Paused':'Running'} · ${steps.toLocaleString()} steps · N=${state.length/4} · ${usingGPU()?'GPU':'CPU'}`;dirty=false;}
function resize(){const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));dirty=true;}
function loop(time){if(document.hidden){last=null;acc=0;requestAnimationFrame(loop);return;}if(last===null)last=time;const dt=Math.min(250,time-last);last=time;if(!paused){acc=Math.min(acc+dt,interval*2);if(acc+.000001>=interval&&!busy){acc=Math.max(0,acc-interval);update();}}else acc=0;if(dirty){const start=performance.now();render();if(!paused&&performance.now()-start>120)warn('描画負荷が高いため停止しました。粒子数や大きさを減らしてください。 / Rendering is slow.');}requestAnimationFrame(loop);}
$('play').onclick=()=>{clearNotice();play(!paused);};$('step').onclick=()=>{play(true);update(true);};$('reset').onclick=reset;$('shuffle').onclick=()=>{seed=(Math.random()*4294967296)>>>0;$('preset').value='soup';reset();};$('preset').onchange=reset;
$('count').oninput=labels;$('count').onchange=()=>resizeCount(Number($('count').value));$('reduce').onclick=()=>{resizeCount(Math.max(100,Math.floor(state.length/8/10)*10));play(true);};$('resume').onclick=()=>{clearNotice();interval=1000/Number($('rate').value);play(false);};
for(const id of ['size','zoom'])$(id).oninput=()=>{zoom=Number($('zoom').value);dirty=true;labels();};
for(const [id,key] of [['alpha','alpha'],['beta','beta'],['radius','r'],['velocity','v']])$(id).oninput=()=>{invalidate();p[key]=Number($(id).value);labels();};
$('rate').oninput=()=>{interval=1000/Number($('rate').value);acc=0;labels();};
$('boundary').onchange=()=>{invalidate();p.loop=$('boundary').value==='loop';};
$('compute').onchange=()=>{invalidate();p.sequential=$('compute').value==='paper';clearNotice();interval=1000/Number($('rate').value);status();};
function menu(open){$('sidebar').classList.toggle('open',open);$('sidebarBackdrop').classList.toggle('open',open);$('menuToggle').setAttribute('aria-expanded',String(open));}
$('menuToggle').onclick=()=>menu(!$('sidebar').classList.contains('open'));$('sidebarBackdrop').onclick=()=>menu(false);document.addEventListener('keydown',e=>{if(e.key==='Escape')menu(false);});
document.addEventListener('visibilitychange',invalidate);window.addEventListener('resize',resize);
async function init(){try{const response=await fetch('./presets.json');if(!response.ok)throw Error('presets');seeds=await response.json();reset();$('loading').hidden=true;$('controls').disabled=false;resize();play(paused);requestAnimationFrame(loop);}catch(e){$('loading').textContent='読み込めませんでした。ページを再読み込みしてください。 / Reload to retry.';}
 try{const {createGPU}=await import('./gpu.js');gpu=await createGPU(fallback);}catch(e){gpu=null;}gpuChecked=true;status();}
init();

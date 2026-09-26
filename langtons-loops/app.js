import {LoopWorld} from './core.js';

const $=id=>document.getElementById(id);
const world=new LoopWorld();
const canvas=$('canvas'),ctx=canvas.getContext('2d');
const colors=['#0b0d12','#579bf0','#ed6479','#72d6bb','#f6c85f','#c999ed','#f59a65','#f2f3f7'];
const layer=document.createElement('canvas');layer.width=layer.height=world.size;
const lctx=layer.getContext('2d'),pixels=lctx.createImageData(world.size,world.size);
const rgb=colors.map(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)));
const small=matchMedia('(max-width:760px)');
let running=!matchMedia('(prefers-reduced-motion:reduce)').matches,busy=false,epoch=0;
let width=1,height=1,cx=80,cy=80,scale=10,last=0,credit=0,dirty=true,drag=null;
for(let i=0;i<colors.length;i++) {
  const el=document.createElement('span');el.textContent=i;el.style.borderColor=colors[i];$('legend').append(el);
}
function pause(){running=false;credit=0;sync();}
function sync(){
  $('play').textContent=running?'一時停止 / Pause':'再生 / Play';
  for(const id of ['play','step','advance','colony','preset','clear','tool','rotation','state'])$(id).disabled=busy;
  $('stageHint').textContent=busy?'計算中… リセットで中止 / Computing… Reset to cancel':
    $('tool').value==='pan'?'ドラッグで移動 · ホイールで拡大 / Drag to pan · Scroll to zoom':'タップ・ドラッグで編集 / Tap or drag to edit';
}
function cancel(){epoch++;busy=false;credit=0;sync();}
function fit(){
  const b=world.bounds();
  if(b.count){cx=(b.x0+b.x1+1)/2;cy=(b.y0+b.y1+1)/2;scale=Math.min(24,width/Math.max(36,b.x1-b.x0+14),(height-150)/Math.max(36,b.y1-b.y0+14));}
  else{cx=cy=world.size/2;scale=Math.min(width,height-150)/world.size;}
  scale=Math.max(.5,scale);$('zoom').value=Math.max(2,scale);dirty=true;
}
function reset(){
  cancel();world.clear();
  if($('preset').value==='pair'){world.place(59,80);world.place(101,80,2);}
  else world.place(80,80);
  $('notice').textContent='';fit();sync();
}
function resize(){
  const r=canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);
  width=r.width;height=r.height;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);dirty=true;
}
function draw(){
  for(let i=0;i<world.cells.length;i++){
    const c=rgb[world.cells[i]],p=i*4;pixels.data[p]=c[0];pixels.data[p+1]=c[1];pixels.data[p+2]=c[2];pixels.data[p+3]=255;
  }
  lctx.putImageData(pixels,0,0);ctx.fillStyle='#060708';ctx.fillRect(0,0,width,height);
  const left=width/2-cx*scale,top=height/2-cy*scale;
  ctx.imageSmoothingEnabled=false;ctx.drawImage(layer,left,top,world.size*scale,world.size*scale);
  ctx.strokeStyle='#343d4e';ctx.lineWidth=1;ctx.strokeRect(left,top,world.size*scale,world.size*scale);
  if(scale>=13){
    ctx.strokeStyle='#ffffff0c';ctx.beginPath();
    for(let x=Math.max(0,Math.floor(-left/scale));x<=Math.min(world.size,(width-left)/scale);x++){const px=left+x*scale;ctx.moveTo(px,Math.max(0,top));ctx.lineTo(px,Math.min(height,top+world.size*scale));}
    for(let y=Math.max(0,Math.floor(-top/scale));y<=Math.min(world.size,(height-top)/scale);y++){const py=top+y*scale;ctx.moveTo(Math.max(0,left),py);ctx.lineTo(Math.min(width,left+world.size*scale),py);}ctx.stroke();
  }
  const b=world.bounds();$('stats').textContent=`${world.steps.toLocaleString('en-US')} steps · ${b.count.toLocaleString('en-US')} cells (states 1–7)`;
  dirty=false;
}
async function advance(n){
  pause();busy=true;const token=++epoch;sync();let remaining=n;
  while(remaining>0 && token===epoch){
    const start=performance.now();do{world.step();remaining--;}while(remaining>0 && performance.now()-start<8);
    dirty=true;await new Promise(resolve=>requestAnimationFrame(resolve));
  }
  if(token===epoch){busy=false;fit();sync();}
}
function frame(now){
  const dt=last?Math.min(.1,(now-last)/1000):0;last=now;
  if(running&&!busy&&!document.hidden){
    credit=Math.min(120,credit+dt*Number($('speed').value));const start=performance.now();
    while(credit>=1 && performance.now()-start<8){world.step();credit--;dirty=true;}
  }
  if(dirty)draw();requestAnimationFrame(frame);
}
function setMenu(open){
  open=small.matches&&open;$('sidebar').classList.toggle('open',open);$('sidebarBackdrop').classList.toggle('open',open);
  $('menuToggle').setAttribute('aria-expanded',String(open));$('sidebar').inert=small.matches&&!open;
}
$('menuToggle').onclick=()=>setMenu(!$('sidebar').classList.contains('open'));
$('sidebarBackdrop').onclick=()=>setMenu(false);
small.addEventListener('change',()=>setMenu(false));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('menuToggle').focus();setMenu(false);}});
document.addEventListener('visibilitychange',()=>{last=0;credit=0;});
$('play').onclick=()=>{running=!running;credit=0;sync();};
$('step').onclick=()=>{pause();world.step();dirty=true;};
$('reset').onclick=reset;
$('preset').onchange=reset;
$('advance').onclick=()=>advance(151);
$('colony').onclick=()=>advance(1000);
$('clear').onclick=()=>{cancel();pause();world.clear();$('notice').textContent='';dirty=true;};
$('tool').onchange=()=>{sync();$('notice').textContent='';};
$('zoom').oninput=()=>{scale=Number($('zoom').value);dirty=true;};
$('fit').onclick=fit;
$('save').onclick=()=>{
  if(dirty)draw();layer.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`langtons-loops-${world.steps}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
};
function point(e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
function cell(p){return {x:Math.floor((p.x-width/2)/scale+cx),y:Math.floor((p.y-height/2)/scale+cy)};}
function edit(p){
  const c=cell(p),tool=$('tool').value;pause();
  if(tool==='seed')$('notice').textContent=world.place(c.x,c.y,Number($('rotation').value))?'':'空きのある場所に置いてください。 / Choose an empty area away from the border.';
  else world.paint(c.x,c.y,tool==='erase'?0:Number($('state').value),tool==='erase'?1:0);
  dirty=true;
}
canvas.addEventListener('pointerdown',e=>{
  if(busy||e.button!==0||drag)return;canvas.setPointerCapture(e.pointerId);drag={...point(e),id:e.pointerId};
  if($('tool').value!=='pan')edit(drag);
});
canvas.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId||busy)return;const p=point(e);
  if($('tool').value==='pan'){cx-=(p.x-drag.x)/scale;cy-=(p.y-drag.y)/scale;dirty=true;}
  else if($('tool').value!=='seed'){
    const length=Math.hypot(p.x-drag.x,p.y-drag.y),steps=Math.max(1,Math.ceil(length/scale));
    for(let i=1;i<=steps;i++)edit({x:drag.x+(p.x-drag.x)*i/steps,y:drag.y+(p.y-drag.y)*i/steps});
  }
  drag={...p,id:e.pointerId};
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{drag=null;});
canvas.addEventListener('wheel',e=>{
  e.preventDefault();const p=point(e),wx=(p.x-width/2)/scale+cx,wy=(p.y-height/2)/scale+cy;
  scale=Math.max(.5,Math.min(32,scale*Math.exp(-e.deltaY*.001)));cx=wx-(p.x-width/2)/scale;cy=wy-(p.y-height/2)/scale;
  $('zoom').value=Math.max(2,scale);dirty=true;
},{passive:false});
new ResizeObserver(resize).observe($('stage'));
resize();setMenu(false);reset();requestAnimationFrame(frame);

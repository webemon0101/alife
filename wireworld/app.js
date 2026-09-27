import {WireWorld} from './core.js';
const $=id=>document.getElementById(id),world=new WireWorld();
const canvas=$('canvas'),ctx=canvas.getContext('2d'),layer=document.createElement('canvas');
layer.width=layer.height=world.size;
const lctx=layer.getContext('2d'),pixels=lctx.createImageData(world.size,world.size);
const colors=['#0b1118','#71e1ff','#fb667c','#d6a64c'];
const rgb=colors.map(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)));
const small=matchMedia('(max-width:760px)'),history=[];
let running=!matchMedia('(prefers-reduced-motion:reduce)').matches,busy=false,epoch=0;
let width=1,height=1,cx=80,cy=80,scale=6,last=0,credit=0,dirty=true,drag=null,autoFit=true;
function sync(){
  $('play').textContent=running?'一時停止 / Pause':'再生 / Play';
  for(const id of ['play','step','advance','preset','clear','quiet','tool','direction'])$(id).disabled=busy;
  $('undo').disabled=busy||!history.length;
  $('stageHint').textContent=busy?'計算中… リセットで中止 / Computing… Reset to cancel':
    $('tool').value==='pan'?'ドラッグで移動 · ホイールで拡大 / Drag to pan · Scroll to zoom':'タップ・ドラッグで編集 / Tap or drag to edit';
}
function pause(){running=false;credit=0;sync();}
function remember(){history.push({cells:world.cells.slice(),steps:world.steps});if(history.length>20)history.shift();sync();}
function fit(){
  autoFit=true;const b=world.bounds();
  cx=b.count?(b.x0+b.x1+1)/2:world.size/2;cy=b.count?(b.y0+b.y1+1)/2:world.size/2;
  const spanX=b.count?Math.max(28,b.x1-b.x0+16):80,spanY=b.count?Math.max(28,b.y1-b.y0+16):80;
  scale=Math.max(.5,Math.min(24,width/spanX,(height-160)/spanY));$('zoom').value=scale;dirty=true;
}
function reset(){epoch++;busy=false;credit=0;remember();world.load($('preset').value);if($('preset').value==='blank')running=false;$('notice').textContent='';fit();sync();}
function resize(){
  const r=canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);
  width=r.width;height=r.height;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);if(autoFit)fit();dirty=true;
}
function draw(){
  const heads=[];
  for(let i=0;i<world.cells.length;i++){
    const s=world.cells[i],c=rgb[s],p=i*4;pixels.data[p]=c[0];pixels.data[p+1]=c[1];pixels.data[p+2]=c[2];pixels.data[p+3]=255;
    if(s===1)heads.push(i);
  }
  lctx.putImageData(pixels,0,0);ctx.fillStyle='#06090e';ctx.fillRect(0,0,width,height);
  const left=width/2-cx*scale,top=(height-35)/2-cy*scale;
  ctx.imageSmoothingEnabled=false;ctx.drawImage(layer,left,top,world.size*scale,world.size*scale);
  ctx.strokeStyle='#263345';ctx.lineWidth=1;ctx.strokeRect(left,top,world.size*scale,world.size*scale);
  if($('glow').checked&&heads.length<=500){
    ctx.save();ctx.fillStyle=colors[1];ctx.shadowColor=colors[1];ctx.shadowBlur=Math.max(5,scale*1.7);
    for(const i of heads){const x=left+(i%world.size)*scale,y=top+Math.floor(i/world.size)*scale;if(x>=-scale&&y>=-scale&&x<width&&y<height)ctx.fillRect(x,y,scale,scale);}
    ctx.restore();
  }
  if(scale>=10){
    ctx.strokeStyle='#00000038';ctx.beginPath();
    for(let x=Math.max(0,Math.floor(-left/scale));x<=Math.min(world.size,(width-left)/scale);x++){const p=left+x*scale;ctx.moveTo(p,Math.max(0,top));ctx.lineTo(p,Math.min(height,top+world.size*scale));}
    for(let y=Math.max(0,Math.floor(-top/scale));y<=Math.min(world.size,(height-top)/scale);y++){const p=top+y*scale;ctx.moveTo(Math.max(0,left),p);ctx.lineTo(Math.min(width,left+world.size*scale),p);}ctx.stroke();
  }
  $('stats').textContent=`${world.steps.toLocaleString('en-US')} steps · ${heads.length} heads`;
  dirty=false;
}
async function advance(){
  remember();pause();busy=true;const token=++epoch;sync();let remaining=100;
  while(remaining>0&&token===epoch){
    const start=performance.now();do{world.step();remaining--;}while(remaining>0&&performance.now()-start<8);
    dirty=true;await new Promise(resolve=>requestAnimationFrame(resolve));
  }
  if(token===epoch){busy=false;sync();}
}
function frame(now){
  const dt=last?Math.min(.1,(now-last)/1000):0;last=now;
  if(running&&!busy&&!document.hidden){
    credit=Math.min(24,credit+dt*Number($('speed').value));const start=performance.now();
    while(credit>=1&&performance.now()-start<8){world.step();credit--;dirty=true;}
  }
  if(dirty)draw();requestAnimationFrame(frame);
}
function menu(open){
  open=small.matches&&open;$('sidebar').classList.toggle('open',open);$('sidebarBackdrop').classList.toggle('open',open);
  $('menuToggle').setAttribute('aria-expanded',String(open));$('sidebar').inert=small.matches&&!open;$('stage').inert=open;
}
$('menuToggle').onclick=()=>menu(!$('sidebar').classList.contains('open'));
$('sidebarBackdrop').onclick=()=>menu(false);small.addEventListener('change',()=>menu(false));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&small.matches){menu(false);$('menuToggle').focus();}});
document.addEventListener('visibilitychange',()=>{last=0;credit=0;});
$('play').onclick=()=>{if(!running)remember();running=!running;credit=0;sync();};
$('step').onclick=()=>{remember();pause();world.step();dirty=true;};
$('reset').onclick=reset;$('preset').onchange=reset;$('advance').onclick=advance;
$('clear').onclick=()=>{remember();pause();world.clear();$('notice').textContent='';dirty=true;};
$('quiet').onclick=()=>{remember();pause();for(let i=0;i<world.cells.length;i++)if(world.cells[i])world.cells[i]=3;dirty=true;};
$('undo').onclick=()=>{pause();const saved=history.pop();if(saved){world.cells.set(saved.cells);world.steps=saved.steps;dirty=true;$('notice').textContent='';}sync();};
$('tool').onchange=()=>{$('notice').textContent='';sync();};
$('zoom').oninput=()=>{autoFit=false;scale=Number($('zoom').value);dirty=true;};
$('glow').onchange=()=>{dirty=true;};$('fit').onclick=fit;
$('save').onclick=()=>{
  if(dirty)draw();const output=document.createElement('canvas');output.width=output.height=640;
  const c=output.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(layer,0,0,640,640);
  output.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`wireworld-${world.steps}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
};
function point(e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
function cell(p){return {x:Math.floor((p.x-width/2)/scale+cx),y:Math.floor((p.y-(height-35)/2)/scale+cy)};}
function edit(p,previous){
  const c=cell(p),tool=$('tool').value;pause();
  if(tool==='pulse')$('notice').textContent=world.pulse(c.x,c.y,Number($('direction').value))?'':'頭と尾を置く2セル分の導線が必要です。 / Two wire cells are needed for head and tail.';
  else{const a=previous?cell(previous):c,value={wire:3,head:1,tail:2,erase:0}[tool];world.line(a.x,a.y,c.x,c.y,value);}
  dirty=true;
}
canvas.addEventListener('pointerdown',e=>{
  if(busy||e.button!==0||drag)return;canvas.setPointerCapture(e.pointerId);drag={...point(e),id:e.pointerId};
  if($('tool').value!=='pan'){remember();edit(drag);}
});
canvas.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId||busy)return;const p=point(e);
  if($('tool').value==='pan'){autoFit=false;cx-=(p.x-drag.x)/scale;cy-=(p.y-drag.y)/scale;dirty=true;}
  else if($('tool').value!=='pulse')edit(p,drag);
  drag={...p,id:e.pointerId};
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{drag=null;});
canvas.addEventListener('wheel',e=>{
  e.preventDefault();autoFit=false;const p=point(e),wx=(p.x-width/2)/scale+cx,wy=(p.y-(height-35)/2)/scale+cy;
  scale=Math.max(.5,Math.min(32,scale*Math.exp(-e.deltaY*.001)));cx=wx-(p.x-width/2)/scale;cy=wy-(p.y-(height-35)/2)/scale;
  $('zoom').value=scale;dirty=true;
},{passive:false});
resize();menu(false);reset();history.length=0;sync();new ResizeObserver(resize).observe($('stage'));requestAnimationFrame(frame);

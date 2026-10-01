// EvoGym-inspired educational model, not the official simulator.
// Original implementation: Copyright (c) 2026 hamzworkerz (MIT).
// Shared actuator edge averaging adapted from EvoGym (MIT, 2022 jagdeepsb).
// See THIRD_PARTY_NOTICES.md and LICENSE-EvoGym.txt.
export const VERSION='voxel-coevolution-v1', SIZE=5, CELLS=25, GENES=297;
export const DT=1/240, STEPS=1440, SETTLE=240;
export const COLORS=['#18212d','#aab6c9','#6acaba','#eeac54','#b591ef'];
export const templates={
  walker:[0,0,0,0,0, 0,0,0,0,0, 0,1,1,1,0, 0,4,2,4,0, 0,3,0,3,0],
  worm:[0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,2,2,2,0, 3,3,3,3,3],
  square:[0,0,0,0,0, 0,0,0,0,0, 0,1,1,1,0, 0,4,2,4,0, 0,3,3,3,0]
};
export function random(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function connected(body){
  const start=body.findIndex(v=>v>0);if(start<0)return false;
  const seen=new Set([start]),queue=[start];
  for(const i of queue)for(const j of neighbors(i))if(body[j]&&!seen.has(j)){seen.add(j);queue.push(j);}
  return seen.size===body.filter(Boolean).length;
}
function neighbors(i){const n=[];if(i%5)n.push(i-1);if(i%5<4)n.push(i+1);if(i>=5)n.push(i-5);if(i<20)n.push(i+5);return n;}
export function validBody(b){return Array.isArray(b)&&b.length===CELLS&&b.every(v=>Number.isInteger(v)&&v>=0&&v<=4)&&b.filter(Boolean).length>=4&&b.some(v=>v>=3)&&connected(b);}
export function validGenome(g){return !!g&&validBody(g.body)&&Array.isArray(g.weights)&&g.weights.length===GENES&&g.weights.every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=4);}
export function copy(g){return {body:g.body.slice(),weights:g.weights.slice()};}
export function makeGenome(body,rng){return {body:body.slice(),weights:Array.from({length:GENES},()=>2*rng()-1)};}
export function mutate(g,rng,rate,morph){
  const q=copy(g);q.weights=q.weights.map(v=>rng()<rate?clamp(v+(rng()+rng()+rng()-1.5)*.7,-4,4):v);
  if(morph&&rng()<.55){const b=q.body.slice(),i=Math.floor(rng()*CELLS);b[i]=Math.floor(rng()*5);if(validBody(b))q.body=b;}
  return q;
}
// Connected voxel corners share mass points. All lengths use one voxel as a unit.
export function create(g){
  if(!validGenome(g))throw Error('Invalid genome');
  const points=[],cells=[],edges=[],pointMap=new Map(),edgeMap=new Map();
  const bottom=Math.max(...g.body.map((v,i)=>v?Math.floor(i/5):-1));
  function point(x,y){const key=x+','+y;if(pointMap.has(key))return pointMap.get(key);const i=points.length;pointMap.set(key,i);points.push({x,y:bottom+1-y+.15,vx:0,vy:0,mass:0});return i;}
  function edge(a,b,rest,k,act=-1){const key=Math.min(a,b)+','+Math.max(a,b);let e=edgeMap.get(key);if(!e){e={a,b,rest,k,act:[],goal:rest};edgeMap.set(key,e);edges.push(e);}e.k=Math.max(e.k,k);if(act>=0)e.act.push(act);return e;}
  g.body.forEach((type,i)=>{if(!type)return;const x=i%5,y=Math.floor(i/5),ids=[point(x,y+1),point(x+1,y+1),point(x+1,y),point(x,y)];
    ids.forEach(j=>points[j].mass+=.25);const k=type===1?500:type===2?100:220;
    const c={ids,type,index:i};cells.push(c);
    edge(ids[0],ids[1],1,k,type===3?i:-1);edge(ids[1],ids[2],1,k,type===4?i:-1);
    edge(ids[2],ids[3],1,k,type===3?i:-1);edge(ids[3],ids[0],1,k,type===4?i:-1);
    edge(ids[0],ids[2],Math.SQRT2,type===1?500:70);edge(ids[1],ids[3],Math.SQRT2,type===1?500:70);
  });
  const b={points,cells,edges,g,t:0,ticks:0,invalid:false,fx:new Float64Array(points.length),fy:new Float64Array(points.length)};
  for(let k=0;k<SETTLE;k++)step(b,false);b.t=0;b.ticks=0;b.start=center(b).x;return b;
}
export function center(b){let x=0,y=0,vx=0,vy=0,m=0;for(const p of b.points){x+=p.x*p.mass;y+=p.y*p.mass;vx+=p.vx*p.mass;vy+=p.vy*p.mass;m+=p.mass;}return {x:x/m,y:y/m,vx:vx/m,vy:vy/m};}
export function control(b){
  const com=center(b);let ux=0,uy=0,contact=0;
  for(const c of b.cells){const a=b.points[c.ids[0]],d=b.points[c.ids[1]],len=Math.max(.001,Math.hypot(d.x-a.x,d.y-a.y));ux+=(d.x-a.x)/len;uy+=(d.y-a.y)/len;}
  for(const p of b.points)if(p.y<.015)contact++;
  const input=[Math.sin(b.t*2*Math.PI),Math.cos(b.t*2*Math.PI),clamp(com.vx/3,-1,1),clamp(com.vy/3,-1,1),ux/b.cells.length,uy/b.cells.length,contact/b.points.length,clamp(com.y/5,0,1)];
  let at=0;const h=[],out=[];for(let j=0;j<8;j++){let v=b.g.weights[at++];for(const x of input)v+=x*b.g.weights[at++];h.push(Math.tanh(v));}
  for(let j=0;j<CELLS;j++){let v=b.g.weights[at++];for(const x of h)v+=x*b.g.weights[at++];out.push(1+.3*Math.tanh(v));}
  // Port of update_actuator_goals' shared-edge averaging; dynamics below are our own.
  for(const e of b.edges)e.goal=e.act.length?e.rest*e.act.reduce((sum,i)=>sum+out[i],0)/e.act.length:e.rest;
  return out;
}
export function step(b,active=true){
  if(b.invalid)return false;
  if(active&&b.ticks%8===0)control(b);
  const {points:p,fx,fy}=b;fx.fill(0);
  for(let i=0;i<p.length;i++)fy[i]=-9.8*p[i].mass;
  for(const e of b.edges){const a=p[e.a],c=p[e.b],dx=c.x-a.x,dy=c.y-a.y,d=Math.max(1e-8,Math.sqrt(dx*dx+dy*dy)),ux=dx/d,uy=dy/d;
    const f=e.k*(d-e.goal)+1.2*((c.vx-a.vx)*ux+(c.vy-a.vy)*uy);fx[e.a]+=f*ux;fy[e.a]+=f*uy;fx[e.b]-=f*ux;fy[e.b]-=f*uy;
  }
  for(let i=0;i<p.length;i++){const a=p[i];a.vx=(a.vx+DT*fx[i]/a.mass)*.9998;a.vy=(a.vy+DT*fy[i]/a.mass)*.9998;a.x+=DT*a.vx;a.y+=DT*a.vy;
    if(a.y<0){a.y=0;const normal=Math.max(0,-a.vy);a.vy=Math.max(0,a.vy);a.vx-=Math.sign(a.vx)*Math.min(Math.abs(a.vx),.8*normal);}
    if(!Number.isFinite(a.x)||!Number.isFinite(a.y)||Math.abs(a.x)>200||a.y>50)b.invalid=true;
  }
  // Reject inverted/folded cells rather than reward a broken numerical body.
  if(b.ticks%8===0){
    const polygons=b.cells.map(c=>c.ids.map(i=>p[i]));
    for(const poly of polygons)for(let i=0;i<4;i++){const u=poly[i],v=poly[(i+1)%4],w=poly[(i+2)%4];if((v.x-u.x)*(w.y-u.y)-(v.y-u.y)*(w.x-u.x)<.04)b.invalid=true;}
    // No full self-contact solver: reject penetrations instead of exploiting them.
    for(let i=0;i<polygons.length&&!b.invalid;i++)for(let j=i+1;j<polygons.length;j++)if(overlap(polygons[i],polygons[j])){b.invalid=true;break;}
  }
  b.t+=DT;b.ticks++;return !b.invalid;
}
function overlap(a,b){
  const box=q=>[Math.min(...q.map(p=>p.x)),Math.max(...q.map(p=>p.x)),Math.min(...q.map(p=>p.y)),Math.max(...q.map(p=>p.y))];
  const x=box(a),y=box(b);if(Math.min(x[1],y[1])-Math.max(x[0],y[0])<=.06||Math.min(x[3],y[3])-Math.max(x[2],y[2])<=.06)return false;
  for(const q of [a,b])for(let i=0;i<4;i++){const u=q[i],v=q[(i+1)%4],d=Math.hypot(v.x-u.x,v.y-u.y),nx=-(v.y-u.y)/d,ny=(v.x-u.x)/d,pa=a.map(p=>p.x*nx+p.y*ny),pb=b.map(p=>p.x*nx+p.y*ny);if(Math.min(Math.max(...pa),Math.max(...pb))-Math.max(Math.min(...pa),Math.min(...pb))<=.06)return false;}
  return true;
}
export function evaluate(g){const b=create(g);for(let i=0;i<STEPS&&!b.invalid;i++)step(b);return {score:b.invalid?-100:center(b).x-b.start,valid:!b.invalid};}
export function initialPopulation(body,n,seed){if(!validBody(body))throw Error('Invalid body');const rng=random(seed);return Array.from({length:n},()=>makeGenome(body,rng));}
export function breed(rank,n,seed,rate,morph){
  const rng=random(seed),out=rank.slice(0,2).map(v=>copy(v.g));
  const parent=()=>{let a=rank[Math.floor(rng()*n)];for(let k=0;k<2;k++){const b=rank[Math.floor(rng()*n)];if(b.score>a.score)a=b;}return a.g;};
  while(out.length<n)out.push(mutate(parent(),rng,rate,morph));return out;
}
export function snapshot(g){if(!validGenome(g))throw Error('Invalid genome');return {format:'alife-voxel-creature',version:1,physics:VERSION,genome:copy(g)};}
export function parseSnapshot(d){if(d?.format!=='alife-voxel-creature'||d.version!==1||d.physics!==VERSION||!validGenome(d.genome))throw Error('対応する個体ファイルではありません / Invalid creature file');return copy(d.genome);}

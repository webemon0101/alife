export const defaults={mu:4,sigma:1,weight:.022,target:.6,width:.15,rep:1,dt:.1};
// Local spatial gradient with the source positions held fixed (not total energy descent).
export function field(points,i,p){
 let u=0,gx=0,gy=0,rx=0,ry=0;
 const [x,y]=points[i];
 for(let j=0;j<points.length;j++){
  const dx=x-points[j][0],dy=y-points[j][1],d=Math.hypot(dx,dy);
  const k=p.weight*Math.exp(-(((d-p.mu)/p.sigma)**2));u+=k;
  if(d<1e-10)continue;
  const a=-2*(d-p.mu)/(p.sigma*p.sigma)*k/d;
  gx+=a*dx;gy+=a*dy;
  const r=p.rep*Math.max(1-d,0)/d;rx+=r*dx;ry+=r*dy;
 }
 const g=Math.exp(-(((u-p.target)/p.width)**2)),dg=-2*(u-p.target)/(p.width*p.width)*g;
 return [rx+dg*gx,ry+dg*gy,u];
}
export function advance(points,p,budget=250){
 const start=performance.now(),next=[];
 for(let i=0;i<points.length;i++){
  if(i%16===0&&performance.now()-start>budget)throw Error('負荷が高いため停止 / Load limit');
  const [vx,vy]=field(points,i,p),x=points[i][0]+p.dt*vx,y=points[i][1]+p.dt*vy;
  if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>1e6||Math.abs(y)>1e6)throw Error('数値範囲を超えました / Numerical limit');
  next.push([x,y]);
 }return next;
}
export function initial(n,seed,shape){let s=seed>>>0;const rand=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296};return Array.from({length:n},(_,i)=>{
 if(shape==='ring'){const a=rand()*Math.PI*2,r=4+rand()*2;return [r*Math.cos(a),r*Math.sin(a)]}
 if(shape==='pair')return [(rand()-.5)*8+(i<n/2?-6:6),(rand()-.5)*8];
 return [(rand()-.5)*12,(rand()-.5)*12];});}

// PPS rule, implemented for ALIFE Collection. Positions use simulation units.
export const TAU=Math.PI*2;
export const wrap=(x,w)=>((x%w)+w)%w;
export const delta=(x,w)=>x-w*Math.floor(x/w+.5);
export function random(seed){let s=seed>>>0;return ()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};}
export function initial(n,w,h,seed){const r=random(seed),a=new Float64Array(n*4);for(let i=0;i<n;i++){a[4*i]=r()*w;a[4*i+1]=r()*h;a[4*i+2]=r()*TAU;}return a;}
export function step(input,p,seed=1,budget=150){
 const start=performance.now(),a=new Float64Array(input),n=a.length/4;
 const source=p.sequential?a:input,cols=Math.max(1,Math.floor(p.w/p.r)),rows=Math.max(1,Math.floor(p.h/p.r)),cw=p.w/cols,ch=p.h/rows;
 const head=new Int32Array(cols*rows).fill(-1),next=new Int32Array(n).fill(-1),prev=new Int32Array(n).fill(-1),cells=new Int32Array(n);
 const cell=(x,y)=>Math.min(cols-1,Math.floor(x/cw))+Math.min(rows-1,Math.floor(y/ch))*cols;
 const insert=(i,c)=>{cells[i]=c;next[i]=head[c];prev[i]=-1;if(head[c]>=0)prev[head[c]]=i;head[c]=i;};
 for(let i=0;i<n;i++)insert(i,cell(source[i*4],source[i*4+1]));
 const order=Int32Array.from({length:n},(_,i)=>i),rng=random(seed);
 if(p.sequential)for(let i=n-1;i>0;i--){const j=Math.floor(rng()*(i+1)),t=order[i];order[i]=order[j];order[j]=t;}
 for(let k=0;k<n;k++){
  const i=order[k],o=i*4,x=source[o],y=source[o+1],phi=source[o+2],cx=cells[i]%cols,cy=Math.floor(cells[i]/cols),sx=Math.cos(phi),sy=Math.sin(phi);
  let count=0,balance=0,close=0;const seen=[];
  for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++){
   let gx=cx+xx,gy=cy+yy;
   if(p.loop){gx=wrap(gx,cols);gy=wrap(gy,rows);}else if(gx<0||gx>=cols||gy<0||gy>=rows)continue;
   const c=gx+gy*cols;if(seen.includes(c))continue;seen.push(c);
   for(let j=head[c];j>=0;j=next[j]){if(j===i)continue;let dx=source[j*4]-x,dy=source[j*4+1]-y;if(p.loop){dx=delta(dx,p.w);dy=delta(dy,p.h);}const d2=dx*dx+dy*dy;
    if(d2<=p.r*p.r){count++;const cross=sx*dy-sy*dx;balance+=Math.sign(cross);if(d2<=1.3*1.3)close++;}
   }
  }
  let angle=wrap(phi+(p.alpha+p.beta*count*Math.sign(balance))*Math.PI/180,TAU),nx=x+Math.cos(angle)*p.v,ny=y+Math.sin(angle)*p.v;
  if(p.loop){nx=wrap(nx,p.w);ny=wrap(ny,p.h);}else{if(nx<0||nx>p.w){nx=Math.max(0,Math.min(p.w,nx));angle=Math.PI-angle;}if(ny<0||ny>p.h){ny=Math.max(0,Math.min(p.h,ny));angle=-angle;}angle=wrap(angle,TAU);}
  a[o]=nx;a[o+1]=ny;a[o+2]=angle;a[o+3]=count>35?3:count>15?2:count>=13?1:close>15?4:0;
  // Compact spores have >15 very close neighbors even if total density is blue.
  if(close>15&&count<=35)a[o+3]=4;
  if(p.sequential){const c=cell(nx,ny),old=cells[i];if(c!==old){if(prev[i]<0)head[old]=next[i];else next[prev[i]]=next[i];if(next[i]>=0)prev[next[i]]=prev[i];insert(i,c);}}
  if((k&63)===63&&performance.now()-start>budget)return null;
 }
 return a;
}

// Wireworld (Brian Silverman, 1987). Browser engine and presets for ALIFE Collection.
// States: 0 empty, 1 electron head, 2 electron tail, 3 conductor.
export class WireWorld {
  constructor(size=160){this.size=size;this.cells=new Uint8Array(size*size);this.next=new Uint8Array(size*size);this.steps=0;}
  clear(){this.cells.fill(0);this.next.fill(0);this.steps=0;}
  set(x,y,value){if(x>=0&&y>=0&&x<this.size&&y<this.size)this.cells[y*this.size+x]=value;}
  step(){
    const a=this.cells,b=this.next,n=this.size;
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const i=y*n+x,s=a[i];
      if(s!==3){b[i]=s===1?2:s===2?3:0;continue;}
      let heads=0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        if((dx||dy)&&x+dx>=0&&y+dy>=0&&x+dx<n&&y+dy<n&&a[(y+dy)*n+x+dx]===1)heads++;
      }
      b[i]=heads===1||heads===2?1:3;
    }
    this.cells=b;this.next=a;this.steps++;
  }
  line(x0,y0,x1,y1,value=3){
    const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;
    let error=dx+dy;
    while(true){this.set(x0,y0,value);if(x0===x1&&y0===y1)break;const e=2*error;if(e>=dy){error+=dy;x0+=sx;}if(e<=dx){error+=dx;y0+=sy;}}
  }
  pulse(x,y,direction){
    const [dx,dy]=[[1,0],[0,1],[-1,0],[0,-1]][direction],tx=x-dx,ty=y-dy,n=this.size;
    if(x<0||y<0||x>=n||y>=n||tx<0||ty<0||tx>=n||ty>=n||!this.cells[y*n+x]||!this.cells[ty*n+tx])return false;
    this.set(tx,ty,2);this.set(x,y,1);return true;
  }
  loop(x,y,w,h,spacing=14,phase=0,reverse=false){
    // Beveled corners keep exactly two neighbors per conductor on isolated loops.
    let path=[];
    for(let i=1;i<w-1;i++)path.push([x+i,y]);
    for(let j=1;j<h-1;j++)path.push([x+w-1,y+j]);
    for(let i=w-2;i>0;i--)path.push([x+i,y+h-1]);
    for(let j=h-2;j>0;j--)path.push([x,y+j]);
    if(reverse)path.reverse();
    for(const [px,py]of path)this.set(px,py,3);
    const count=Math.max(1,Math.floor(path.length/spacing));
    for(let i=0;i<count;i++){
      const k=(Math.floor(i*path.length/count)+phase)%path.length;
      const head=path[k],tail=path[(k+path.length-1)%path.length];this.set(...tail,2);this.set(...head,1);
    }
    return path;
  }
  load(name){
    this.clear();
    if(name==='city'){
      this.loop(25,29,110,102,15,3);
      this.loop(30,34,100,92,19,8,true);
      for(let row=0;row<2;row++)for(let col=0;col<3;col++){
        const x=36+col*30,y=40+row*42;
        this.loop(x,y,26,36,10+col*3+row*2,col*7+row*3,(row+col)%2===1);
        this.loop(x+5,y+5,16,26,13+row*4,col*3,(row+col)%2===0);
        this.loop(x+10,y+10,6,16,14,col);
      }
    }else if(name==='loop')this.loop(55,58,50,44,1000,5);
    else if(name==='branches'){
      this.loop(30,64,26,32,22,4);
      this.line(56,79,84,79);this.line(84,50,84,108);
      for(const y of [50,64,94,108])this.line(84,y,125,y);
    }else if(name==='collision'){
      for(let y=60;y<=100;y+=20){this.line(38,y,122,y);this.pulse(44,y,0);this.pulse(116,y,2);}
    }
  }
  bounds(){
    let x0=this.size,y0=this.size,x1=-1,y1=-1,count=0,heads=0;
    for(let y=0;y<this.size;y++)for(let x=0;x<this.size;x++)if(this.cells[y*this.size+x]){
      count++;if(this.cells[y*this.size+x]===1)heads++;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
    }
    return {x0,y0,x1,y1,count,heads};
  }
}

// Browser simulation for ALIFE Collection. Rule/seed data attribution: rules.js.
import {RULES, SEED} from './rules.js';

const lookup = new Uint8Array(8 ** 5);
const defined = new Uint8Array(lookup.length);
const key = (c,n,e,s,w) => ((((c*8+n)*8+e)*8+s)*8+w);
for (const rule of RULES) {
  const [c,n,e,s,w,out] = [...rule].map(Number);
  const neighbors = [n,e,s,w];
  for (let rotation=0; rotation<4; rotation++) {
    const k=key(c,...neighbors);
    if (defined[k] && lookup[k]!==out) throw new Error('Conflicting rotated rule');
    lookup[k]=out; defined[k]=1;
    neighbors.push(neighbors.shift());
  }
}

export function rotatedSeed(turns=0) {
  let rows=SEED.map(row=>[...row].map(Number));
  for(let i=0;i<turns%4;i++) rows=rows[0].map((_,x)=>rows.map(row=>row[x]).reverse());
  return rows;
}

export class LoopWorld {
  constructor(size=160) {
    this.size=size;
    this.cells=new Uint8Array(size*size);
    this.next=new Uint8Array(size*size);
    this.steps=0;
  }
  clear() { this.cells.fill(0); this.next.fill(0); this.steps=0; }
  place(x,y,turns=0) {
    const seed=rotatedSeed(turns),h=seed.length,w=seed[0].length,n=this.size;
    x=Math.floor(x-w/2);y=Math.floor(y-h/2);
    if(x<1 || y<1 || x+w>=n || y+h>=n) return false;
    // Reserve the full footprint so placing a loop cannot erase an existing one.
    for(let j=0;j<h;j++)for(let i=0;i<w;i++)if(this.cells[(y+j)*n+x+i])return false;
    for(let j=0;j<h;j++)for(let i=0;i<w;i++)this.cells[(y+j)*n+x+i]=seed[j][i];
    return true;
  }
  paint(x,y,value,radius=0) {
    const n=this.size;
    for(let j=Math.max(1,y-radius);j<=Math.min(n-2,y+radius);j++)
      for(let i=Math.max(1,x-radius);i<=Math.min(n-2,x+radius);i++)this.cells[j*n+i]=value;
  }
  step() {
    const n=this.size,a=this.cells,b=this.next;
    // The outermost ring stays empty. All interior cells update synchronously.
    for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++) {
      const i=y*n+x;
      b[i]=lookup[key(a[i],a[i-n],a[i+1],a[i+n],a[i-1])];
    }
    this.cells=b;this.next=a;this.steps++;
  }
  bounds() {
    let x0=this.size,y0=this.size,x1=-1,y1=-1,count=0;
    for(let y=0;y<this.size;y++)for(let x=0;x<this.size;x++)if(this.cells[y*this.size+x]) {
      count++;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
    }
    return {x0,y0,x1,y1,count};
  }
}

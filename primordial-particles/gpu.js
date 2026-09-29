const code=`
struct Params { n:u32, looped:u32, w:f32, h:f32, r:f32, alpha:f32, beta:f32, speed:f32 }
@group(0) @binding(0) var<storage,read> src:array<vec4<f32>>;
@group(0) @binding(1) var<storage,read_write> dst:array<vec4<f32>>;
@group(0) @binding(2) var<uniform> p:Params;
fn wrap(x:f32,w:f32)->f32{return x-w*floor(x/w);}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id:vec3<u32>){
 let i=id.x;if(i>=p.n){return;}let a=src[i];var count=0.0;var balance=0.0;var close=0.0;let dir=vec2<f32>(cos(a.z),sin(a.z));
 for(var j=0u;j<p.n;j++){if(i==j){continue;}var d=src[j].xy-a.xy;if(p.looped!=0u){let size=vec2<f32>(p.w,p.h);d-=size*floor(d/size+vec2<f32>(0.5));}let d2=dot(d,d);
 if(d2<=p.r*p.r){count+=1.0;balance+=sign(dir.x*d.y-dir.y*d.x);if(d2<=1.69){close+=1.0;}}}
 var angle=wrap(a.z+(p.alpha+p.beta*count*sign(balance))*0.017453292519943295,6.283185307179586);
 var pos=a.xy+vec2<f32>(cos(angle),sin(angle))*p.speed;
 if(p.looped!=0u){pos=vec2<f32>(wrap(pos.x,p.w),wrap(pos.y,p.h));}else{
 if(pos.x<0.0||pos.x>p.w){pos.x=clamp(pos.x,0.0,p.w);angle=3.141592653589793-angle;}
 if(pos.y<0.0||pos.y>p.h){pos.y=clamp(pos.y,0.0,p.h);angle=-angle;}angle=wrap(angle,6.283185307179586);}
 var color=0.0;if(count>35.0){color=3.0;}else if(count>15.0){color=2.0;}else if(count>=13.0){color=1.0;}if(close>15.0&&count<=35.0){color=4.0;}
 dst[i]=vec4<f32>(pos,angle,color);
}`;
export async function createGPU(onFailure){
 if(!navigator.gpu)throw Error('WebGPU unavailable');const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw Error('No adapter');const device=await adapter.requestDevice();let closed=false,busy=false;
 const fail=()=>{if(!closed){closed=true;device.destroy();onFailure();}};device.lost.then(fail);device.addEventListener('uncapturederror',fail);
 try{device.pushErrorScope('validation');const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module:device.createShaderModule({code}),entryPoint:'main'}});const error=await device.popErrorScope();if(error)throw Error(error.message);
 const size=5000*16,buffer=(s,u)=>device.createBuffer({size:s,usage:u}),src=buffer(size,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST),dst=buffer(size,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC),read=buffer(size,GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST),params=buffer(32,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);
 const bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[src,dst,params].map((buffer,binding)=>({binding,resource:{buffer}}))});
 return {async step(a,p){if(closed||busy)throw Error('GPU unavailable');if(a.length>20000)throw Error('Too many particles');busy=true;try{
 const u=new ArrayBuffer(32);new Uint32Array(u).set([a.length/4,p.loop?1:0]);new Float32Array(u).set([p.w,p.h,p.r,p.alpha,p.beta,p.v],2);
 device.queue.writeBuffer(src,0,new Float32Array(a));device.queue.writeBuffer(params,0,u);const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.dispatchWorkgroups(Math.ceil(a.length/256));pass.end();encoder.copyBufferToBuffer(dst,0,read,0,a.length*4);device.queue.submit([encoder.finish()]);await read.mapAsync(GPUMapMode.READ,0,a.length*4);const result=new Float64Array(new Float32Array(read.getMappedRange(0,a.length*4).slice(0)));read.unmap();if(!result.every(Number.isFinite))throw Error('Invalid GPU state');return result;
 }finally{busy=false;}},destroy(){closed=true;device.destroy();}};
 }catch(e){closed=true;device.destroy();throw e;}
}

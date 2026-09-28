// WebGPU acceleration for Particle Life forces. UI/integration remain on the CPU.
const shader = `
struct Params { n:u32, k:u32, radius:f32, beta:f32 }
@group(0) @binding(0) var<storage,read> particles:array<vec4<f32>>;
@group(0) @binding(1) var<storage,read> matrix:array<f32>;
@group(0) @binding(2) var<storage,read_write> forces:array<vec2<f32>>;
@group(0) @binding(3) var<uniform> p:Params;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id:vec3<u32>){
  let i=id.x; if(i>=p.n){return;}
  let a=particles[i]; var force=vec2<f32>(0.0);
  for(var j=0u;j<p.n;j++){
    let b=particles[j];let delta=b.xy-a.xy;let d2=dot(delta,delta);
    if(d2>0.0001 && d2<p.radius*p.radius){
      let d=sqrt(d2);let r=d/p.radius;
      let attraction=matrix[u32(a.z)*p.k+u32(b.z)];
      var f=attraction*(1.0-abs(2.0*r-1.0-p.beta)/(1.0-p.beta));
      if(r<p.beta){f=r/p.beta-1.0;}
      force+=delta/d*f;
    }
  }
  forces[i]=force;
}`;
export async function createParticleGPU(onFailure){
  if(!navigator.gpu)throw new Error('WebGPU unavailable');
  const adapter=await navigator.gpu.requestAdapter();
  if(!adapter)throw new Error('No WebGPU adapter');
  const device=await adapter.requestDevice();
  let closed=false;
  const fail=()=>{if(!closed){closed=true;device.destroy();onFailure();}};
  device.lost.then(fail);device.addEventListener('uncapturederror',fail);
  try{
    device.pushErrorScope('validation');
    const module=device.createShaderModule({code:shader});
    const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});
    const error=await device.popErrorScope();if(error)throw new Error(error.message);
    const buffer=(size,usage)=>device.createBuffer({size,usage});
    const particles=buffer(5000*16,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST);
    const matrix=buffer(30*30*4,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST);
    const forces=buffer(5000*8,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC);
    const read=buffer(5000*8,GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST);
    const params=buffer(16,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);
    const bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[particles,matrix,forces,params].map((b,i)=>({binding:i,resource:{buffer:b}}))});
    let inFlight=false;
    return {
      async forces(x,y,types,coefficients,radius,beta){
        if(closed||inFlight)throw new Error('GPU unavailable or busy');
        const n=x.length,k=coefficients.length;if(n>5000||k>30)throw new Error('Capacity exceeded');
        inFlight=true;
        try{
          const data=new Float32Array(n*4);
          for(let i=0;i<n;i++){data[i*4]=x[i];data[i*4+1]=y[i];data[i*4+2]=types[i];}
          const uniform=new ArrayBuffer(16);new Uint32Array(uniform).set([n,k]);new Float32Array(uniform).set([radius,beta],2);
          device.queue.writeBuffer(particles,0,data);device.queue.writeBuffer(matrix,0,new Float32Array(coefficients.flat()));device.queue.writeBuffer(params,0,uniform);
          const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();
          pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.dispatchWorkgroups(Math.ceil(n/64));pass.end();
          encoder.copyBufferToBuffer(forces,0,read,0,n*8);device.queue.submit([encoder.finish()]);
          await read.mapAsync(GPUMapMode.READ,0,n*8);
          const result=new Float32Array(read.getMappedRange(0,n*8).slice(0));read.unmap();
          if(!result.every(Number.isFinite))throw new Error('Invalid GPU result');
          return result;
        }finally{inFlight=false;}
      },
      destroy(){closed=true;device.destroy();}
    };
  }catch(error){closed=true;device.destroy();throw error;}
}

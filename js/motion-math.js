import{state}from'./state.js';

let glMatrix=null;
const localVelocity=new Float32Array(2);
const worldVelocity=new Float32Array(2);
const rotation=new Float32Array(4);

export function initMotionMath(){
  import('https://cdn.jsdelivr.net/npm/gl-matrix@3.4.4/+esm').then(mod=>{
    glMatrix=mod;
    state.motionMath='gl-matrix';
  }).catch(err=>{
    console.warn('[ZenDrive] gl-matrix unavailable; using local math fallback',err);
    state.motionMath='fallback';
  });
}

export function localVelocityToWorld(lateral,longitudinal,heading,out){
  const c=Math.cos(heading),s=Math.sin(heading);
  if(glMatrix){
    glMatrix.vec2.set(localVelocity,lateral,longitudinal);
    glMatrix.mat2.set(rotation,c,-s,s,c);
    glMatrix.vec2.transformMat2(worldVelocity,localVelocity,rotation);
    out.x=worldVelocity[0];
    out.z=worldVelocity[1];
  }else{
    out.x=c*lateral+s*longitudinal;
    out.z=-s*lateral+c*longitudinal;
  }
  return out;
}

import{state,clamp,smoothstep}from'./state.js';

let noise2D=null;
function mulberry32(seed){
  let a=seed>>>0;
  return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}
}
export function initRoadNoise(seed=137.731){
  const random=mulberry32(Math.floor(seed*100000)>>>0);
  import('https://cdn.jsdelivr.net/npm/simplex-noise@4.0.3/+esm').then(mod=>{
    noise2D=mod.createNoise2D(random);state.proceduralEngine='simplex-noise';
  }).catch(err=>{console.warn('[ZenDrive] simplex-noise unavailable; using coherent fallback',err);state.proceduralEngine='fallback'});
}
function coherentNoise(x,channel=0){
  if(noise2D)return noise2D(x,channel*17.173);
  return Math.sin(x*1.37+channel*2.91)*.56+Math.sin(x*.47+channel*5.33)*.29+Math.sin(x*2.83+channel*.71)*.15;
}
function roadMicroProfile(z){
  return coherentNoise(z*.035,0)*.0062+coherentNoise(z*.095,1)*.0036+coherentNoise(z*.24,2)*.0018;
}

export const ROAD_HALF_WIDTH=4.55;
export const ROAD_SHOULDER=1.05;
export const ROAD_NEAR=4.2;
export const ROAD_DRAW=980;
export const ROAD_SEGMENT=6;

function baseX(z){
  const s=state.routeSeed;
  return Math.sin((z+s*3.1)/520)*16.5+Math.sin((z+s*1.7)/1700)*26+Math.sin((z+s*.8)/255)*4.8;
}
function baseY(z){
  const s=state.routeSeed;
  return Math.sin((z+s*2.4)/920)*7.2+Math.sin((z+s*.6)/420)*3.1+Math.sin((z+s*4.1)/1850)*5.4;
}
function explicitHill(z){
  const cycle=5600,local=((z%cycle)+cycle)%cycle;
  const rise=smoothstep(500,1200,local)-smoothstep(1700,2450,local);
  const valley=smoothstep(2650,3250,local)-smoothstep(3900,4550,local);
  return rise*7.5-valley*5.5;
}
function featureFor(z){
  const cycle=5600,local=((z%cycle)+cycle)%cycle;
  if(local>1800&&local<2280){
    const amount=Math.min(smoothstep(1800,1900,local),1-smoothstep(2180,2280,local));
    return{type:'bridge',amount,local,exit:0};
  }
  if(local>3650&&local<4230){
    const amount=Math.min(smoothstep(3650,3760,local),1-smoothstep(4120,4230,local));
    const exit=smoothstep(4010,4230,local);
    return{type:'tunnel',amount,local,exit};
  }
  return{type:null,amount:0,local,exit:0};
}

export function roadX(z){return baseX(z)}
export function roadY(z){return baseY(z)+explicitHill(z)}
export function roadBank(z){
  const curvature=(roadX(z+6)-2*roadX(z)+roadX(z-6))/36;
  const wave=Math.sin((z+state.routeSeed)/760)*.012;
  return clamp(-curvature*.85+wave,-.075,.075);
}
export function roadBump(z){return roadMicroProfile(z)}

export function sampleRoad(z,out={}){
  const h=2.5,x=roadX(z),y=roadY(z),x0=roadX(z-h),x1=roadX(z+h),y0=roadY(z-h),y1=roadY(z+h);
  const dx=(x1-x0)/(h*2),dy=(y1-y0)/(h*2);
  const ddx=(x1-2*x+x0)/(h*h);
  const feature=featureFor(z);
  out.x=x;out.y=y;out.z=z;
  out.heading=Math.atan2(dx,1);
  out.pitch=Math.atan2(dy,Math.sqrt(1+dx*dx));
  out.bank=roadBank(z);
  out.curvature=ddx/Math.pow(1+dx*dx,1.5);
  out.feature=feature.type;out.featureAmount=feature.amount;out.featureLocal=feature.local;out.featureExit=feature.exit;
  return out;
}

export function roadPoint(sample,lateral=0,height=0,out={}){
  const ch=Math.cos(sample.heading),sh=Math.sin(sample.heading),cb=Math.cos(sample.bank),sb=Math.sin(sample.bank);
  const rightX=ch*cb,rightY=sb,rightZ=-sh*cb;
  out.x=sample.x+rightX*lateral;
  out.y=sample.y+rightY*lateral+height;
  out.z=sample.z+rightZ*lateral;
  return out;
}

export function roadFeatureAt(z){return featureFor(z)}

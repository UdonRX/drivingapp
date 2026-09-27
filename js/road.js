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
  const env=state.environment;
  if(env==='country'){
    // 里山の一本道。ほぼ一直線で、遠景がよく見える。
    return Math.sin((z+s*1.1)/1250)*1.8+Math.sin((z+s*.7)/3300)*3.2;
  }
  if(env==='city'){
    // 都市大通り。区画整理された長い直線を基本にする。
    return Math.sin((z+s*1.4)/1800)*2.2+Math.sin((z+s*.8)/5200)*4.0;
  }
  if(env==='coast'){
    // 海岸線。海側へ寄ったり離れたりする、見通しのよい緩いワインディング。
    return Math.sin((z+s*2.0)/390)*9.5+Math.sin((z+s*.9)/980)*15.0+Math.sin((z+s*.4)/2300)*8.0;
  }
  // 山岳道路。短い周期の大きな左右振幅で峠道を作る。
  const u=(z+s*1.7)/310;
  const v=(z+s*.6)/780;
  const hairpin=Math.sin(u)*20.0+Math.sin(u*.5+1.4)*13.0;
  const broad=Math.sin(v)*18.0;
  return hairpin+broad+Math.sin((z+s*.8)/150)*3.2;
}
function baseY(z){
  const s=state.routeSeed;
  const env=state.environment;
  if(env==='country')return Math.sin((z+s*.6)/1500)*1.8;
  if(env==='city')return Math.sin((z+s*.8)/2400)*.9;
  if(env==='coast')return Math.sin((z+s*1.2)/820)*3.2+Math.sin((z+s*.5)/1700)*2.2;
  // 山は標高が上がるにつれて上り下りする。
  return Math.sin((z+s*2.4)/620)*10.0+Math.sin((z+s*.6)/1180)*6.0+Math.sin((z+s*4.1)/1850)*5.4;
}
function explicitHill(z){
  const env=state.environment;
  if(env==='country')return Math.sin((z+state.routeSeed)/2100)*1.2;
  if(env==='city')return Math.sin((z+state.routeSeed)/3000)*.7;
  if(env==='coast')return Math.sin((z+state.routeSeed)/1050)*2.4;
  const cycle=5600,local=((z%cycle)+cycle)%cycle;
  const rise=smoothstep(500,1200,local)-smoothstep(1700,2450,local);
  const valley=smoothstep(2650,3250,local)-smoothstep(3900,4550,local);
  return rise*12.5-valley*9.0;
}
function featureFor(z){
  const env=state.environment;
  const cycle=5600,local=((z%cycle)+cycle)%cycle;
  if(env==='mountain'&&local>900&&local<1900){
    const amount=Math.min(smoothstep(900,1020,local),1-smoothstep(1780,1900,local));
    return{type:'hairpin',amount,local,exit:0};
  }
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

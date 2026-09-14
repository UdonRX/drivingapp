export const ENVS=['mountain','country','city','coast'];
export const ENV_LABELS={mountain:'MOUNTAIN',country:'COUNTRY',city:'CITY',coast:'COAST'};
export const WEATHER_LABELS={clear:'CLEAR',cloudy:'CLOUDY',rain:'RAIN',fog:'FOG'};
export const palettes={day:{clear:['#79bff2','#dff2ff'],cloudy:['#7c8790','#c1c9ce'],rain:['#586671','#84939c'],fog:['#a9b6b7','#d7dedd']},sunset:{clear:['#675d9b','#f3a56f'],cloudy:['#5c586d','#c48372'],rain:['#4a4a5b','#815f68'],fog:['#8a7f83','#cab0a3']},night:{clear:['#07101f','#182743'],cloudy:['#111722','#293343'],rain:['#080f18','#1d2a37'],fog:['#1b2630','#43515a']}};

export const ROAD_SEGMENT_LENGTH=10;
export const ROAD_DRAW_DISTANCE=1180;
export const ROAD_NEAR_Z=.82;
export const ROAD_HALF_WIDTH=4.65;
export const CAMERA_HEIGHT=1.34;
const DEG=Math.PI/180;

export const state={running:false,paused:false,environment:'mountain',time:'day',weather:'clear',control:'tilt',endless:true,speed:0,targetSpeed:76,distance:0,worldZ:0,roadPhase:0,lateral:0,steer:0,buttonSteer:0,tiltSteer:0,tiltZero:null,sensorAvailable:false,sensorPermission:'unknown',lastT:performance.now(),envIndex:0,routeOrigin:0,feature:null,featureProgress:0,featureCooldown:0,sound:false,dpr:1,width:0,height:0,audio:null,fpsSmoother:60,routeSeed:Math.random()*1000,cameraYaw:0,cameraRoll:0,cameraBob:0,cameraPitch:0,cameraLookX:0,cameraFov:58,carYaw:0,roadYaw:0,suspensionKick:0,speedPulse:0,accelPulse:0};
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const lerp=(a,b,t)=>a+(b-a)*t;
export function smoothstep(a,b,x){const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)}
export function hash(n){return Math.abs(Math.sin(n*12.9898+state.routeSeed)*43758.5453)%1}

export function roadCurveAt(z){
  const d=(state.worldZ+z)*.0048+state.routeSeed*.0007;
  return Math.sin(d*.93)*.31+Math.sin(d*.31+1.7)*.42+Math.sin(d*.083+.4)*.27;
}

// Approximate the accumulated lateral displacement of a curved road in world space.
// The z^2 term is what makes bends grow naturally toward the horizon instead of
// looking like a fixed 2D trapezoid sliding sideways.
export function roadCenterWorldX(z){
  const c0=roadCurveAt(z*.12),c1=roadCurveAt(z*.48),c2=roadCurveAt(z);
  const curvature=c0*.5+c1*.34+c2*.16;
  return clamp(curvature*z*z*.00024,-145,145);
}

export function focalLengthFor(w){
  const fov=clamp(state.cameraFov,54,72)*DEG;
  return (w*.5)/Math.tan(fov*.5);
}

export function vanishingX(w){
  const f=focalLengthFor(w);
  const viewYaw=state.cameraYaw+state.cameraLookX;
  return w*.5-Math.tan(viewYaw)*f;
}

export function projectWorldPoint(z,worldX,worldY,w,hor,out){
  z=Math.max(ROAD_NEAR_Z,z);
  const f=focalLengthFor(w);
  const vx=w*.5-Math.tan(state.cameraYaw+state.cameraLookX)*f;
  const cameraX=state.lateral*ROAD_HALF_WIDTH*.54;
  let sx=vx+(worldX-cameraX)*f/z;
  const nearGain=1+clamp(state.speed/138,0,1)*Math.max(0,1-z/115)*.055;
  sx=vx+(sx-vx)*nearGain;
  out.x=sx;
  out.y=hor+(CAMERA_HEIGHT-worldY)*f/z;
  out.scale=f/z;
  out.z=z;
  return out;
}

export function projectRoadPoint(z,w,hor,out,lateralWorld=0){
  return projectWorldPoint(z,roadCenterWorldX(z)+lateralWorld,0,w,hor,out);
}

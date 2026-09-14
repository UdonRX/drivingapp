export const ENVS=['mountain','country','city','coast'];
export const ENV_LABELS={mountain:'MOUNTAIN',country:'COUNTRY',city:'CITY',coast:'COAST'};
export const WEATHER_LABELS={clear:'CLEAR',cloudy:'CLOUDY',rain:'RAIN',fog:'FOG'};
export const TIME_LABELS={day:'DAY',sunset:'SUNSET',night:'NIGHT'};
export const palettes={
  day:{clear:['#79bff2','#dff2ff'],cloudy:['#7c8790','#c1c9ce'],rain:['#586671','#84939c'],fog:['#a9b6b7','#d7dedd']},
  sunset:{clear:['#675d9b','#f3a56f'],cloudy:['#5c586d','#c48372'],rain:['#4a4a5b','#815f68'],fog:['#8a7f83','#cab0a3']},
  night:{clear:['#07101f','#182743'],cloudy:['#111722','#293343'],rain:['#080f18','#1d2a37'],fog:['#1b2630','#43515a']}
};

export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const lerp=(a,b,t)=>a+(b-a)*t;
export const damp=(current,target,lambda,dt)=>lerp(current,target,1-Math.exp(-lambda*dt));
export function smoothstep(a,b,x){const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)}
export function wrapAngle(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a}
export function hash1(n,seed=0){const x=Math.sin(n*12.9898+seed*78.233)*43758.5453;return x-Math.floor(x)}

export const state={
  running:false,
  paused:false,
  environment:'mountain',
  time:'day',
  weather:'clear',
  endless:true,
  targetSpeedKmh:82,
  distance:0,
  routeOrigin:0,
  envIndex:0,
  sound:false,
  width:0,
  height:0,
  dpr:1,
  lastT:performance.now(),
  worldTime:0,
  routeSeed:137.731,
  motionMath:'fallback',
  input:{left:false,right:false},
  vehicle:{
    x:0,y:0,z:0,
    heading:0,
    velocityHeading:0,
    speed:0,
    acceleration:0,
    steerInput:0,
    steerAngle:0,
    steeringWheelAngle:0,
    yawRate:0,
    slipAngle:0,
    grip:1,
    roll:0,
    pitch:0,
    lateralVelocity:0,
    longitudinalVelocity:0,
    lateralAcceleration:0,
    bodyY:0,
    bodyVy:0,
    suspensionTravel:0,
    suspensionImpact:0,
    rpm:900,
    gear:1,
    shiftPulse:0,
    roadOffset:0,
    roadHeadingError:0
  },
  camera:{
    x:0,y:1.35,z:0,
    targetX:0,targetY:1.35,targetZ:60,
    yaw:0,pitch:0,roll:0,fov:59,
    headX:0,headXV:0,
    headY:0,headYV:0,
    headZ:0,headZV:0,
    headRoll:0,headRollV:0,
    headYaw:0,headYawV:0,
    lookBias:0
  },
  world:{feature:null,featureAmount:0},
  performance:{fps:60,quality:1,lowFpsTime:0,highFpsTime:0},
  audio:null
};

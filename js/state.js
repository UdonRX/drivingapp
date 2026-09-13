export const ENVS=['mountain','country','city','coast'];
export const ENV_LABELS={mountain:'MOUNTAIN',country:'COUNTRY',city:'CITY',coast:'COAST'};
export const WEATHER_LABELS={clear:'CLEAR',cloudy:'CLOUDY',rain:'RAIN',fog:'FOG'};
export const palettes={day:{clear:['#79bff2','#dff2ff'],cloudy:['#7c8790','#c1c9ce'],rain:['#586671','#84939c'],fog:['#a9b6b7','#d7dedd']},sunset:{clear:['#675d9b','#f3a56f'],cloudy:['#5c586d','#c48372'],rain:['#4a4a5b','#815f68'],fog:['#8a7f83','#cab0a3']},night:{clear:['#07101f','#182743'],cloudy:['#111722','#293343'],rain:['#080f18','#1d2a37'],fog:['#1b2630','#43515a']}};
export const state={running:false,paused:false,environment:'mountain',time:'day',weather:'clear',control:'tilt',endless:true,speed:0,targetSpeed:76,distance:0,roadPhase:0,lateral:0,steer:0,buttonSteer:0,tiltSteer:0,tiltZero:null,sensorAvailable:false,sensorPermission:'unknown',lastT:performance.now(),envIndex:0,routeOrigin:0,feature:null,featureProgress:0,featureCooldown:0,sound:false,dpr:1,width:0,height:0,audio:null,fpsSmoother:60,routeSeed:Math.random()*1000,cameraYaw:0,cameraRoll:0,cameraBob:0,cameraPitch:0,cameraLookX:0,carYaw:0,roadYaw:0,suspensionKick:0,speedPulse:0,accelPulse:0};
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const lerp=(a,b,t)=>a+(b-a)*t;
export function smoothstep(a,b,x){const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)}
export function hash(n){return Math.abs(Math.sin(n*12.9898+state.routeSeed)*43758.5453)%1}
export function roadCurveAt(z){const d=state.distance*.0035+z*.0054;return Math.sin(d*.74)*.2+Math.sin(d*.205+1.7)*.34+Math.sin(d*.057)*.27}
export function roadPoint(t,w,h,hor){
  const speedN=clamp(state.speed/138,0,1);
  const expo=1.36-speedN*.07;
  const p=Math.pow(clamp(t,0,1),expo);
  const y=lerp(hor,h*1.035,p);
  const curve=roadCurveAt((1-t)*1080);
  const farBend=curve*w*.31*(1-t)*(1-p*.28);
  const cameraShift=(state.cameraYaw*.115+state.cameraLookX*.045)*w*(1-p*.22);
  const nearHalf=w*(.615+speedN*.045);
  const halfWidth=lerp(w*.092,nearHalf,p);
  const laneBias=halfWidth*.11*p;
  const lateralShift=state.lateral*w*.175*p;
  const center=w*.5+farBend-cameraShift-lateralShift+laneBias;
  return{x:center,y,halfWidth,perspective:p};
}

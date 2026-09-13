export const ENVS=['mountain','country','city','coast'];
export const ENV_LABELS={mountain:'MOUNTAIN',country:'COUNTRY',city:'CITY',coast:'COAST'};
export const WEATHER_LABELS={clear:'CLEAR',cloudy:'CLOUDY',rain:'RAIN',fog:'FOG'};
export const palettes={day:{clear:['#79bff2','#dff2ff'],cloudy:['#7c8790','#c1c9ce'],rain:['#586671','#84939c'],fog:['#a9b6b7','#d7dedd']},sunset:{clear:['#675d9b','#f3a56f'],cloudy:['#5c586d','#c48372'],rain:['#4a4a5b','#815f68'],fog:['#8a7f83','#cab0a3']},night:{clear:['#07101f','#182743'],cloudy:['#111722','#293343'],rain:['#080f18','#1d2a37'],fog:['#1b2630','#43515a']}};
export const state={running:false,paused:false,environment:'mountain',time:'day',weather:'clear',control:'tilt',endless:true,speed:0,targetSpeed:76,distance:0,roadPhase:0,lateral:0,steer:0,buttonSteer:0,tiltSteer:0,tiltZero:null,sensorAvailable:false,sensorPermission:'unknown',lastT:performance.now(),envIndex:0,routeOrigin:0,feature:null,featureProgress:0,featureCooldown:0,sound:false,dpr:1,width:0,height:0,audio:null,fpsSmoother:60,routeSeed:Math.random()*1000,cameraYaw:0,cameraRoll:0,cameraBob:0,carYaw:0,roadYaw:0,suspensionKick:0,speedPulse:0};
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const lerp=(a,b,t)=>a+(b-a)*t;
export function smoothstep(a,b,x){const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)}
export function hash(n){return Math.abs(Math.sin(n*12.9898+state.routeSeed)*43758.5453)%1}
export function roadCurveAt(z){const d=state.distance*.004+z*.006;return Math.sin(d*.72)*.22+Math.sin(d*.19+1.7)*.36+Math.sin(d*.055)*.32}
export function roadPoint(t,w,h,hor){const speedN=clamp(state.speed/138,0,1),expo=1.62-speedN*.18,p=Math.pow(t,expo),y=lerp(hor,h*1.08,p),curve=roadCurveAt((1-t)*1250),cameraShift=state.cameraYaw*w*.075*(1-p),center=w*.5+curve*w*.25*(1-t)-cameraShift-state.lateral*w*.21*p,nearBoost=1+speedN*.16,halfWidth=lerp(w*.021,w*.595*nearBoost,p);return{x:center,y,halfWidth,perspective:p}}

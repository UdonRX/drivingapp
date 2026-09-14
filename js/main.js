import{state,ENVS,ENV_LABELS,clamp,lerp,hash,roadCurveAt}from'./state.js';
import{updateAudio}from'./audio.js';
import{drawSky,drawFarEnvironment}from'./render-bg.js';
import{drawRoad}from'./road-surface.js';
import{drawRoadside}from'./roadside.js';
import{drawFeature,drawWeather,drawCockpit}from'./render-effects.js';
import{initControls}from'./controls.js';
import{ui,updateHud,toast}from'./ui.js';
const skin=document.createElement('link');skin.rel='stylesheet';skin.href='/jdm.css?v=pseudo3d-v1';document.head.appendChild(skin);
const canvas=document.getElementById('driveCanvas'),ctx=canvas.getContext('2d',{alpha:false,desynchronized:true});
function resize(){const r=canvas.getBoundingClientRect();state.dpr=Math.min(devicePixelRatio||1,2);state.width=Math.max(1,r.width);state.height=Math.max(1,r.height);canvas.width=Math.round(state.width*state.dpr);canvas.height=Math.round(state.height*state.dpr);ctx.setTransform(state.dpr,0,0,state.dpr,0,0);ctx.imageSmoothingEnabled=true}
function update(dt){
  if(!state.running||state.paused)return;
  const prevSpeed=state.speed;
  state.speed=lerp(state.speed,state.targetSpeed,1-Math.exp(-dt*1.7));
  const sn=clamp(state.speed/138,0,1),accel=(state.speed-prevSpeed)/Math.max(dt,.001);
  state.accelPulse=lerp(state.accelPulse,clamp(accel/24,-1,1),1-Math.exp(-dt*3.2));
  state.distance+=state.speed*dt*.94;
  state.worldZ+=state.speed/3.6*dt;
  state.roadPhase=(state.roadPhase+state.speed*dt*2.12)%10000;
  const raw=state.control==='tilt'?state.tiltSteer:state.buttonSteer;
  state.steer=lerp(state.steer,raw,1-Math.exp(-dt*7.2));
  state.lateral=clamp((state.lateral+state.steer*dt*(.42+sn*.42))*Math.pow(.986,dt*60),-.62,.62);
  const curve=roadCurveAt(72);
  state.roadYaw=lerp(state.roadYaw,curve*.055,1-Math.exp(-dt*3.8));
  const carTarget=state.steer*.028+curve*.018;
  state.carYaw=lerp(state.carYaw,carTarget,1-Math.exp(-dt*3.4));
  const lookTarget=curve*.045+state.steer*.012;
  state.cameraLookX=lerp(state.cameraLookX,lookTarget,1-Math.exp(-dt*1.65));
  const camTarget=state.carYaw*.42+curve*.025;
  state.cameraYaw=lerp(state.cameraYaw,camTarget,1-Math.exp(-dt*2.15));
  const rollTarget=clamp(-(state.steer*.012+curve*.008)*(.35+sn*.65),-.025,.025);
  state.cameraRoll=lerp(state.cameraRoll,rollTarget,1-Math.exp(-dt*2.8));
  state.cameraPitch=lerp(state.cameraPitch,state.accelPulse*(2.2+sn*1.2),1-Math.exp(-dt*2.5));
  const roadBuzz=Math.sin(state.worldZ*.62)*(.045+sn*.12)+Math.sin(state.worldZ*.23+1.4)*(.035+sn*.08);
  state.cameraBob=lerp(state.cameraBob,roadBuzz,1-Math.exp(-dt*7.5));
  state.speedPulse=lerp(state.speedPulse,clamp((state.speed-68)/70,0,1),1-Math.exp(-dt*2.2));
  const fovTarget=57.5+Math.pow(sn,1.35)*9+Math.max(0,state.accelPulse)*1.1;
  state.cameraFov=lerp(state.cameraFov,fovTarget,1-Math.exp(-dt*1.8));
  if(Math.floor(state.distance/520)!==Math.floor((state.distance-state.speed*dt*.94)/520)&&hash(Math.floor(state.distance/520))>.67)state.suspensionKick=1.35+sn*.8;
  state.suspensionKick=lerp(state.suspensionKick,0,1-Math.exp(-dt*7));
  if(state.endless){const next=(state.routeOrigin+Math.floor(state.distance/2600))%ENVS.length;if(next!==state.envIndex){state.envIndex=next;state.environment=ENVS[next];toast(`${ENV_LABELS[state.environment]} へ景色が変化`)}}
  state.featureCooldown-=dt;
  if(!state.feature&&state.featureCooldown<=0){const cycle=Math.floor(state.distance/700);if(cycle>0&&(cycle%6===2||cycle%6===4)){state.feature=cycle%6===2?'tunnel':'bridge';state.featureProgress=0}}
  if(state.feature){state.featureProgress+=dt*(.12+sn*.08);if(state.featureProgress>=1){state.feature=null;state.featureCooldown=14+hash(Math.floor(state.distance))*12}}
  updateAudio();updateHud();
}
function draw(){
  const w=state.width,h=state.height;if(!w||!h)return;
  const sn=clamp(state.speed/138,0,1),hor=h*(.405-sn*.008)+state.cameraPitch;
  ctx.save();ctx.translate(w*.5,h*.56);ctx.rotate(state.cameraRoll);ctx.translate(-w*.5,-h*.56+state.cameraBob+state.suspensionKick);
  drawSky(ctx,w,h,hor);drawFarEnvironment(ctx,w,h,hor);drawRoad(ctx,w,h,hor);drawRoadside(ctx,w,h,hor);drawFeature(ctx,w,h,hor);drawWeather(ctx,w,h,hor);ctx.restore();
  drawCockpit(ctx,w,h);
  if(!state.running){const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(0,0,0,.04)');g.addColorStop(1,'rgba(0,0,0,.22)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h)}
}
function frame(t){const dt=Math.min(.05,Math.max(.001,(t-state.lastT)/1000));state.lastT=t;state.fpsSmoother=lerp(state.fpsSmoother,1/dt,.05);update(dt);draw();requestAnimationFrame(frame)}
addEventListener('resize',resize,{passive:true});addEventListener('orientationchange',()=>setTimeout(resize,120));document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.running&&!state.paused){state.paused=true;ui.pauseOverlay.classList.remove('is-hidden')}state.lastT=performance.now()});if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(err=>console.warn('[ZenDrive] SW',err)));resize();initControls();draw();requestAnimationFrame(frame);

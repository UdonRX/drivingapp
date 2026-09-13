import{state,ENVS,ENV_LABELS,clamp,lerp,hash,roadCurveAt}from'./state.js';
import{updateAudio}from'./audio.js';
import{drawSky,drawFarEnvironment}from'./render-bg.js';
import{drawRoad}from'./road-surface.js';
import{drawRoadside}from'./roadside.js';
import{drawFeature,drawWeather,drawCockpit}from'./render-effects.js';
import{initControls}from'./controls.js';
import{ui,updateHud,toast}from'./ui.js';
const skin=document.createElement('link');skin.rel='stylesheet';skin.href='/jdm.css';document.head.appendChild(skin);
const canvas=document.getElementById('driveCanvas'),ctx=canvas.getContext('2d',{alpha:false,desynchronized:true});
function resize(){const r=canvas.getBoundingClientRect();state.dpr=Math.min(devicePixelRatio||1,2);state.width=Math.max(1,r.width);state.height=Math.max(1,r.height);canvas.width=Math.round(state.width*state.dpr);canvas.height=Math.round(state.height*state.dpr);ctx.setTransform(state.dpr,0,0,state.dpr,0,0);ctx.imageSmoothingEnabled=true}
function update(dt){
  if(!state.running||state.paused)return;
  const prevSpeed=state.speed;
  state.speed=lerp(state.speed,state.targetSpeed,1-Math.exp(-dt*1.65));
  const sn=clamp(state.speed/138,0,1);
  state.accelPulse=lerp(state.accelPulse,clamp((state.speed-prevSpeed)/Math.max(dt,0.001)/24,-1,1),1-Math.exp(-dt*3));
  state.distance+=state.speed*dt*.94;
  state.roadPhase=(state.roadPhase+state.speed*dt*2.12)%10000;
  const raw=state.control==='tilt'?state.tiltSteer:state.buttonSteer;
  state.steer=lerp(state.steer,raw,1-Math.exp(-dt*7.4));
  state.lateral=clamp((state.lateral+state.steer*dt*(.47+sn*.55))*Math.pow(.989,dt*60),-.66,.66);

  const nearCurve=roadCurveAt(85),farCurve=roadCurveAt(520);
  state.roadYaw=lerp(state.roadYaw,nearCurve,1-Math.exp(-dt*5.6));
  const carTarget=state.steer*.34+nearCurve*.21;
  state.carYaw=lerp(state.carYaw,carTarget,1-Math.exp(-dt*4.2));
  const lookTarget=state.carYaw*.58+farCurve*.15;
  state.cameraLookX=lerp(state.cameraLookX,lookTarget,1-Math.exp(-dt*2.05));
  const camTarget=state.carYaw*.48+nearCurve*.095;
  state.cameraYaw=lerp(state.cameraYaw,camTarget,1-Math.exp(-dt*2.45));
  const rollTarget=clamp(-(state.steer*.018+nearCurve*.011)*(.42+sn*.92),-.034,.034);
  state.cameraRoll=lerp(state.cameraRoll,rollTarget,1-Math.exp(-dt*3.15));
  const pitchTarget=-sn*.008-state.accelPulse*.005;
  state.cameraPitch=lerp(state.cameraPitch,pitchTarget,1-Math.exp(-dt*2.6));
  const fineBuzz=Math.sin(state.roadPhase*.115)*(.12+sn*.48)+Math.sin(state.roadPhase*.041)*(.11+sn*.31);
  state.cameraBob=lerp(state.cameraBob,fineBuzz,1-Math.exp(-dt*11));
  state.speedPulse=lerp(state.speedPulse,clamp((state.speed-62)/76,0,1),1-Math.exp(-dt*2.2));
  const prevDistance=state.distance-state.speed*dt*.94;
  if(Math.floor(state.distance/430)!==Math.floor(prevDistance/430)&&hash(Math.floor(state.distance/430))>.66)state.suspensionKick=2.2+sn*2.1;
  state.suspensionKick=lerp(state.suspensionKick,0,1-Math.exp(-dt*8.8));

  if(state.endless){const next=(state.routeOrigin+Math.floor(state.distance/2600))%ENVS.length;if(next!==state.envIndex){state.envIndex=next;state.environment=ENVS[next];toast(`${ENV_LABELS[state.environment]} へ景色が変化`)}}
  state.featureCooldown-=dt;
  if(!state.feature&&state.featureCooldown<=0){const cycle=Math.floor(state.distance/700);if(cycle>0&&(cycle%6===2||cycle%6===4)){state.feature=cycle%6===2?'tunnel':'bridge';state.featureProgress=0}}
  if(state.feature){state.featureProgress+=dt*(.12+sn*.08);if(state.featureProgress>=1){state.feature=null;state.featureCooldown=14+hash(Math.floor(state.distance))*12}}
  updateAudio();updateHud();
}
function draw(){
  const w=state.width,h=state.height;if(!w||!h)return;
  const sn=clamp(state.speed/138,0,1);
  const hor=h*(.302-sn*.014+state.cameraPitch);
  ctx.save();
  ctx.translate(w*.5,h*.57);
  ctx.rotate(state.cameraRoll);
  ctx.translate(-w*.5,-h*.57+state.cameraBob+state.suspensionKick);
  ctx.translate(-state.cameraLookX*w*.032,0);
  const shake=state.running?state.speedPulse*.34:0;
  if(shake)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
  drawSky(ctx,w,h,hor);
  drawFarEnvironment(ctx,w,h,hor);
  drawRoad(ctx,w,h,hor);
  drawRoadside(ctx,w,h,hor);
  drawFeature(ctx,w,h,hor);
  drawWeather(ctx,w,h,hor);
  drawCockpit(ctx,w,h);
  ctx.restore();
  if(!state.running){const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(0,0,0,.04)');g.addColorStop(1,'rgba(0,0,0,.22)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h)}
}
function frame(t){const dt=Math.min(.05,Math.max(.001,(t-state.lastT)/1000));state.lastT=t;state.fpsSmoother=lerp(state.fpsSmoother,1/dt,.05);update(dt);draw();requestAnimationFrame(frame)}
addEventListener('resize',resize,{passive:true});addEventListener('orientationchange',()=>setTimeout(resize,120));document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.running&&!state.paused){state.paused=true;ui.pauseOverlay.classList.remove('is-hidden')}state.lastT=performance.now()});if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(err=>console.warn('[ZenDrive] SW',err)));resize();initControls();draw();requestAnimationFrame(frame);

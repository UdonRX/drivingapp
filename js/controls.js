import{state,ENVS,clamp}from'./state.js';
import{toggleAudio,stopAudio}from'./audio.js';
import{resetVehicle}from'./vehicle.js';
import{resetCamera}from'./camera.js';
import{ui,toast,bindSettings,updateHud}from'./ui.js';

function setSteer(side,on){state.input[side]=on;ui[side==='left'?'leftBtn':'rightBtn'].classList.toggle('is-pressed',on)}
function bindSteer(btn,side){
  btn.addEventListener('pointerdown',e=>{e.preventDefault();try{btn.setPointerCapture(e.pointerId)}catch{}setSteer(side,true)});
  const up=e=>{e.preventDefault();setSteer(side,false)};
  btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);btn.addEventListener('lostpointercapture',up);
}
function resetDynamics(speed=18){resetVehicle(speed);resetCamera();state.lastT=performance.now()}

export function initControls(){
  bindSettings();bindSteer(ui.leftBtn,'left');bindSteer(ui.rightBtn,'right');
  const releaseAll=()=>{setSteer('left',false);setSteer('right',false)};addEventListener('blur',releaseAll);document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseAll()});
  addEventListener('keydown',e=>{if(e.repeat)return;if(e.key==='ArrowLeft'||e.key.toLowerCase()==='a')setSteer('left',true);if(e.key==='ArrowRight'||e.key.toLowerCase()==='d')setSteer('right',true)});
  addEventListener('keyup',e=>{if(e.key==='ArrowLeft'||e.key.toLowerCase()==='a')setSteer('left',false);if(e.key==='ArrowRight'||e.key.toLowerCase()==='d')setSteer('right',false)});

  ui.startBtn.addEventListener('click',()=>{state.endless=ui.endlessToggle.checked;state.envIndex=Math.max(0,ENVS.indexOf(state.environment));state.routeOrigin=state.envIndex;resetDynamics(18);state.running=true;state.paused=false;ui.startScreen.classList.add('is-hidden');ui.hud.classList.remove('is-hidden');ui.pauseOverlay.classList.add('is-hidden');updateHud()});
  ui.pauseBtn.addEventListener('click',()=>{state.paused=true;releaseAll();ui.pauseOverlay.classList.remove('is-hidden')});
  ui.resumeBtn.addEventListener('click',()=>{state.paused=false;ui.pauseOverlay.classList.add('is-hidden');state.lastT=performance.now()});
  ui.backToMenuBtn.addEventListener('click',()=>{state.running=false;state.paused=false;releaseAll();stopAudio(ui.soundBtn);ui.pauseOverlay.classList.add('is-hidden');ui.hud.classList.add('is-hidden');ui.startScreen.classList.remove('is-hidden')});
  ui.resetBtn.addEventListener('click',()=>{resetDynamics(24);toast('ドライブをリセットしました')});
  ui.speedDownBtn.addEventListener('click',()=>state.targetSpeedKmh=clamp(state.targetSpeedKmh-10,30,160));
  ui.speedUpBtn.addEventListener('click',()=>state.targetSpeedKmh=clamp(state.targetSpeedKmh+10,30,160));
  ui.soundBtn.addEventListener('click',()=>toggleAudio(ui.soundBtn));
  updateHud();
}

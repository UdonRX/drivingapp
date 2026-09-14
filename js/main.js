import{state,ENVS,ENV_LABELS,damp}from'./state.js';
import{initRenderer,resizeRenderer,renderWorld,setRenderQuality}from'./webgl-renderer.js';
import{updateVehicle,resetVehicle}from'./vehicle.js';
import{updateCamera,resetCamera}from'./camera.js';
import{updateAudio}from'./audio.js';
import{initControls}from'./controls.js';
import{initMotionMath}from'./motion-math.js';
import{ui,updateHud,toast}from'./ui.js';
const canvas=document.getElementById('driveCanvas');
function updateEnvironment(){if(!state.endless)return;const next=(state.routeOrigin+Math.floor(state.distance/2600))%ENVS.length;if(next!==state.envIndex){state.envIndex=next;state.environment=ENVS[next];toast(`${ENV_LABELS[state.environment]} へ景色が変化`)}}
function updatePerformance(dt){const p=state.performance,fps=1/Math.max(.001,dt);p.fps=damp(p.fps,fps,3.2,dt);if(p.fps<43){p.lowFpsTime+=dt;p.highFpsTime=0}else if(p.fps>56){p.highFpsTime+=dt;p.lowFpsTime=Math.max(0,p.lowFpsTime-dt)}else{p.lowFpsTime=Math.max(0,p.lowFpsTime-dt*.5);p.highFpsTime=0}if(p.lowFpsTime>2.2&&p.quality!==.72){p.quality=.72;setRenderQuality(.72);p.lowFpsTime=0}if(p.highFpsTime>6&&p.quality!==1){p.quality=1;setRenderQuality(1);p.highFpsTime=0}}
function update(dt){if(!state.running||state.paused)return;state.worldTime+=dt;updateVehicle(dt);updateCamera(dt);updateEnvironment();updateAudio(dt);updateHud();updatePerformance(dt)}
function frame(t){const dt=Math.min(.045,Math.max(.001,(t-state.lastT)/1000));state.lastT=t;update(dt);renderWorld();requestAnimationFrame(frame)}
function resize(){resizeRenderer()}
initMotionMath();
try{initRenderer(canvas)}catch(err){console.error('[ZenDrive] WebGL init failed',err);document.body.classList.add('webgl-failed');const note=document.getElementById('renderError');if(note){note.textContent='この端末ではWebGL2を開始できません。Safariを再読み込みしてください。';note.hidden=false}}
resetVehicle(0);resetCamera();initControls();updateHud();
addEventListener('resize',resize,{passive:true});addEventListener('orientationchange',()=>setTimeout(resize,100));
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.running&&!state.paused){state.paused=true;ui.pauseOverlay.classList.remove('is-hidden')}state.lastT=performance.now()});
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(err=>console.warn('[ZenDrive] SW',err)));
requestAnimationFrame(frame);

import{state,clamp,damp}from'./state.js';

const GEAR_RATIOS=[0,3.55,2.19,1.52,1.16,.91,.72];
const FINAL_DRIVE=3.42;
const WHEEL_CIRC=2.03;
const SHIFT_KMH=[0,22,43,68,96,126,999];

function noiseBuffer(ac,seconds=2){const b=ac.createBuffer(1,Math.floor(ac.sampleRate*seconds),ac.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return b}
function loopingNoise(ac,buffer,type,freq,q=1){const src=ac.createBufferSource(),filter=ac.createBiquadFilter(),gain=ac.createGain();src.buffer=buffer;src.loop=true;filter.type=type;filter.frequency.value=freq;filter.Q.value=q;gain.gain.value=.0001;src.connect(filter).connect(gain);src.start();return{src,filter,gain}}
function connectLayer(layer,node){layer.gain.connect(node)}

export function createAudio(){
  if(state.audio)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  const ac=new AC,master=ac.createGain(),compressor=ac.createDynamicsCompressor(),dry=ac.createGain(),wet=ac.createGain(),convolver=ac.createConvolver();
  master.gain.value=.0001;dry.gain.value=1;wet.gain.value=.0001;dry.connect(compressor);wet.connect(compressor);compressor.connect(master).connect(ac.destination);
  const impulse=ac.createBuffer(2,Math.floor(ac.sampleRate*.22),ac.sampleRate);for(let ch=0;ch<2;ch++){const d=impulse.getChannelData(ch);for(let i=0;i<d.length;i++){const t=1-i/d.length;d[i]=(Math.random()*2-1)*t*t*.36}}convolver.buffer=impulse;convolver.connect(wet);
  const engine=ac.createOscillator(),engine2=ac.createOscillator(),engineFilter=ac.createBiquadFilter(),engineGain=ac.createGain();engine.type='sawtooth';engine2.type='triangle';engineFilter.type='lowpass';engineFilter.frequency.value=900;engineGain.gain.value=.0001;engine.connect(engineFilter);engine2.connect(engineFilter);engineFilter.connect(engineGain);engineGain.connect(dry);engineGain.connect(convolver);engine.start();engine2.start();
  const transmission=ac.createOscillator(),transmissionGain=ac.createGain();transmission.type='square';transmissionGain.gain.value=.0001;transmission.connect(transmissionGain);transmissionGain.connect(dry);transmission.start();
  const noise=noiseBuffer(ac,2.5),wind=loopingNoise(ac,noise,'highpass',850,.7),tire=loopingNoise(ac,noise,'bandpass',420,.9),road=loopingNoise(ac,noise,'lowpass',240,.6),rain=loopingNoise(ac,noise,'highpass',1900,.5),suspension=loopingNoise(ac,noise,'bandpass',110,.8);
  [wind,tire,road,rain,suspension].forEach(l=>{connectLayer(l,dry);l.gain.connect(convolver)});
  state.audio={ac,master,dry,wet,convolver,engine,engine2,engineFilter,engineGain,transmission,transmissionGain,wind,tire,road,rain,suspension};
}

export function toggleAudio(button){state.sound=!state.sound;if(button)button.textContent=state.sound?'♫':'♪';if(state.sound){createAudio();if(state.audio?.ac.state==='suspended')state.audio.ac.resume()}else if(state.audio)state.audio.master.gain.setTargetAtTime(.0001,state.audio.ac.currentTime,.05)}
export function stopAudio(button){state.sound=false;if(button)button.textContent='♪';if(state.audio){try{state.audio.ac.close()}catch{}state.audio=null}}

function gearFor(kmh,current){let g=current;if(kmh>SHIFT_KMH[g]+3&&g<6)g++;else if(g>1&&kmh<SHIFT_KMH[g-1]-6)g--;return g}
function updatePowertrain(dt){
  const v=state.vehicle,kmh=v.speed*3.6;const next=gearFor(kmh,v.gear||1);if(next!==v.gear){v.gear=next;v.shiftPulse=1}v.shiftPulse=damp(v.shiftPulse,0,7,dt);
  const wheelRpm=(v.speed/WHEEL_CIRC)*60;let rpm=wheelRpm*GEAR_RATIOS[v.gear]*FINAL_DRIVE;rpm=Math.max(850,Math.min(6800,rpm));if(v.shiftPulse>.1)rpm*=1-v.shiftPulse*.18;v.rpm=damp(v.rpm,rpm,8,dt);
}

export function updateAudio(dt){
  updatePowertrain(dt);if(!state.sound||!state.audio)return;
  const a=state.audio,v=state.vehicle,ac=a.ac,t=ac.currentTime,kmh=v.speed*3.6,sn=clamp(kmh/150,0,1),rpmN=clamp((v.rpm-850)/5950,0,1),slip=clamp(Math.abs(v.slipAngle)*7,0,1),lat=clamp(Math.abs(v.lateralAcceleration)/8,0,1),tunnel=state.world.feature==='tunnel'?state.world.featureAmount:0;
  a.master.gain.setTargetAtTime(.075,t,.12);
  const fundamental=35+v.rpm/60*.72;a.engine.frequency.setTargetAtTime(fundamental,t,.035);a.engine2.frequency.setTargetAtTime(fundamental*.5,t,.045);a.engineFilter.frequency.setTargetAtTime(520+rpmN*2600,t,.06);a.engineGain.gain.setTargetAtTime(.075+rpmN*.16+Math.max(0,v.acceleration)*.012,t,.07);
  a.transmission.frequency.setTargetAtTime(70+v.rpm/60*1.9,t,.05);a.transmissionGain.gain.setTargetAtTime(.004+sn*.012+v.shiftPulse*.055,t,.025);
  a.wind.filter.frequency.setTargetAtTime(700+sn*2300,t,.08);a.wind.gain.gain.setTargetAtTime(.002+Math.pow(sn,1.8)*.18,t,.10);
  a.tire.filter.frequency.setTargetAtTime(260+sn*900,t,.08);a.tire.gain.gain.setTargetAtTime(.006+sn*.035+lat*.055+slip*.07,t,.07);
  a.road.filter.frequency.setTargetAtTime(120+sn*430,t,.10);a.road.gain.gain.setTargetAtTime(.008+sn*.08,t,.09);
  a.suspension.gain.gain.setTargetAtTime(v.suspensionImpact*.055,t,.025);a.rain.gain.gain.setTargetAtTime(state.weather==='rain'?(.035+sn*.035):.0001,t,.12);
  a.wet.gain.setTargetAtTime(tunnel*.26,t,.14);a.dry.gain.setTargetAtTime(1-tunnel*.12,t,.14);
}

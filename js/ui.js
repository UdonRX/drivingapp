import{state,ENVS,ENV_LABELS,WEATHER_LABELS,clamp}from'./state.js';
const $=id=>document.getElementById(id);
export const ui={
  startScreen:$('startScreen'),hud:$('hud'),startBtn:$('startBtn'),speedValue:$('speedValue'),gearValue:$('gearValue'),rpmValue:$('rpmValue'),environmentLabel:$('environmentLabel'),weatherLabel:$('weatherLabel'),pauseBtn:$('pauseBtn'),resetBtn:$('resetBtn'),pauseOverlay:$('pauseOverlay'),resumeBtn:$('resumeBtn'),backToMenuBtn:$('backToMenuBtn'),leftBtn:$('leftBtn'),rightBtn:$('rightBtn'),speedDownBtn:$('speedDownBtn'),speedUpBtn:$('speedUpBtn'),soundBtn:$('soundBtn'),endlessToggle:$('endlessToggle'),toast:$('toast')
};
export function updateHud(){
  const v=state.vehicle,kmh=v.speed*3.6;ui.speedValue.textContent=Math.round(kmh);ui.gearValue.textContent=`${v.gear}`;ui.rpmValue.textContent=`${Math.round(v.rpm/100)*100}`;ui.environmentLabel.textContent=ENV_LABELS[state.environment];ui.weatherLabel.textContent=WEATHER_LABELS[state.weather];document.documentElement.style.setProperty('--speed-pct',`${clamp(kmh/160,0,1)*100}%`);document.documentElement.style.setProperty('--steer-angle',`${v.steerAngle}rad`)
}
export function toast(message){ui.toast.textContent=message;ui.toast.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>ui.toast.classList.remove('show'),1900)}
export function bindSettings(){
  document.querySelectorAll('.segmented').forEach(group=>group.addEventListener('click',e=>{const btn=e.target.closest('button');if(!btn)return;const key=group.dataset.setting,n=key==='weather-extra'?'weather':key;document.querySelectorAll(`[data-setting="${n}"] button, [data-setting="${n}-extra"] button`).forEach(b=>b.classList.remove('active'));btn.classList.add('active');state[n]=btn.dataset.value;if(n==='environment')state.envIndex=Math.max(0,ENVS.indexOf(state.environment))}));
  ui.endlessToggle.addEventListener('change',()=>state.endless=ui.endlessToggle.checked)
}

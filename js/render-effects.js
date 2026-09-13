import { state, lerp, smoothstep, hash, clamp } from './state.js';

export function drawFeature(ctx,w,h,hor){if(!state.feature)return;const p=state.featureProgress,amount=Math.min(smoothstep(0,.22,p),1-smoothstep(.78,1,p));if(state.feature==='tunnel'){ctx.save();const top=lerp(hor-15,-h*.22,amount),side=lerp(w*.06,-w*.22,amount);ctx.fillStyle=`rgba(10,12,14,${.96*amount})`;ctx.fillRect(0,0,w,Math.max(0,hor+20));ctx.fillRect(0,0,Math.max(0,side+w*.24),h);ctx.fillRect(w-Math.max(0,side+w*.24),0,Math.max(0,side+w*.24),h);ctx.strokeStyle=`rgba(105,115,120,${.9*amount})`;ctx.lineWidth=Math.max(3,w*.018);ctx.beginPath();ctx.moveTo(side,h);ctx.lineTo(side,hor+30);ctx.quadraticCurveTo(w*.5,top,w-side,hor+30);ctx.lineTo(w-side,h);ctx.stroke();ctx.globalAlpha=amount;for(let i=0;i<7;i++){const yy=hor*.2+i*70-(state.roadPhase*1.8%70);ctx.strokeStyle='rgba(255,230,170,.62)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(w*.43,yy);ctx.lineTo(w*.57,yy);ctx.stroke()}ctx.restore()}else{ctx.save();ctx.globalAlpha=amount;const railY=h*.73;ctx.strokeStyle=state.time==='night'?'#8d9499':'#d3d6d7';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,railY);ctx.lineTo(w*.36,hor+20);ctx.moveTo(w,railY);ctx.lineTo(w*.64,hor+20);ctx.stroke();for(let i=0;i<12;i++){const t=i/11,y=lerp(railY,hor+20,t),xl=lerp(0,w*.36,t),xr=lerp(w,w*.64,t);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(xl,y);ctx.lineTo(xl,y-18*(1-t));ctx.moveTo(xr,y);ctx.lineTo(xr,y-18*(1-t));ctx.stroke()}ctx.restore()}}

export function drawWeather(ctx,w,h,hor){if(state.weather==='fog'){const g=ctx.createLinearGradient(0,hor-90,0,h*.78);g.addColorStop(0,'rgba(230,236,235,.72)');g.addColorStop(.5,'rgba(220,228,227,.36)');g.addColorStop(1,'rgba(220,228,227,0)');ctx.fillStyle=g;ctx.fillRect(0,hor-100,w,h*.75)}if(state.weather==='rain'){const count=state.fpsSmoother<43?55:90;ctx.save();ctx.strokeStyle='rgba(210,228,236,.5)';ctx.lineWidth=1;const slant=state.steer*6;for(let i=0;i<count;i++){const x=(hash(i*5.3)*w+state.roadPhase*(.4+hash(i))*.8)%(w+60)-30,y=(hash(i*7.7)*h+state.roadPhase*(2.2+hash(i))*.5)%h,len=7+hash(i*3.2)*18+state.speed*.04;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-slant,y+len);ctx.stroke()}ctx.restore()}}

export function drawCockpit(ctx,w,h){
  const speedN=clamp(state.speed/138,0,1);
  const yaw=state.carYaw*w*.055;
  const bob=Math.sin(state.roadPhase*.055)*(0.5+speedN*1.25)+state.suspensionKick*.32;
  const top=h*.775;
  ctx.save();
  ctx.translate(yaw,bob);
  ctx.rotate(state.carYaw*.018);

  ctx.fillStyle='rgba(5,8,11,.84)';
  ctx.beginPath();
  ctx.moveTo(0,h*.87);ctx.lineTo(0,h);
  ctx.lineTo(w,h);ctx.lineTo(w,h*.87);
  ctx.lineTo(w*.94,h*.83);ctx.lineTo(w*.06,h*.83);ctx.closePath();ctx.fill();

  const hood=ctx.createLinearGradient(0,top,0,h);
  hood.addColorStop(0,'#34404a');
  hood.addColorStop(.18,'#202933');
  hood.addColorStop(.58,'#10161d');
  hood.addColorStop(1,'#06090d');
  ctx.fillStyle=hood;
  ctx.beginPath();
  ctx.moveTo(-w*.04,h);
  ctx.lineTo(w*.035,h*.91);
  ctx.quadraticCurveTo(w*.17,top+18,w*.39,top+3);
  ctx.quadraticCurveTo(w*.5,top-9,w*.61,top+3);
  ctx.quadraticCurveTo(w*.83,top+18,w*.965,h*.91);
  ctx.lineTo(w*1.04,h);
  ctx.closePath();ctx.fill();

  const highlight=ctx.createLinearGradient(0,0,w,0);
  highlight.addColorStop(0,'rgba(255,255,255,0)');
  highlight.addColorStop(.46,'rgba(194,220,235,.16)');
  highlight.addColorStop(.54,'rgba(255,255,255,.22)');
  highlight.addColorStop(1,'rgba(255,255,255,0)');
  ctx.strokeStyle=highlight;ctx.lineWidth=1.4;
  ctx.beginPath();ctx.moveTo(w*.08,h*.91);ctx.quadraticCurveTo(w*.34,top+12,w*.48,top+2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(w*.92,h*.91);ctx.quadraticCurveTo(w*.66,top+12,w*.52,top+2);ctx.stroke();

  ctx.strokeStyle='rgba(0,0,0,.42)';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(w*.5,top-5);ctx.lineTo(w*.5,h*.965);ctx.stroke();

  ctx.fillStyle='rgba(4,7,10,.78)';
  ctx.beginPath();ctx.moveTo(0,h*.88);ctx.lineTo(w*.07,h*.83);ctx.lineTo(w*.13,h*.845);ctx.lineTo(w*.08,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(w,h*.88);ctx.lineTo(w*.93,h*.83);ctx.lineTo(w*.87,h*.845);ctx.lineTo(w*.92,h);ctx.lineTo(w,h);ctx.closePath();ctx.fill();

  ctx.globalAlpha=.18+speedN*.08;ctx.fillStyle='#a9d0e4';ctx.fillRect(w*.45,top+1,w*.1,2);
  ctx.restore();
}

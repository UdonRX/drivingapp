import{state,lerp,smoothstep,hash,clamp}from'./state.js';
export function drawFeature(ctx,w,h,hor){if(!state.feature)return;const p=state.featureProgress,amount=Math.min(smoothstep(0,.22,p),1-smoothstep(.78,1,p));if(state.feature==='tunnel'){ctx.save();const top=lerp(hor-15,-h*.22,amount),side=lerp(w*.06,-w*.22,amount);ctx.fillStyle=`rgba(10,12,14,${.96*amount})`;ctx.fillRect(0,0,w,Math.max(0,hor+20));ctx.fillRect(0,0,Math.max(0,side+w*.24),h);ctx.fillRect(w-Math.max(0,side+w*.24),0,Math.max(0,side+w*.24),h);ctx.strokeStyle=`rgba(105,115,120,${.9*amount})`;ctx.lineWidth=Math.max(3,w*.018);ctx.beginPath();ctx.moveTo(side,h);ctx.lineTo(side,hor+30);ctx.quadraticCurveTo(w*.5,top,w-side,hor+30);ctx.lineTo(w-side,h);ctx.stroke();ctx.globalAlpha=amount;for(let i=0;i<7;i++){const yy=hor*.2+i*70-(state.roadPhase*1.8%70);ctx.strokeStyle='rgba(255,230,170,.62)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(w*.43,yy);ctx.lineTo(w*.57,yy);ctx.stroke()}ctx.restore()}else{ctx.save();ctx.globalAlpha=amount;const railY=h*.73;ctx.strokeStyle=state.time==='night'?'#8d9499':'#d3d6d7';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,railY);ctx.lineTo(w*.36,hor+20);ctx.moveTo(w,railY);ctx.lineTo(w*.64,hor+20);ctx.stroke();for(let i=0;i<12;i++){const t=i/11,y=lerp(railY,hor+20,t),xl=lerp(0,w*.36,t),xr=lerp(w,w*.64,t);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(xl,y);ctx.lineTo(xl,y-18*(1-t));ctx.moveTo(xr,y);ctx.lineTo(xr,y-18*(1-t));ctx.stroke()}ctx.restore()}}
export function drawWeather(ctx,w,h,hor){if(state.weather==='fog'){const g=ctx.createLinearGradient(0,hor-90,0,h*.78);g.addColorStop(0,'rgba(230,236,235,.72)');g.addColorStop(.5,'rgba(220,228,227,.36)');g.addColorStop(1,'rgba(220,228,227,0)');ctx.fillStyle=g;ctx.fillRect(0,hor-100,w,h*.75)}if(state.weather==='rain'){const count=state.fpsSmoother<43?55:90;ctx.save();ctx.strokeStyle='rgba(210,228,236,.5)';ctx.lineWidth=1;const slant=state.steer*6;for(let i=0;i<count;i++){const x=(hash(i*5.3)*w+state.roadPhase*(.4+hash(i))*.8)%(w+60)-30,y=(hash(i*7.7)*h+state.roadPhase*(2.2+hash(i))*.5)%h,len=7+hash(i*3.2)*18+state.speed*.04;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-slant,y+len);ctx.stroke()}ctx.restore()}}
export function drawCockpit(ctx,w,h){
  const speedN=clamp(state.speed/138,0,1),yaw=state.carYaw*w*.065;
  const bob=Math.sin(state.roadPhase*.052)*(.35+speedN*.95)+state.suspensionKick*.24;
  const hoodTop=h*.724;
  ctx.save();ctx.translate(yaw,bob);ctx.rotate(state.carYaw*.014);

  ctx.fillStyle='rgba(2,5,8,.96)';
  ctx.beginPath();ctx.moveTo(0,h*.89);ctx.lineTo(0,h);ctx.lineTo(w,h);ctx.lineTo(w,h*.89);ctx.lineTo(w*.95,h*.835);ctx.lineTo(w*.05,h*.835);ctx.closePath();ctx.fill();

  const hood=ctx.createLinearGradient(0,hoodTop,0,h);
  hood.addColorStop(0,state.time==='night'?'#1c2731':'#334552');hood.addColorStop(.18,'#22313d');hood.addColorStop(.55,'#111a22');hood.addColorStop(1,'#05080c');ctx.fillStyle=hood;
  ctx.beginPath();ctx.moveTo(-w*.08,h);ctx.lineTo(w*.015,h*.91);ctx.quadraticCurveTo(w*.11,h*.79,w*.31,hoodTop+18);ctx.quadraticCurveTo(w*.43,hoodTop-4,w*.5,hoodTop-8);ctx.quadraticCurveTo(w*.57,hoodTop-4,w*.69,hoodTop+18);ctx.quadraticCurveTo(w*.89,h*.79,w*.985,h*.91);ctx.lineTo(w*1.08,h);ctx.closePath();ctx.fill();

  const skyRef=ctx.createLinearGradient(0,hoodTop,0,h*.86);skyRef.addColorStop(0,state.time==='night'?'rgba(80,116,150,.22)':'rgba(175,218,241,.34)');skyRef.addColorStop(.5,'rgba(120,164,190,.12)');skyRef.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=skyRef;ctx.beginPath();ctx.moveTo(w*.18,h*.82);ctx.quadraticCurveTo(w*.34,hoodTop+5,w*.5,hoodTop);ctx.quadraticCurveTo(w*.66,hoodTop+5,w*.82,h*.82);ctx.lineTo(w*.72,h*.84);ctx.quadraticCurveTo(w*.5,h*.77,w*.28,h*.84);ctx.closePath();ctx.fill();

  ctx.strokeStyle='rgba(214,233,242,.24)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(w*.08,h*.9);ctx.quadraticCurveTo(w*.31,hoodTop+20,w*.48,hoodTop+2);ctx.stroke();ctx.beginPath();ctx.moveTo(w*.92,h*.9);ctx.quadraticCurveTo(w*.69,hoodTop+20,w*.52,hoodTop+2);ctx.stroke();
  ctx.strokeStyle='rgba(0,0,0,.52)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(w*.5,hoodTop-6);ctx.lineTo(w*.5,h*.985);ctx.stroke();

  ctx.fillStyle='rgba(3,6,9,.92)';ctx.fillRect(w*.11,h*.862,w*.78,h*.025);
  ctx.strokeStyle='rgba(130,145,153,.28)';ctx.lineWidth=2;for(let i=0;i<7;i++){const x=w*(.25+i*.083);ctx.beginPath();ctx.moveTo(x,h*.865);ctx.lineTo(x+w*.02,h*.882);ctx.stroke()}

  ctx.fillStyle='rgba(4,7,10,.88)';ctx.beginPath();ctx.moveTo(0,h*.88);ctx.lineTo(w*.06,h*.82);ctx.lineTo(w*.13,h*.835);ctx.lineTo(w*.09,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(w,h*.88);ctx.lineTo(w*.94,h*.82);ctx.lineTo(w*.87,h*.835);ctx.lineTo(w*.91,h);ctx.lineTo(w,h);ctx.closePath();ctx.fill();
  ctx.restore();
}

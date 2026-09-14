import{state,lerp,smoothstep,hash,clamp}from'./state.js';
export function drawFeature(ctx,w,h,hor){if(!state.feature)return;const p=state.featureProgress,amount=Math.min(smoothstep(0,.22,p),1-smoothstep(.78,1,p));if(state.feature==='tunnel'){ctx.save();const top=lerp(hor-15,-h*.22,amount),side=lerp(w*.06,-w*.22,amount);ctx.fillStyle=`rgba(10,12,14,${.96*amount})`;ctx.fillRect(0,0,w,Math.max(0,hor+20));ctx.fillRect(0,0,Math.max(0,side+w*.24),h);ctx.fillRect(w-Math.max(0,side+w*.24),0,Math.max(0,side+w*.24),h);ctx.strokeStyle=`rgba(105,115,120,${.9*amount})`;ctx.lineWidth=Math.max(3,w*.018);ctx.beginPath();ctx.moveTo(side,h);ctx.lineTo(side,hor+30);ctx.quadraticCurveTo(w*.5,top,w-side,hor+30);ctx.lineTo(w-side,h);ctx.stroke();ctx.globalAlpha=amount;for(let i=0;i<7;i++){const yy=hor*.2+i*70-(state.roadPhase*1.8%70);ctx.strokeStyle='rgba(255,230,170,.62)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(w*.43,yy);ctx.lineTo(w*.57,yy);ctx.stroke()}ctx.restore()}else{ctx.save();ctx.globalAlpha=amount;const railY=h*.73;ctx.strokeStyle=state.time==='night'?'#8d9499':'#d3d6d7';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,railY);ctx.lineTo(w*.36,hor+20);ctx.moveTo(w,railY);ctx.lineTo(w*.64,hor+20);ctx.stroke();for(let i=0;i<12;i++){const t=i/11,y=lerp(railY,hor+20,t),xl=lerp(0,w*.36,t),xr=lerp(w,w*.64,t);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(xl,y);ctx.lineTo(xl,y-18*(1-t));ctx.moveTo(xr,y);ctx.lineTo(xr,y-18*(1-t));ctx.stroke()}ctx.restore()}}
export function drawWeather(ctx,w,h,hor){if(state.weather==='fog'){const g=ctx.createLinearGradient(0,hor-90,0,h*.78);g.addColorStop(0,'rgba(230,236,235,.72)');g.addColorStop(.5,'rgba(220,228,227,.36)');g.addColorStop(1,'rgba(220,228,227,0)');ctx.fillStyle=g;ctx.fillRect(0,hor-100,w,h*.75)}if(state.weather==='rain'){const count=state.fpsSmoother<43?55:90;ctx.save();ctx.strokeStyle='rgba(210,228,236,.5)';ctx.lineWidth=1;const slant=state.steer*6;for(let i=0;i<count;i++){const x=(hash(i*5.3)*w+state.roadPhase*(.4+hash(i))*.8)%(w+60)-30,y=(hash(i*7.7)*h+state.roadPhase*(2.2+hash(i))*.5)%h,len=7+hash(i*3.2)*18+state.speed*.04;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-slant,y+len);ctx.stroke()}ctx.restore()}}
export function drawCockpit(ctx,w,h){
  const dashY=h*.89,night=state.time==='night';ctx.save();

  // Thin windshield frame / A-pillars: enough to anchor the eye in the cabin without
  // sacrificing peripheral optical flow.
  const pillar=Math.max(12,w*.038);ctx.fillStyle='rgba(3,6,9,.9)';
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(pillar*.72,0);ctx.lineTo(pillar*2.15,dashY+10);ctx.lineTo(0,dashY+28);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(w-pillar*.72,0);ctx.lineTo(w,0);ctx.lineTo(w,dashY+28);ctx.lineTo(w-pillar*2.15,dashY+10);ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(2,5,8,.68)';ctx.fillRect(0,0,w,Math.max(5,h*.012));

  // Small rear-view mirror, fixed to the viewer.
  const mw=Math.min(94,w*.24),mh=Math.max(18,h*.025),mx=(w-mw)*.5,my=Math.max(9,h*.025);ctx.fillStyle='rgba(5,8,11,.92)';ctx.beginPath();ctx.roundRect(mx,my,mw,mh,5);ctx.fill();ctx.fillStyle=night?'rgba(40,54,67,.7)':'rgba(91,117,135,.55)';ctx.fillRect(mx+4,my+4,mw-8,mh-8);

  // Only a tiny hood/windshield-base sliver remains visible.
  const hood=ctx.createLinearGradient(0,dashY-9,0,dashY+10);hood.addColorStop(0,'rgba(66,91,108,.8)');hood.addColorStop(1,'rgba(15,26,34,.9)');ctx.fillStyle=hood;ctx.beginPath();ctx.moveTo(w*.25,dashY+4);ctx.quadraticCurveTo(w*.5,dashY-7,w*.75,dashY+4);ctx.lineTo(w*.72,dashY+12);ctx.lineTo(w*.28,dashY+12);ctx.closePath();ctx.fill();

  const dash=ctx.createLinearGradient(0,dashY,0,h);dash.addColorStop(0,'rgba(13,18,23,.93)');dash.addColorStop(.24,'rgba(5,9,13,.98)');dash.addColorStop(1,'#020406');ctx.fillStyle=dash;ctx.beginPath();ctx.moveTo(0,dashY+21);ctx.quadraticCurveTo(w*.18,dashY-7,w*.34,dashY+3);ctx.quadraticCurveTo(w*.5,dashY-8,w*.66,dashY+3);ctx.quadraticCurveTo(w*.82,dashY-7,w,dashY+21);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(145,164,176,.13)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(w*.05,dashY+17);ctx.quadraticCurveTo(w*.5,dashY-4,w*.95,dashY+17);ctx.stroke();

  // Partial steering wheel. It reacts to steering, but the cockpit itself stays fixed.
  ctx.save();ctx.translate(w*.5,h*1.015);ctx.rotate(state.steer*.16);const r=Math.min(w*.19,h*.095);ctx.strokeStyle='rgba(4,7,10,.98)';ctx.lineWidth=Math.max(11,r*.18);ctx.beginPath();ctx.arc(0,0,r,Math.PI*1.06,Math.PI*1.94);ctx.stroke();ctx.strokeStyle='rgba(73,82,88,.42)';ctx.lineWidth=Math.max(1.5,r*.025);ctx.beginPath();ctx.arc(0,0,r,Math.PI*1.07,Math.PI*1.93);ctx.stroke();ctx.restore();
  ctx.restore();
}

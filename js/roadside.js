import{state,ROAD_HALF_WIDTH,ROAD_NEAR_Z,CAMERA_HEIGHT,hash,clamp,focalLengthFor,vanishingX,roadCenterWorldX}from'./state.js';

function roadsideObject(ctx,x,y,s,side,i){
  const env=state.environment,night=state.time==='night';ctx.save();ctx.translate(x,y);
  if(env==='city'){
    const bh=54*s,bw=24*s;ctx.fillStyle=night?'#151b22':'#68727a';ctx.fillRect(-bw/2,-bh,bw,bh);
    if(night&&s>.28){ctx.fillStyle='#ffd77f';ctx.globalAlpha=.7;for(let yy=-bh+8*s;yy<-6*s;yy+=10*s)ctx.fillRect(-bw*.23,yy,3*s,4*s);ctx.globalAlpha=1}
    if(i%2===0){ctx.strokeStyle='#3e444b';ctx.lineWidth=Math.max(1,2*s);ctx.beginPath();ctx.moveTo(side*18*s,0);ctx.lineTo(side*18*s,-48*s);ctx.stroke();if(night){ctx.fillStyle='#ffe6a1';ctx.shadowColor='#ffe6a1';ctx.shadowBlur=Math.min(12,10*s);ctx.beginPath();ctx.arc(side*18*s,-49*s,3*s,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}}
  }else if(env==='mountain'){
    ctx.fillStyle=night?'#102017':'#245432';ctx.beginPath();ctx.moveTo(0,-54*s);ctx.lineTo(-20*s,-12*s);ctx.lineTo(-9*s,-12*s);ctx.lineTo(-25*s,10*s);ctx.lineTo(24*s,10*s);ctx.lineTo(8*s,-12*s);ctx.lineTo(19*s,-12*s);ctx.closePath();ctx.fill();ctx.fillStyle='#493d2c';ctx.fillRect(-2.5*s,-3*s,5*s,14*s);
  }else if(env==='coast'){
    if(i%3===0){ctx.strokeStyle=night?'#a2a7a7':'#e5e6e3';ctx.lineWidth=Math.max(1,2*s);ctx.beginPath();ctx.moveTo(-12*s,0);ctx.lineTo(-12*s,-20*s);ctx.moveTo(12*s,0);ctx.lineTo(12*s,-20*s);ctx.moveTo(-14*s,-18*s);ctx.lineTo(14*s,-18*s);ctx.stroke()}else{ctx.fillStyle=night?'#18271d':'#3f7144';ctx.beginPath();ctx.arc(0,-9*s,10*s,0,Math.PI*2);ctx.fill()}
  }else if(i%3===0){
    ctx.strokeStyle=night?'#626562':'#5f625b';ctx.lineWidth=Math.max(1,2*s);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-52*s);ctx.moveTo(-12*s,-43*s);ctx.lineTo(12*s,-43*s);ctx.stroke();
  }else{ctx.fillStyle=night?'#263421':'#5d7a43';ctx.fillRect(-18*s,-12*s,36*s,12*s)}
  ctx.restore();
}

function drawGuardrails(ctx,w,hor,focal,vx,cameraX,speedN){
  const spacing=10,maxZ=520,offset=state.worldZ%spacing,count=Math.ceil((maxZ+offset)/spacing);
  ctx.save();ctx.lineCap='round';ctx.strokeStyle=state.time==='night'?'rgba(180,190,196,.7)':'rgba(224,227,227,.88)';
  for(const side of[-1,1]){
    for(let i=count;i>=1;i--){
      let zn=i*spacing-offset,zf=(i+1)*spacing-offset;if(zf<=ROAD_NEAR_Z)continue;zn=Math.max(ROAD_NEAR_Z,zn);
      const sn=focal/zn,sf=focal/zf,gn=1+speedN*Math.max(0,1-zn/115)*.055,gf=1+speedN*Math.max(0,1-zf/115)*.055;
      let xn=vx+(roadCenterWorldX(zn)+side*(ROAD_HALF_WIDTH+.42)-cameraX)*sn,xf=vx+(roadCenterWorldX(zf)+side*(ROAD_HALF_WIDTH+.42)-cameraX)*sf;xn=vx+(xn-vx)*gn;xf=vx+(xf-vx)*gf;
      const yn=hor+CAMERA_HEIGHT*sn-.42*sn,yf=hor+CAMERA_HEIGHT*sf-.42*sf;
      ctx.lineWidth=clamp(sn*.025,.55,3.1);ctx.beginPath();ctx.moveTo(xf,yf);ctx.lineTo(xn,yn);ctx.stroke();
      const absolute=Math.floor((state.worldZ+zn)/spacing);if(absolute%2===0&&zn<260){const roadY=hor+CAMERA_HEIGHT*sn;ctx.lineWidth=clamp(sn*.018,.5,2.2);ctx.beginPath();ctx.moveTo(xn,roadY);ctx.lineTo(xn,yn);ctx.stroke()}
    }
  }
  ctx.restore();
}

export function drawRoadside(ctx,w,h,hor){
  const focal=focalLengthFor(w),vx=vanishingX(w),cameraX=state.lateral*ROAD_HALF_WIDTH*.54,speedN=clamp(state.speed/138,0,1);
  drawGuardrails(ctx,w,hor,focal,vx,cameraX,speedN);

  const spacing=31,maxZ=760,base=Math.floor(state.worldZ/spacing),count=state.fpsSmoother<43?18:25;
  for(let j=count;j>=1;j--){
    const id=base+j,jitter=(hash(id*5.91)-.5)*spacing*.54,z=id*spacing+jitter-state.worldZ;if(z<2.2||z>maxZ)continue;
    const side=hash(id*1.73)>.5?1:-1,spread=2.2+hash(id*8.31)*5.8;
    const scale=focal/z,gain=1+speedN*Math.max(0,1-z/115)*.055;
    let x=vx+(roadCenterWorldX(z)+side*(ROAD_HALF_WIDTH+spread)-cameraX)*scale;x=vx+(x-vx)*gain;
    const y=hor+CAMERA_HEIGHT*scale,s=clamp(scale*.115,.045,5.1);
    const fade=clamp((780-z)/270,.28,1);ctx.globalAlpha=fade;roadsideObject(ctx,x,y,s,side,id);ctx.globalAlpha=1;
  }
}

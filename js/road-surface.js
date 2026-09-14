import{state,ROAD_SEGMENT_LENGTH,ROAD_DRAW_DISTANCE,ROAD_NEAR_Z,ROAD_HALF_WIDTH,CAMERA_HEIGHT,clamp,hash,focalLengthFor,vanishingX,roadCenterWorldX}from'./state.js';

function quad(ctx,x1,y1,x2,y2,x3,y3,x4,y4,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineTo(x3,y3);ctx.lineTo(x4,y4);ctx.closePath();ctx.fill()}
function band(ctx,cf,yf,sf,gf,cn,yn,sn,gn,lateral,width,color){const xf=cf+lateral*sf*gf,xn=cn+lateral*sn*gn,wf=Math.max(.35,width*sf*gf),wn=Math.max(.5,width*sn*gn);quad(ctx,xf-wf,yf,xf+wf,yf,xn+wn,yn,xn-wn,yn,color)}

export function drawRoad(ctx,w,h,hor){
  const focal=focalLengthFor(w),vx=vanishingX(w),cameraX=state.lateral*ROAD_HALF_WIDTH*.54;
  const speedN=clamp(state.speed/138,0,1),offset=state.worldZ%ROAD_SEGMENT_LENGTH;
  const maxI=Math.ceil((ROAD_DRAW_DISTANCE+offset)/ROAD_SEGMENT_LENGTH),step=state.fpsSmoother<43?2:1,startI=maxI-(maxI%step);
  const roadColor=state.time==='night'?'#171b1f':state.weather==='rain'?'#30363a':'#34383b';
  const shoulder=state.environment==='coast'?'#77746d':state.environment==='city'?'#464b4e':'#565a50';
  const edgeColor=state.time==='night'?'rgba(237,241,239,.88)':'rgba(246,246,240,.96)';
  const laneColor='rgba(246,246,241,.9)',centerColor='rgba(225,157,55,.96)';

  for(let i=startI;i>=0;i-=step){
    let zNear=i*ROAD_SEGMENT_LENGTH-offset,zFar=(i+step)*ROAD_SEGMENT_LENGTH-offset;
    if(zFar<=ROAD_NEAR_Z||zNear>ROAD_DRAW_DISTANCE)continue;
    zNear=Math.max(ROAD_NEAR_Z,zNear);zFar=Math.min(ROAD_DRAW_DISTANCE,zFar);

    const sf=focal/zFar,sn=focal/zNear;
    const gf=1+speedN*Math.max(0,1-zFar/115)*.055,gn=1+speedN*Math.max(0,1-zNear/115)*.055;
    let cf=vx+(roadCenterWorldX(zFar)-cameraX)*sf,cn=vx+(roadCenterWorldX(zNear)-cameraX)*sn;
    cf=vx+(cf-vx)*gf;cn=vx+(cn-vx)*gn;
    const yf=hor+CAMERA_HEIGHT*sf,yn=hor+CAMERA_HEIGHT*sn;
    const hwf=ROAD_HALF_WIDTH*sf*gf,hwn=ROAD_HALF_WIDTH*sn*gn;
    const lf=cf-hwf,rf=cf+hwf,ln=cn-hwn,rn=cn+hwn;

    quad(ctx,0,yf,lf,yf,ln,yn,0,yn,shoulder);
    quad(ctx,rf,yf,w,yf,w,yn,rn,yn,shoulder);
    quad(ctx,lf,yf,rf,yf,rn,yn,ln,yn,roadColor);

    band(ctx,cf,yf,sf,gf,cn,yn,sn,gn,-ROAD_HALF_WIDTH,.055,edgeColor);
    band(ctx,cf,yf,sf,gf,cn,yn,sn,gn, ROAD_HALF_WIDTH,.055,edgeColor);
    band(ctx,cf,yf,sf,gf,cn,yn,sn,gn,-.105,.045,centerColor);
    band(ctx,cf,yf,sf,gf,cn,yn,sn,gn, .105,.045,centerColor);

    const segId=Math.floor((state.worldZ+zNear)/ROAD_SEGMENT_LENGTH);
    if(segId%3===0&&zNear>5){
      band(ctx,cf,yf,sf,gf,cn,yn,sn,gn,-ROAD_HALF_WIDTH*.5,.045,laneColor);
      band(ctx,cf,yf,sf,gf,cn,yn,sn,gn, ROAD_HALF_WIDTH*.5,.045,laneColor);
    }

    const wear=hash(segId*3.17);
    if(wear>.73&&zNear<330){
      const lateral=(hash(segId*7.31)-.5)*ROAD_HALF_WIDTH*1.22;
      const xf=cf+lateral*sf*gf,xn=cn+(lateral+(hash(segId+9)-.5)*.12)*sn*gn;
      ctx.strokeStyle=state.time==='night'?'rgba(205,214,218,.055)':'rgba(12,15,17,.09)';
      ctx.lineWidth=Math.max(.45,Math.min(2.2,sn*.018));ctx.beginPath();ctx.moveTo(xf,yf);ctx.lineTo(xn,yn);ctx.stroke();
    }
    if(state.weather==='rain'&&zNear<90&&segId%4===0){
      band(ctx,cf,yf,sf,gf,cn,yn,sn,gn,(hash(segId)-.5)*ROAD_HALF_WIDTH*1.25,.15,state.time==='night'?'rgba(115,165,198,.09)':'rgba(205,228,238,.08)');
    }
  }
}

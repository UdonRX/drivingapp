import{state,roadPoint,clamp,hash}from'./state.js';
function quad(ctx,a,b,c,d,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.closePath();ctx.fill()}
function strip(ctx,p1,p2,offset1,offset2,width1,width2,color){quad(ctx,{x:p1.x+p1.halfWidth*offset1-width1,y:p1.y},{x:p1.x+p1.halfWidth*offset1+width1,y:p1.y},{x:p2.x+p2.halfWidth*offset2+width2,y:p2.y},{x:p2.x+p2.halfWidth*offset2-width2,y:p2.y},color)}
export function drawRoad(ctx,w,h,hor){
  const slices=state.fpsSmoother<43?56:78;
  const speedN=clamp(state.speed/138,0,1);
  for(let i=0;i<slices;i++){
    const t1=i/slices,t2=(i+1)/slices;
    const p1=roadPoint(t1,w,h,hor),p2=roadPoint(t2,w,h,hor);
    const alt=Math.floor(state.roadPhase*.075+i*1.15)%2===0;
    const road=state.time==='night'?(alt?'#171b20':'#1b2025'):(alt?'#373b3e':'#3b3f42');
    const shoulder=state.environment==='coast'?'#8a8178':state.environment==='city'?'#4b5053':'#5f6159';
    quad(ctx,{x:0,y:p1.y},{x:p1.x-p1.halfWidth,y:p1.y},{x:p2.x-p2.halfWidth,y:p2.y},{x:0,y:p2.y},shoulder);
    quad(ctx,{x:p1.x+p1.halfWidth,y:p1.y},{x:w,y:p1.y},{x:w,y:p2.y},{x:p2.x+p2.halfWidth,y:p2.y},shoulder);
    quad(ctx,{x:p1.x-p1.halfWidth,y:p1.y},{x:p1.x+p1.halfWidth,y:p1.y},{x:p2.x+p2.halfWidth,y:p2.y},{x:p2.x-p2.halfWidth,y:p2.y},road);

    if(i>2){
      const ew1=Math.max(.9,p1.halfWidth*.012),ew2=Math.max(1,p2.halfWidth*.012);
      strip(ctx,p1,p2,-1,-1,ew1,ew2,'rgba(245,245,240,.94)');
      strip(ctx,p1,p2,1,1,ew1,ew2,'rgba(245,245,240,.94)');
    }

    if(i>4){
      const cw1=Math.max(.65,p1.halfWidth*.008),cw2=Math.max(.9,p2.halfWidth*.0085);
      strip(ctx,p1,p2,-.018,-.018,cw1,cw2,'rgba(233,153,51,.96)');
      strip(ctx,p1,p2,.018,.018,cw1,cw2,'rgba(233,153,51,.96)');
    }

    const dashPeriod=11-speedN*3.2;
    const dash=(state.roadPhase*.205+i*2.38)%dashPeriod;
    if(dash<dashPeriod*.47&&i>7){
      const lw1=Math.max(.5,p1.halfWidth*.0055),lw2=Math.max(.8,p2.halfWidth*.0065);
      strip(ctx,p1,p2,-.5,-.5,lw1,lw2,'rgba(249,249,244,.9)');
      strip(ctx,p1,p2,.5,.5,lw1,lw2,'rgba(249,249,244,.9)');
    }

    if(i>10&&i%3===0){
      ctx.globalAlpha=.04+.025*speedN;
      ctx.strokeStyle=state.time==='night'?'#c8d0d4':'#15191b';
      ctx.lineWidth=Math.max(.4,p2.perspective*1.1);
      ctx.beginPath();
      const jitter=(hash(i+Math.floor(state.roadPhase*.01))-.5)*p2.halfWidth*.55;
      ctx.moveTo(p1.x+jitter*.75,p1.y);ctx.lineTo(p2.x+jitter,p2.y);ctx.stroke();
      ctx.globalAlpha=1;
    }
  }

  if(speedN>.42){
    const alpha=clamp((speedN-.42)/.58,0,1);
    ctx.save();ctx.globalAlpha=alpha*.22;ctx.strokeStyle='rgba(255,255,255,.34)';ctx.lineWidth=1;
    const count=state.fpsSmoother<43?8:14;
    for(let i=0;i<count;i++){
      const side=i%2?-1:1;
      const y=hor+h*(.2+hash(i*4.3)*.62);
      const x=side<0?hash(i*6.1)*w*.12:w-hash(i*6.1)*w*.12;
      const len=10+speedN*32+hash(i*2.7)*16;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+side*len*.33,y+len);ctx.stroke();
    }
    ctx.restore();
  }

  if(state.weather==='rain'){
    const p=roadPoint(.62,w,h,hor),g=ctx.createLinearGradient(0,p.y,0,h);g.addColorStop(0,'rgba(180,210,225,0)');g.addColorStop(1,state.time==='night'?'rgba(120,170,205,.28)':'rgba(210,230,238,.22)');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(p.x-p.halfWidth,p.y);ctx.lineTo(p.x+p.halfWidth,p.y);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();
  }
}

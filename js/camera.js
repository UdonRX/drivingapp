import{state,clamp,damp,lerp,wrapAngle}from'./state.js';
import{sampleRoad}from'./road.js';

const r0={},r1={},r2={},r3={};
function spring(value,velocity,target,k,c,dt){
  velocity+=(target-value)*k*dt-velocity*c*dt;
  value+=velocity*dt;
  return[value,velocity];
}

export function resetCamera(){
  const v=state.vehicle,c=state.camera,r=sampleRoad(v.z,r0);
  Object.assign(c,{
    x:v.x,y:v.bodyY+1.08,z:v.z-.12,
    targetX:r.x,targetY:r.y+1.1,targetZ:v.z+60,
    yaw:v.heading,pitch:r.pitch,roll:0,fov:58,
    headX:0,headXV:0,headY:0,headYV:0,headZ:0,headZV:0,headRoll:0,headRollV:0,lookBias:0
  });
}

export function updateCamera(dt){
  const v=state.vehicle,c=state.camera,kmh=v.speed*3.6,sn=clamp(kmh/150,0,1);
  let s=spring(c.headX,c.headXV,clamp(-v.lateralAcceleration*.0105,-.075,.075),38,10.5,dt);c.headX=s[0];c.headXV=s[1];
  s=spring(c.headZ,c.headZV,clamp(-v.acceleration*.012,-.05,.045),34,10,dt);c.headZ=s[0];c.headZV=s[1];
  s=spring(c.headY,c.headYV,clamp(v.suspensionTravel*.36,-.055,.05),46,12,dt);c.headY=s[0];c.headYV=s[1];
  s=spring(c.headRoll,c.headRollV,v.roll*.52,31,9.5,dt);c.headRoll=s[0];c.headRollV=s[1];

  const rightX=Math.cos(v.heading),rightZ=-Math.sin(v.heading),forwardX=Math.sin(v.heading),forwardZ=Math.cos(v.heading);
  c.x=v.x+rightX*c.headX+forwardX*c.headZ;
  c.y=v.bodyY+1.08+c.headY;
  c.z=v.z+rightZ*c.headX+forwardZ*c.headZ-.12;

  const d0=lerp(22,34,sn),d1=lerp(42,66,sn),d2=lerp(70,105,sn),d3=lerp(105,160,sn);
  sampleRoad(v.z+d0,r0);sampleRoad(v.z+d1,r1);sampleRoad(v.z+d2,r2);sampleRoad(v.z+d3,r3);
  const targetX=r0.x*.08+r1.x*.19+r2.x*.30+r3.x*.43;
  const targetY=r0.y*.08+r1.y*.19+r2.y*.30+r3.y*.43+1.0;
  const targetZ=r0.z*.08+r1.z*.19+r2.z*.30+r3.z*.43;
  const steerPreview=Math.tan(v.steerAngle)*lerp(6,14,sn);
  const desiredYaw=Math.atan2(targetX-c.x+steerPreview,targetZ-c.z);
  c.lookBias=damp(c.lookBias,wrapAngle(desiredYaw-v.heading),3.0+sn*.6,dt);
  c.yaw=wrapAngle(v.heading+c.lookBias);

  const horizontal=Math.max(1,Math.hypot(targetX-c.x,targetZ-c.z));
  const desiredPitch=Math.atan2(targetY-c.y,horizontal)+v.pitch*.18;
  c.pitch=damp(c.pitch,desiredPitch,3.4,dt);
  c.roll=damp(c.roll,c.headRoll,4.4,dt);
  c.fov=damp(c.fov,57.5+Math.pow(sn,1.25)*8.6+Math.max(0,v.acceleration)*.22,2.2,dt);

  const lookDistance=120;
  const cp=Math.cos(c.pitch),sp=Math.sin(c.pitch),sy=Math.sin(c.yaw),cy=Math.cos(c.yaw);
  c.targetX=c.x+sy*cp*lookDistance;
  c.targetY=c.y+sp*lookDistance;
  c.targetZ=c.z+cy*cp*lookDistance;
}

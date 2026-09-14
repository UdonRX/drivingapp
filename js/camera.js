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
    x:v.x,y:v.bodyY+1.02,z:v.z-.10,
    targetX:r.x,targetY:r.y+1.05,targetZ:v.z+60,
    yaw:v.heading,pitch:r.pitch,roll:0,fov:57,
    headX:0,headXV:0,headY:0,headYV:0,headZ:0,headZV:0,
    headRoll:0,headRollV:0,headYaw:0,headYawV:0,lookBias:0
  });
}

export function updateCamera(dt){
  const v=state.vehicle,c=state.camera,kmh=v.speed*3.6,sn=clamp(kmh/150,0,1);

  // The reference is stable: small inertial head motion, never a floating/shaking camera.
  let s=spring(c.headX,c.headXV,clamp(-v.lateralAcceleration*.0070,-.048,.048),46,13.4,dt);c.headX=s[0];c.headXV=s[1];
  s=spring(c.headZ,c.headZV,clamp(-v.acceleration*.0105,-.036,.034),42,12.6,dt);c.headZ=s[0];c.headZV=s[1];
  s=spring(c.headY,c.headYV,clamp(v.suspensionTravel*.32,-.032,.030),58,15.2,dt);c.headY=s[0];c.headYV=s[1];
  s=spring(c.headRoll,c.headRollV,v.roll*.24,42,12.8,dt);c.headRoll=s[0];c.headRollV=s[1];

  const rightX=Math.cos(v.heading),rightZ=-Math.sin(v.heading),forwardX=Math.sin(v.heading),forwardZ=Math.cos(v.heading);
  c.x=v.x+rightX*c.headX+forwardX*c.headZ;
  c.y=v.bodyY+1.02+c.headY;
  c.z=v.z+rightZ*c.headX+forwardZ*c.headZ-.10;

  // Look through the bend, but keep the cockpit as a strong reference just like the supplied clip.
  const d0=lerp(18,30,sn),d1=lerp(36,58,sn),d2=lerp(62,96,sn),d3=lerp(96,148,sn);
  sampleRoad(v.z+d0,r0);sampleRoad(v.z+d1,r1);sampleRoad(v.z+d2,r2);sampleRoad(v.z+d3,r3);
  const previewYaw=(
    wrapAngle(r0.heading-v.heading)*.14+
    wrapAngle(r1.heading-v.heading)*.23+
    wrapAngle(r2.heading-v.heading)*.29+
    wrapAngle(r3.heading-v.heading)*.34
  );
  const steerCue=v.steerAngle*lerp(.16,.24,sn);
  const slipCue=v.slipAngle*lerp(.18,.28,sn);
  const yawCue=v.yawRate*lerp(.018,.034,sn);
  const desiredHeadYaw=clamp(previewYaw*.62+steerCue+slipCue+yawCue,-.098,.098);
  s=spring(c.headYaw,c.headYawV,desiredHeadYaw,36,12.2,dt);c.headYaw=s[0];c.headYawV=s[1];
  c.lookBias=c.headYaw;
  c.yaw=wrapAngle(v.heading+c.headYaw);

  const targetX=r0.x*.11+r1.x*.21+r2.x*.30+r3.x*.38;
  const targetY=r0.y*.11+r1.y*.21+r2.y*.30+r3.y*.38+1.0;
  const targetZ=r0.z*.11+r1.z*.21+r2.z*.30+r3.z*.38;
  const horizontal=Math.max(1,Math.hypot(targetX-c.x,targetZ-c.z));
  const desiredPitch=Math.atan2(targetY-c.y,horizontal)+v.pitch*.12;
  c.pitch=damp(c.pitch,desiredPitch,4.4,dt);
  c.roll=damp(c.roll,c.headRoll,6.0,dt);

  // The renderer widens horizontal portrait FOV separately; vertical FOV remains natural.
  c.fov=damp(c.fov,56.5+Math.pow(sn,1.22)*7.0+Math.max(0,v.acceleration)*.12,2.8,dt);

  const lookDistance=130;
  const cp=Math.cos(c.pitch),sp=Math.sin(c.pitch),sy=Math.sin(c.yaw),cy=Math.cos(c.yaw);
  c.targetX=c.x+sy*cp*lookDistance;
  c.targetY=c.y+sp*lookDistance;
  c.targetZ=c.z+cy*cp*lookDistance;
}

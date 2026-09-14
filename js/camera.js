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
    yaw:v.heading,pitch:r.pitch,roll:0,fov:59,
    headX:0,headXV:0,headY:0,headYV:0,headZ:0,headZV:0,
    headRoll:0,headRollV:0,headYaw:0,headYawV:0,lookBias:0
  });
}

export function updateCamera(dt){
  const v=state.vehicle,c=state.camera,kmh=v.speed*3.6,sn=clamp(kmh/150,0,1);

  // Vehicle -> body -> driver head. The head resists body motion instead of being welded to it.
  let s=spring(c.headX,c.headXV,clamp(-v.lateralAcceleration*.0115,-.082,.082),40,11.5,dt);c.headX=s[0];c.headXV=s[1];
  s=spring(c.headZ,c.headZV,clamp(-v.acceleration*.014,-.052,.048),35,10.5,dt);c.headZ=s[0];c.headZV=s[1];
  s=spring(c.headY,c.headYV,clamp(v.suspensionTravel*.42,-.052,.048),48,12.8,dt);c.headY=s[0];c.headYV=s[1];
  s=spring(c.headRoll,c.headRollV,v.roll*.38,34,10.2,dt);c.headRoll=s[0];c.headRollV=s[1];

  const rightX=Math.cos(v.heading),rightZ=-Math.sin(v.heading),forwardX=Math.sin(v.heading),forwardZ=Math.cos(v.heading);
  c.x=v.x+rightX*c.headX+forwardX*c.headZ;
  c.y=v.bodyY+1.02+c.headY;
  c.z=v.z+rightZ*c.headX+forwardZ*c.headZ-.10;

  // JDM-style dynamic driver camera: road preview + steering cue + actual vehicle slip.
  // The view turns into the corner before the body has fully yawed, but stays bounded to avoid motion sickness.
  const d0=lerp(20,32,sn),d1=lerp(38,62,sn),d2=lerp(66,104,sn),d3=lerp(100,158,sn);
  sampleRoad(v.z+d0,r0);sampleRoad(v.z+d1,r1);sampleRoad(v.z+d2,r2);sampleRoad(v.z+d3,r3);
  const previewYaw=(
    wrapAngle(r0.heading-v.heading)*.12+
    wrapAngle(r1.heading-v.heading)*.22+
    wrapAngle(r2.heading-v.heading)*.30+
    wrapAngle(r3.heading-v.heading)*.36
  );
  const steerCue=v.steerAngle*lerp(.22,.34,sn);
  const slipCue=v.slipAngle*lerp(.36,.62,sn);
  const yawCue=v.yawRate*lerp(.025,.055,sn);
  const desiredHeadYaw=clamp(previewYaw*.72+steerCue+slipCue+yawCue,-.145,.145);
  s=spring(c.headYaw,c.headYawV,desiredHeadYaw,30,10.6,dt);c.headYaw=s[0];c.headYawV=s[1];
  c.lookBias=c.headYaw;
  c.yaw=wrapAngle(v.heading+c.headYaw);

  const targetX=r0.x*.10+r1.x*.20+r2.x*.30+r3.x*.40;
  const targetY=r0.y*.10+r1.y*.20+r2.y*.30+r3.y*.40+1.0;
  const targetZ=r0.z*.10+r1.z*.20+r2.z*.30+r3.z*.40;
  const horizontal=Math.max(1,Math.hypot(targetX-c.x,targetZ-c.z));
  const desiredPitch=Math.atan2(targetY-c.y,horizontal)+v.pitch*.14;
  c.pitch=damp(c.pitch,desiredPitch,3.8,dt);
  c.roll=damp(c.roll,c.headRoll,5.2,dt);

  // Moderate speed-dependent FOV: stronger peripheral flow without fisheye distortion.
  c.fov=damp(c.fov,59+Math.pow(sn,1.22)*11.2+Math.max(0,v.acceleration)*.18,2.45,dt);

  const lookDistance=130;
  const cp=Math.cos(c.pitch),sp=Math.sin(c.pitch),sy=Math.sin(c.yaw),cy=Math.cos(c.yaw);
  c.targetX=c.x+sy*cp*lookDistance;
  c.targetY=c.y+sp*lookDistance;
  c.targetZ=c.z+cy*cp*lookDistance;
}

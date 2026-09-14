import{state,clamp,damp,smoothstep,wrapAngle,lerp}from'./state.js';
import{ROAD_HALF_WIDTH,sampleRoad,roadBump}from'./road.js';
import{localVelocityToWorld}from'./motion-math.js';

const WHEELBASE=2.62;
const LR=1.44;
const RIDE_HEIGHT=.44;
const G=9.81;
const DEG=Math.PI/180;
const roadNow={};
const worldVelocity={x:0,z:0};

function approach(current,target,rate,dt){
  const delta=target-current,maxStep=rate*dt;
  return current+clamp(delta,-maxStep,maxStep);
}

export function resetVehicle(speedKmh=18){
  const v=state.vehicle,r=sampleRoad(0,roadNow),speed=speedKmh/3.6;
  Object.assign(v,{
    x:r.x,y:r.y+RIDE_HEIGHT,z:0,heading:r.heading,velocityHeading:r.heading,speed,acceleration:0,
    steerInput:0,steerAngle:0,steeringWheelAngle:0,yawRate:0,slipAngle:0,grip:1,roll:r.bank,pitch:r.pitch,
    lateralVelocity:0,longitudinalVelocity:speed,lateralAcceleration:0,
    bodyY:r.y+RIDE_HEIGHT,bodyVy:0,suspensionTravel:0,suspensionImpact:0,
    rpm:900,gear:1,shiftPulse:0,roadOffset:0,roadHeadingError:0
  });
  state.distance=0;
  state.worldTime=0;
  state.input.left=false;state.input.right=false;
}

export function updateVehicle(dt){
  const v=state.vehicle;
  const prevSpeed=v.speed;
  const targetSpeed=state.targetSpeedKmh/3.6;
  const speedDelta=targetSpeed-v.speed;
  const accelLimit=speedDelta>=0?2.65:4.1;
  v.speed+=clamp(speedDelta,-accelLimit*dt,accelLimit*dt);
  v.speed=Math.max(0,v.speed);
  v.acceleration=damp(v.acceleration,(v.speed-prevSpeed)/Math.max(.001,dt),5.5,dt);
  const kmh=v.speed*3.6;
  const speedN=smoothstep(20,150,kmh);

  // Buttons build steering progressively, but self-centre much faster than the body yaw.
  // This keeps tap steering precise without removing the vehicle's mass/inertia.
  const direction=state.input.left===state.input.right?0:(state.input.left?-1:1);
  const steeringRise=lerp(.27,.38,smoothstep(50,150,kmh));
  const steeringReturn=.17;
  const inputRate=direction===0?1/steeringReturn:1/steeringRise;
  v.steerInput=approach(v.steerInput,direction,inputRate,dt);

  // Strong speed-sensitive steering rack. Highway steering stays fine-grained.
  const highSpeed=smoothstep(15,130,kmh);
  const maxSteerDeg=27.5-23*highSpeed;
  const maxSteer=maxSteerDeg*DEG;
  const targetSteer=v.steerInput*maxSteer;
  v.steerAngle=damp(v.steerAngle,targetSteer,direction===0?18:10.5,dt);
  v.steeringWheelAngle=damp(v.steeringWheelAngle,clamp(v.steerAngle*12.2,-2.65,2.65),14,dt);

  const road=sampleRoad(v.z,roadNow);
  const lateralError=(v.x-road.x)*Math.cos(road.heading);
  v.roadOffset=lateralError;
  v.roadHeadingError=wrapAngle(road.heading-v.heading);

  // Grip-first simcade bicycle model.
  // Previously lateralVelocity was added on top of bicycle yaw, effectively applying the turn twice.
  // Here sideslip only rotates the velocity vector; it is never added as a second independent slide.
  const understeer=1/(1+.00008*kmh*kmh);
  const rawBeta=Math.atan((LR/WHEELBASE)*Math.tan(v.steerAngle));
  const betaScale=lerp(.58,.24,speedN);
  const betaTarget=clamp(rawBeta*betaScale,-3.6*DEG,3.6*DEG);
  v.slipAngle=damp(v.slipAngle,betaTarget,direction===0?9:5.8,dt);

  let yawTarget=(v.speed/WHEELBASE)*Math.tan(v.steerAngle)*understeer*Math.cos(v.slipAngle);
  if(direction===0&&Math.abs(v.steerAngle)<.005)yawTarget=0;

  // No invisible centre-line magnet. Only a very small edge recovery remains when the driver releases steering.
  const edgeN=clamp((Math.abs(lateralError)-ROAD_HALF_WIDTH*.88)/(ROAD_HALF_WIDTH*.42),0,1);
  if(direction===0&&edgeN>0)yawTarget+=clamp(v.roadHeadingError*edgeN*.32,-.07,.07);

  const yawResponse=direction===0?lerp(6.5,5.0,speedN):lerp(4.8,3.4,speedN);
  v.yawRate=damp(v.yawRate,yawTarget,yawResponse,dt);
  v.heading=wrapAngle(v.heading+v.yawRate*dt);

  v.lateralVelocity=v.speed*Math.sin(v.slipAngle);
  v.longitudinalVelocity=v.speed*Math.cos(v.slipAngle);
  localVelocityToWorld(v.lateralVelocity,v.longitudinalVelocity,v.heading,worldVelocity);
  v.x+=worldVelocity.x*dt;
  v.z+=worldVelocity.z*dt;
  v.velocityHeading=wrapAngle(v.heading+v.slipAngle);
  v.grip=1-clamp(Math.abs(v.slipAngle)/(5.5*DEG),0,1)*.42;
  v.lateralAcceleration=damp(v.lateralAcceleration,v.yawRate*v.longitudinalVelocity,5.4,dt);

  const roadAfter=sampleRoad(v.z,roadNow);
  const bump=roadBump(v.z)*(1+.62*speedN);
  const targetBodyY=roadAfter.y+RIDE_HEIGHT+bump;
  const springK=78,dampingC=16.5;
  const bodyAcc=(targetBodyY-v.bodyY)*springK-v.bodyVy*dampingC;
  v.bodyVy+=bodyAcc*dt;
  v.bodyY+=v.bodyVy*dt;
  v.y=v.bodyY;
  v.suspensionTravel=targetBodyY-v.bodyY;
  const impactTarget=clamp(Math.abs(bodyAcc)/38,0,1.5);
  v.suspensionImpact=damp(v.suspensionImpact,impactTarget,impactTarget>v.suspensionImpact?14:6,dt);

  const rollTarget=clamp(roadAfter.bank-v.lateralAcceleration/G*.048,-.105,.105);
  const pitchTarget=clamp(roadAfter.pitch-v.acceleration/G*.042,-.085,.085);
  v.roll=damp(v.roll,rollTarget,4.6,dt);
  v.pitch=damp(v.pitch,pitchTarget,4.8,dt);

  state.distance+=v.speed*dt;
  state.world.feature=roadAfter.feature;
  state.world.featureAmount=roadAfter.featureAmount;
}

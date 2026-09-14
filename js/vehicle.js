import{state,clamp,damp,smoothstep,wrapAngle}from'./state.js';
import{ROAD_HALF_WIDTH,sampleRoad,roadBump}from'./road.js';

const WHEELBASE=2.62;
const RIDE_HEIGHT=.44;
const G=9.81;
const roadNow={};

function approach(current,target,rate,dt){
  const delta=target-current,maxStep=rate*dt;
  return current+clamp(delta,-maxStep,maxStep);
}

export function resetVehicle(speedKmh=18){
  const v=state.vehicle,r=sampleRoad(0,roadNow),speed=speedKmh/3.6;
  Object.assign(v,{
    x:r.x,y:r.y+RIDE_HEIGHT,z:0,heading:r.heading,speed,acceleration:0,
    steerInput:0,steerAngle:0,yawRate:0,slipAngle:0,roll:r.bank,pitch:r.pitch,
    lateralVelocity:0,longitudinalVelocity:speed,lateralAcceleration:0,
    bodyY:r.y+RIDE_HEIGHT,bodyVy:0,suspensionTravel:0,suspensionImpact:0,
    rpm:900,gear:1,shiftPulse:0,roadOffset:0
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
  const speedN=clamp(kmh/150,0,1);

  const direction=state.input.left===state.input.right?0:(state.input.left?-1:1);
  const steeringRise=.34;
  const steeringReturn=.46;
  const inputRate=direction===0?1/steeringReturn:1/steeringRise;
  v.steerInput=approach(v.steerInput,direction,inputRate,dt);

  const highSpeed=smoothstep(28,145,kmh);
  const maxSteerDeg=27-(21.5*highSpeed);
  const maxSteer=maxSteerDeg*Math.PI/180;
  const targetSteer=v.steerInput*maxSteer;
  v.steerAngle=damp(v.steerAngle,targetSteer,direction===0?7.2:10.5,dt);

  const road=sampleRoad(v.z,roadNow);
  const lateralError=v.x-road.x;
  v.roadOffset=lateralError;

  const understeer=1/(1+.000058*kmh*kmh);
  const nominalBeta=Math.atan(.52*Math.tan(v.steerAngle))*understeer;
  const desiredLatVel=v.speed*Math.sin(nominalBeta);
  v.lateralVelocity=damp(v.lateralVelocity,desiredLatVel,2.8+1.2*(1-speedN),dt);
  v.slipAngle=Math.atan2(v.lateralVelocity,Math.max(1.2,v.speed));

  let yawTarget=(v.speed/WHEELBASE)*Math.tan(v.steerAngle)*understeer;
  const roadHeadingError=wrapAngle(road.heading-v.heading);
  const edgeN=clamp((Math.abs(lateralError)-ROAD_HALF_WIDTH*.58)/(ROAD_HALF_WIDTH*.72),0,1);
  const assist=(direction!==0?.015:0)+edgeN*.16;
  yawTarget+=clamp(roadHeadingError*assist,-.045,.045);
  yawTarget-=v.slipAngle*(.12+.18*speedN);
  const yawResponse=2.3+1.7*(1-speedN);
  v.yawRate=damp(v.yawRate,yawTarget,yawResponse,dt);

  v.heading=wrapAngle(v.heading+v.yawRate*dt);
  const sh=Math.sin(v.heading),ch=Math.cos(v.heading);
  const rightX=ch,rightZ=-sh;
  v.x+=(sh*v.speed+rightX*v.lateralVelocity)*dt;
  v.z+=(ch*v.speed+rightZ*v.lateralVelocity)*dt;
  v.longitudinalVelocity=v.speed;
  v.lateralAcceleration=damp(v.lateralAcceleration,v.yawRate*v.speed,5.0,dt);

  const roadAfter=sampleRoad(v.z,roadNow);
  const bump=roadBump(v.z)*(1+.7*speedN);
  const targetBodyY=roadAfter.y+RIDE_HEIGHT+bump;
  const springK=72,dampingC=14.5;
  const bodyAcc=(targetBodyY-v.bodyY)*springK-v.bodyVy*dampingC;
  v.bodyVy+=bodyAcc*dt;
  v.bodyY+=v.bodyVy*dt;
  v.y=v.bodyY;
  v.suspensionTravel=targetBodyY-v.bodyY;
  const impactTarget=clamp(Math.abs(bodyAcc)/35,0,1.8);
  v.suspensionImpact=damp(v.suspensionImpact,impactTarget,impactTarget>v.suspensionImpact?13:5.5,dt);

  const rollTarget=clamp(roadAfter.bank-v.lateralAcceleration/G*.055,-.13,.13);
  const pitchTarget=clamp(roadAfter.pitch-v.acceleration/G*.045,-.10,.10);
  v.roll=damp(v.roll,rollTarget,3.9,dt);
  v.pitch=damp(v.pitch,pitchTarget,4.2,dt);

  state.distance+=v.speed*dt;
  state.world.feature=roadAfter.feature;
  state.world.featureAmount=roadAfter.featureAmount;
}

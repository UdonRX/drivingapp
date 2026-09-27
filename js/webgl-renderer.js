import{state,clamp,hash1,palettes}from'./state.js';
import{ROAD_HALF_WIDTH,ROAD_SHOULDER,ROAD_NEAR,ROAD_DRAW,ROAD_SEGMENT,sampleRoad,roadPoint}from'./road.js';

const VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aColor;
uniform mat4 uViewProj;
uniform vec3 uCameraPos;
out vec3 vColor;
out float vDistance;
void main(){
  gl_Position=uViewProj*vec4(aPosition,1.0);
  vColor=aColor;
  vDistance=distance(aPosition,uCameraPos);
}`;
const SKY_VS=`#version 300 es
precision highp float;
const vec2 P[3]=vec2[3](vec2(-1.0,-1.0),vec2(3.0,-1.0),vec2(-1.0,3.0));
out vec2 vUv;
void main(){vUv=P[gl_VertexID]*0.5+0.5;gl_Position=vec4(P[gl_VertexID],0.0,1.0);}
`;
const SKY_FS=`#version 300 es
precision highp float;
in vec2 vUv;
uniform vec3 uTop,uHorizon,uSunColor,uCloud,uCloudShadow;
uniform float uWeatherMix,uWorldTime,uYaw,uPitch;
out vec4 outColor;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.0,a=.5;for(int i=0;i<4;i++){v+=noise(p)*a;p=p*2.02+13.7;a*=.5;}return v;}
void main(){float y=clamp(vUv.y,0.0,1.0);vec3 sky=mix(uHorizon,uTop,pow(y,.62));float sunSide=1.0-smoothstep(0.0,.72,length(vUv-vec2(.72,.72)));sky+=uSunColor*sunSide*.20*(1.0-uWeatherMix*.7);vec2 cp=(vUv-0.5)*vec2(3.2,1.35)+vec2(uYaw*.42+uWorldTime*.0022,uPitch*.22);float cloud=smoothstep(.53,.70,fbm(cp*1.25))*smoothstep(.12,.58,y)*(1.0-uWeatherMix*.45);sky=mix(sky,mix(uCloudShadow,uCloud,cloud),cloud*.58);sky=mix(sky,uCloudShadow,smoothstep(0.0,.34,1.0-y)*uWeatherMix*.22);outColor=vec4(sky,1.0);}
`;
const FS=`#version 300 es
precision highp float;
in vec3 vColor;
in float vDistance;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uExposure;
uniform float uTunnelMix;
out vec4 outColor;
void main(){
  float fog=smoothstep(uFogNear,uFogFar,vDistance);
  vec3 lit=vColor*uExposure;
  lit=mix(lit,lit*vec3(.88,.80,.70),uTunnelMix*.18);
  outColor=vec4(mix(lit,uFogColor,fog),1.0);
}`;

class MeshBuilder{
  constructor(maxVertices){this.data=new Float32Array(maxVertices*6);this.count=0}
  reset(){this.count=0}
  vertex(x,y,z,c,shade=1){const i=this.count*6,d=this.data;if(i+5>=d.length)return;d[i]=x;d[i+1]=y;d[i+2]=z;d[i+3]=c[0]*shade;d[i+4]=c[1]*shade;d[i+5]=c[2]*shade;this.count++}
  tri(a,b,c,col,shade=1){this.vertex(a.x,a.y,a.z,col,shade);this.vertex(b.x,b.y,b.z,col,shade);this.vertex(c.x,c.y,c.z,col,shade)}
  quad(a,b,c,d,col,shade=1){this.tri(a,b,c,col,shade);this.tri(a,c,d,col,shade)}
  triXYZ(ax,ay,az,bx,by,bz,cx,cy,cz,col,shade=1){this.vertex(ax,ay,az,col,shade);this.vertex(bx,by,bz,col,shade);this.vertex(cx,cy,cz,col,shade)}
  quadXYZ(ax,ay,az,bx,by,bz,cx,cy,cz,dx,dy,dz,col,shade=1){this.triXYZ(ax,ay,az,bx,by,bz,cx,cy,cz,col,shade);this.triXYZ(ax,ay,az,cx,cy,cz,dx,dy,dz,col,shade)}
}

const roadBuilder=new MeshBuilder(90000);
const sceneryBuilder=new MeshBuilder(850000);
const rainBuilder=new MeshBuilder(2400);
const rs0={},rs1={},p0={},p1={},p2={},p3={};
const matP=new Float32Array(16),matV=new Float32Array(16),matVP=new Float32Array(16);
let gl,program,skyProgram,skyBuffer,roadBuffer,sceneryBuffer,rainBuffer,lastSceneryKey='',quality=1,canvasRef,sceneryCount=0;

function rgb(hex){
  const h=hex.replace('#','');const n=parseInt(h.length===3?h.split('').map(x=>x+x).join(''):h,16);
  return[((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];
}
function mixColor(a,b,t){return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]}

function perspective(out,fovy,aspect,near,far,horizontalScale=1){
  const f=1/Math.tan(fovy/2),nf=1/(near-far);
  out[0]=(f/aspect)*horizontalScale;out[1]=0;out[2]=0;out[3]=0;
  out[4]=0;out[5]=f;out[6]=0;out[7]=0;
  out[8]=0;out[9]=0;out[10]=(far+near)*nf;out[11]=-1;
  out[12]=0;out[13]=0;out[14]=2*far*near*nf;out[15]=0;
}
function lookAt(out,eye,target,roll){
  let zx=eye[0]-target[0],zy=eye[1]-target[1],zz=eye[2]-target[2];let l=Math.hypot(zx,zy,zz)||1;zx/=l;zy/=l;zz/=l;
  let upx=Math.sin(roll),upy=Math.cos(roll),upz=0;
  let xx=upy*zz-upz*zy,xy=upz*zx-upx*zz,xz=upx*zy-upy*zx;l=Math.hypot(xx,xy,xz)||1;xx/=l;xy/=l;xz/=l;
  const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
  out[0]=xx;out[1]=yx;out[2]=zx;out[3]=0;
  out[4]=xy;out[5]=yy;out[6]=zy;out[7]=0;
  out[8]=xz;out[9]=yz;out[10]=zz;out[11]=0;
  out[12]=-(xx*eye[0]+xy*eye[1]+xz*eye[2]);out[13]=-(yx*eye[0]+yy*eye[1]+yz*eye[2]);out[14]=-(zx*eye[0]+zy*eye[1]+zz*eye[2]);out[15]=1;
}
function multiply(out,a,b){
  for(let c=0;c<4;c++)for(let r=0;r<4;r++)out[c*4+r]=a[0*4+r]*b[c*4+0]+a[1*4+r]*b[c*4+1]+a[2*4+r]*b[c*4+2]+a[3*4+r]*b[c*4+3];
}
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'shader compile failed');return s}
function createSkyProgram(){const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,SKY_VS));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,SKY_FS));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||'sky program link failed');return p}
function createProgram(){const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,VS));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||'program link failed');return p}
function setupBuffer(buffer){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12)}
function uploadBuffer(buffer,builder,usage=gl.DYNAMIC_DRAW){if(!builder.count)return 0;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,builder.data.subarray(0,builder.count*6),usage);return builder.count}
function drawBuffer(buffer,count){if(!count)return;setupBuffer(buffer);gl.drawArrays(gl.TRIANGLES,0,count)}

function roadQuad(builder,sA,sB,l0,l1,h,col,shade=1){
  roadPoint(sA,l0,h,p0);roadPoint(sA,l1,h,p1);roadPoint(sB,l1,h,p2);roadPoint(sB,l0,h,p3);builder.quad(p0,p1,p2,p3,col,shade);
}
function wallQuad(builder,sA,sB,lateral,h0,h1,col,shade=1){
  roadPoint(sA,lateral,h0,p0);roadPoint(sA,lateral,h1,p1);roadPoint(sB,lateral,h1,p2);roadPoint(sB,lateral,h0,p3);builder.quad(p0,p1,p2,p3,col,shade);
}
function ceilingQuad(builder,sA,sB,l0,l1,h,col,shade=1){
  roadPoint(sA,l0,h,p0);roadPoint(sA,l1,h,p1);roadPoint(sB,l1,h,p2);roadPoint(sB,l0,h,p3);builder.quad(p0,p1,p2,p3,col,shade);
}

function buildRoad(){
  roadBuilder.reset();const v=state.vehicle;
  const wet=state.weather==='rain',night=state.time==='night';
  const road=rgb(night?'#181d22':wet?'#292f33':'#353a3e'),shoulder=rgb(state.environment==='coast'?'#716f68':state.environment==='city'?'#4b5052':'#596052');
  const white=rgb(night?'#d9e0df':'#f1f2ec'),yellow=rgb('#d9a23c'),seam=rgb(night?'#20262a':'#252a2d'),patch=rgb(night?'#15191c':'#2c3033');
  const start=v.z+ROAD_NEAR,end=v.z+ROAD_DRAW;
  const step=quality<.82?ROAD_SEGMENT*1.5:ROAD_SEGMENT;
  for(let z=start;z<end;z+=step){
    const z1=Math.min(end,z+step);sampleRoad(z,rs0);sampleRoad(z1,rs1);
    roadQuad(roadBuilder,rs0,rs1,-ROAD_HALF_WIDTH,ROAD_HALF_WIDTH,0,road);
    roadQuad(roadBuilder,rs0,rs1,-ROAD_HALF_WIDTH-ROAD_SHOULDER,-ROAD_HALF_WIDTH,.002,shoulder);
    roadQuad(roadBuilder,rs0,rs1,ROAD_HALF_WIDTH,ROAD_HALF_WIDTH+ROAD_SHOULDER,.002,shoulder);
    roadQuad(roadBuilder,rs0,rs1,-ROAD_HALF_WIDTH+.08,-ROAD_HALF_WIDTH+.14,.018,white);
    roadQuad(roadBuilder,rs0,rs1,ROAD_HALF_WIDTH-.14,ROAD_HALF_WIDTH-.08,.018,white);
    roadQuad(roadBuilder,rs0,rs1,-.15,-.07,.020,yellow);roadQuad(roadBuilder,rs0,rs1,.07,.15,.020,yellow);
    const dash=Math.floor((z+4)/13)%2===0;
    if(dash){roadQuad(roadBuilder,rs0,rs1,-ROAD_HALF_WIDTH*.50-.035,-ROAD_HALF_WIDTH*.50+.035,.018,white);roadQuad(roadBuilder,rs0,rs1,ROAD_HALF_WIDTH*.50-.035,ROAD_HALF_WIDTH*.50+.035,.018,white)}
    if(wet&&z<v.z+260&&Math.floor(z/22)!==Math.floor(z1/22)){const sheen=rgb(night?'#26343d':'#3e4c51'),side=((Math.floor(z/22)&1)?-1:1)*ROAD_HALF_WIDTH*.43;roadQuad(roadBuilder,rs0,rs1,side-.22,side+.22,.024,sheen)}
    if(Math.floor(z/18)!==Math.floor(z1/18)){const zs=Math.ceil(z/18)*18;sampleRoad(zs-.10,rs0);sampleRoad(zs+.10,rs1);roadQuad(roadBuilder,rs0,rs1,-ROAD_HALF_WIDTH+.3,ROAD_HALF_WIDTH-.3,.012,seam)}
    if(z<v.z+210&&Math.floor(z/9)!==Math.floor(z1/9)){
      const id=Math.floor(z/9),lat=(hash1(id*3.17,state.routeSeed)-.5)*ROAD_HALF_WIDTH*1.35,width=.045+hash1(id*5.3)*.07;
      roadQuad(roadBuilder,rs0,rs1,lat-width,lat+width,.010,patch);
    }
  }
}

// Low-poly geometry primitives for roadside scenery
function pushBox(b,x,y,z,sx,sy,sz,col,shadeMult=1){
  const x0=x-sx/2,x1=x+sx/2,y0=y,y1=y+sy,z0=z-sz/2,z1=z+sz/2;
  b.quadXYZ(x0,y0,z0,x1,y0,z0,x1,y1,z0,x0,y1,z0,col,.86*shadeMult);
  b.quadXYZ(x1,y0,z1,x0,y0,z1,x0,y1,z1,x1,y1,z1,col,1.0*shadeMult);
  b.quadXYZ(x0,y0,z1,x0,y0,z0,x0,y1,z0,x0,y1,z1,col,.74*shadeMult);
  b.quadXYZ(x1,y0,z0,x1,y0,z1,x1,y1,z1,x1,y1,z0,col,.94*shadeMult);
  b.quadXYZ(x0,y1,z0,x1,y1,z0,x1,y1,z1,x0,y1,z1,col,1.08*shadeMult);
  b.quadXYZ(x0,y0,z1,x1,y0,z1,x1,y0,z0,x0,y0,z0,col,.66*shadeMult);
}

function pushPyramid(b,x,y,z,r,h,col,shadeMult=1){
  const ty=y+h,x0=x-r,x1=x+r,z0=z-r,z1=z+r;
  b.triXYZ(x0,y,z0,x1,y,z0,x,ty,z,col,.88*shadeMult);
  b.triXYZ(x1,y,z0,x1,y,z1,x,ty,z,col,1.0*shadeMult);
  b.triXYZ(x1,y,z1,x0,y,z1,x,ty,z,col,.78*shadeMult);
  b.triXYZ(x0,y,z1,x0,y,z0,x,ty,z,col,.92*shadeMult);
  b.quadXYZ(x0,y,z0,x0,y,z1,x1,y,z1,x1,y,z0,col,.58*shadeMult);
}

function pushGrass(b,x,y,z,scale,col){
  const h=0.35*scale,w=0.28*scale;
  const darkCol=mixColor(col,[0,0,0],.25);
  // Base soil/grass patch
  b.quadXYZ(x-w,y+.01,z-w, x+w,y+.01,z-w, x+w,y+.01,z+w, x-w,y+.01,z+w, darkCol, .9);
  // Crossed grass blades
  b.quadXYZ(x-w,y,z, x+w,y,z, x+w,y+h,z, x-w,y+h,z, col, 1.0);
  b.quadXYZ(x,y,z-w, x,y,z+w, x,y+h,z+w, x,y+h,z-w, col, 0.88);
  b.quadXYZ(x-w*.7,y,z-w*.7, x+w*.7,y,z+w*.7, x+w*.7,y+h*.85,z+w*.7, x-w*.7,y+h*.85,z-w*.7, col, 0.94);
}

function pushShrub(b,x,y,z,scale,col){
  const r=0.55*scale,h=0.7*scale;
  const trunkCol=rgb('#3f3327');
  pushBox(b,x,y,z,0.12*scale,0.2*scale,0.12*scale,trunkCol);
  pushPyramid(b,x,y+0.15*scale,z,r,h,col,1.0);
  pushPyramid(b,x+r*.2,y+0.25*scale,z+r*.2,r*.7,h*.8,mixColor(col,[1,1,1],.08),0.92);
}

function pushTree(b,x,y,z,scale,col,type=0){
  const trunkCol=rgb('#433527');
  if(type===0){ // Coniferous / Pine tree
    pushBox(b,x,y,z,0.22*scale,1.8*scale,0.22*scale,trunkCol);
    pushPyramid(b,x,y+1.0*scale,z,1.3*scale,3.6*scale,col,1.0);
    pushPyramid(b,x,y+1.8*scale,z,1.0*scale,2.8*scale,mixColor(col,[1,1,1],.08),1.05);
  }else if(type===1){ // Deciduous / Round Canopy Tree
    pushBox(b,x,y,z,0.26*scale,2.2*scale,0.26*scale,trunkCol);
    const cy=y+1.6*scale,r=1.35*scale;
    pushBox(b,x,cy,z,r*1.6,r*1.4,r*1.6,col,0.95);
    pushBox(b,x,cy+r*.5,z,r*1.2,r*1.0,r*1.2,mixColor(col,[1,1,1],.12),1.05);
  }else{ // Small Roadside Planted Tree
    pushBox(b,x,y,z,0.14*scale,1.2*scale,0.14*scale,trunkCol);
    pushBox(b,x,y+0.9*scale,z,0.9*scale,0.9*scale,0.9*scale,col,1.0);
  }
}

function pushPole(b,x,y,z,scale,lit,side=1){
  const poleCol=rgb('#5a6064'),crossCol=rgb('#3a3f42'),boxCol=rgb('#485055'),wirePinCol=rgb('#c2c7ca');
  const h=4.2*scale;
  // Utility pole main vertical post
  pushBox(b,x,y,z,0.11*scale,h,0.11*scale,poleCol);
  // Upper crossarm (電柱の腕木)
  const armY=y+h*.88;
  pushBox(b,x,armY,z,1.2*scale,0.08*scale,0.1*scale,crossCol);
  // Lower secondary arm
  pushBox(b,x,armY-0.5*scale,z,0.8*scale,0.07*scale,0.09*scale,crossCol);
  // Transformer box (トランス)
  pushBox(b,x+0.12*scale*side,armY-0.7*scale,z,0.28*scale,0.45*scale,0.24*scale,boxCol);
  // Insulators / pins on crossarm ends (ガイシ)
  pushBox(b,x-0.52*scale,armY+0.06*scale,z,0.06*scale,0.12*scale,0.06*scale,wirePinCol);
  pushBox(b,x+0.52*scale,armY+0.06*scale,z,0.06*scale,0.12*scale,0.06*scale,wirePinCol);
  if(lit){
    pushBox(b,x+0.3*side*scale,armY-0.2*scale,z,0.6*scale,0.08*scale,0.14*scale,crossCol);
    pushBox(b,x+0.55*side*scale,armY-0.26*scale,z,0.18*scale,0.10*scale,0.16*scale,rgb('#ffe8a3'));
  }
}

function pushWire(b,p1,p2,sag=0.4,col=rgb('#1e2225')){
  const steps=4;
  for(let i=0;i<steps;i++){
    const t0=i/steps, t1=(i+1)/steps;
    const x0=p1.x+(p2.x-p1.x)*t0, y0=p1.y+(p2.y-p1.y)*t0 - sag*Math.sin(t0*Math.PI), z0=p1.z+(p2.z-p1.z)*t0;
    const x1=p1.x+(p2.x-p1.x)*t1, y1=p1.y+(p2.y-p1.y)*t1 - sag*Math.sin(t1*Math.PI), z1=p1.z+(p2.z-p1.z)*t1;
    b.quadXYZ(x0-.015,y0,z0, x0+.015,y0,z0, x1+.015,y1,z1, x1-.015,y1,z1, col, 0.7);
  }
}

function pushSign(b,x,y,z,type='speed',scale=1){
  const poleCol=rgb('#828a8e'),white=rgb('#f4f5f0'),red=rgb('#d83535'),blue=rgb('#2a5caa'),yellow=rgb('#e2a828'),black=rgb('#1b1d1f');
  const h=2.2*scale;
  // Sign pole
  pushBox(b,x,y,z,0.06*scale,h,0.06*scale,poleCol);
  const sy=y+h*.85;
  if(type==='speed'){ // Circular Speed Limit Sign (50km/h)
    const r=0.38*scale;
    pushBox(b,x,sy,z,r*2,r*2,0.04*scale,red);
    pushBox(b,x,sy,z+0.01*scale,r*1.5,r*1.5,0.04*scale,white);
    pushBox(b,x,sy,z+0.02*scale,r*0.7,r*0.4,0.04*scale,blue);
  }else if(type==='curve'){ // Curve Warning Sign (Yellow Diamond)
    const w=0.55*scale;
    pushBox(b,x,sy,z,w,w,0.04*scale,yellow);
    pushBox(b,x,sy,z+0.01*scale,w*0.3,w*0.5,0.04*scale,black);
  }else{ // Route / Direction Board (Blue Rectangular Sign)
    const w=0.9*scale,bh=0.6*scale;
    pushBox(b,x,sy,z,w,bh,0.04*scale,blue);
    pushBox(b,x,sy,z+0.01*scale,w*0.82,bh*0.75,0.04*scale,white);
  }
}

function pushBuilding(b,x,y,z,width,height,depth,wallCol,roofCol,type=0){
  // Main building structure
  pushBox(b,x,y,z,width,height,depth,wallCol);
  const night=state.time==='night';
  const winCol=night?rgb('#f8d374'):rgb('#516370');

  if(type===0){ // Japanese House with Pitch/Gabled Roof
    const roofH=height*0.55;
    pushPyramid(b,x,y+height,z,Math.max(width,depth)*0.65,roofH,roofCol,1.05);
    // Door / windows
    pushBox(b,x,y+height*0.25,z+depth*0.51,width*0.25,height*0.4,0.05,rgb('#2c221b'));
    pushBox(b,x+width*0.22,y+height*0.55,z+depth*0.51,width*0.28,height*0.28,0.05,winCol);
    pushBox(b,x-width*0.22,y+height*0.55,z+depth*0.51,width*0.28,height*0.28,0.05,winCol);
  }else if(type===1){ // Roadside Commercial Store / Shop
    // Front visor overhang
    pushBox(b,x,y+height*0.7,z+depth*0.55,width*1.08,0.12,depth*0.3,roofCol);
    // Large glass display / entrance
    pushBox(b,x,y+height*0.3,z+depth*0.51,width*0.75,height*0.5,0.05,winCol);
  }else{ // Agricultural Shed / Warehouse
    // Low pitched roof
    pushBox(b,x,y+height,z,width*1.05,height*0.18,depth*1.05,roofCol);
    pushBox(b,x,y+height*0.35,z+depth*0.51,width*0.4,height*0.6,0.05,rgb('#3a3a3d'));
  }
}

function pushFence(b,sA,sB,lateral,height,col){
  roadPoint(sA,lateral,0,p0); roadPoint(sB,lateral,0,p1);
  roadPoint(sA,lateral,height,p2); roadPoint(sB,lateral,height,p3);
  // Posts
  pushBox(sceneryBuilder,p0.x,p0.y,p0.z,0.08,height*1.1,0.08,col);
  pushBox(sceneryBuilder,p1.x,p1.y,p1.z,0.08,height*1.1,0.08,col);
  // Rails
  wallQuad(sceneryBuilder,sA,sB,lateral,height*0.4,height*0.52,col,0.9);
  wallQuad(sceneryBuilder,sA,sB,lateral,height*0.78,height*0.9,col,0.95);
}

function pushField(b,sA,sB,lat0,lat1,colField,colRidge){
  // Rice field / farmland surface
  roadQuad(b,sA,sB,lat0,lat1,-0.08,colField,0.92);
  // Raised earthen ridges (畦 - aze)
  roadQuad(b,sA,sB,lat0,lat0+0.4,-0.02,colRidge,0.85);
  roadQuad(b,sA,sB,lat1-0.4,lat1,-0.02,colRidge,0.85);
}

function pushRetainingWall(b,sA,sB,side,h0,h1,col){
  const lat=side*(ROAD_HALF_WIDTH+ROAD_SHOULDER+0.1);
  wallQuad(b,sA,sB,lat,h0,h1,col,0.88);
  // Wall top cap
  roadPoint(sA,lat,h1,p0); roadPoint(sA,lat+side*0.3,h1,p1);
  roadPoint(sB,lat+side*0.3,h1,p2); roadPoint(sB,lat,h1,p3);
  b.quad(p0,p1,p2,p3,mixColor(col,[1,1,1],.15),1.0);
}

function pushBusStop(b,sA,side){
  const lat=side*(ROAD_HALF_WIDTH+1.8);
  roadPoint(sA,lat,0,p0);
  const night=state.time==='night';
  // Shelter roof & posts
  pushBox(b,p0.x,p0.y,p0.z,1.6,2.1,1.2,rgb('#525a5e'));
  pushBox(b,p0.x,p0.y+2.0,p0.z,1.8,0.12,1.4,rgb('#386d88'));
  // Signpost
  pushSign(b,p0.x+side*0.9,p0.y,p0.z+0.8,'route',0.8);
}

function pushGroundTerrain(b,sA,sB,lat0,lat1,h0,h1,col){
  roadPoint(sA,lat0,h0,p0); roadPoint(sA,lat1,h1,p1);
  roadPoint(sB,lat1,h1,p2); roadPoint(sB,lat0,h0,p3);
  b.quad(p0,p1,p2,p3,col,0.85);
}

function pushMountainRange(b,vz){
  const night=state.time==='night', sunset=state.time==='sunset',env=state.environment;
  const farCol=rgb(night?'#101a25':sunset?'#514b67':env==='mountain'?'#314f4a':'#4b625e');
  const farLight=rgb(night?'#18283a':sunset?'#716277':env==='mountain'?'#49685b':'#61756e');
  const midCol=rgb(night?'#17261f':sunset?'#5f5961':env==='mountain'?'#42644a':'#55705c');
  const nearCol=rgb(night?'#14251b':env==='mountain'?'#31583b':'#426548');
  for(let layer=0;layer<4;layer++){
    const count=22,zBase=vz+220+layer*95;
    for(let i=0;i<count;i++){
      const z=zBase+i*(105+layer*16),side=(i+layer)%2?1:-1;
      const x=side*(55+layer*24+hash1(i*4.7+layer*11,state.routeSeed)*120);
      const w=70+hash1(i*2.1+layer)*90;
      const h=(layer===0?28:layer===1?48:layer===2?72:92)+hash1(i*3.8+layer)*45;
      const col=layer===0?nearCol:layer===1?midCol:layer===2?farLight:farCol;
      pushPyramid(b,x,layer===0?-4:layer===1?-7:-10,z,w,h,col,.68+layer*.08);
    }
  }
  for(let i=0;i<28;i++){
    const z=vz+130+i*48,side=i%2?1:-1,x=side*(18+hash1(i*7.1)*48);
    pushPyramid(b,x,-1.8,z,28+hash1(i*2.8)*44,8+hash1(i*5.6)*15,mixColor(nearCol,farCol,.35),.72);
  }
}

function pushStreetLamp(b,x,y,z,scale=1,lit=false){const pole=rgb('#5c6265'),head=lit?rgb('#ffe8a5'):rgb('#8d979b');pushBox(b,x,y,z,.10,4*scale,.10,pole,.9);pushBox(b,x,y+3.85*scale,z,.72*scale,.10,.10,pole,.92);pushBox(b,x+.3*scale,y+3.72*scale,z,.24*scale,.16,.22,head)}
function pushPerson(b,x,y,z,scale=1,coat=rgb('#4b5360')){const skin=rgb('#c58f72'),dark=rgb('#25282c');pushBox(b,x,y,z,.24*scale,.72*scale,.20*scale,coat,.95);pushBox(b,x,y+.86*scale,z,.20*scale,.22*scale,.18*scale,skin);pushBox(b,x-.10*scale,y-.55*scale,z,.08*scale,.55*scale,.08*scale,dark,.88);pushBox(b,x+.10*scale,y-.55*scale,z,.08*scale,.55*scale,.08*scale,dark,.88)}
function pushPond(b,sA,sB,side,offset,width,waterCol,bankCol){const inner=ROAD_HALF_WIDTH+offset,outer=inner+width;roadQuad(b,sA,sB,side*inner,side*outer,-.35,waterCol,.92);roadQuad(b,sA,sB,side*(inner-.8),side*inner,-.08,bankCol,.88);roadQuad(b,sA,sB,side*outer,side*(outer+1.2),-.18,bankCol,.82)}
function pushCoastCliff(b,sA,sB,side,base,top,rockCol,grassCol){const inner=ROAD_HALF_WIDTH+ROAD_SHOULDER+base,outer=inner+8;wallQuad(b,sA,sB,side*inner,-1,top,rockCol,.88);roadQuad(b,sA,sB,side*inner,side*outer,top-.02,grassCol,.78)}
function pushCoastBeach(b,sA,sB,side,inner,width,sandCol,waterCol){const a=ROAD_HALF_WIDTH+inner,c=a+width;roadQuad(b,sA,sB,side*a,side*c,-1.55,sandCol,.9);roadQuad(b,sA,sB,side*c,side*(c+34),-1.62,waterCol,.88)}
function pushCityBlock(b,x,y,z,w,h,d,night){const wall=rgb(night?'#222931':'#707b83'),roof=rgb(night?'#171d24':'#505961');pushBox(b,x,y,z,w,h,d,wall,.94);const win=night?rgb('#ffd879'):rgb('#5f7b8c');const cols=Math.max(2,Math.floor(w/1.8)),rows=Math.max(2,Math.floor(h/2));for(let ix=0;ix<cols;ix+=Math.max(1,Math.floor(cols/4)))for(let iy=0;iy<rows;iy+=Math.max(1,Math.floor(rows/5))){const wx=x-w/2+(ix+.5)*w/cols,wy=y+.65+(iy+.5)*h/rows;pushBox(b,wx,wy,z+d/2+.025,Math.min(.72,w/cols*.65),Math.min(.82,h/rows*.58),.035,win,.82)}pushBox(b,x,y+h,z,w*1.02,.12,d*1.02,roof,.9)}
function sidePosition(z,side,offset,out){sampleRoad(z,rs0);return roadPoint(rs0,side*(ROAD_HALF_WIDTH+offset),0,out)}

function buildGuardrails(){
  const b=sceneryBuilder,start=Math.floor((state.vehicle.z+8)/8)*8,end=state.vehicle.z+420,col=rgb(state.time==='night'?'#a8b1b5':'#cfd4d5'),reflector=rgb('#f4d66e');
  for(const side of[-1,1])for(let z=start;z<end;z+=8){
    sampleRoad(z,rs0);sampleRoad(z+8,rs1);
    const a=roadPoint(rs0,side*(ROAD_HALF_WIDTH+.55),0,p0);
    pushBox(b,a.x,a.y,a.z,.085,.82,.085,col);
    wallQuad(b,rs0,rs1,side*(ROAD_HALF_WIDTH+.55),.55,.68,col,.92);
    if(Math.floor(z/8)%2===0){const r=roadPoint(rs0,side*(ROAD_HALF_WIDTH+.48),.72,p1);pushBox(b,r.x,r.y,r.z,.12,.14,.12,reflector)}
  }
}

function buildNoiseBarriers(){
  const env=state.environment;if(env!=='city'&&env!=='country')return;
  const b=sceneryBuilder,vz=state.vehicle.z,start=Math.floor((vz+16)/14)*14,end=vz+(env==='city'?330:220);
  const segment=Math.floor(vz/520),primary=segment%2===0?-1:1;
  const col=rgb(env==='city'?(state.time==='night'?'#263534':'#54736b'):(state.time==='night'?'#29332a':'#69765f'));
  for(let z=start;z<end;z+=14){
    sampleRoad(z,rs0);sampleRoad(z+14,rs1);
    const side=primary;
    const height=env==='city'?2.8:1.45;
    wallQuad(b,rs0,rs1,side*(ROAD_HALF_WIDTH+2.05),.18,height,col,.82);
    if(Math.floor(z/28)%2===0){
      const p=roadPoint(rs0,side*(ROAD_HALF_WIDTH+2.03),height,p0);
      pushBox(b,p.x,p.y,p.z,.10,.30,.10,rgb('#7d8b84'));
    }
  }
}

function buildTunnelAndBridge(){
  const b=sceneryBuilder,vz=state.vehicle.z,start=Math.floor((vz+12)/12)*12,end=vz+720;
  const wall=rgb('#303235'),wallLow=rgb('#454548'),ceiling=rgb('#1b1d20'),joint=rgb('#4a4948');
  for(let z=start;z<end;z+=12){
    sampleRoad(z,rs0);sampleRoad(z+12,rs1);
    const amt=Math.min(rs0.featureAmount||0,rs1.featureAmount||0);
    if((rs0.feature==='tunnel'||rs1.feature==='tunnel')&&amt>.06){
      const left=-(ROAD_HALF_WIDTH+1.32),right=ROAD_HALF_WIDTH+1.32;
      wallQuad(b,rs0,rs1,left,.05,5.05,wall,.78);wallQuad(b,rs0,rs1,right,.05,5.05,wall,.82);
      wallQuad(b,rs0,rs1,left,.10,1.05,wallLow,.96);wallQuad(b,rs0,rs1,right,.10,1.05,wallLow,.96);
      ceilingQuad(b,rs0,rs1,left,right,5.05,ceiling,.72);
      if(Math.floor(z/24)!==Math.floor((z+12)/24)){
        wallQuad(b,rs0,rs1,left+.03,.15,4.85,joint,.72);wallQuad(b,rs0,rs1,right-.03,.15,4.85,joint,.72);
      }
    }else if(rs0.feature==='bridge'&&rs0.featureAmount>.12){
      const p=roadPoint(rs0,0,-2.5,p0);pushBox(b,p.x,p.y,p.z,1.2,2.6,1.2,rgb('#71787b'));
    }
  }
  const lampStart=Math.floor((vz+9)/18)*18,lit=rgb('#ffdca0');
  for(let z=lampStart;z<vz+650;z+=18){
    sampleRoad(z-.22,rs0);sampleRoad(z+.22,rs1);
    if(rs0.feature==='tunnel'&&rs0.featureAmount>.08){
      ceilingQuad(b,rs0,rs1,-1.55,1.55,4.91,lit,1.35);
      const lp=roadPoint(rs0,-ROAD_HALF_WIDTH-.98,3.25,p0),rp=roadPoint(rs0,ROAD_HALF_WIDTH+.98,3.25,p1);
      pushBox(b,lp.x,lp.y,lp.z,.16,.18,.34,lit);pushBox(b,rp.x,rp.y,rp.z,.16,.18,.34,lit);
    }
  }
}

function buildCoastWater(){
  if(state.environment!=='coast')return;
  const b=sceneryBuilder,water=rgb(state.time==='night'?'#102b3d':state.time==='sunset'?'#4b7184':'#347fa3');
  const start=Math.floor((state.vehicle.z+35)/30)*30,end=state.vehicle.z+900;
  for(let z=start;z<end;z+=30){
    sampleRoad(z,rs0);sampleRoad(z+30,rs1);
    const a=roadPoint(rs0,ROAD_HALF_WIDTH+10,-2.2,p0),c=roadPoint(rs0,ROAD_HALF_WIDTH+72,-2.2,p1),d=roadPoint(rs1,ROAD_HALF_WIDTH+72,-2.2,p2),e=roadPoint(rs1,ROAD_HALF_WIDTH+10,-2.2,p3);
    b.quad(a,c,d,e,water,.86);
  }
}

function buildGroundAndShoulderTerrain(){
  const b=sceneryBuilder,vz=state.vehicle.z,env=state.environment,night=state.time==='night';
  const groundCol=rgb(night?'#121d17':env==='city'?'#3a4042':env==='mountain'?'#28422e':env==='country'?'#425e32':'#4e5d48');
  const farGroundCol=rgb(night?'#0e1712':env==='city'?'#323739':env==='mountain'?'#223726':env==='country'?'#364e28':'#414e3d');

  const step=ROAD_SEGMENT*2;
  const start=Math.floor((vz+ROAD_NEAR)/step)*step;
  const end=vz+580;

  for(let z=start;z<end;z+=step){
    sampleRoad(z,rs0); sampleRoad(z+step,rs1);
    const sw=ROAD_HALF_WIDTH+ROAD_SHOULDER;
    // Left shoulder terrain
    pushGroundTerrain(b,rs0,rs1,-sw,-sw-18,0,-0.6,groundCol);
    pushGroundTerrain(b,rs0,rs1,-sw-18,-sw-80,-0.6,-2.2,farGroundCol);
    // Right shoulder terrain
    pushGroundTerrain(b,rs0,rs1,sw,sw+18,0,-0.6,groundCol);
    pushGroundTerrain(b,rs0,rs1,sw+18,sw+80,-0.6,-2.2,farGroundCol);
  }
  buildTerrainVariation(b,vz,env,groundCol,farGroundCol);
}

function buildTerrainVariation(b,vz,env,groundCol,farGroundCol){
  // Extend terrain far beyond the roadside strip so the player sees a landscape, not a green plane.
  const step=18;
  for(let z=Math.floor((vz+20)/step)*step;z<vz+650;z+=step){
    sampleRoad(z,rs0);sampleRoad(z+step,rs1);
    for(const side of[-1,1]){
      const seed=Math.floor(z/step)*1.73+side*9.1;
      const inner=ROAD_HALF_WIDTH+ROAD_SHOULDER+18;
      const outer=inner+90+hash1(seed)*85;
      const drop=1.2+hash1(seed*2.7)*4.5;
      const col=hash1(seed*3.1)>.58?mixColor(groundCol,farGroundCol,.35):groundCol;
      pushGroundTerrain(b,rs0,rs1,side*inner,side*outer,-.45,-drop,col);
      if(hash1(seed*4.4)>.35){
        const lat=side*(inner+10+hash1(seed*5.2)*55);
        const p=roadPoint(rs0,lat,-.42,p0);
        pushBox(b,p.x,p.y,p.z,2.5+hash1(seed)*6,.06,3+hash1(seed*2)*8,mixColor(col,[1,1,1],.10),.7);
      }
    }
  }
}

function buildScenery(){
  sceneryBuilder.reset();
  buildGroundAndShoulderTerrain();
  buildCoastWater();
  buildGuardrails();
  buildNoiseBarriers();
  buildTunnelAndBridge();

  const b=sceneryBuilder,vz=state.vehicle.z,env=state.environment,night=state.time==='night';
  const treeCol=rgb(night?'#14251a':env==='mountain'?'#2e603a':env==='country'?'#55763c':'#426d4a');
  const shrubCol=rgb(night?'#182e20':env==='mountain'?'#3d6f4b':env==='country'?'#628746':'#4f7b58');
  const grassCol=rgb(night?'#1e3626':env==='country'?'#769b4e':env==='mountain'?'#4c7855':'#5a8352');
  const houseWall=rgb(night?'#222a33':'#8c867a'),houseRoof=rgb(night?'#161c22':'#3d4852');
  const shopWall=rgb(night?'#2b333a':'#a2a8ab'),shopRoof=rgb(night?'#1c2830':'#2b5c70');
  const fieldCol=rgb(night?'#15281a':state.time==='sunset'?'#6b6d3b':'#527a3b');
  const ridgeCol=rgb(night?'#1a2018':'#3d3124');
  const fenceCol=rgb(night?'#3d454a':'#80888c');
  const wallCol=rgb(night?'#2b3136':'#71797e');

  // Environment-specific scenery. Keep a guaranteed fallback so a single optional prop can never blank the whole world.
  try {
    // Each environment gets its own visual language: terrain, architecture, density and landmarks.
    if(env==='mountain'){
      const rock=rgb(night?'#252b2b':'#66675e'),oldWall=rgb(night?'#2a2925':'#7b6750');
      for(let z=Math.floor((vz+24)/20)*20;z<vz+520;z+=20){
        sampleRoad(z,rs0);sampleRoad(z+20,rs1);const id=Math.floor(z/20),side=id%3===0?-1:1;
        if(id%2===0)pushRetainingWall(b,rs0,rs1,side,0,1.8+hash1(z)*2.8,rock);
        if(id%5===1){const p=sidePosition(z,side,6+hash1(z)*5,p0);pushBuilding(b,p.x,p.y,p.z,4.5+hash1(z)*2,2.4+hash1(z*2)*1.5,4,oldWall,houseRoof,0)}
        if(id%4===0){const p=sidePosition(z,-side,7+hash1(z*2)*9,p0);pushTree(b,p.x,p.y,p.z,1.1+hash1(z*3)*.8,treeCol,0)}
      }
    }else if(env==='country'){
      const pond=rgb(night?'#10262a':'#4b91a0'),mud=rgb(night?'#1c241b':'#6d6749'),shed=rgb(night?'#25282a':'#817664'),roof=rgb(night?'#1c2024':'#4d4b45');
      for(let z=Math.floor((vz+30)/30)*30;z<vz+560;z+=30){
        sampleRoad(z,rs0);sampleRoad(z+30,rs1);const id=Math.floor(z/30),side=id%2?-1:1;
        if(id%3===0)pushField(b,rs0,rs1,side*(ROAD_HALF_WIDTH+3),side*(ROAD_HALF_WIDTH+34),fieldCol,ridgeCol);
        if(id%7===2)pushPond(b,rs0,rs1,side,5+hash1(id)*8,18+hash1(id*2)*22,pond,mud);
        if(id%6===1){const p=sidePosition(z,side,10+hash1(id)*12,p0);pushBuilding(b,p.x,p.y,p.z,5+hash1(id)*3,2.5+hash1(id*2)*1.6,5,shed,roof,2)}
        if(id%9===4){const p=sidePosition(z,side,4.5,p0);pushTree(b,p.x,p.y,p.z,1.5,treeCol,1)}
      }
    }else if(env==='city'){
      const sidewalk=rgb(night?'#3a4045':'#85888a');
      for(let z=Math.floor((vz+12)/12)*12;z<vz+500;z+=12){
        sampleRoad(z,rs0);const id=Math.floor(z/12),dense=id%5!==0;
        for(const side of[-1,1]){
          const off=dense?5+hash1(id*2.7+side)*4:10+hash1(id*4.1)*10,p=sidePosition(z,side,off,p0),pav=roadPoint(rs0,side*(ROAD_HALF_WIDTH+2),.01,p1);
          pushBox(b,pav.x,pav.y,pav.z,3.2,.08,12,sidewalk,.8);
          if(dense){
            pushCityBlock(b,p.x,p.y,p.z,5+hash1(id*5.2)*6,7+hash1(id*3.1+side)*15,6+hash1(id*7.3)*5,night);
            if(id%3===0){const q=roadPoint(rs0,side*(ROAD_HALF_WIDTH+2.45),0,p1);pushPerson(b,q.x,q.y,q.z,.9,hash1(id+side)>.5?rgb('#3e596d'):rgb('#6a4c4a'));if(id%6===0)pushPerson(b,q.x+side*.8,q.y,q.z+1.2,.82,rgb('#526344'))}
          }
        }
        if(id%2===0){const lp=sidePosition(z,1,1.6,p0);pushStreetLamp(b,lp.x,lp.y,lp.z,1,night)}
      }
      for(let i=0;i<12;i++){const z=vz+150+i*34,side=i%2?-1:1,p=sidePosition(z,side,48+hash1(i)*55,p0);pushCityBlock(b,p.x,p.y,p.z,10+hash1(i)*10,24+hash1(i*2)*35,10+hash1(i*3)*8,night)}
    }else if(env==='coast'){
      const water=rgb(night?'#0d3143':state.time==='sunset'?'#3f7185':'#3188a8'),sand=rgb(night?'#2b3430':'#b8ad87'),rock=rgb(night?'#20282a':'#65655b');
      for(let z=Math.floor((vz+20)/20)*20;z<vz+700;z+=20){
        sampleRoad(z,rs0);sampleRoad(z+20,rs1);const side=Math.floor(z/80)%2===0?1:-1;
        if(Math.floor(z/80)%3===0)pushCoastBeach(b,rs0,rs1,side,4,28+hash1(z)*18,sand,water);
        else{pushCoastCliff(b,rs0,rs1,side,4,2+hash1(z)*2.5,rock,grassCol);pushCoastBeach(b,rs0,rs1,-side,14,18,sand,water)}
        if(Math.floor(z/20)%3===0){const p=sidePosition(z,side,2,p0);pushBox(b,p.x,p.y,p.z,.10,1,.10,rgb('#d9d0b0'))}
        if(Math.floor(z/20)%4===1){const p=sidePosition(z,-side,5+hash1(z)*8,p0);pushShrub(b,p.x,p.y,p.z,1+hash1(z*2)*.7,shrubCol)}
      }
    }
  
  
  } catch(environmentError) {
    // Safe fallback: these primitives are shared by all environments and guarantee visible scenery.
    for(let z=Math.floor((vz+20)/28)*28;z<vz+420;z+=28){
      sampleRoad(z,rs0);
      const id=Math.floor(z/28);
      for(const side of[-1,1]){
        const p=sidePosition(z,side,5+hash1(id*2+side)*9,p0);
        if(env==='city'){
          pushBox(b,p.x,p.y,p.z,7+hash1(id)*4,9+hash1(id*3)*13,6+hash1(id*5)*3,night?rgb('#202830'):rgb('#69747b'),.95);
          if(id%2===0){const q=sidePosition(z,side,2.5,p1);pushStreetLamp(b,q.x,q.y,q.z,1,night)}
        }else if(env==='country'){
          pushField(b,rs0,rs1,side*(ROAD_HALF_WIDTH+3),side*(ROAD_HALF_WIDTH+30),fieldCol,ridgeCol);
          if(id%3===0)pushTree(b,p.x,p.y,p.z,1.2,treeCol,1);
        }else if(env==='coast'){
          pushCoastBeach(b,rs0,rs1,side,4,30,sandCol||rgb('#b8ad87'),rgb('#3188a8'));
        }else{
          pushRetainingWall(b,rs0,rs1,side,0,2.5,wallCol);
          if(id%3===0)pushTree(b,p.x,p.y,p.z,1.4,treeCol,0);
        }
      }
    }
  }

  // Keep the horizon deep, but do not let identical roadside objects dominate every biome.
  pushMountainRange(b,vz);
  if(env!=='mountain')for(let i=0;i<16;i++){const z=vz+420+i*70,side=i%2?-1:1;pushPyramid(b,side*(90+hash1(i)*90),-8,z,70+hash1(i*2)*55,18+hash1(i*3)*18,mixColor(farGroundCol,groundCol,.25),.55)}

  // Near layer: mountain/country keep utility infrastructure; city uses urban lighting instead.
  const nearStep=quality<.82?12:8;let prevPoleP1=null,prevPoleP2=null;
  for(let z=Math.floor((vz+10)/nearStep)*nearStep;z<vz+180;z+=nearStep){
    const id=Math.floor(z/nearStep);sampleRoad(z,rs0);
    for(const side of[-1,1]){const gp=roadPoint(rs0,side*(ROAD_HALF_WIDTH+ROAD_SHOULDER+.6+hash1(id*3.1+side)*1.4),0,p0);pushGrass(b,gp.x,gp.y,gp.z,.8+hash1(id*2.3)*.6,grassCol);if(env!=='city'&&id%2===0){const sp=roadPoint(rs0,side*(ROAD_HALF_WIDTH+ROAD_SHOULDER+1.2+hash1(id*4.1+side)*2),0,p1);pushShrub(b,sp.x,sp.y,sp.z,.7+hash1(id*1.8)*.5,shrubCol)}}
    if(id%7===2){const side=id%14===2?1:-1,sp=sidePosition(z,side,1.2,p0);pushSign(b,sp.x,sp.y,sp.z,env==='mountain'?'curve':env==='city'?'route':id%21===2?'speed':'route',.9)}
    if(env!=='city'&&id%3===0){const pp=sidePosition(z,1,2.2,p0);pushPole(b,pp.x,pp.y,pp.z,1,night,1);const wh=3.7,p1w=roadPoint(rs0,ROAD_HALF_WIDTH+1.68,wh,{}),p2w=roadPoint(rs0,ROAD_HALF_WIDTH+2.72,wh,{});if(prevPoleP1){pushWire(b,prevPoleP1,p1w,.35);pushWire(b,prevPoleP2,p2w,.35)}prevPoleP1=p1w;prevPoleP2=p2w}
  }

  // Mid layer is deliberately sparse in country/coast and dense in city.
  const midStep=quality<.82?26:18;
  for(let z=Math.floor((vz+25)/midStep)*midStep;z<vz+480;z+=midStep){
    const id=Math.floor(z/midStep);sampleRoad(z,rs0);sampleRoad(z+midStep,rs1);
    if((env==='country'||env==='mountain')&&id%2===0){const side=id%4===0?-1:1;pushField(b,rs0,rs1,side>0?ROAD_HALF_WIDTH+3.5:-(ROAD_HALF_WIDTH+28),side>0?ROAD_HALF_WIDTH+28:-(ROAD_HALF_WIDTH+3.5),fieldCol,ridgeCol);pushFence(b,rs0,rs1,side*(ROAD_HALF_WIDTH+2.8),.8,fenceCol)}
    if((env==='mountain'||env==='country')&&id%5===1)pushRetainingWall(b,rs0,rs1,id%10===1?-1:1,0,env==='mountain'?3.2:1.5,wallCol);
    if(env!=='city'&&id%4===1)for(const side of[-1,1]){const tp=sidePosition(z+hash1(id)*8,side,3.5+hash1(id*5.1+side*2.3)*14,p0);pushTree(b,tp.x,tp.y,tp.z,.85+hash1(id*3.9)*.9,treeCol,env==='mountain'?0:id%3===0?1:2)}
  }
}
function buildRain(){
  rainBuilder.reset();if(state.weather!=='rain')return;
  const c=state.camera,forwardX=Math.sin(c.yaw),forwardZ=Math.cos(c.yaw),rightX=Math.cos(c.yaw),rightZ=-Math.sin(c.yaw),col=rgb('#bcd3df'),count=quality<.82?48:76;
  for(let i=0;i<count;i++){
    const phase=(state.worldTime*(18+hash1(i)*18)+hash1(i*4.7)*90)%90,depth=5+phase,lateral=(hash1(i*7.1)-.5)*32,up=(hash1(i*3.9)*10)-2;
    const x=c.x+forwardX*depth+rightX*lateral,z=c.z+forwardZ*depth+rightZ*lateral,y=c.y+up,len=.45+hash1(i*9.1)*.8;
    rainBuilder.triXYZ(x,y,z,x-rightX*.018,y-len,z-rightZ*.018,x+rightX*.018,y-len,z+rightZ*.018,col);
  }
}

function sceneKey(){return`${Math.floor(state.vehicle.z/8)}|${state.environment}|${state.time}|${state.weather}|${quality}`}
function setUniforms(){
  const c=state.camera,aspect=Math.max(.2,state.width/Math.max(1,state.height));
  const portraitWide=aspect<.8?.72+.28*clamp((aspect-.45)/.35,0,1):1;
  perspective(matP,c.fov*Math.PI/180,aspect,.22,1700,portraitWide);
  lookAt(matV,[c.x,c.y,c.z],[c.targetX,c.targetY,c.targetZ],c.roll);multiply(matVP,matP,matV);
  gl.useProgram(program);
  gl.uniformMatrix4fv(gl.getUniformLocation(program,'uViewProj'),false,matVP);
  gl.uniform3f(gl.getUniformLocation(program,'uCameraPos'),c.x,c.y,c.z);
  const pal=palettes[state.time][state.weather];
  let fog=mixColor(rgb(pal[0]),rgb(pal[1]),state.weather==='fog'?.68:.42);
  const tunnel=state.world.feature==='tunnel'?state.world.featureAmount:0;
  if(tunnel>0)fog=mixColor(fog,rgb('#171719'),tunnel*.82);
  gl.uniform3fv(gl.getUniformLocation(program,'uFogColor'),fog);
  const fogNear=tunnel>0?180:state.weather==='fog'?70:state.weather==='rain'?240:520;
  const fogFar=tunnel>0?780:state.weather==='fog'?330:state.weather==='rain'?920:1500;
  gl.uniform1f(gl.getUniformLocation(program,'uFogNear'),fogNear);gl.uniform1f(gl.getUniformLocation(program,'uFogFar'),fogFar);
  gl.uniform1f(gl.getUniformLocation(program,'uExposure'),clamp(state.world.tunnelExposure+state.world.exitFlash*.10,.52,1.12));
  gl.uniform1f(gl.getUniformLocation(program,'uTunnelMix'),tunnel);
  return fog;
}

export function initRenderer(canvas){
  canvasRef=canvas;gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:true,powerPreference:'high-performance',desynchronized:true,preserveDrawingBuffer:false});
  if(!gl)throw new Error('WebGL2 is not available');
  program=createProgram();skyProgram=createSkyProgram();skyBuffer=gl.createBuffer();roadBuffer=gl.createBuffer();sceneryBuffer=gl.createBuffer();rainBuffer=gl.createBuffer();
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.clearDepth(1);resizeRenderer();
}
export function resizeRenderer(){
  if(!gl||!canvasRef)return;
  const rect=canvasRef.getBoundingClientRect();state.width=Math.max(1,rect.width);state.height=Math.max(1,rect.height);
  const cap=quality<.82?1.22:1.58;state.dpr=Math.min(window.devicePixelRatio||1,cap);
  const w=Math.round(state.width*state.dpr),h=Math.round(state.height*state.dpr);
  if(canvasRef.width!==w||canvasRef.height!==h){canvasRef.width=w;canvasRef.height=h;gl.viewport(0,0,w,h)}
}
export function setRenderQuality(q){const next=q<.85?.72:1;if(next===quality)return;quality=next;lastSceneryKey='';resizeRenderer()}
export function renderWorld(){
  if(!gl)return;
  const pal=palettes[state.time][state.weather],base=mixColor(rgb(pal[0]),rgb(pal[1]),.38),tunnel=state.world.feature==='tunnel'?state.world.featureAmount:0;
  const clear=tunnel>0?mixColor(base,rgb('#090b0d'),tunnel*.90):base;
  gl.clearColor(clear[0],clear[1],clear[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

  // Procedural sky: animated cloud masses, horizon haze and a time-of-day sun glow.
  gl.disable(gl.DEPTH_TEST);
  gl.useProgram(skyProgram);
  const top=rgb(pal[0]),horizon=rgb(pal[1]);
  const sun=rgb(state.time==='night'?'#7d91b7':state.time==='sunset'?'#ffb16f':'#fff1cf');
  const cloud=rgb(state.time==='night'?'#384653':state.time==='sunset'?'#d5aaa0':'#f5f7f3');
  const cloudShadow=rgb(state.weather==='fog'?'#9ca9aa':state.time==='night'?'#1c2631':state.time==='sunset'?'#766d79':'#aeb9bd');
  gl.uniform3fv(gl.getUniformLocation(skyProgram,'uTop'),top);
  gl.uniform3fv(gl.getUniformLocation(skyProgram,'uHorizon'),horizon);
  gl.uniform3fv(gl.getUniformLocation(skyProgram,'uSunColor'),sun);
  gl.uniform3fv(gl.getUniformLocation(skyProgram,'uCloud'),cloud);
  gl.uniform3fv(gl.getUniformLocation(skyProgram,'uCloudShadow'),cloudShadow);
  gl.uniform1f(gl.getUniformLocation(skyProgram,'uWeatherMix'),state.weather==='clear'?0:state.weather==='cloudy'?.55:state.weather==='fog'?.9:.72);
  gl.uniform1f(gl.getUniformLocation(skyProgram,'uWorldTime'),state.worldTime);
  gl.uniform1f(gl.getUniformLocation(skyProgram,'uYaw'),state.camera.yaw);
  gl.uniform1f(gl.getUniformLocation(skyProgram,'uPitch'),state.camera.pitch);
  gl.drawArrays(gl.TRIANGLES,0,3);
  gl.enable(gl.DEPTH_TEST);

  setUniforms();buildRoad();
  const key=sceneKey();if(key!==lastSceneryKey){buildScenery();sceneryCount=uploadBuffer(sceneryBuffer,sceneryBuilder,gl.DYNAMIC_DRAW);lastSceneryKey=key}
  buildRain();
  const roadCount=uploadBuffer(roadBuffer,roadBuilder,gl.DYNAMIC_DRAW),rainCount=uploadBuffer(rainBuffer,rainBuilder,gl.DYNAMIC_DRAW);
  drawBuffer(sceneryBuffer,sceneryCount);drawBuffer(roadBuffer,roadCount);drawBuffer(rainBuffer,rainCount);
}

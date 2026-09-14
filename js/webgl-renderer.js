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
const FS=`#version 300 es
precision highp float;
in vec3 vColor;
in float vDistance;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
out vec4 outColor;
void main(){
  float fog=smoothstep(uFogNear,uFogFar,vDistance);
  outColor=vec4(mix(vColor,uFogColor,fog),1.0);
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

const roadBuilder=new MeshBuilder(70000);
const sceneryBuilder=new MeshBuilder(180000);
const rainBuilder=new MeshBuilder(2400);
const rs0={},rs1={},p0={},p1={},p2={},p3={};
const matP=new Float32Array(16),matV=new Float32Array(16),matVP=new Float32Array(16);
let gl,program,roadBuffer,sceneryBuffer,rainBuffer,lastSceneryKey='',quality=1,canvasRef,sceneryCount=0;

function rgb(hex){
  const h=hex.replace('#','');const n=parseInt(h.length===3?h.split('').map(x=>x+x).join(''):h,16);
  return[((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];
}
function mixColor(a,b,t){return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]}

function perspective(out,fovy,aspect,near,far){
  const f=1/Math.tan(fovy/2),nf=1/(near-far);
  out[0]=f/aspect;out[1]=0;out[2]=0;out[3]=0;
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
function createProgram(){const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,VS));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||'program link failed');return p}
function setupBuffer(buffer){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12)}
function uploadBuffer(buffer,builder,usage=gl.DYNAMIC_DRAW){if(!builder.count)return 0;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,builder.data.subarray(0,builder.count*6),usage);return builder.count}
function drawBuffer(buffer,count){if(!count)return;setupBuffer(buffer);gl.drawArrays(gl.TRIANGLES,0,count)}

function roadQuad(builder,sA,sB,l0,l1,h,col){
  roadPoint(sA,l0,h,p0);roadPoint(sA,l1,h,p1);roadPoint(sB,l1,h,p2);roadPoint(sB,l0,h,p3);builder.quad(p0,p1,p2,p3,col);
}
function buildRoad(){
  roadBuilder.reset();const v=state.vehicle;
  const wet=state.weather==='rain',night=state.time==='night';
  const road=rgb(night?'#181d22':wet?'#2a3135':'#353a3e'),shoulder=rgb(state.environment==='coast'?'#716f68':state.environment==='city'?'#4b5052':'#596052');
  const white=rgb(night?'#d9e0df':'#f1f2ec'),yellow=rgb('#d9a23c'),seam=rgb(night?'#20262a':'#252a2d');
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
    const dash=Math.floor((z+4)/13)%2===0;if(dash){roadQuad(roadBuilder,rs0,rs1,-ROAD_HALF_WIDTH*.50-.035,-ROAD_HALF_WIDTH*.50+.035,.018,white);roadQuad(roadBuilder,rs0,rs1,ROAD_HALF_WIDTH*.50-.035,ROAD_HALF_WIDTH*.50+.035,.018,white)}
    if(wet&&z<v.z+260&&Math.floor(z/22)!==Math.floor(z1/22)){const sheen=rgb(night?'#26343d':'#3e4c51'),side=((Math.floor(z/22)&1)?-1:1)*ROAD_HALF_WIDTH*.43;roadQuad(roadBuilder,rs0,rs1,side-.22,side+.22,.024,sheen)}
    if(Math.floor(z/18)!==Math.floor(z1/18)){const zs=Math.ceil(z/18)*18;sampleRoad(zs-.10,rs0);sampleRoad(zs+.10,rs1);roadQuad(roadBuilder,rs0,rs1,-ROAD_HALF_WIDTH+.3,ROAD_HALF_WIDTH-.3,.012,seam)}
  }
}

function pushBox(b,x,y,z,sx,sy,sz,col){
  const x0=x-sx/2,x1=x+sx/2,y0=y,y1=y+sy,z0=z-sz/2,z1=z+sz/2;
  b.quadXYZ(x0,y0,z0,x1,y0,z0,x1,y1,z0,x0,y1,z0,col,.86);
  b.quadXYZ(x1,y0,z1,x0,y0,z1,x0,y1,z1,x1,y1,z1,col,1);
  b.quadXYZ(x0,y0,z1,x0,y0,z0,x0,y1,z0,x0,y1,z1,col,.74);
  b.quadXYZ(x1,y0,z0,x1,y0,z1,x1,y1,z1,x1,y1,z0,col,.94);
  b.quadXYZ(x0,y1,z0,x1,y1,z0,x1,y1,z1,x0,y1,z1,col,1.08);
  b.quadXYZ(x0,y0,z1,x1,y0,z1,x1,y0,z0,x0,y0,z0,col,.66);
}
function pushPyramid(b,x,y,z,r,h,col){
  const ty=y+h,x0=x-r,x1=x+r,z0=z-r,z1=z+r;
  b.triXYZ(x0,y,z0,x1,y,z0,x,ty,z,col,.88);b.triXYZ(x1,y,z0,x1,y,z1,x,ty,z,col,1);
  b.triXYZ(x1,y,z1,x0,y,z1,x,ty,z,col,.78);b.triXYZ(x0,y,z1,x0,y,z0,x,ty,z,col,.92);
  b.quadXYZ(x0,y,z0,x0,y,z1,x1,y,z1,x1,y,z0,col,.58);
}
function pushTree(b,x,y,z,scale,col){pushBox(b,x,y,z,.18*scale,1.8*scale,.18*scale,rgb('#4d3d2d'));pushPyramid(b,x,y+1.0*scale,z,1.25*scale,3.6*scale,col)}
function pushPole(b,x,y,z,scale,lit){pushBox(b,x,y,z,.08*scale,3.8*scale,.08*scale,rgb('#50575a'));if(lit)pushBox(b,x,y+3.65*scale,z,.55*scale,.08*scale,.16*scale,rgb('#ffe39a'))}
function sidePosition(z,side,offset,out){sampleRoad(z,rs0);return roadPoint(rs0,side*(ROAD_HALF_WIDTH+offset),0,out)}

function buildGuardrails(){
  const b=sceneryBuilder,start=Math.floor((state.vehicle.z+12)/16)*16,end=state.vehicle.z+360,col=rgb(state.time==='night'?'#a8b1b5':'#cfd4d5');
  for(const side of[-1,1])for(let z=start;z<end;z+=16){
    const a=sidePosition(z,side,.55,p0),c=sidePosition(z+14,side,.55,p1);
    pushBox(b,a.x,a.y,a.z,.10,.86,.10,col);
    const mx=(a.x+c.x)/2,my=(a.y+c.y)/2+.62,mz=(a.z+c.z)/2,dist=Math.hypot(c.x-a.x,c.z-a.z);
    pushBox(b,mx,my,mz,.10,.10,Math.max(2,dist),col);
    if(Math.floor(z/32)%2===0)pushBox(b,a.x,a.y+.78,a.z,.13,.14,.13,rgb('#f3d470'));
  }
}
function buildTunnelAndBridge(){
  const b=sceneryBuilder,start=Math.floor((state.vehicle.z+20)/18)*18,end=state.vehicle.z+700;
  for(let z=start;z<end;z+=18){sampleRoad(z,rs0);if(rs0.feature==='tunnel'&&rs0.featureAmount>.15){
    const dark=rgb('#252a2d'),lit=rgb('#e8d499');const left=roadPoint(rs0,-ROAD_HALF_WIDTH-1.5,0,p0),right=roadPoint(rs0,ROAD_HALF_WIDTH+1.5,0,p1);
    pushBox(b,left.x,left.y,left.z,.55,5.4,.55,dark);pushBox(b,right.x,right.y,right.z,.55,5.4,.55,dark);
    pushBox(b,(left.x+right.x)/2,Math.max(left.y,right.y)+5.1,(left.z+right.z)/2,ROAD_HALF_WIDTH*2+3.2,.38,.55,dark);
    if(Math.floor(z/36)%2===0)pushBox(b,(left.x+right.x)/2,Math.max(left.y,right.y)+4.8,(left.z+right.z)/2,2.2,.08,.16,lit);
  }else if(rs0.feature==='bridge'&&rs0.featureAmount>.12){
    const p=roadPoint(rs0,0,-2.5,p0);pushBox(b,p.x,p.y,p.z,1.2,2.6,1.2,rgb('#71787b'));
  }}
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
function buildScenery(){
  sceneryBuilder.reset();buildCoastWater();buildGuardrails();buildTunnelAndBridge();
  const b=sceneryBuilder,vz=state.vehicle.z,env=state.environment,night=state.time==='night';
  const treeCol=rgb(night?'#14251a':env==='mountain'?'#2e603a':env==='country'?'#55763c':'#426d4a');
  const nearStep=quality<.82?24:18;
  for(let z=Math.floor((vz+20)/nearStep)*nearStep;z<vz+140;z+=nearStep){for(const side of[-1,1]){
    const id=Math.floor(z/nearStep)*13+side*3,offset=1.3+hash1(id,state.routeSeed)*2.8,p=sidePosition(z+hash1(id+1)*6,side,offset,p0),s=.65+hash1(id+2)*.8;
    if(env==='city')pushPole(b,p.x,p.y,p.z,s,night);else if(env==='coast'){if(id%3===0)pushPole(b,p.x,p.y,p.z,.72,false);else pushBox(b,p.x,p.y,p.z,.45*s,.35*s,.55*s,rgb('#7c7569'));}else if(env==='mountain')pushTree(b,p.x,p.y,p.z,s,treeCol);else if(id%4===0)pushPole(b,p.x,p.y,p.z,.8,false);else pushTree(b,p.x,p.y,p.z,.72*s,treeCol);
  }}
  const farStep=quality<.82?78:54;
  for(let z=Math.floor((vz+120)/farStep)*farStep;z<vz+680;z+=farStep){for(const side of[-1,1]){
    const id=Math.floor(z/farStep)*7+side*5,offset=8+hash1(id,state.routeSeed)*18,p=sidePosition(z,side,offset,p0);
    if(env==='city'){const h=5+hash1(id+2)*18,w=3+hash1(id+4)*7;pushBox(b,p.x,p.y,p.z,w,h,w*.8,rgb(night?'#1a222c':'#707d84'));if(night&&id%2===0)pushBox(b,p.x,p.y+h*.72,p.z-.45,w*.65,.14,.10,rgb('#e4c878'));}
    else if(env==='coast'){if(side<0)pushPyramid(b,p.x,p.y,p.z,5+hash1(id)*6,5+hash1(id+3)*6,rgb(night?'#1d3028':'#426b57'));}
    else pushTree(b,p.x,p.y,p.z,1.2+hash1(id+9)*1.6,treeCol);
  }}
  for(let i=0;i<10;i++){const z=vz+720+i*95,side=i%2?1:-1,p=sidePosition(z,side,45+hash1(i+Math.floor(vz/500))*55,p0);pushPyramid(b,p.x,p.y-3,p.z,18+hash1(i*2)*22,22+hash1(i*3)*28,rgb(night?'#162229':state.time==='sunset'?'#6c6c68':'#667d78'));}
}

function buildRain(){
  rainBuilder.reset();if(state.weather!=='rain')return;const c=state.camera,forwardX=Math.sin(c.yaw),forwardZ=Math.cos(c.yaw),rightX=Math.cos(c.yaw),rightZ=-Math.sin(c.yaw),col=rgb('#bcd3df');const count=quality<.82?48:76;
  for(let i=0;i<count;i++){const phase=(state.worldTime*(18+hash1(i)*18)+hash1(i*4.7)*90)%90;const depth=5+phase,lateral=(hash1(i*7.1)-.5)*32,up=(hash1(i*3.9)*10)-2;const x=c.x+forwardX*depth+rightX*lateral,z=c.z+forwardZ*depth+rightZ*lateral,y=c.y+up;const len=.45+hash1(i*9.1)*.8;
    rainBuilder.triXYZ(x,y,z,x-rightX*.018,y-len,z-rightZ*.018,x+rightX*.018,y-len,z+rightZ*.018,col);
  }
}

function sceneKey(){return`${Math.floor(state.vehicle.z/18)}|${state.environment}|${state.time}|${state.weather}|${quality}`}
function setUniforms(){
  const c=state.camera,aspect=Math.max(.2,state.width/Math.max(1,state.height));perspective(matP,c.fov*Math.PI/180,aspect,.22,1700);lookAt(matV,[c.x,c.y,c.z],[c.targetX,c.targetY,c.targetZ],c.roll);multiply(matVP,matP,matV);
  gl.useProgram(program);gl.uniformMatrix4fv(gl.getUniformLocation(program,'uViewProj'),false,matVP);gl.uniform3f(gl.getUniformLocation(program,'uCameraPos'),c.x,c.y,c.z);
  const pal=palettes[state.time][state.weather],fog=mixColor(rgb(pal[0]),rgb(pal[1]),state.weather==='fog'?.68:.42);
  gl.uniform3fv(gl.getUniformLocation(program,'uFogColor'),fog);
  const fogNear=state.weather==='fog'?70:state.weather==='rain'?240:520,fogFar=state.weather==='fog'?330:state.weather==='rain'?920:1500;gl.uniform1f(gl.getUniformLocation(program,'uFogNear'),fogNear);gl.uniform1f(gl.getUniformLocation(program,'uFogFar'),fogFar);
  return fog;
}

export function initRenderer(canvas){
  canvasRef=canvas;gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:true,powerPreference:'high-performance',desynchronized:true,preserveDrawingBuffer:false});
  if(!gl)throw new Error('WebGL2 is not available');program=createProgram();roadBuffer=gl.createBuffer();sceneryBuffer=gl.createBuffer();rainBuffer=gl.createBuffer();gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.clearDepth(1);resizeRenderer();
}
export function resizeRenderer(){
  if(!gl||!canvasRef)return;const rect=canvasRef.getBoundingClientRect();state.width=Math.max(1,rect.width);state.height=Math.max(1,rect.height);const cap=quality<.82?1.22:1.58;state.dpr=Math.min(window.devicePixelRatio||1,cap);const w=Math.round(state.width*state.dpr),h=Math.round(state.height*state.dpr);if(canvasRef.width!==w||canvasRef.height!==h){canvasRef.width=w;canvasRef.height=h;gl.viewport(0,0,w,h)}
}
export function setRenderQuality(q){const next=q<.85?.72:1;if(next===quality)return;quality=next;lastSceneryKey='';resizeRenderer()}
export function renderWorld(){
  if(!gl)return;const pal=palettes[state.time][state.weather],clear=mixColor(rgb(pal[0]),rgb(pal[1]),.38);gl.clearColor(clear[0],clear[1],clear[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);setUniforms();buildRoad();
  const key=sceneKey();if(key!==lastSceneryKey){buildScenery();sceneryCount=uploadBuffer(sceneryBuffer,sceneryBuilder,gl.DYNAMIC_DRAW);lastSceneryKey=key}
  buildRain();const roadCount=uploadBuffer(roadBuffer,roadBuilder,gl.DYNAMIC_DRAW),rainCount=uploadBuffer(rainBuffer,rainBuilder,gl.DYNAMIC_DRAW);
  drawBuffer(sceneryBuffer,sceneryCount);drawBuffer(roadBuffer,roadCount);drawBuffer(rainBuffer,rainCount);
}

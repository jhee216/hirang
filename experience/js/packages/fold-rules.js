// 기존 index.html '패키지 직접 열어보기'의 접힘 규칙(CH1_CFG · CH2_CFG)을 수정 없이 옮겼다.
// pose(v, object, panel, p)가 도면(mm, z-up) 위의 점을 열림 정도 p(0 닫힘 → 1 열림)에 맞게 접는다.
/* eslint-disable */

export function makeCH1Cfg() {
  return (function(){
  function ry(v,h,a){var r=a*Math.PI/180,c=Math.cos(r),s=Math.sin(r),x=v[0]-h;return [h+x*c+v[2]*s,v[1],-x*s+v[2]*c]}
  function ease(t){t=Math.max(0,Math.min(1,t));return -(Math.cos(Math.PI*t)-1)/2}
  function ang(p){return {outer:90*(1-ease(p/.6)),inner:90*(1-ease((p-.38)/.62))}}
  return {
    bg:[0.894,0.867,0.812], repeat:{book:1}, hinges:[281.005,117.005,82,-116.979,-82].map(function(h){return [[h,-1000],[h,1000]]}), light:[-250,-280,650],
    objects:[
      {geo:'plug',kind:'pkg',cf:[.80,.78,.72],cb:[.80,.78,.72],offset:3,when:function(p){return p<.03}},
      {geo:'book',front:'book',back:'book'},
      {geo:'package',kind:'pkg',front:null,back:'art'},
      {geo:'tongue',ins:1},
      {geo:'intro2',ins:1,front:'intro2',cb:[.98,.98,.98]},
      {geo:'intro1',ins:1,front:'intro1',cb:[.98,.98,.98]},
      {geo:'card',ins:1,front:'cardF',back:'cardB',offset:-2},
      {geo:'message',ins:1,front:'message',back:'message',offset:-1}
    ],
    pose:function(v,o,m,p){var a=ang(p),w=v.slice();
      if(o.ins){w=ry(ry(w,-116.979,a.inner),-82,a.inner);return w}
      if(o.kind!=='pkg')return w;
      var xi=m[0],yi=m[1];
      if(xi===2&&yi<4){if(yi===0)w=ry(w,281.005,-115*a.outer/90);/* 잠금 탭은 홈 안쪽으로 끼워 넣는다 */if(yi<=1)w=ry(w,117.005,-a.outer);w=ry(w,82,-a.outer);w[2]+=1.5*Math.sin(a.outer*Math.PI/180)}
      else if(yi>4&&!((xi===0||xi===5)&&yi<=7)){if(yi>=7)w=ry(w,-116.979,a.inner);w=ry(w,-82,a.inner)}
      return w},
    camera:function(p){var e=p*p*(3-2*p);return {target:[10*e,-10*e,8],dist:440+250*e,yaw:Math.atan2(650,-550),pitch:.86-.1*e,fov:38}}
  };
})();
}

export function makeCH2Cfg(CH2_K) {
  return (function(){
  var MODE='slide',LIFT=0,YAW=Math.atan2(650,-550);
  function sm(x){x=Math.max(0,Math.min(1,x));return -(Math.cos(Math.PI*x)-1)/2}   // 부드러운 가감속
  function slides(p){return MODE==='slide'?{a:0,b:sm((p-.56)/.44)}:{a:0,b:0}}   // a: 보라 패키지를 들어 올림, b: 책을 뚫린 쪽으로 뺌
  var K=CH2_K,topX=K.topX,lowX=K.lowX,diagonal=K.diagonal,seamY=K.seamY,A={};
  function rotate(p,a,b,deg){var t=deg*Math.PI/180,n=b.map(function(x,i){return x-a[i]}),len=Math.hypot(n[0],n[1],n[2]);n=n.map(function(x){return x/len});var v=p.map(function(x,i){return x-a[i]}),c=Math.cos(t),s=Math.sin(t),dot=v[0]*n[0]+v[1]*n[1]+v[2]*n[2],cr=[n[1]*v[2]-n[2]*v[1],n[2]*v[0]-n[0]*v[2],n[0]*v[1]-n[1]*v[0]];return v.map(function(x,i){return a[i]+x*c+cr[i]*s+n[i]*dot*(1-c)})}
  function hinge(p,x,a){return rotate(p,[x,0,0],[x,1,0],a)}
  function rawBridge(p){return rotate(rotate(p,[diagonal[1][0],diagonal[1][1],0],[diagonal[0][0],diagonal[0][1],0],A.diagonal),[0,seamY,0],[1,seamY,0],A.bridge)}
  var lowerCenter=null,upperCenter=null;
  function centers(geo,geo2){function box(kind,idx,g){var G0=g||geo;var mn=[1e9,1e9],mx=[-1e9,-1e9];for(var t=0;t<G0.m.length/2;t++){if(G0.m[t*2]!==kind||G0.m[t*2+1]!==idx)continue;for(var k=0;k<3;k++){var i=(t*3+k)*3;for(var d=0;d<2;d++){mn[d]=Math.min(mn[d],G0.p[i+d]);mx[d]=Math.max(mx[d],G0.p[i+d])}}}return [(mn[0]+mx[0])/2,(mn[1]+mx[1])/2,0]}lowerCenter=box(1,2);upperCenter=box(0,2,geo2)}
  function align(p){var w=Math.min(A.bridge/180,A.diagonal/180);if(w<=0)return p;var c=rawBridge(lowerCenter),e=rawBridge([lowerCenter[0]+1,lowerCenter[1],0]);var a=(-Math.PI/2-Math.atan2(e[1]-c[1],e[0]-c[0]))*w,x=p[0]-c[0],y=p[1]-c[1];return [c[0]+x*Math.cos(a)-y*Math.sin(a)+(upperCenter[0]-c[0])*w,c[1]+x*Math.sin(a)+y*Math.cos(a)+(upperCenter[1]-c[1])*w,p[2]-c[2]*w]}
  var DZ=0,TAB=115,LT=52;   // LT: 보라 띠 잠금 탭이 홈 바로 아래를 막는 각도(홈으로 속이 보이지 않게)
  /* p(0 닫힘 → 1 열림) 하나로 각 면의 각도를 정한다. 크림 띠는 잠금 탭 → 바깥 날개 → 안쪽 날개 순서로 하나씩 연다(안쪽 날개의 문구가 보이게) */
  function angles(p){
    var o=function(a,b){return 1-sm((p-a)/(b-a))};
    A.bridge=180;A.diagonal=180;
    A.lockU=TAB*o(.02,.34);/* 잠금 탭은 Ch1처럼 덮개와 함께 움직인다 */A.upR=90*o(.02,.34);A.upL=90*o(.28,.6);
    if(MODE==='full'){A.lockL=LT*o(.6,.84);A.lowR=90*o(.6,.84);A.lowL=90*o(.76,1)}
    else{A.lockL=LT;A.lowR=90;A.lowL=90}
  }
  function tf(v,kind,idx){var p=v.slice();
    if(kind===0){if(idx<2){if(idx===0)p=hinge(p,topX[1],A.upL);p=hinge(p,topX[2],A.upL)}else if(idx>2){if(idx===5)p=hinge(p,topX[5],-A.lockU);if(idx>=4)p=hinge(p,topX[4],-A.upR);p=hinge(p,topX[3],-A.upR)}}
    else{if(kind===1){if(idx<2){if(idx===0)p=hinge(p,lowX[1],A.lowL);p=hinge(p,lowX[2],A.lowL)}else if(idx>2){if(idx===5)p=hinge(p,lowX[5],-A.lockL);if(idx>=4)p=hinge(p,lowX[4],-A.lowR);p=hinge(p,lowX[3],-A.lowR)}p=rotate(p,[diagonal[1][0],diagonal[1][1],0],[diagonal[0][0],diagonal[0][1],0],A.diagonal)}p=rotate(p,[0,seamY,0],[1,seamY,0],A.bridge);if(kind===1)p=align(p)}
    return [p[0]-(topX[2]+topX[3])/2,p[1]-(seamY-117.5),p[2]+(kind!==0?DZ:0)]}
  var BOOK=null;
  function bookBox(geo){var m0=MODE;MODE='full';angles(0);MODE=m0;var mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9],zs=[];for(var t=0;t<geo.m.length/2;t++){var kind=geo.m[t*2],idx=geo.m[t*2+1];if(kind!==1)continue;for(var k=0;k<3;k++){var i=(t*3+k)*3,w=tf([geo.p[i],geo.p[i+1],geo.p[i+2]],kind,idx);if(idx===2){for(var d=0;d<3;d++){mn[d]=Math.min(mn[d],w[d]);mx[d]=Math.max(mx[d],w[d])}}else if(idx===1)zs.push(w[2])}}
    var z0=mn[2],zw=zs.reduce(function(a,b){return a+b},0)/zs.length,up=zw>z0?1:-1,wall=Math.abs(lowX[2]-lowX[1]);
    BOOK={mn:mn,mx:mx,z0:z0,up:up,h:Math.min(wall-10,30)};
    var ext=[[1e9,-1e9],[1e9,-1e9]];for(var t2=0;t2<geo.m.length/2;t2++){if(geo.m[t2*2]!==1)continue;for(var k2=0;k2<3;k2++){var i2=(t2*3+k2)*3,w2=tf([geo.p[i2],geo.p[i2+1],geo.p[i2+2]],1,geo.m[t2*2+1]);for(var d2=0;d2<2;d2++){ext[d2][0]=Math.min(ext[d2][0],w2[d2]);ext[d2][1]=Math.max(ext[d2][1],w2[d2])}}}
    var lx=mx[0]-mn[0],ly=mx[1]-mn[1];
    // 보라 띠의 벽(세로 면)이 막고 있는 축을 찾고, 그 반대 축(뚫린 쪽)으로 책을 뺀다
    var wall=[0,0];for(var t3=0;t3<geo.m.length/2;t3++){if(geo.m[t3*2]!==1)continue;var P3=[];for(var k3=0;k3<3;k3++){var i3=(t3*3+k3)*3;P3.push(tf([geo.p[i3],geo.p[i3+1],geo.p[i3+2]],1,geo.m[t3*2+1]))}
      var ax=[P3[1][0]-P3[0][0],P3[1][1]-P3[0][1],P3[1][2]-P3[0][2]],bx=[P3[2][0]-P3[0][0],P3[2][1]-P3[0][1],P3[2][2]-P3[0][2]],nx=ax[1]*bx[2]-ax[2]*bx[1],ny=ax[2]*bx[0]-ax[0]*bx[2],nz=ax[0]*bx[1]-ax[1]*bx[0],ar=Math.hypot(nx,ny,nz);if(!ar)continue;
      if(Math.abs(nz)/ar<.3){wall[Math.abs(nx)>Math.abs(ny)?0:1]+=ar}}
    BOOK.axis=wall[0]>wall[1]?1:0;BOOK.len=BOOK.axis?ly:lx;
    var eye=[Math.cos(YAW),Math.sin(YAW)];BOOK.dir=eye[BOOK.axis]>=0?1:-1}
  return {
    bg:[0.894,0.867,0.812], repeat:{book:1}, pairCreases:false, hinges:[1,2,3,4].map(function(i){return [[topX[i],-1000],[topX[i],1000],0]}).concat([1,2,3,4].map(function(i){return [[lowX[i],-1000],[lowX[i],1000],1]}),[[[-1000,seamY],[2000,seamY],null],[diagonal[0],diagonal[1],1]]), light:[-250,-280,650], openMap:function(p){return 1-.7*p},
    init:function(GEO){centers(GEO.package,GEO.cream);
      // 보라 띠가 크림 띠 안에 정확히 들어가도록 높이를 맞춘다(조립 정렬 뒤에도 6mm 어긋나 있었다)
      var m0=MODE;MODE='full';angles(0);MODE=m0;DZ=0;var zr=function(g,kind){var mn=1e9,mx=-1e9;for(var t=0;t<g.m.length/2;t++){if(g.m[t*2]!==kind)continue;for(var k=0;k<3;k++){var i=(t*3+k)*3,w=tf([g.p[i],g.p[i+1],g.p[i+2]],kind,g.m[t*2+1]);mn=Math.min(mn,w[2]);mx=Math.max(mx,w[2])}}return [mn,mx]};
      var zc=zr(GEO.cream,0),zp=zr(GEO.package,1);DZ=zc[0]-zp[0];bookBox(GEO.package)},
    objects:[{geo:'plugU',kind:'pkg',cf:[.80,.78,.72],cb:[.80,.78,.72],offset:3,when:function(p){return p<.03}},{geo:'plugL',kind:'pkg',cf:[.55,.50,.62],cb:[.55,.50,.62],offset:3,when:function(p){return MODE==='slide'||p<.62}},{geo:'book',kind:'book',front:'book',back:'book'},{geo:'package',kind:'pkg',front:null,back:'art'},{geo:'ltab',kind:'pkg',front:null,back:'art'},{geo:'cream',kind:'pkg',front:null,back:'art',offset:-2},{geo:'top',kind:'pkg',front:null,back:'art',offset:-3}],
    setMode:function(m){MODE=m},getMode:function(){return MODE},
    steps:function(){return MODE==='full'?[['닫힘',0],['바깥 날개',.34],['안쪽 날개',.6],['보라 띠 열기',.84],['모두 펼침',1]]:[['닫힘',0],['바깥 날개',.34],['안쪽 날개',.6],['책 꺼내기',1]]},
    pose:function(v,o,m,p){angles(p);var S2=slides(p),b0=BOOK;
      if(o.kind==='book'){var b=BOOK,ins=5,lx=b.mx[0]-b.mn[0],ly=b.mx[1]-b.mn[1],long=ly>lx;
        var F=3,u=long?(F&1?1-v[0]:v[0]):1-v[1],w=long?(F&2?1-v[1]:v[1]):1-v[0];var q=[b.mn[0]+ins+(lx-2*ins)*u,b.mn[1]+ins+(ly-2*ins)*w,b.z0+b.up*(0.3+b.h*v[2])];
        q[b0.axis]+=b0.dir*S2.b*(b0.len+28);return q}
      var r=tf(v,m[0],m[1]);if(m[0]!==0&&S2.a>0)r[2]+=b0.up*S2.a*LIFT;return r},
    camera:function(p){var e=p*p*(3-2*p),b=BOOK,c=[(b.mn[0]+b.mx[0])/2,(b.mn[1]+b.mx[1])/2,b.z0+b.up*15];if(MODE==='slide'){var S2=slides(p);c[b.axis]+=b.dir*S2.b*(b.len+28)*.5;c[2]+=b.up*S2.a*LIFT;e=Math.max(e*.55,S2.b*.8)}return {target:c,dist:430+260*e,yaw:YAW,pitch:b.up>0?(.86-.1*e):-(.86-.1*e),fov:38}}
  };
})();
}

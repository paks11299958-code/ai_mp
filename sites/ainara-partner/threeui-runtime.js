/* DBZONE ThreeUI catalog runtime — local, dependency-free, one canvas maximum. */
(()=>{'use strict';
const host=document.querySelector('[data-threeui-effect]');if(!host)return;
const id=host.dataset.threeuiEffect,reduce=matchMedia('(prefers-reduced-motion: reduce)');
if(reduce.matches){host.dataset.threeuiFallback='motion';return}
const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx){host.dataset.threeuiFallback='canvas';return}
canvas.setAttribute('aria-hidden','true');host.append(canvas);
let w=1,h=1,raf=0,visible=true,last=performance.now(),seed=7;
const rnd=()=>((seed=Math.imul(seed,48271)%2147483647)&2147483647)/2147483647;
const nodes=Array.from({length:innerWidth<600?32:58},()=>({x:rnd(),y:rnd(),vx:(rnd()-.5)*.00006,vy:(rnd()-.5)*.00006}));
const drops=Array.from({length:innerWidth<600?28:52},()=>({x:rnd(),y:rnd(),r:3+rnd()*18,p:rnd()*6.28}));
const verts=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
const edges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
function size(){const r=host.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,1.5);w=Math.max(1,r.width);h=Math.max(1,r.height);canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(d,0,0,d,0,0);draw(performance.now(),0)}
function network(t,d){const lim=Math.min(w,h)*.24;for(const n of nodes){n.x+=n.vx*d;n.y+=n.vy*d;if(n.x<0||n.x>1)n.vx*=-1;if(n.y<0||n.y>1)n.vy*=-1}for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i],b=nodes[j],q=Math.hypot((a.x-b.x)*w,(a.y-b.y)*h);if(q<lim){ctx.strokeStyle=`rgba(96,165,250,${(1-q/lim)*.28})`;ctx.beginPath();ctx.moveTo(a.x*w,a.y*h);ctx.lineTo(b.x*w,b.y*h);ctx.stroke()}}ctx.fillStyle='rgba(147,197,253,.8)';for(const n of nodes){ctx.beginPath();ctx.arc(n.x*w,n.y*h,1.3,0,7);ctx.fill()}}
function cloth(t){const C=innerWidth<600?14:22,R=14,L=w*.12,T=h*.14,W=w*.76,H=h*.68;ctx.fillStyle='rgba(169,73,82,.16)';ctx.strokeStyle='rgba(244,218,190,.32)';for(let y=0;y<R-1;y++)for(let x=0;x<C-1;x++){const p=(a,b)=>{const nx=a/(C-1),ny=b/(R-1),v=Math.sin(nx*7+t*.0011)*13*Math.sin(ny*Math.PI)+Math.cos(ny*8+t*.0007)*6;return[L+nx*W+v*.35,T+ny*H+v]};const a=p(x,y),b=p(x+1,y),c=p(x+1,y+1),d=p(x,y+1);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.lineTo(...c);ctx.lineTo(...d);ctx.closePath();ctx.fill();ctx.stroke()}}
function condensation(t){for(const d of drops){const pulse=1+Math.sin(t*.0007+d.p)*.09,g=ctx.createRadialGradient(d.x*w-d.r*.3,d.y*h-d.r*.4,1,d.x*w,d.y*h,d.r*pulse);g.addColorStop(0,'rgba(255,255,255,.58)');g.addColorStop(.45,'rgba(255,255,255,.12)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(d.x*w,d.y*h,d.r*pulse,0,7);ctx.fill()}}
function wire(t){const a=t*.00022,s=Math.min(w,h)*.32,p=verts.map(([x,y,z])=>{const X=x*Math.cos(a)-z*Math.sin(a),Z=x*Math.sin(a)+z*Math.cos(a),Y=y*Math.cos(a*.77)-Z*Math.sin(a*.77),Z2=y*Math.sin(a*.77)+Z*Math.cos(a*.77),q=3.8/(4.8+Z2);return[w*.62+X*s*q,h*.54+Y*s*q]});ctx.strokeStyle='rgba(241,245,249,.62)';for(const[a,b]of edges){ctx.beginPath();ctx.moveTo(...p[a]);ctx.lineTo(...p[b]);ctx.stroke()}}
function orbital(t){const cx=w*.68,cy=h*.5,r=Math.min(w,h)*.27,a=t*.00018;for(let i=0;i<90;i++){const u=i/89,th=i*2.399+a,ph=Math.acos(1-2*u),x=Math.sin(ph)*Math.cos(th),y=Math.cos(ph),z=Math.sin(ph)*Math.sin(th),q=1/(1.5-z*.25);ctx.fillStyle=`rgba(167,139,250,${.18+(z+1)*.25})`;ctx.beginPath();ctx.arc(cx+x*r*q,cy+y*r*q,1.1+(z+1)*.6,0,7);ctx.fill()}}
const render={'particle-network':network,'woven-cloth':cloth,'condensation':condensation,'wireframe-forms':wire,'orbital-sphere':orbital}[id];
function draw(t,d){ctx.clearRect(0,0,w,h);if(render)render(t,d)}function tick(t){draw(t,Math.min(40,t-last));last=t;raf=visible&&!document.hidden?requestAnimationFrame(tick):0}function start(){if(!raf&&visible&&!document.hidden){last=performance.now();raf=requestAnimationFrame(tick)}}function stop(){cancelAnimationFrame(raf);raf=0}
new ResizeObserver(size).observe(host);new IntersectionObserver(([e])=>{visible=e.isIntersecting;visible?start():stop()}).observe(host);document.addEventListener('visibilitychange',()=>document.hidden?stop():start());size();start();
})();

(() => {
'use strict';
const hero=document.querySelector('.hero'),stack=document.querySelector('.hero-stack'),stage=document.getElementById('stage'),copy=document.querySelector('.hero-copy'),poster=document.getElementById('poster'),end=document.getElementById('end-frame'),labels=document.getElementById('labels'),anchors=document.getElementById('anchors'),leaders=document.getElementById('leaders'),canvas=document.getElementById('beam');
const reduced=matchMedia('(prefers-reduced-motion:reduce)'),portrait=matchMedia('(orientation:portrait)');
let data=null,video=null,frame=0,generation=0,mode='poster',time=0,positions=[],timer=0,scrollReady=false;

let currentAspect=portrait.matches?'9x16':'16x9';
const phone=()=>matchMedia('(max-width:760px)').matches || /Android|iPhone|iPod/i.test(navigator.userAgent);
function mapPoint(point){const r=stage.getBoundingClientRect(),s=Math.max(r.width/data.width,r.height/data.height);return {x:point.x*data.width*s+(r.width-data.width*s)/2,y:point.y*data.height*s+(r.height-data.height*s)/2};}
function mapRect(rect){const a=mapPoint(rect),b=mapPoint({x:rect.x+rect.width,y:rect.y+rect.height});return {x:a.x,y:a.y,width:b.x-a.x,height:b.y-a.y};}
function overlaps(a,b,gap=0){return a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;}
function robotSafeRect(){if(!data?.robot_bbox)return null;const m=data.robot_bbox_margin||{x:0,y:0},r=data.robot_bbox;return mapRect({x:r.x-m.x,y:r.y-m.y,width:r.width+2*m.x,height:r.height+2*m.y});}
function layout(){
 const w=stage.clientWidth,h=stage.clientHeight,offset=Math.max(0,copy.getBoundingClientRect().height-h*.27);stage.style.setProperty('--copy-offset',offset+'px');
 if(!data||!labels.firstElementChild)return;
 const large=parseFloat(getComputedStyle(labels.firstElementChild).fontSize)>15;
 hero.classList.toggle('large-labels',large);
 if(large && labels.parentElement===stage)stack.append(labels);else if(!large && labels.parentElement!==stage)stage.append(labels);
 positions=data.labels.map(mapPoint);const occupied=[],obstacles=positions.map(p=>({x:p.x-5,y:p.y-5,width:10,height:10}));const safe=robotSafeRect();if(safe)obstacles.push(safe);
 const sr=stage.getBoundingClientRect(),cr=copy.getBoundingClientRect();obstacles.push({x:cr.x-sr.x,y:cr.y-sr.y,width:cr.width,height:cr.height});
 leaders.setAttribute('viewBox',`0 0 ${w} ${h}`);leaders.replaceChildren();
 [...labels.children].forEach((pill,i)=>{
  const p=positions[i],dot=anchors.children[i];dot.style.left=p.x+'px';dot.style.top=p.y+'px';if(large)return;
  const pw=pill.offsetWidth,ph=pill.offsetHeight,clampX=x=>Math.max(8,Math.min(w-pw-8,x)),clampY=y=>Math.max(8,Math.min(h-ph-36,y));
  const xs=[clampX(p.x-pw/2),clampX(p.x-pw-12),clampX(p.x+12)],ys=[clampY(p.y-ph-12),clampY(p.y+12)];
  for(const o of obstacles){xs.push(clampX(o.x-pw-8),clampX(o.x+o.width+8));ys.push(clampY(o.y-ph-8),clampY(o.y+o.height+8));}
  for(let y=8;y<h-ph-36;y+=ph+8)ys.push(y);
  const choices=[];for(const x of xs)for(const y of ys){const r={x,y,width:pw,height:ph};if(![...obstacles,...occupied].some(o=>overlaps(r,o,6))){const dx=Math.max(x-p.x,0,p.x-x-pw),dy=Math.max(y-p.y,0,p.y-y-ph);choices.push({r,score:Math.hypot(dx,dy)+(y>p.y?2:0)});}}
  choices.sort((a,b)=>a.score-b.score);const r=choices[0]?.r;if(!r){throw new Error('No collision-free label position for '+pill.dataset.id+' '+JSON.stringify({w,h,pw,ph,obstacles}));}
  pill.style.left=r.x+'px';pill.style.top=r.y+'px';occupied.push(r);
  const line=document.createElementNS('http://www.w3.org/2000/svg','line');line.setAttribute('x1',p.x);line.setAttribute('y1',p.y);line.setAttribute('x2',Math.max(r.x,Math.min(r.x+pw,p.x)));line.setAttribute('y2',Math.max(r.y,Math.min(r.y+ph,p.y)));line.setAttribute('stroke','#80b7a5');line.setAttribute('stroke-width','1');line.style.opacity=pill.classList.contains('visible')?'.65':'0';leaders.append(line);
 });
 const dpr=Math.min(devicePixelRatio,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);drawBeam(time);
}
function antennaAt(t){const track=data.robot_antenna_track;if(!track?.length)return data.robot_antenna;let i=Math.max(0,Math.min(track.length-1,Math.round((t-3.8)*24)));return track[i];}
function beamTarget(t){const phase=Math.max(0,Math.min(3,(t-6)/.5)),i=Math.floor(phase),j=Math.min(3,i+1),u=phase-i;return {x:positions[i].x+(positions[j].x-positions[i].x)*u,y:positions[i].y+(positions[j].y-positions[i].y)*u,index:i};}
function drawBeam(t){
 const ctx=canvas.getContext('2d'),w=stage.clientWidth,h=stage.clientHeight;ctx.clearRect(0,0,canvas.width,canvas.height);
 if(!data||reduced.matches||t<6||t>=8||mode==='static'||mode==='complete'||positions.length!==4)return;
 const start=mapPoint(antennaAt(t)),target=beamTarget(t),angle=Math.atan2(target.y-start.y,target.x-start.x),distance=Math.max(96,Math.hypot(target.x-start.x,target.y-start.y)*1.32);
 ctx.save();ctx.scale(canvas.width/w,canvas.height/h);ctx.translate(start.x,start.y);ctx.rotate(angle);
 // Nested angular fans feather both sides; the radial fade keeps the far end transparent.
 for(let i=0;i<28;i++){const spread=.42*(1-i/32),g=ctx.createRadialGradient(0,0,0,0,0,distance);g.addColorStop(0,'rgba(25,201,172,0.065)');g.addColorStop(.48,'rgba(25,201,172,0.052)');g.addColorStop(.78,'rgba(25,201,172,0.025)');g.addColorStop(1,'rgba(25,201,172,0)');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,distance,-spread,spread);ctx.closePath();ctx.fill();}
 ctx.restore();
}
function sync(t){time=t;hero.classList.toggle('complete',t>=8||mode==='static');[...labels.children].forEach((p,i)=>{const visible=t>=6+i*.5||mode==='static';p.classList.toggle('visible',visible);anchors.children[i].classList.toggle('visible',visible);if(leaders.children[i])leaders.children[i].style.opacity=visible?'.65':'0';});drawBeam(t);}
function finalState(reason){mode='static';hero.dataset.state=reason;clearTimeout(timer);cancelAnimationFrame(frame);if(video){video.pause();video.remove();video=null;}end.hidden=false;poster.hidden=true;sync(10);layout();}
function tick(){if(!video)return;sync(video.currentTime);frame=requestAnimationFrame(tick);}
async function start(){
 const ticket=++generation;clearTimeout(timer);cancelAnimationFrame(frame);if(video){video.pause();video.remove();video=null;}mode='poster';hero.dataset.state='poster';poster.hidden=false;end.hidden=true;currentAspect=portrait.matches?'9x16':'16x9';
 const response=await fetch(`assets/labels_${currentAspect}.json`);if(!response.ok)throw new Error('좌표 자료를 불러오지 못했습니다.');data=await response.json();if(ticket!==generation)return;
 end.src=`assets/last_${currentAspect}.webp`;labels.replaceChildren();anchors.replaceChildren();data.labels.forEach(l=>{const pill=document.createElement('span');pill.className='pill';pill.dataset.id=l.id;pill.textContent=l.label+' ✓';labels.append(pill);const dot=document.createElement('span');dot.className='anchor';dot.dataset.id=l.id;anchors.append(dot);});sync(0);layout();refreshLook();paintLook();
 const connection=navigator.connection,low=(navigator.deviceMemory&&navigator.deviceMemory<=2)||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=2);
 if(reduced.matches||connection?.saveData||low){finalState(reduced.matches?'reduced-motion':connection?.saveData?'save-data':'low-spec');return;}
 try{await poster.querySelector('img').decode();}catch{}if(ticket!==generation)return;
 await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await new Promise(r=>setTimeout(r,120));if(ticket!==generation)return;
 video=document.createElement('video');video.muted=true;video.defaultMuted=true;video.autoplay=true;video.playsInline=true;video.loop=false;video.preload='auto';video.setAttribute('aria-hidden','true');video.poster=`assets/poster_${currentAspect}.webp`;video.src=`assets/hero_${currentAspect}${phone()?'_720p':''}.mp4`;stage.insertBefore(video,canvas);
 video.addEventListener('error',()=>{if(ticket===generation)finalState('media-error')});video.addEventListener('ended',()=>{mode='complete';finalState('ended')});video.addEventListener('playing',()=>{clearTimeout(timer);mode='playing';hero.dataset.state='playing';frame=requestAnimationFrame(tick)});video.addEventListener('timeupdate',()=>sync(video?.currentTime||0));timer=setTimeout(()=>{if(ticket===generation && mode!=='playing')finalState('autoplay-timeout')},3000);
 try{await video.play();}catch{if(ticket===generation)finalState('autoplay-blocked');}
}
new ResizeObserver(layout).observe(copy);new ResizeObserver(layout).observe(stage);new ResizeObserver(layout).observe(labels);
portrait.addEventListener('change',()=>start().catch(()=>finalState('load-error')));reduced.addEventListener('change',()=>{if(reduced.matches){finalState('reduced-motion');if(window.ScrollTrigger)ScrollTrigger.getAll().forEach(t=>t.kill());if(window.gsap){gsap.killTweensOf(look);gsap.killTweensOf('[data-look]');gsap.set('[data-look]',{opacity:1,y:0});}refreshLook();}});
document.querySelectorAll('a[href="#ask"]').forEach(a=>a.addEventListener('click',()=>setTimeout(()=>document.getElementById('q').focus({preventScroll:true}),350)));
document.getElementById('ask').addEventListener('submit',e=>{e.preventDefault();const v=document.getElementById('q').value.trim(),done=document.getElementById('done');done.textContent=v?`"${v}" 조건으로 비교를 준비했어요. (시안이라 실제 분석은 연결 전이에요)`: '원하는 조건을 적어 주세요.';done.hidden=false;});
const compact=matchMedia('(max-width:760px), (orientation:portrait)');
const lookImage=document.getElementById('look-image'),lookFrame=document.querySelector('.look-picture'),lookCards=[...document.querySelectorAll('[data-look]')];
const look={scale:1,x:.5,y:.5};let activeLook=-1,lookFrameRequest=0;
function paintLook(){if(compact.matches||!data||!lookImage.currentSrc)return;const w=lookFrame.clientWidth,h=Math.max(1,lookFrame.clientHeight-lookFrame.querySelector('.look-caption').offsetHeight),s=Math.max(w/data.width,h/data.height)*look.scale,rw=data.width*s,rh=data.height*s;lookFrame.style.backgroundImage=`url("${lookImage.currentSrc}")`;lookFrame.style.backgroundSize=`${rw}px ${rh}px`;lookFrame.style.backgroundPosition=`${Math.min(0,Math.max(w-rw,w/2-look.x*rw))}px ${Math.min(0,Math.max(h-rh,h/2-look.y*rh))}px`;lookFrame.classList.add('background-ready');}
function zoom(i){if(compact.matches||!data)return;const card=lookCards[i],p=data.labels.find(p=>p.id===card.dataset.look);if(!p)return;
 activeLook=i;lookCards.forEach((el,j)=>el.classList.toggle('is-active',j===i));document.getElementById('look-name').textContent=card.querySelector('h3').textContent;document.getElementById('look-description').textContent=card.querySelector('.look-text p').textContent;lookFrame.dataset.focus=card.dataset.look;
 if(window.gsap)gsap.killTweensOf(look);look.x=p.x;look.y=p.y;look.scale=1.28;paintLook();
 // Focus and caption change together. Optional GSAP only eases the final tiny scale adjustment.
 if(window.gsap&&!reduced.matches){look.scale=1.25;paintLook();gsap.to(look,{scale:1.28,duration:.65,ease:'power2.out',onUpdate:paintLook});}
}
function focusNearest(){if(compact.matches||!data)return;let index=0,best=Infinity;lookCards.forEach((card,i)=>{const r=card.getBoundingClientRect(),distance=Math.abs(r.top+r.height/2-innerHeight/2);if(distance<best){best=distance;index=i;}});if(index!==activeLook)zoom(index);else paintLook();}
function refreshLook(){if(window.gsap)gsap.killTweensOf(look);if(compact.matches){if(window.ScrollTrigger)ScrollTrigger.getAll().forEach(t=>t.kill());lookCards.forEach(c=>c.classList.remove('is-active'));activeLook=-1;return;}activeLook=-1;focusNearest();}
function loadScroll(){if(scrollReady||compact.matches||reduced.matches)return;scrollReady=true;
 const attach=()=>{if(compact.matches||reduced.matches)return;gsap.registerPlugin(ScrollTrigger);ScrollTrigger.create({trigger:'#how',start:'top bottom',end:'bottom top',onUpdate:focusNearest,onRefresh:focusNearest});focusNearest();};
 if(window.gsap&&window.ScrollTrigger){attach();return;}const script=document.createElement('script');script.src='assets/gsap.min.js';script.onload=()=>{if(!window.gsap)return;const trigger=document.createElement('script');trigger.src='assets/ScrollTrigger.min.js';trigger.onload=()=>{if(window.ScrollTrigger)attach();};document.head.append(trigger);};document.head.append(script);
}
lookImage.addEventListener('load',()=>{refreshLook();paintLook();});new ResizeObserver(paintLook).observe(lookFrame);new ResizeObserver(paintLook).observe(lookFrame.querySelector('.look-caption'));
const reveal=new IntersectionObserver(entries=>entries.forEach(e=>e.target.classList.toggle('is-seen',e.isIntersecting&&!reduced.matches)),{threshold:.12});lookCards.forEach(card=>reveal.observe(card));
compact.addEventListener('change',()=>{scrollReady=false;refreshLook();if(!compact.matches&&nearHow)loadScroll();});
let nearHow=false;new IntersectionObserver(entries=>{nearHow=entries.some(e=>e.isIntersecting);if(nearHow&&scrollY>0)loadScroll();},{rootMargin:'120px'}).observe(document.getElementById('how'));
addEventListener('scroll',()=>{if(nearHow)loadScroll();if(!lookFrameRequest)lookFrameRequest=requestAnimationFrame(()=>{lookFrameRequest=0;focusNearest();});},{passive:true});
refreshLook();
start().catch(()=>{end.src=`assets/last_${currentAspect}.webp`;finalState('load-error')});
// Read-only state plus actual video seeking for reproducible browser QA; no synthetic frame replacement.
window.rentalfitQA={get state(){return hero.dataset.state},get aspect(){return currentAspect},mapPoint,mapRect,robotSafeRect,beamTarget,antennaAt,get time(){return time},async seek(t){if(!video)throw new Error('No video');video.pause();cancelAnimationFrame(frame);await new Promise((resolve,reject)=>{const v=video;const timeout=setTimeout(()=>reject(new Error('Seek timeout')),10000);v.addEventListener('seeked',()=>{clearTimeout(timeout);resolve()},{once:true});v.currentTime=t;});sync(t);layout();},layout,get anchors(){return positions},get metadata(){return data}};
})();

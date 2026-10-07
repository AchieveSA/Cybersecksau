// Animated particle network background
(function(){
  const c=document.getElementById('bg');if(!c)return;
  const ctx=c.getContext('2d');let w,h,pts=[];
  const N=Math.min(90,Math.floor(innerWidth/14));
  function size(){w=c.width=innerWidth;h=c.height=innerHeight}
  function init(){pts=[];for(let i=0;i<N;i++)pts.push({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.35,vy:(Math.random()-.5)*.35,r:Math.random()*1.8+.6})}
  function step(){
    ctx.clearRect(0,0,w,h);
    for(const p of pts){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>w)p.vx*=-1;if(p.y<0||p.y>h)p.vy*=-1}
    for(let i=0;i<pts.length;i++){for(let j=i+1;j<pts.length;j++){
      const a=pts[i],b=pts[j],d=Math.hypot(a.x-b.x,a.y-b.y);
      if(d<140){ctx.strokeStyle=`rgba(120,140,255,${(1-d/140)*.35})`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
    }}
    for(const p of pts){ctx.fillStyle='rgba(140,200,255,.9)';ctx.shadowBlur=10;ctx.shadowColor='#38d9ff';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,7);ctx.fill();ctx.shadowBlur=0}
    requestAnimationFrame(step);
  }
  addEventListener('resize',()=>{size();init()});size();init();step();
})();

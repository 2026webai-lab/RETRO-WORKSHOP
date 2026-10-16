const { chromium } = require('playwright');
const fs = require('fs');
// 使い方: node tools/capture.js <名前> <幅> <高さ> <dsf> <秒数>   例) node tools/capture.js v 1080 1920 1 12
// 先に `python3 -m http.server 8765` を起動。出力: out/frames_<名前>/ → ffmpegでmp4化(README参照)
const [,, name, w, h, dsf, secs] = process.argv;
(async()=>{
  const out = `out/frames_${name}/`;
  fs.rmSync(out,{recursive:true,force:true}); fs.mkdirSync(out,{recursive:true});
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const ctx = await b.newContext({viewport:{width:+w,height:+h},deviceScaleFactor:+dsf});
  const p = await ctx.newPage();
  await p.addInitScript(()=>{ window.__vt=0; performance.now=()=>window.__vt; });
  await p.goto('http://localhost:8765/index.html');
  await p.waitForFunction(()=>document.getElementById('loader').classList.contains('done'),null,{timeout:90000});
  await p.waitForTimeout(800);
  const H = await p.evaluate(()=>document.getElementById('stage').offsetHeight - innerHeight);
  const FPS=30, N=Math.round(+secs*FPS), hold0=Math.round(1.2*FPS), hold1=Math.round(1.0*FPS);
  const ease = t => t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
  for (let i=0;i<N;i++){
    let u = (i-hold0)/(N-hold0-hold1); u=Math.max(0,Math.min(1,u));
    const y = ease(u)*H;
    await p.evaluate(([y,t])=>{ window.__vt=t; scrollTo(0,y); },[y,i/FPS*1000]);
    await p.evaluate(()=>new Promise(r=>{let n=0;const f=()=>++n>5?r():requestAnimationFrame(f);requestAnimationFrame(f);}));
    await p.screenshot({path:out+`f_${String(i).padStart(4,'0')}.jpg`,type:'jpeg',quality:92});
    if (i%30===0) console.log(name,i,'/',N);
  }
  await b.close(); console.log('DONE',name);
})();

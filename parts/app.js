(() => {
  const CFG = @@CFG@@;
  const TOTAL = CFG.frames;                           // frame_001〜NNN.webp
  const BASES = ['public/frames/', 'frames/', ''];   // アップロード場所が違っても見つける
  let base = null;
  const src = i => `${base}frame_${String(i).padStart(3,'0')}.webp`;

  const c2d = document.getElementById('c');
  const cgl = document.getElementById('gl');
  const ctx = c2d.getContext('2d');
  const stage = document.getElementById('stage');
  const layers = [...document.querySelectorAll('.layer')];
  const prog = document.getElementById('prog');
  const bar = document.getElementById('bar'), pct = document.getElementById('pct');
  const loader = document.getElementById('loader');
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const isMobile = matchMedia('(max-width:768px)').matches;

  const imgs = new Array(TOTAL);
  let loaded = 0, current = 0, lastDrawn = -1, mode = 'gl', ar = 16 / 9;

  const nearest = i => {
    for (let d = 0; d < TOTAL; d++) {
      for (const k of [i - d, i + d]) if (k >= 0 && k < TOTAL && imgs[k] && imgs[k].ok) return k;
    }
    return -1;
  };

  /* ---------- WebGL（光の筋・粒子・布と羽の揺れ） ---------- */
  let gl = null, prog1, prog2, slots, uni = {}, pbuf, pcount;
  const VS = `attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}`;
  const FS = `precision highp float;
uniform sampler2D A,B;uniform float mv,t,fx,ar;uniform vec2 res;varying vec2 v;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
void main(){
  float sa=res.x/res.y;vec2 uv=v;
  if(sa>ar){uv.y=(v.y-.5)*(ar/sa)+.5;}else{uv.x=(v.x-.5)*(sa/ar)+.5;}
  vec2 q=vec2(uv.x,1.-uv.y);                 // q.y: 上=0
  float side=abs(q.x-.5);
  // 羽：左右の外側ほど大きく波打つ
  float wing=${CFG.fx.wings?1:0}.*smoothstep(.10,.42,side)*(1.-smoothstep(.45,.78,q.y));
  float w1=sin(t*1.3+side*9.+q.y*5.)*.5+(n(vec2(side*4.+t*.35,q.y*4.))-.5);
  vec2 d=vec2((n(vec2(q.y*5.,t*.4))-.5)*sign(q.x-.5)*.006,w1*.010)*wing*fx;
  // 布：下ほど大きく横に揺れる
  float robe=${CFG.fx.robe?1:0}.*(1.-smoothstep(.08,.22,side))*smoothstep(.45,.85,q.y);
  d.x+=(sin(t*1.1+q.y*10.)*(q.y-.4)*.010+(n(vec2(q.y*6.,t*.5))-.5)*.007)*robe*fx;
  vec2 su=clamp(uv+vec2(d.x,-d.y),0.,1.);
  vec3 col=mix(texture2D(A,su).rgb,texture2D(B,su).rgb,mv);
  // 差し込む光：上中央から放射する筋がゆっくり揺れる
  vec2 r=q-vec2(.5,-.15);float ang=atan(r.x,r.y),dist=length(r);
  float st=n(vec2(ang*14.+t*.25,t*.1))*.65+n(vec2(ang*33.-t*.18,1.7))*.35;
  st=smoothstep(.35,.95,st);
  float fall=exp(-dist*1.9);
  float pulse=.75+.25*sin(t*.7)+.1*sin(t*1.9);
  col+=vec3(${CFG.fx.rayColor})*st*fall*.38*pulse*fx*${CFG.fx.rays?1:0}.;
  col+=vec3(.5,.65,.9)*${CFG.fx.rays?1:0}.*exp(-length((q-vec2(.5,.02))*vec2(1.6,2.5)))*.12*pulse*fx;
  gl_FragColor=vec4(col,1.);
}`;
  const PVS = `attribute vec4 s;uniform float t,dpr,hh;varying float a;
void main(){
  float y=fract(s.y-t*(.02+s.z*.045));
  float x=(s.x-.5)*1.7+sin(t*(.4+s.w*.6)+s.w*20.)*.05;
  gl_Position=vec4(x,y*2.-1.,0.,1.);
  gl_PointSize=(1.5+s.z*s.z*7.)*dpr*(hh/800.);
  a=(.35+.65*sin(t*(1.+s.w*2.)+s.w*40.)*.5+.325)*smoothstep(0.,.08,y)*smoothstep(1.,.9,y);
}`;
  const PFS = `precision mediump float;varying float a;
void main(){float d=length(gl_PointCoord-.5);float k=smoothstep(.5,0.,d);
 gl_FragColor=vec4(vec3(${CFG.fx.particleColor})*k*k*1.4,k*k*a);}`;

  function sh(type, code){
    const s = gl.createShader(type); gl.shaderSource(s, code); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function mk(vs, fs){
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  function initGL(){
    try {
      gl = cgl.getContext('webgl', {alpha:false, antialias:false});
      if (!gl) return false;
      prog1 = mk(VS, FS); prog2 = mk(PVS, PFS);
      const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
      pcount = CFG.fx.particles ? (isMobile ? CFG.fx.particles/2 : CFG.fx.particles) : 0;
      const pd = new Float32Array(pcount * 4);
      for (let i = 0; i < pd.length; i++) pd[i] = Math.random();
      pbuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pbuf);
      gl.bufferData(gl.ARRAY_BUFFER, pd, gl.STATIC_DRAW);
      slots = [0, 1].map(u => {
        const tex = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, tex);
        for (const [k, val] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR],[gl.TEXTURE_MAG_FILTER, gl.LINEAR],
          [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, val);
        return {tex, idx: -1, unit: u};
      });
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.useProgram(prog1);
      for (const k of ['A','B','mv','t','fx','ar','res']) uni[k] = gl.getUniformLocation(prog1, k);
      gl.uniform1i(uni.A, 0); gl.uniform1i(uni.B, 1);
      for (const k of ['t','dpr','hh']) uni['p' + k] = gl.getUniformLocation(prog2, k);
      uni.quadP = gl.getAttribLocation(prog1, 'p'); uni.partS = gl.getAttribLocation(prog2, 's');
      uni.quad = quad;
      return true;
    } catch (e) { console.warn('WebGL off:', e); return false; }
  }
  function upload(slot, idx){
    if (slot.idx === idx) return;
    gl.activeTexture(gl.TEXTURE0 + slot.unit); gl.bindTexture(gl.TEXTURE_2D, slot.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, imgs[idx]);
    slot.idx = idx;
  }
  function fallback2d(){
    mode = '2d'; cgl.style.display = 'none'; c2d.style.display = 'block'; c2d.style.opacity = 1; lastDrawn = -1;
  }
  function renderGL(pos, time){
    const i0 = nearest(Math.floor(pos)), i1 = nearest(Math.min(Math.floor(pos) + 1, TOTAL - 1));
    if (i0 < 0) return;
    try { upload(slots[0], i0); upload(slots[1], i1 < 0 ? i0 : i1); }
    catch (e) { console.warn('texture error → 2D fallback', e); fallback2d(); return; }
    const fx = reduce ? 0 : 1;
    gl.viewport(0, 0, cgl.width, cgl.height);
    gl.disable(gl.BLEND);
    gl.useProgram(prog1);
    gl.bindBuffer(gl.ARRAY_BUFFER, uni.quad);
    gl.enableVertexAttribArray(uni.quadP); gl.vertexAttribPointer(uni.quadP, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(uni.mv, pos - Math.floor(pos)); gl.uniform1f(uni.t, time);
    gl.uniform1f(uni.fx, fx); gl.uniform1f(uni.ar, ar); gl.uniform2f(uni.res, cgl.width, cgl.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(uni.quadP);
    if (!reduce) {
      gl.useProgram(prog2); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.bindBuffer(gl.ARRAY_BUFFER, pbuf);
      gl.enableVertexAttribArray(uni.partS); gl.vertexAttribPointer(uni.partS, 4, gl.FLOAT, false, 0, 0);
      gl.uniform1f(uni.pt, time); gl.uniform1f(uni.pdpr, cgl.width / innerWidth); gl.uniform1f(uni.phh, cgl.height);
      gl.drawArrays(gl.POINTS, 0, pcount);
      gl.disableVertexAttribArray(uni.partS);
    }
    cgl.style.opacity = 1;
  }

  /* ---------- 2D（WebGLが使えない時の予備） ---------- */
  function put(img, alpha){
    const cw = c2d.width, ch = c2d.height;
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.globalAlpha = alpha; ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h); ctx.globalAlpha = 1;
  }
  function draw2d(pos){
    const i = nearest(Math.floor(pos)); if (i < 0) return;
    const j = nearest(Math.min(Math.floor(pos) + 1, TOTAL - 1));
    put(imgs[i], 1); if (j >= 0 && j !== i) put(imgs[j], pos - Math.floor(pos));
    lastDrawn = pos;
  }

  function resize(){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c2d.width = innerWidth * dpr; c2d.height = innerHeight * dpr;
    const g = Math.min(dpr, 1.5);
    cgl.width = Math.round(innerWidth * g); cgl.height = Math.round(innerHeight * g);
    lastDrawn = -1;
  }
  addEventListener('resize', resize); resize();
  if (!initGL()) fallback2d();

  /* ---------- 読み込み ---------- */
  const probe = b => new Promise(r => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = b + 'frame_001.webp'; });
  function load(i){
    return new Promise(res => {
      const im = new Image(); im.decoding = 'async'; im.ok = false;
      im.onload = () => { im.ok = true; done(); }; im.onerror = done;
      function done(){
        loaded++; const p = Math.round(loaded / TOTAL * 100);
        bar.style.width = p + '%'; pct.textContent = p + '%'; res();
      }
      im.src = src(i + 1); imgs[i] = im;
    });
  }
  (async () => {
    const hide = () => loader.classList.add('done');
    setTimeout(hide, 8000);                        // 何があっても8秒で表示
    for (const b of BASES) { const im = await probe(b); if (im) { base = b; ar = im.naturalWidth / im.naturalHeight; break; } }
    if (base === null) { console.warn('frames not found: poster only'); hide(); return; }
    await load(0);
    let next = 1;
    const worker = async () => { while (next < TOTAL) await load(next++); };
    await Promise.all(Array.from({length: 8}, worker));
    hide();
  })();

  /* ---------- スクロール連動 ---------- */
  const clamp = (v,a,b) => Math.min(b, Math.max(a, v));
  const progress = () => { const r = stage.getBoundingClientRect(); return clamp(-r.top / (stage.offsetHeight - innerHeight), 0, 1); };
  const t0 = performance.now();

  function tick(){
    const p = progress();
    const target = p * (TOTAL - 1);
    current += (target - current) * 0.12;
    if (Math.abs(target - current) < 0.01) current = target;
    if (base !== null && !document.hidden) {
      if (mode === 'gl') renderGL(current, (performance.now() - t0) / 1000);
      else if (Math.abs(current - lastDrawn) > 0.005) draw2d(current);
    }
    const z = `scale(${1 + p * CFG.zoom})`; c2d.style.transform = z; cgl.style.transform = z;
    prog.style.height = (p * 100) + '%';
    for (const el of layers){
      const a = +el.dataset.in, b = +el.dataset.out, f = 0.04;
      let o = 0;
      if (p >= a - f && p <= b + f) o = Math.min(clamp((p - (a - f)) / f, 0, 1), clamp(((b + f) - p) / f, 0, 1));
      if (a === 0 && p < b) o = clamp((b - p) / f, 0, 1);
      el.style.opacity = o; el.style.transform = `translateY(${(1 - o) * 30}px)`;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

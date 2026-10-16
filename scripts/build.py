#!/usr/bin/env python3
"""lp.config.json + public/frames/ → index.html / og.jpg / robots.txt / sitemap.xml / llms.txt / 404.html
使い方: python3 scripts/build.py"""
import json, base64, io, os, html, sys
from PIL import Image
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(R)
C = json.load(open('lp.config.json', encoding='utf-8'))
S, col = C['site'], C['colors']
esc = lambda s: html.escape(s, quote=True)
frames = sorted(f for f in os.listdir('public/frames') if f.startswith('frame_') and f.endswith('.webp'))
if not frames: sys.exit('public/frames/ が空です。先に scripts/make_frames.sh を実行してください')
C['frames'] = len(frames)                      # 実際の枚数に合わせる
pf = min(C['posterFrame'], len(frames))
im = Image.open(f'public/frames/frame_{pf:03d}.webp').convert('RGB')
# 背景ポスター（読み込み前・失敗時の保険）
p = im.copy(); p.thumbnail((960, 960)); b = io.BytesIO(); p.save(b, 'WEBP', quality=40)
poster = 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
# OGP画像 1200x630
o = im.copy(); w, h = o.size; nh = int(w * 630 / 1200)
o = o.crop((0, max(0, (h - nh) // 2), w, max(0, (h - nh) // 2) + nh)).resize((1200, 630)); o.save('public/og.jpg', quality=82)

css = open('parts/style.css', encoding='utf-8').read().replace('@@POSTER@@', poster)
import re
for k in ('bg','fg','muted','accent'):
    css = re.sub(rf'--{k}:#[0-9a-fA-F]+', f'--{k}:{col[k]}', css)
cfg = {k: C[k] for k in ('frames', 'zoom', 'fx')}
js = open('parts/app.js', encoding='utf-8').read().replace('@@CFG@@', json.dumps(cfg))

u, au, pid = S['url'], S['authorUrl'], S['authorUrl'] + '#person'
ld = {"@context": "https://schema.org", "@graph": [
 {"@type": "WebSite", "@id": u + '#website', "url": u, "name": S['brand'], "inLanguage": S['lang'], "publisher": {"@id": pid}},
 {"@type": "WebPage", "@id": u + '#webpage', "url": u, "name": S['title'], "description": S['description'], "inLanguage": S['lang'],
  "isPartOf": {"@id": u + '#website'}, "author": {"@id": pid}, "dateModified": S['date'], "datePublished": S['date'],
  "primaryImageOfPage": {"@type": "ImageObject", "url": u + 'public/og.jpg'}},
 {"@type": "CreativeWork", "name": S['brand'], "creator": {"@id": pid}, "url": u, "copyrightHolder": {"@id": pid}},
 {"@type": "Person", "@id": pid, "name": S['author'], "alternateName": S['authorAlt'], "jobTitle": S['authorJob'], "url": au, "sameAs": [au]},
 {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": f['q'], "acceptedAnswer": {"@type": "Answer", "text": f['a']}} for f in C['faq']]}]}

layers = ''
H = C['hero']
layers += f'''    <div class="layer hero" data-in="0" data-out="0.14">
      <div class="eyebrow">{H['eyebrow']}</div>
      <h1>{H['title']}</h1>
      <p class="lead">{H['lead']}</p>
      <div class="scroll-hint">SCROLL</div>
    </div>\n'''
for l in C['layers']:
    cls = {'left': '', 'right': ' right', 'center': ' center'}[l.get('pos', 'left')]
    layers += f'''    <div class="layer{cls}" data-in="{l['in']}" data-out="{l['out']}">
      <div class="eyebrow">{l.get('eyebrow','')}</div>
      <h2>{l['title']}</h2>
      {'<p class="lead">'+l['lead']+'</p>' if l.get('lead') else ''}
    </div>\n'''
F, A, CT = C['features'], C['about'], C['cta']
cards = ''.join(f'    <div class="card"><b>{i+1:02d}</b><h3>{x["title"]}</h3><p>{x["text"]}</p></div>\n' for i, x in enumerate(F['items']))
faq = ''.join(f'      <details><summary>{f["q"]}</summary><p>{f["a"]}</p></details>\n' for f in C['faq'])
eb = 'style="font-family:var(--font-en);letter-spacing:.4em;font-size:12px;color:var(--accent)"'
doc = f'''<!doctype html>
<html lang="{S['lang']}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(S['title'])}</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%23{col['bg'][1:]}'/%3E%3Cpath d='M16 5l9 21H7z' fill='none' stroke='%23{col['accent'][1:]}' stroke-width='2'/%3E%3C/svg%3E">
<meta name="theme-color" content="{col['bg']}">
<meta name="description" content="{esc(S['description'])}">
<meta name="author" content="{esc(S['author'])}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<link rel="canonical" href="{u}">
<meta property="og:type" content="website"><meta property="og:url" content="{u}">
<meta property="og:title" content="{esc(S['title'])}"><meta property="og:description" content="{esc(S['description'])}">
<meta property="og:image" content="{u}public/og.jpg"><meta property="og:site_name" content="{esc(S['brand'])}">
<meta name="twitter:card" content="summary_large_image">
<style>
{css}</style>
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False, indent=1)}</script>
</head>
<body id="top">

<div id="loader"><div class="box">LOADING<div class="bar"><i id="bar"></i></div><div id="pct" style="margin-top:12px">0%</div></div></div>

<header><a href="#top">{S['brand']}</a><a href="{S['contactUrl']}" target="_blank" rel="noopener">{S['contactLabel']}</a></header>

<div id="stage">
  <div id="sticky">
    <canvas id="c" style="display:none"></canvas>
    <canvas id="gl" style="opacity:0"></canvas>
    <div class="vignette"></div>

{layers}
    <div class="progress"><i id="prog"></i></div>
  </div>
</div>

<section class="after" id="features">
  <div class="eyebrow" {eb}>FEATURES</div>
  <h2>{F['heading']}</h2>
  <div class="grid">
{cards}  </div>
</section>

<section class="after" id="about">
  <div class="eyebrow" {eb}>ABOUT</div>
  <div class="about">
    <h2>{A['heading']}</h2>
    {''.join('<p>'+x+'</p>' for x in A['paragraphs'])}
  </div>
  <div class="faq">
    <h2 style="font-size:clamp(22px,3vw,34px)">よくある質問</h2>
    <div style="margin-top:28px">
{faq}    </div>
  </div>
</section>

<section class="cta" id="contact">
  <h2>{CT['heading']}</h2>
  <p class="lead" style="margin:22px auto 0">{CT['text']}</p>
  <a class="btn" href="{S['contactUrl']}" target="_blank" rel="noopener">{S['contactLabel']}</a>
</section>

<footer>{S['footer']}</footer>

<script>
(() => {{
{js}}})();
</script>
</body>
</html>
'''
open('index.html', 'w', encoding='utf-8').write(doc)
open('robots.txt', 'w').write(f'User-agent: *\nAllow: /\nSitemap: {u}sitemap.xml\n')
open('sitemap.xml', 'w').write(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>{u}</loc><lastmod>{S["date"]}</lastmod></url></urlset>\n')
open('llms.txt', 'w', encoding='utf-8').write(f'# {S["brand"]}\n\n> {S["description"]}\n\n- 制作者: {S["author"]} ({au})\n- URL: {u}\n- 技術: スクロール連動の画像連番＋WebGL（外部ライブラリなし）\n')
open('404.html', 'w', encoding='utf-8').write(f'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404</title><body style="background:{col["bg"]};color:{col["fg"]};font-family:sans-serif;text-align:center;padding:20vh 20px"><h1>404</h1><p><a style="color:{col["accent"]}" href="{u}">トップへ戻る</a></p>')
print(f'OK: index.html を生成 ({len(frames)}枚)')

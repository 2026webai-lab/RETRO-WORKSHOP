# スクロール3D LP テンプレート（動画1本＋設定1ファイルで作る）

## 3ステップ
```
① 動画を置く      source/my-video.mp4
② 連番に変換      bash scripts/make_frames.sh source/my-video.mp4 96 [開始秒] [終了秒]
③ 文章を書く→生成  lp.config.json を編集 → python3 scripts/build.py
```
→ `index.html` が出来ます。`python3 -m http.server 8765` で確認。

## 公開（GitHub Pages・ブラウザでアップロード）
アップロードするもの: `index.html` `404.html` `robots.txt` `sitemap.xml` `llms.txt` `public/`（frames と og.jpg）
- 1回のアップロードは100ファイル未満。frames(96枚) は **frames だけ先に**、残りは次に。
- `.gitignore` `.nojekyll` はブラウザからは上げられない（無くても動く）。
- `source/` `scripts/` `parts/` `tools/` は公開不要。

## lp.config.json の主な項目
| 項目 | 意味 |
|---|---|
| frames / posterFrame | 枚数（自動で実数に合わせる）／背景に埋め込むコマ |
| colors | 背景・文字・補助・アクセントの色 |
| fx | wings(羽の揺れ) robe(布の揺れ) rays(光の筋) particles(粒子数、0で無し) と色 |
| site | タイトル・URL・制作者・問い合わせURL・フッター（GEO用の構造化データにも使われる） |
| hero / layers | 題字と、スクロール位置(0〜1)ごとの文字。in/outが表示区間 |
| features / about / faq / cta | 下のセクション |

## 画像の種類で効果を変える
- 人物・天使・布がある絵 → wings / robe を true
- 風景・商品・建物 → wings / robe を false、rays と particles だけ
- 軽くしたい → particles を 120 以下、zoom を 0.1

## 告知ショート動画
`python3 -m http.server 8765` を起動 → `bash tools/make_short.sh v 1080 1920 12`（縦）/ `h 1920 1080 12`（横）→ `out/` にmp4。

## 注意
- 動画・画像の権利（生成AIの利用規約、商用可否）は公開前に確認。
- 羽・布の揺れは「中央に人物、左右に羽、下に布」の構図向けに調整済み。別構図は fx で切る。

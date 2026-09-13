# わたしの収集手帳

好きな名前と表紙色の帳を作り、都道府県ごとに写真と言葉を残す端末内保存型のPWAです。初回は「ポケフタ旅帖」と「一宮巡礼帖」のテンプレートが用意されます。外部ライブラリやビルド作業は不要で、GitHub Pagesへそのまま公開できます。

帳・記録・文章はブラウザのIndexedDBへ保存され、サーバーには送信されません。対応するAndroidのChromium系ブラウザでは写真の元ファイルを参照し、参照機能が使えない環境だけ画像データをIndexedDBへ保存します。

## ページ構成

- `index.html` — 自分の収集手帳を作成・閲覧するPWA
- `archive.html` — 以前のポケフタ・一宮・都道府県の三冊を選ぶ目次
- `pokefuta.html` — ポケフタ帳の表紙
- `map.html` — 日本地図から地域を選ぶ入口
- `list.html` — 全国一覧
- `region.html?region=tohoku` — 地域詳細
- `prefecture.html?pref=miyagi` — 都道府県別一覧
- `spots/474.html` — 写真・場所・訪問印を表示する個別詳細
- `ichinomiya/index.html` — 一宮巡礼帖
- `todofuken/index.html` — 都道府県訪問帖

## 写真を入れる

新しい収集手帳では、記録の詳細頁にある「写真を選ぶ」から端末内の画像を選択します。画像はアップロードされません。元ファイル参照に対応する端末では、画像を複製せずファイルへの参照だけを保存します。元ファイルを移動・削除した場合や権限が失われた場合は、もう一度選択してください。

以前のポケフタ帳へソースで写真を追加する場合は、次の手順を使います。

1. 撮影した写真を `assets/photos` に置きます。
2. `assets/js/my-collection.js` を開き、該当する蓋の `photo` に写真パスを指定します。

```js
"474": {
  photo: "assets/photos/pokefuta-474.jpg",
  visited: true,
  photographed: "2026年9月5日"
}
```

写真がまだない項目には「写真はまだありません」と表示されます。アップロード機能はありません。

## 公式情報を更新する

`node tools/scrape-official.mjs` を実行すると、公式サイトから設置情報を再取得し、`assets/js/official-spots.js` と各詳細ページを更新します。自分の写真・訪問記録は `my-collection.js` に分離されているため上書きされません。

## GitHub Pagesで公開する

リポジトリの Settings → Pages を開き、公開元を `main` ブランチの `/ (root)` にします。数分後、発行されたURLから閲覧できます。

PWAはGitHub Pagesの公開URL（HTTPS）で動作します。ローカルファイルを直接開いた状態では、Service Workerは登録されません。

## 権利表記について

このサイトは個人の旅・撮影記録用の非公式テンプレートです。公開時は、写真や名称などの利用条件を確認し、必要に応じて権利表記を追記してください。

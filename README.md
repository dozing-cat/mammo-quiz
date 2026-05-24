# mammo-quiz

マンモグラフィ認定試験対策

## 概要

マンモグラフィ認定試験の学習を支援する Web アプリケーションです。  
10問単位でクイズを出題し、習熟度に基づいて問題を選定します。

## 機能

- **カテゴリ別出題**: 解剖と生理、病理、臨床の3分野から選択可能
- **習熟度管理**: 正答・誤答に応じて習熟度を自動更新
- **復習機能**: 間違えた問題だけを再出題
- **ブックマーク**: 重要な問題を保存
- **違和感あり**: 問題内容に疑問がある場合にフラグ付け
- **学習履歴の永続化**: LocalStorageで進捗を保存

## ファイル構成

```
.
├── index.html        # HTML骨格
├── styles.css        # スタイル定義
├── app.js            # アプリケーションロジック
├── questions.json    # 問題データ(40問)
└── README.md         # このファイル
```

## ローカル実行

ローカルサーバーが必要です(`file://`では `fetch` が動作しないため)。

```bash
# Python 3 の場合
python3 -m http.server 8000

# または Node.js の http-server
npx http-server
```

ブラウザで `http://localhost:8000` を開いてください。

## GitHub Pages での公開

このリポジトリは GitHub Pages で公開されています。

🔗 **https://dozing-cat.github.io/mammo-quiz/**

## 問題データの編集

`questions.json` を編集することで問題の追加・修正が可能です。

### 問題の構造

```json
{
  "id": "q001",
  "category": "解剖と生理",
  "question": "問題文",
  "choices": ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
  "answer_index": 0,
  "explanation": "解説文"
}
```

## 習熟度アルゴリズム

- 正解: `mastery +1`(最大3)
- 不正解: `mastery -2`(最小0)
- 習熟度が低い問題ほど出題されやすくなります

## 技術スタック

- Pure HTML/CSS/JavaScript(フレームワーク不使用)
- LocalStorage による状態管理
- JSON による問題データ管理

## 今後の改善予定

- [ ] 問題数の拡充
- [ ] エクスポート/インポート機能
- [ ] 学習統計グラフ表示

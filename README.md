# Photo to Stylish Video API

このAPIは、写真からカメラメタデータ（ISO、レンズ、カメラ名）入りの5秒間のオシャレなMP4動画を生成します。

## Prerequisites
- Docker installed

## Setup and Run (ローカルに保存する方法)

Dockerコンテナ内で生成された動画を自分のPC（ホスト）の好きなディレクトリに保存するには、`-v` オプション（ボリュームマウント）を使用します。

### 1. 動画を保存したいローカルディレクトリを決める
例: `/Users/yourname/my-videos`

### 2. イメージのビルド
```bash
docker build -t gen-video-api .
```

### 3. コンテナの起動（パスを自由に設定）
以下のコマンドの `/path/to/your/local/folder` を、動画を保存したい実在のディレクトリパスに置き換えてください。

```bash
docker run -p 3000:3000 \
  -v "/path/to/your/local/folder:/app/outputs" \
  gen-video-api
```
これだけで、API経由で生成された動画が即座にローカルの指定したフォルダに出現します。

## Usage

### Create Video (カスタムファイル名指定)
- **Endpoint**: `POST /api/v1/create-video`
- **Body**: `multipart/form-data`
  - `photo`: 画像ファイル (必須)
  - `fileName`: 保存したいファイル名 (任意、拡張子不要。例: `my_cool_photo`)

**Example with curl**:
```bash
curl -X POST \
  -F "photo=@/path/to/your/photo.jpg" \
  -F "fileName=landscape_2024" \
  http://localhost:3000/api/v1/create-video
```

### Response
```json
{
  "message": "Video created successfully",
  "fileName": "landscape_2024.mp4",
  "videoUrl": "/outputs/landscape_2024.mp4",
  "metadata": {
    "cameraName": "SONY ILCE-7RM4",
    "lensInfo": "FE 35mm F1.4 GM",
    "iso": "100",
    "aperture": "1.4",
    "shutterSpeed": "1/500"
  }
}
```

## Features
- **EXIF抽出**: 写真からメタデータを自動取得。
- **オシャレなオーバーレイ**: 画面左下にカメラ情報を配置し、ビネット効果を適用。
- **Ken Burns効果**: 緩やかなズームインアニメーション。
- **Docker Volume対応**: ホスト側の任意のディレクトリに直接保存可能。
- **カスタムファイル名**: APIから保存時の名前を自由に指定可能。

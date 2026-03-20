# Photo to Stylish Video API

This API generates a 5-second MP4 video from a photo with camera metadata (ISO, Lens, Camera Name) overlaid.

## Prerequisites
- Docker installed

## Setup and Run

1. Build the Docker image:
   ```bash
   docker build -t gen-video-api .
   ```

2. Run the container:
   ```bash
   docker run -p 3000:3000 gen-video-api
   ```

## Usage

### Create Video
- **Endpoint**: `POST /api/v1/create-video`
- **Body**: `multipart/form-data` with a field named `photo` containing the image file.

**Example with curl**:
```bash
curl -X POST -F "photo=@/path/to/your/photo.jpg" http://localhost:3000/api/v1/create-video
```

### Response
```json
{
  "message": "Video created successfully",
  "videoId": "uuid-string",
  "videoUrl": "/outputs/uuid-string.mp4",
  "metadata": {
    "cameraName": "SONY ILCE-7RM4",
    "lensInfo": "FE 35mm F1.4 GM",
    "iso": "100",
    "aperture": "1.4",
    "shutterSpeed": "1/500"
  }
}
```

### Download Video
Use the `videoUrl` from the response:
`http://localhost:3000/outputs/uuid-string.mp4`

## Features
- Automatic EXIF extraction.
- Stylish typography overlay.
- Subtle zoom-in animation (Ken Burns effect).
- Dockerized for easy deployment.

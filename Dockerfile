FROM node:20

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libexif-dev \
    libimage-exiftool-perl \
    libcairo2-dev \
    libjpeg-dev \
    libpango1.0-dev \
    libgif-dev \
    build-essential \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy application source
COPY . .

# Create necessary directories
RUN mkdir -p uploads outputs

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["npm", "start"]

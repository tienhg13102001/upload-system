# syntax=docker/dockerfile:1
FROM node:22-alpine

WORKDIR /app

# Cài dependencies trước để tận dụng layer cache
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy source
COPY src ./src

# Thư mục lưu file (sẽ được mount volume từ NAS vào đây)
ENV UPLOAD_DIR=/data/uploads
RUN mkdir -p /data/uploads

ENV PORT=3000
EXPOSE 3000

CMD ["node", "src/server.js"]

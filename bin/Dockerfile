FROM node:20-bookworm
COPY . /build
WORKDIR /build
RUN npm ci --omit=dev && npm run build

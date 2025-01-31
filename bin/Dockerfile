FROM node:18-bullseye
COPY . /build
WORKDIR /build
RUN npm ci --omit=dev && npm run build

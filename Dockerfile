FROM node:24
COPY . /build
WORKDIR /build
RUN npm ci

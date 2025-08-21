FROM node:22
COPY . /build
WORKDIR /build
RUN npm ci

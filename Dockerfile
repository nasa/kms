FROM node:24
COPY . /build
WORKDIR /build
RUN npm ci
RUN chown -R node:node /build
USER node

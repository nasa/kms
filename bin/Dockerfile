FROM node:24
COPY . /build
WORKDIR /build
RUN npm ci --omit=dev && npm run build
RUN chown -R node:node /build
USER node

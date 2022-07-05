FROM node:16-alpine
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN apk add \
    git \
    python3 \
    make \
    gcc \
    g++;
RUN yarn install --non-interactive --frozen-lockfile
COPY $PWD/docker/entrypoint.sh /usr/local/bin
COPY $PWD/docker/healthcheck.js /usr/local/bin
ENTRYPOINT ["/bin/sh", "/usr/local/bin/entrypoint.sh"]
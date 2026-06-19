FROM node:22-bookworm-slim AS build

WORKDIR /workspace/packages/docker-api

RUN rm -f /etc/apt/sources.list.d/* && \
	echo "deb http://mirrors.tuna.tsinghua.edu.cn/debian bookworm main contrib non-free non-free-firmware" > /etc/apt/sources.list.d/debian.sources.list && \
	echo "deb http://mirrors.tuna.tsinghua.edu.cn/debian bookworm-updates main contrib non-free non-free-firmware" >> /etc/apt/sources.list.d/debian.sources.list && \
	echo "deb http://mirrors.tuna.tsinghua.edu.cn/debian-security bookworm-security main contrib non-free non-free-firmware" >> /etc/apt/sources.list.d/debian.sources.list && \
	apt-get update
RUN apt install apt-transport-https ca-certificates -y --no-install-recommends
RUN sed -i 's/http:/https:/g' /etc/apt/sources.list.d/debian.sources.list
RUN apt-get update
RUN apt-get update && apt-get install -y --no-install-recommends \
	libx11-6 \
	libxext6 \
	libxcb1 \
	libxau6 \
	libxdmcp6 \
	&& rm -rf /var/lib/apt/lists/*

RUN npm config set registry https://registry.npmmirror.com/

COPY docker-api/workspace.json /workspace/package.json
COPY docker-api/package.json /workspace/packages/docker-api/
COPY package.json /workspace/packages/skinview3d-node/

RUN cd ../.. && npm install --ignore-scripts

COPY docker-api/ /workspace/packages/docker-api
COPY assets /workspace/packages/skinview3d-node/assets
COPY libs /workspace/packages/skinview3d-node/libs
RUN npm run build
RUN cd ../.. && npm ci --omit=dev --ignore-scripts
RUN cd ../.. && sed -i 's#const BINARY_HOST = `${REPO_URL}/releases/download`#const BINARY_HOST = process.env.SKIA_CANVAS_BINARY_HOST || `${REPO_URL}/releases/download`#' \
	node_modules/skia-canvas/lib/prebuild.mjs
RUN env npm_config_loglevel=info \
	npm_config_gl_binary_host=https://npmmirror.com/mirrors/gl \
	SKIA_CANVAS_BINARY_HOST=https://npmmirror.com/mirrors/skia-canvas \
	npm rebuild && rm -rf node_modules/.cache

FROM node:22-bookworm-slim

WORKDIR /workspace/packages/docker-api

RUN rm -f /etc/apt/sources.list.d/* && \
	echo "deb http://mirrors.tuna.tsinghua.edu.cn/debian bookworm main contrib non-free non-free-firmware" > /etc/apt/sources.list.d/debian.sources.list && \
	echo "deb http://mirrors.tuna.tsinghua.edu.cn/debian bookworm-updates main contrib non-free non-free-firmware" >> /etc/apt/sources.list.d/debian.sources.list && \
	echo "deb http://mirrors.tuna.tsinghua.edu.cn/debian-security bookworm-security main contrib non-free non-free-firmware" >> /etc/apt/sources.list.d/debian.sources.list && \
	apt-get update
RUN apt install apt-transport-https ca-certificates -y --no-install-recommends
RUN sed -i 's/http:/https:/g' /etc/apt/sources.list.d/debian.sources.list
RUN apt-get update
RUN apt-get install -y --no-install-recommends \
	libgl1 \
	libglx-mesa0 \
	libegl1 \
	xvfb \
	libx11-6 \
	libxext6 \
	libxcb1 \
	&& rm -rf /var/lib/apt/lists/*

# ffmpeg7.0.2（静态） from https://www.johnvansickle.com/ffmpeg/
COPY ffmpeg /usr/local/bin/ffmpeg
RUN chmod +x /usr/local/bin/ffmpeg

RUN npm config set registry https://registry.npmmirror.com/

COPY --from=build /workspace /workspace

# RUN export NODE_ENV=production && cd ../.. && npm install --omit=dev --ignore-scripts && npm cache clean --force
RUN chmod +x start.sh

EXPOSE 3000

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

CMD ["./start.sh"]

# image size ~700MB

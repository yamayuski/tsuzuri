# @link https://docs.deno.com/runtime/reference/docker/
# @link https://fresh.deno.dev/docs/deployment/docker

FROM mirror.gcr.io/denoland/deno:latest AS dev

WORKDIR /app

VOLUME [ "/app" ]

ENV DENO_ENV=development

CMD ["deno", "task", "dev"]



FROM mirror.gcr.io/denoland/deno:latest AS builder

ARG GIT_REVISION
ENV DENO_DEPLOYMENT_ID=${GIT_REVISION}

WORKDIR /app

COPY . .
RUN \
    deno install \
    && deno task build \
    && deno cache _fresh/server.js



FROM mirror.gcr.io/denoland/deno:distroless AS prod

ENV DENO_NO_UPDATE_CHECK=1 \
    DENO_NO_PROMPT=1 \
    DENO_ENV=production \
    PORT=8000 \
    HOSTNAME=localhost

WORKDIR /app

COPY --chown=nonroot:nonroot --from=builder /app/_fresh/ /app/_fresh/

USER nonroot
EXPOSE ${PORT}

CMD ["serve", "-A", "_fresh/server.js"]

# @link https://docs.deno.com/runtime/reference/docker/
# @link https://fresh.deno.dev/docs/deployment/docker

FROM mirror.gcr.io/denoland/deno:latest AS dev

WORKDIR /app

VOLUME [ "/app" ]

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

WORKDIR /app

COPY --chown=nonroot:nonroot --from=builder /app /app

USER nonroot
EXPOSE 8000

CMD ["serve", "-A", "_fresh/server.js"]

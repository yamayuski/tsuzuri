FROM mirror.gcr.io/node:24 AS dev

WORKDIR /app

VOLUME [ "/app" ]

ENV NODE_ENV=development

ARG USERNAME=node
ARG USER_UID=1000
ARG USER_GID=1000
ARG TZ=UTC
ARG LANGUAGE=en
ARG COUNTRY=US
ARG ENCODING=UTF-8
ARG LOCALE="en_US.UTF-8 UTF-8"

USER ${USERNAME}

SHELL [ "/bin/bash", "-c" ]

RUN wget -qO- https://get.pnpm.io/install.sh | ENV="$HOME/.bashrc" SHELL="$(which bash)" bash -

ENV PATH="/home/${USERNAME}/.local/share/pnpm:$PATH"

CMD ["pnpm", "dev"]

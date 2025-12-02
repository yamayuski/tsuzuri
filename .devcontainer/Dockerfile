# syntax=docker/dockerfile:1.6
# check=error=true

FROM --platform=${BUILDPLATFORM} mirror.gcr.io/node:24

ARG USERNAME=node
ARG USER_UID=1000
ARG USER_GID=1000
ARG TZ=UTC
ARG LANGUAGE=en
ARG COUNTRY=US
ARG ENCODING=UTF-8
ARG LOCALE="en_US.UTF-8 UTF-8"
ARG GIT_DELTA_VERSION=0.18.2

ENV DEBIAN_FRONTEND=noninteractive \
  TZ="$TZ" \
  LANG="${LANGUAGE}-${COUNTRY}.${ENCODING}" \
  LANGUAGE="${LANGUAGE}" \
  DEVCONTAINER=true \
  EDITOR=vim \
  VISUAL=vim

RUN \
  --mount=type=cache,sharing=locked,target=/var/lib/apt \
  --mount=type=cache,target=/var/cache/apt \
  <<EOL
rm -f /etc/apt/apt.conf.d/docker-clean
echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache
apt-get update
apt-get install -y --no-install-recommends \
    aggregate \
    ca-certificates \
    curl \
    dnsutils \
    fonts-font-awesome \
    fonts-noto-cjk \
    fonts-powerline \
    fzf \
    gnupg \
    htop \
    iproute2 \
    ipset \
    iptables \
    jq \
    less \
    locales \
    lsb-release \
    lsof \
    make \
    man-db \
    net-tools \
    procps \
    python3 \
    python3-pip \
    ripgrep \
    rsync \
    socat \
    sudo \
    tmux \
    unzip \
    vim \
    wget \
    zsh

# Install git-delta
ARCH=$(dpkg --print-architecture)
wget "https://github.com/dandavison/delta/releases/download/${GIT_DELTA_VERSION}/git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb"
dpkg -i "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb"
rm "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb"
unset ARCH

# Generate locale
echo "en_US.UTF-8 UTF-8" >> /etc/locale.gen
echo "${LOCALE}" >> /etc/locale.gen
cat /etc/locale.gen | uniq > /etc/locale.gen
locale-gen
locale -a
EOL

RUN <<EOL
# Update runtime user and group
echo "${USERNAME} ALL=(root) NOPASSWD:ALL" > "/etc/sudoers.d/${USERNAME}"
chmod 0440 "/etc/sudoers.d/${USERNAME}"

# Create workspace directory
mkdir -p /workspace
mkdir -p /commandhistory
touch /commandhistory/.bash_history

# https://code.visualstudio.com/remote/advancedcontainers/persist-bash-history
SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history"
echo "${SNIPPET}" >> "/home/${USERNAME}/.bashrc"
echo "${SNIPPET}" >> "/home/${USERNAME}/.zshrc"
unset SNIPPET

chown -R ${USER_UID}:${USER_GID} /home/${USERNAME}
chown -R ${USER_UID}:${USER_GID} /workspace
chown -R ${USER_UID}:${USER_GID} /commandhistory
EOL

USER ${USERNAME}

RUN wget -qO- https://get.pnpm.io/install.sh | ENV="$HOME/.bashrc" SHELL="$(which bash)" bash -

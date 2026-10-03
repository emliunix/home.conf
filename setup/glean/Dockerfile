# Glean build/run container — tasks #103 / #108.
#
# WHY A CONTAINER. glean's executable has an UNCONDITIONAL `hinotify` dependency,
# which wraps the Linux kernel's inotify feature and needs `sys/inotify.h`.
# macOS has no equivalent header, so this build cannot complete on the host. A
# Linux container is the smallest runtime that supplies that API — the reason is
# one platform API, not a deployment preference.
#
# COMPILER. glean requires `base >=4.11.1 && <4.19`, i.e. GHC <= 9.6.x. The
# container pins 9.6.6 through ghcup so the build does not depend on the distro's
# GHC version.
#
# FOLLY, resolved from glean's own cabal metadata rather than by analogy with the
# macOS chain. glean.cabal declares:
#
#     common folly
#         if flag(use-folly-clib)
#             build-depends: fb-util >= 0.2, folly-clib > 0
#         else
#             build-depends: fb-util < 0.2
#             pkgconfig-depends: libfolly      <-- the hard C++ dependency
#
# libfolly is a large C++ library with no Debian bookworm package, and building
# it here would dominate the image. `-fuse-folly-clib` selects the pure-Haskell
# `folly-clib` instead and DROPS the `libfolly` pkg-config requirement entirely.
# That flag is why this image is buildable at all.
#
# FAIL LOUDLY. An earlier revision ended its apt line with `|| true`, which
# swallowed a missing package and left the image without `curl`, so the ghcup
# bootstrap failed silently and the build only surfaced the problem at `cabal:
# not found`. `set -eux` plus no error-swallowing is deliberate: a provisioning
# layer that cannot fail is a layer that cannot be trusted.

# BASE IMAGE CHOICE, measured rather than assumed. glean's own `lib:rocksdb` needs
# `rocksdb/advanced_cache.h`, which bookworm's librocksdb-dev 7.8.3 does not ship.
# Debian TRIXIE's package does. Verified by presence of the header in each:
#   bookworm 7.8.3   -> advanced_cache.h ABSENT
#   trixie           -> advanced_cache.h PRESENT
# So the base is trixie, not bookworm. This single line is the difference between
# a build that reaches glean and one that fails at its rocksdb binding.
FROM docker.m.daocloud.io/library/debian:trixie-slim

SHELL ["/bin/bash", "-euxo", "pipefail", "-c"]
ENV DEBIAN_FRONTEND=noninteractive

# The proxy is needed for the build network path in this environment, and the
# ADDRESS MATTERS: the container runs inside the podman VM, so `127.0.0.1` is the
# VM, not the host where the proxy listens. Measured from inside a container:
#   http://127.0.0.1:7897               -> unreachable (that is the VM)
#   http://host.containers.internal:7897 -> 200   <- the working address
#   http://192.168.127.254:7897          -> 200   (the VM host side)
# Default to the named host alias; override the build args for a direct network.
ARG HTTPS_PROXY="http://host.containers.internal:7897"
ARG HTTP_PROXY="http://host.containers.internal:7897"
ENV HTTPS_PROXY=${HTTPS_PROXY} HTTP_PROXY=${HTTP_PROXY}

# Every package here is verified present in bookworm. No `|| true`, no `2>/dev/null
# || true`: a missing name must stop the build, not silently shrink the image.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential ca-certificates curl pkg-config git \
      libgmp-dev libffi-dev libncurses-dev zlib1g-dev \
      libssl-dev libsqlite3-dev libtinfo-dev \
      libnuma-dev libunwind-dev libdouble-conversion-dev \
      libgoogle-glog-dev libgflags-dev libxxhash-dev \
      libicu-dev librocksdb-dev libfmt-dev \
      libevent-dev libdouble-conversion-dev libboost-context-dev \
      libboost-filesystem-dev libboost-program-options-dev \
      libboost-regex-dev libboost-system-dev libboost-thread-dev \
      libsnappy-dev liblz4-dev libzstd-dev libbz2-dev liblzma-dev \
      libsodium-dev libgoogle-glog-dev libgmock-dev libsasl2-dev \
      libkrb5-dev libssl-dev libcurl4-openssl-dev \
      libjemalloc-dev libaio-dev \
 && rm -rf /var/lib/apt/lists/*

# PCRE1 FROM SOURCE — the one place the two Debian releases conflict, and the
# reason this image is trixie rather than bookworm.
#
#   glean's rocksdb binding needs `rocksdb/advanced_cache.h`
#     bookworm's librocksdb-dev 7.8.3 -> ABSENT      trixie's -> PRESENT
#   glean's regex-pcre (PCRE1) needs `pcre.h`
#     bookworm has libpcre3-dev         trixie DROPPED it (pcre2 only)
#
# So each release supplies exactly one of the two. trixie is the base because the
# rocksdb header is a hard C++ dependency inside glean, while PCRE1 is a small
# standalone library that builds in under a minute. Measured: this builds and
# installs /usr/include/pcre.h in trixie.
RUN cd /tmp \
 && curl -sL -o pcre.tar.gz https://sourceforge.net/projects/pcre/files/pcre/8.45/pcre-8.45.tar.gz \
 && tar xzf pcre.tar.gz \
 && cd pcre-8.45 \
 && ./configure --prefix=/usr --enable-utf --enable-unicode-properties \
 && make -j2 \
 && make install \
 && /sbin/ldconfig \
 && test -f /usr/include/pcre.h \
 && test -f /usr/lib/libpcre.so \
 && cd /tmp && rm -rf pcre-8.45 pcre.tar.gz

# ghcup -> GHC 9.6.6 + cabal. The bootstrap is piped, so a curl failure would be
# masked by the pipe; check the toolchain exists afterwards instead of trusting it.
RUN curl --proto '=https' --tlsv1.2 -sSf https://get-ghcup.haskell.org -o /tmp/ghcup.sh \
 && BOOTSTRAP_HASKELL_NONINTERACTIVE=1 \
    BOOTSTRAP_HASKELL_GHC_VERSION=9.6.6 \
    BOOTSTRAP_HASKELL_INSTALL_NO_STACK=1 \
    BOOTSTRAP_HASKELL_INSTALL_NO_CABAL=0 \
    BOOTSTRAP_HASKELL_ADJUST_BASHRC=0 \
    bash /tmp/ghcup.sh \
 && rm -f /tmp/ghcup.sh \
 && /root/.ghcup/bin/ghc --version \
 && /root/.ghcup/bin/cabal --version
ENV PATH=/root/.ghcup/bin:$PATH

WORKDIR /work
# `-fuse-folly-clib` is the dependency decision; `--jobs=2` is capped because the
# podman VM has 4 CPUs and 2 GiB.
RUN cabal update \
 && cabal install \
      --with-compiler=/root/.ghcup/ghc/9.6.6/bin/ghc \
      --jobs=2 \
      -fuse-folly-clib \
      glean \
 && /root/.cabal/bin/glean --help >/dev/null \
 && test -x /root/.cabal/bin/glean

CMD ["/bin/bash", "-lc", "glean --version || glean --help | head -20"]

# Render build. Build context is ./deploy (see render.yaml).
# Only "latest" is published on Docker Hub; pin a digest here once you have
# a version you trust:  kiwitcms/kiwi@sha256:...
ARG KIWI_IMAGE=docker.io/kiwitcms/kiwi:latest
FROM ${KIWI_IMAGE}

# COPY ignores USER, so set ownership explicitly (upstream runs as uid 1001)
COPY --chown=1001:0 nginx.conf uwsgi.override /Kiwi/etc/
COPY --chown=1001:0 tcms_settings_dir/ /Kiwi/tcms_settings_dir/
COPY --chown=1001:0 --chmod=755 start.sh /start.sh

# must match listen port in nginx.conf; also set as PORT in render.yaml
EXPOSE 8080

# upstream HEALTHCHECK curls the removed 8443 listener; Render uses healthCheckPath
HEALTHCHECK NONE

CMD ["/start.sh"]

# Local test fixture only. Supply both reviewed docker-image named build contexts.
FROM docker_cli_source AS docker_cli
FROM media_source
COPY --from=docker_cli /usr/local/bin/docker /usr/local/bin/docker

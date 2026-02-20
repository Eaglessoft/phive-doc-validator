FROM mcr.microsoft.com/devcontainers/java:dev-25-jdk-bookworm AS build

WORKDIR /src

RUN apt-get update \
    && apt-get install -y --no-install-recommends maven ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY . .

RUN mvn -q package


FROM tomcat:jre25-temurin

ENV CONTEXT_PATH=/ \
    LOG_FORMAT=json \
    LOG_LEVEL=WARN

RUN rm -rf /usr/local/tomcat/webapps/*

COPY --from=build /src/target/ROOT /opt/app
COPY scripts/runtime-entrypoint.sh /usr/local/bin/runtime-entrypoint.sh

RUN chmod +x /usr/local/bin/runtime-entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/runtime-entrypoint.sh"]
CMD ["catalina.sh", "run"]

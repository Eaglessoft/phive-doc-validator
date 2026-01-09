# Multi-stage build for PHIVE Validation API
FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /app

# Copy local project files (build context)
COPY pom.xml .
COPY src ./src

# Build the application
RUN mvn clean package -DskipTests

# Runtime stage
FROM eclipse-temurin:17-jre-alpine

# Install necessary tools
RUN apk add --no-cache curl

WORKDIR /app

# Copy the WAR file from build stage
COPY --from=build /app/target/phive-validation-api.war ./phive-validation-api.war

# Create directories for uploaded files and output
RUN mkdir -p /app/uploads && chmod 777 /app/uploads && \
    mkdir -p /app/output && chmod 777 /app/output

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8080/ || exit 1

# Download Tomcat for WAR deployment
RUN apk add --no-cache wget unzip && \
    wget -O /tmp/tomcat.tar.gz https://archive.apache.org/dist/tomcat/tomcat-9/v9.0.85/bin/apache-tomcat-9.0.85.tar.gz && \
    tar -xzf /tmp/tomcat.tar.gz -C /app && \
    mv /app/apache-tomcat-9.0.85 /app/tomcat && \
    rm -rf /app/tomcat/webapps/* && \
    cp /app/phive-validation-api.war /app/tomcat/webapps/ROOT.war && \
    # Verify WAR contents (optional - for debugging)
    unzip -l /app/tomcat/webapps/ROOT.war | grep -E "(index.html|styles.css|app.js|FAVICON)" || true && \
    rm /tmp/tomcat.tar.gz && \
    apk del wget unzip

# Set JVM options for PHIVE (stack size requirement)
ENV JAVA_OPTS="-Xss1m -Xmx512m -XX:+UseG1GC"
ENV CATALINA_OPTS="$JAVA_OPTS"

# Expose Tomcat port
EXPOSE 8080

# Run Tomcat
CMD ["/app/tomcat/bin/catalina.sh", "run"]


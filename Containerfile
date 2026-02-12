# Multi-stage build for PHIVE Validation API
# Strategy: Clone phive-rules repository and build locally to get ALL rulesets

FROM maven:3.9.9-eclipse-temurin-21 AS build

WORKDIR /app

# Install git for cloning repositories
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Copy local project files
COPY pom.xml .
COPY src ./src

# Clone phive-rules repository to get ALL validation rules
RUN echo "========================================" && \
    echo "Cloning phive-rules repository..." && \
    echo "========================================" && \
    git clone https://github.com/phax/phive-rules.git /phive-rules && \
    cd /phive-rules && \
    echo "Repository cloned successfully!"

# Build ALL phive-rules modules locally (skip failures, continue with successful ones)
# This installs all successfully built rules to local Maven repository
RUN echo "========================================" && \
    echo "Building phive-rules modules..." && \
    echo "Note: Some modules may fail due to missing optional dependencies." && \
    echo "Successful modules will be installed to local Maven repo." && \
    echo "This will take 15-20 minutes..." && \
    echo "========================================" && \
    cd /phive-rules && \
    mvn clean install -DskipTests -Dmaven.javadoc.skip=true --fail-at-end -Dmaven.test.skip=true 2>&1 | tee /tmp/phive-rules-build.log || true && \
    echo "========================================" && \
    echo "phive-rules build completed!" && \
    echo "" && \
    echo "📊 BUILD SUMMARY:" && \
    echo "----------------" && \
    grep -i "SUCCESS" /tmp/phive-rules-build.log | grep -E "phive-rules-[a-z]+" | wc -l | xargs -I {} echo "✅ Successful modules: {}" && \
    grep -i "FAILURE" /tmp/phive-rules-build.log | grep -E "phive-rules-[a-z]+" | wc -l | xargs -I {} echo "❌ Failed modules: {}" && \
    echo "" && \
    echo "✅ SUCCESSFUL MODULES:" && \
    grep "SUCCESS" /tmp/phive-rules-build.log | grep -E "phive-rules-[a-z]+" | sed 's/.*\(phive-rules-[^ ]*\).*/\1/' | sort -u && \
    echo "" && \
    echo "❌ FAILED MODULES:" && \
    grep "FAILURE" /tmp/phive-rules-build.log | grep -E "phive-rules-[a-z]+" | sed 's/.*\(phive-rules-[^ ]*\).*/\1/' | sort -u && \
    echo "========================================" && \
    echo "Successful modules are now available in local Maven repository." && \
    echo "========================================"

# Now build our application
# It will use the locally installed phive-rules from above
RUN echo "========================================" && \
    echo "Building PHIVE Validation API..." && \
    echo "========================================" && \
    cd /app && \
    mvn clean package -DskipTests && \
    echo "========================================" && \
    echo "Application built successfully!" && \
    echo "========================================"

# Auto-discover all phive-rules modules from local Maven repository
RUN echo "========================================" && \
    echo "🔍 Auto-discovering PHIVE modules..." && \
    echo "========================================" && \
    mkdir -p /tmp/phive-discovery && \
    find /root/.m2/repository/com/helger/phive/rules -name 'phive-rules-*.jar' -type f | \
    grep -v 'phive-rules-api' | \
    grep -v 'phive-rules-parent-pom' | \
    while read jar; do \
        echo "Scanning: $(basename $jar)"; \
        jar tf "$jar" | grep 'Validation\.class$' | grep -v '\$' | \
        sed 's|/|.|g' | sed 's|\.class$||' | \
        while read class; do \
            echo "$class"; \
        done; \
    done | sort -u > /tmp/phive-discovery/discovered-modules.txt && \
    echo "========================================" && \
    echo "✅ Discovered $(wc -l < /tmp/phive-discovery/discovered-modules.txt) validation classes" && \
    echo "========================================" && \
    cat /tmp/phive-discovery/discovered-modules.txt

# Runtime stage
FROM eclipse-temurin:21-jre-alpine

# Install necessary tools
RUN apk add --no-cache curl

WORKDIR /app

# Copy the WAR file from build stage
COPY --from=build /app/target/phive-validation-api.war ./phive-validation-api.war

# Copy auto-discovered modules list
COPY --from=build /tmp/phive-discovery/discovered-modules.txt /app/discovered-modules.txt

# Create directories for uploaded files and output
RUN mkdir -p /app/uploads && chmod 777 /app/uploads && \
    mkdir -p /app/output && chmod 777 /app/output

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/ || exit 1

# Download Tomcat for WAR deployment
RUN apk add --no-cache wget unzip && \
    wget -O /tmp/tomcat.tar.gz https://archive.apache.org/dist/tomcat/tomcat-9/v9.0.85/bin/apache-tomcat-9.0.85.tar.gz && \
    tar -xzf /tmp/tomcat.tar.gz -C /app && \
    mv /app/apache-tomcat-9.0.85 /app/tomcat && \
    rm -rf /app/tomcat/webapps/* && \
    cp /app/phive-validation-api.war /app/tomcat/webapps/ROOT.war && \
    rm /tmp/tomcat.tar.gz && \
    apk del wget unzip

# Set JVM options for PHIVE
# Memory for ALL available rules from local repository
ENV JAVA_OPTS="-Xss2m -Xmx1536m -XX:+UseG1GC -XX:MaxMetaspaceSize=768m"
ENV CATALINA_OPTS="$JAVA_OPTS"

# Expose Tomcat port
EXPOSE 8080

# Run Tomcat
CMD ["/app/tomcat/bin/catalina.sh", "run"]

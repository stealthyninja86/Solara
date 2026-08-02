# Stage 1: Build Stage
FROM maven:3.9.9-eclipse-temurin-21 AS builder

WORKDIR /app

# Copy Maven POM and download dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source code
COPY src ./src

# Build application
RUN mvn clean package -Dmaven.test.skip=true

# Stage 2: Runtime Stage
FROM eclipse-temurin:21-jre

WORKDIR /app

# Copy JAR from builder stage
COPY --from=builder /app/target/auth-service-0.0.1-SNAPSHOT.jar app.jar

# Expose port
EXPOSE 4001

# Run application
ENTRYPOINT ["java", "-jar", "app.jar"]

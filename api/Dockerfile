FROM gradle:8-jdk17 AS build
COPY --chown=gradle:gradle . /home/gradle/src
WORKDIR /home/gradle/src
RUN gradle build --no-daemon -x test

FROM openjdk:17-slim
WORKDIR /app
COPY --from=build /home/gradle/src/build/quarkus-app/ /app/
EXPOSE 3000
CMD ["java", "-jar", "/app/quarkus-run.jar"]

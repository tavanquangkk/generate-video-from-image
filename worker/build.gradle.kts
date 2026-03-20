plugins {
    kotlin("jvm") version "1.9.24"
    kotlin("plugin.allopen") version "1.9.24"
    id("io.quarkus") version "3.15.2"
}

repositories {
    mavenCentral()
    mavenLocal()
}

val quarkusPlatformGroupId: String by project
val quarkusPlatformArtifactId: String by project
val quarkusPlatformVersion: String by project

dependencies {
    implementation("io.quarkus:quarkus-kotlin")
    implementation("io.quarkus:quarkus-redis-client")
    implementation("io.quarkus:quarkus-rest-client-jackson")
    implementation("io.quarkus:quarkus-arc")
    implementation("com.drewnoakes:metadata-extractor:2.19.0")
    implementation("org.jetbrains.kotlin:kotlin-stdlib-jdk8")
}

group = "org.acme"
version = "1.0.0-SNAPSHOT"

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
    kotlinOptions.jvmTarget = "17"
    kotlinOptions.javaParameters = true
}

quarkus {
    setProperty("quarkus.platform.group-id", "io.quarkus.platform")
    setProperty("quarkus.platform.artifact-id", "quarkus-bom")
    setProperty("quarkus.platform.version", "3.15.2")
}

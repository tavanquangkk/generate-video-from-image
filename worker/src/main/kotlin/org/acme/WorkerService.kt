package org.acme

import io.quarkus.redis.client.RedisClient
import io.quarkus.runtime.StartupEvent
import jakarta.enterprise.context.ApplicationScoped
import jakarta.enterprise.event.Observes
import jakarta.inject.Inject
import org.eclipse.microprofile.config.inject.ConfigProperty
import com.fasterxml.jackson.databind.ObjectMapper
import org.acme.models.VideoJob
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.net.URI

@ApplicationScoped
class WorkerService {

    @Inject
    lateinit var redisClient: RedisClient

    @Inject
    lateinit var objectMapper: ObjectMapper

    @Inject
    lateinit var videoProcessor: VideoProcessor

    @ConfigProperty(name = "STORAGE_PATH", defaultValue = "/storage")
    lateinit var storagePath: String

    @ConfigProperty(name = "BASE_URL", defaultValue = "http://api:3000")
    lateinit var baseUrl: String

    fun onStart(@Observes ev: StartupEvent) {
        Thread {
            while (true) {
                try {
                    // Poll from Redis queue (video_jobs)
                    val response = redisClient.blpop(listOf("video_jobs", "10"))
                    if (response != null && response.size() > 1) {
                        val jobJson = response.get(1).toString()
                        val job = objectMapper.readValue(jobJson, VideoJob::class.java)
                        
                        println("Processing job: ${job.jobId}")
                        redisClient.set(listOf("status:${job.jobId}", "processing"))

                        try {
                            val videoFile = videoProcessor.processVideo(job, storagePath)
                            println("Video generated: $videoFile")

                            redisClient.set(listOf("status:${job.jobId}", "completed"))
                            
                            // Callback to n8n
                            sendCallback(job.callbackUrl, mapOf(
                                "jobId" to job.jobId,
                                "status" to "completed",
                                "videoUrl" to "$baseUrl/videos/video_${job.jobId}.mp4"
                            ))
                        } catch (e: Exception) {
                            println("Job failed: ${e.message}")
                            redisClient.set(listOf("status:${job.jobId}", "failed"))
                            sendCallback(job.callbackUrl, mapOf(
                                "jobId" to job.jobId,
                                "status" to "failed",
                                "error" to e.message
                            ))
                        }
                    }
                } catch (e: Exception) {
                    println("Worker Error: ${e.message}")
                    Thread.sleep(5000)
                }
            }
        }.start()
    }

    private fun sendCallback(url: String, payload: Map<String, Any?>) {
        try {
            val json = objectMapper.writeValueAsString(payload)
            val client = HttpClient.newHttpClient()
            val request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build()
            
            client.send(request, HttpResponse.BodyHandlers.ofString())
        } catch (e: Exception) {
            println("Callback Error: ${e.message}")
        }
    }
}

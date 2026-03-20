package org.acme

import io.quarkus.redis.client.RedisClient
import jakarta.inject.Inject
import jakarta.ws.rs.*
import jakarta.ws.rs.core.MediaType
import jakarta.ws.rs.core.Response
import org.acme.models.VideoJob
import org.acme.models.JobOptions
import java.util.UUID
import com.fasterxml.jackson.databind.ObjectMapper

@Path("/jobs")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
class JobResource {

    @Inject
    lateinit var redisClient: RedisClient

    @Inject
    lateinit var objectMapper: ObjectMapper

    @POST
    @Path("/create")
    fun createJob(request: CreateJobRequest): Response {
        val jobId = "job_" + UUID.randomUUID().toString().substring(0, 8)
        val job = VideoJob(
            jobId = jobId,
            images = request.images,
            options = request.options ?: JobOptions(),
            callbackUrl = request.callbackUrl
        )

        val jobJson = objectMapper.writeValueAsString(job)
        
        // Push to Redis Queue and Store Status
        redisClient.rpush(listOf("video_jobs", jobJson))
        redisClient.set(listOf("status:$jobId", "queued"))

        return Response.accepted(mapOf("jobId" to jobId, "status" to "queued")).build()
    }

    @GET
    @Path("/{id}")
    fun getStatus(@PathParam("id") id: String): Response {
        val status = redisClient.get(id) ?: return Response.status(Response.Status.NOT_FOUND).build()
        return Response.ok(mapOf("jobId" to id, "status" to status.toString())).build()
    }
}

data class CreateJobRequest(
    val images: List<String>,
    val options: JobOptions? = null,
    val callbackUrl: String
)

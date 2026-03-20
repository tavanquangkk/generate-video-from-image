package org.acme.models

import com.fasterxml.jackson.annotation.JsonProperty

data class VideoJob(
    @JsonProperty("jobId") val jobId: String,
    @JsonProperty("images") val images: List<String>,
    @JsonProperty("options") val options: JobOptions,
    @JsonProperty("callbackUrl") val callbackUrl: String,
    @JsonProperty("status") var status: String = "queued",
    @JsonProperty("createdAt") val createdAt: Long = System.currentTimeMillis()
)

data class JobOptions(
    @JsonProperty("durationPerImage") val durationPerImage: Int = 3,
    @JsonProperty("overlay") val overlay: Boolean = true,
    @JsonProperty("music") val music: Boolean = false
)

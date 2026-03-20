package org.acme

import jakarta.ws.rs.*
import jakarta.ws.rs.core.MediaType
import jakarta.ws.rs.core.Response
import java.io.File
import org.eclipse.microprofile.config.inject.ConfigProperty

@Path("/videos")
class VideoResource {

    @ConfigProperty(name = "STORAGE_PATH", defaultValue = "/storage")
    lateinit var storagePath: String

    @GET
    @Path("/{name}")
    @Produces("video/mp4")
    fun getVideo(@PathParam("name") name: String): Response {
        val file = File("$storagePath/videos/$name")
        if (!file.exists()) return Response.status(Response.Status.NOT_FOUND).build()
        
        return Response.ok(file).build()
    }
}

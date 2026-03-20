package org.acme

import jakarta.enterprise.context.ApplicationScoped
import jakarta.inject.Inject
import java.io.File
import java.util.concurrent.TimeUnit
import org.acme.models.VideoJob

@ApplicationScoped
class VideoProcessor {

    @Inject
    lateinit var metadataService: MetadataService

    fun processVideo(job: VideoJob, storagePath: String): String {
        val jobId = job.jobId
        val outputDir = File("$storagePath/videos")
        if (!outputDir.exists()) outputDir.mkdirs()
        
        val tempDir = File("$storagePath/temp/$jobId")
        if (!tempDir.exists()) tempDir.mkdirs()

        val videoClips = mutableListOf<String>()

        job.images.forEachIndexed { index, imageName ->
            val imagePath = "$storagePath/images/$imageName"
            val metadata = metadataService.extractMetadata(imagePath)
            val overlayText = metadata.toOverlayText()
            
            val clipPath = "${tempDir.absolutePath}/clip_$index.mp4"
            
            // Create a short clip for each image with text overlay
            // -loop 1: repeat image
            // -t: duration
            // drawtext filter: ISO | f/ | Shutter ...
            val ffmpegCmd = listOf(
                "ffmpeg", "-y",
                "-loop", "1", "-i", imagePath,
                "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,drawtext=text='$overlayText':x=w-tw-50:y=h-th-50:fontsize=36:fontcolor=white:box=1:boxcolor=black@0.5:boxborderw=10",
                "-c:v", "libx264", "-t", job.options.durationPerImage.toString(),
                "-pix_fmt", "yuv420p",
                clipPath
            )
            
            runCommand(ffmpegCmd)
            videoClips.add(clipPath)
        }

        // Concat all clips
        val concatListPath = "${tempDir.absolutePath}/concat_list.txt"
        File(concatListPath).writeText(videoClips.joinToString("\n") { "file '$it'" })

        val finalOutput = "${outputDir.absolutePath}/video_$jobId.mp4"
        val concatCmd = listOf(
            "ffmpeg", "-y",
            "-f", "concat", "-safe", "0", "-i", concatListPath,
            "-c", "copy",
            finalOutput
        )
        runCommand(concatCmd)

        // Cleanup
        tempDir.deleteRecursively()

        return finalOutput
    }

    private fun runCommand(cmd: List<String>) {
        println("Running: ${cmd.joinToString(" ")}")
        val process = ProcessBuilder(cmd)
            .redirectErrorStream(true)
            .start()
        
        process.inputStream.bufferedReader().use { it.readText() }
        process.waitFor(5, TimeUnit.MINUTES)
    }
}

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
            val duration = job.options.durationPerImage
            
            // Stylish Improvements:
            // 1. Zoompan (Ken Burns Effect): slow zoom in
            // 2. Fade: fade in and fade out
            // 3. Drawtext: adjusted positioning and styling
            val ffmpegCmd = listOf(
                "ffmpeg", "-y",
                "-loop", "1", "-i", imagePath,
                "-vf", "scale=8000:-1,zoompan=z='min(zoom+0.0015,1.5)':d=${duration * 25}:s=1920x1080:fps=25,fade=t=in:st=0:d=1,fade=t=out:st=${duration - 1}:d=1,drawtext=text='$overlayText':x=60:y=h-th-60:fontsize=32:fontcolor=white@0.8:box=1:boxcolor=black@0.3:boxborderw=15",
                "-c:v", "libx264", "-t", duration.toString(),
                "-pix_fmt", "yuv420p", "-r", "25",
                clipPath
            )
            
            runCommand(ffmpegCmd)
            videoClips.add(clipPath)
        }

        // Concat all clips
        val concatListPath = "${tempDir.absolutePath}/concat_list.txt"
        File(concatListPath).writeText(videoClips.joinToString("\n") { "file '$it'" })

        val intermediateOutput = "${tempDir.absolutePath}/no_music.mp4"
        val concatCmd = listOf(
            "ffmpeg", "-y",
            "-f", "concat", "-safe", "0", "-i", concatListPath,
            "-c", "copy",
            intermediateOutput
        )
        runCommand(concatCmd)

        // Final step: Add BGM if requested and available
        val finalOutput = "${outputDir.absolutePath}/video_$jobId.mp4"
        val bgmFile = File("$storagePath/music/background.mp3")
        
        if (job.options.music && bgmFile.exists()) {
            val musicCmd = listOf(
                "ffmpeg", "-y",
                "-i", intermediateOutput,
                "-stream_loop", "-1", "-i", bgmFile.absolutePath,
                "-map", "0:v", "-map", "1:a",
                "-c:v", "copy", "-c:a", "aac", "-shortest",
                finalOutput
            )
            runCommand(musicCmd)
        } else {
            File(intermediateOutput).copyTo(File(finalOutput), overwrite = true)
        }

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

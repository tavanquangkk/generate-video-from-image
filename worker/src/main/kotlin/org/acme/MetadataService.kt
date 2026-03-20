package org.acme

import com.drew.imaging.ImageMetadataReader
import com.drew.metadata.exif.ExifIFD0Directory
import com.drew.metadata.exif.ExifSubIFDDirectory
import jakarta.enterprise.context.ApplicationScoped
import java.io.File

@ApplicationScoped
class MetadataService {

    fun extractMetadata(imagePath: String): ImageMetadata {
        val file = File(imagePath)
        if (!file.exists()) return ImageMetadata()

        try {
            val metadata = ImageMetadataReader.readMetadata(file)
            val subIfd = metadata.getFirstDirectoryOfType(ExifSubIFDDirectory::class.java)
            val ifd0 = metadata.getFirstDirectoryOfType(ExifIFD0Directory::class.java)

            return ImageMetadata(
                iso = subIfd?.getString(ExifSubIFDDirectory.TAG_ISO_EQUIVALENT),
                aperture = subIfd?.getString(ExifSubIFDDirectory.TAG_FNUMBER),
                shutter = subIfd?.getString(ExifSubIFDDirectory.TAG_EXPOSURE_TIME),
                camera = ifd0?.getString(ExifIFD0Directory.TAG_MODEL),
                lens = subIfd?.getString(ExifSubIFDDirectory.TAG_LENS_MODEL) ?: subIfd?.getString(ExifSubIFDDirectory.TAG_LENS_INFO)
            )
        } catch (e: Exception) {
            println("Error reading EXIF: ${e.message}")
            return ImageMetadata()
        }
    }
}

data class ImageMetadata(
    val iso: String? = null,
    val aperture: String? = null,
    val shutter: String? = null,
    val camera: String? = null,
    val lens: String? = null
) {
    fun toOverlayText(): String {
        val line1 = "ISO ${iso ?: "?"} | f/${aperture ?: "?"} | ${shutter ?: "?"}s"
        val line2 = "${camera ?: "Camera ?"} + ${lens ?: "Lens ?"}"
        return "$line1\\n$line2"
    }
}

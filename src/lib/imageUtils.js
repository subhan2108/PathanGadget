/**
 * src/lib/imageUtils.js
 * Browser-side image compression and direct gallery upload utilities for Neon DB.
 * Allows users to pick photos directly from device gallery/files and converts them
 * into lightweight, high-performance WebP/JPEG Data URLs stored directly in PostgreSQL.
 */

export async function compressImageFile(file, maxWidth = 1200, maxHeight = 1200, quality = 0.82) {
    if (!file || !file.type.startsWith('image/')) {
        throw new Error('Please select a valid image file');
    }

    // If it's an SVG, read directly as data URL without rasterizing
    if (file.type === 'image/svg+xml') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Scale down if larger than maximum constraints
                if (width > maxWidth || height > maxHeight) {
                    if (width / height > maxWidth / maxHeight) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, width);
                canvas.height = Math.max(1, height);

                const ctx = canvas.getContext('2d');
                // Improve downscaling quality
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                // Try modern WebP first
                let dataUrl = canvas.toDataURL('image/webp', quality);
                if (!dataUrl || !dataUrl.startsWith('data:image/webp')) {
                    // Fallback to JPEG
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                }

                resolve(dataUrl);
            };
            img.onerror = (err) => reject(new Error('Failed to parse image for compression: ' + err));
        };
        reader.onerror = (err) => reject(new Error('Failed to read image file: ' + err));
    });
}

/**
 * Calculates rough size of a data URL in bytes
 */
export function getDataUrlSize(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return 0;
    const base64Index = dataUrl.indexOf(';base64,');
    if (base64Index === -1) return dataUrl.length;
    const base64Data = dataUrl.substring(base64Index + 8);
    return Math.round((base64Data.length * 3) / 4);
}

/**
 * Formats bytes to human-readable size
 */
export function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

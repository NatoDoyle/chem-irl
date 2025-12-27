/**
 * Image compression utilities for reducing file size before upload
 */

import * as ImageManipulator from 'expo-image-manipulator';

const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1500;
const COMPRESSION_QUALITY = 0.8;

/**
 * Compress and resize an image to reduce file size
 *
 * @param uri - Local file URI of the image
 * @returns Compressed image URI or original URI if compression fails
 */
export async function compressImage(uri: string): Promise<string> {
  try {
    // Get image info first to check dimensions
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          resize: {
            width: MAX_WIDTH,
            height: MAX_HEIGHT,
          },
        },
      ],
      {
        compress: COMPRESSION_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    return manipResult.uri;
  } catch (error) {
    // If compression fails, return original URI
    console.error('Image compression failed:', error);
    return uri;
  }
}

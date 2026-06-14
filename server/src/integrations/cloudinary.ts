import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
  secure: true,
});

// Upload a reader profile image (base64 data URI or remote URL). Admin only.
export async function uploadReaderImage(dataUri: string): Promise<string> {
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "soulseer/readers",
    resource_type: "image",
    transformation: [{ width: 600, height: 600, crop: "fill", gravity: "face" }],
  });
  return result.secure_url;
}

export { cloudinary };

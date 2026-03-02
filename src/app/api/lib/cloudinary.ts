import { v2 as cloudinary } from "cloudinary";

// Required env keys for Cloudinary image storage:
// - CLOUDINARY_CLOUD_NAME
// - CLOUDINARY_API_KEY
// - CLOUDINARY_API_SECRET
// Optional:
// - CLOUDINARY_UPLOAD_FOLDER (base folder prefix, e.g. "hapuslogistics")

let isConfigured = false;

type UploadImageOptions = {
  folder?: string;
};

function getEnv(name: string): string {
  return String(process.env[name] ?? "").trim();
}

function getCloudinaryBaseFolder(): string {
  return getEnv("CLOUDINARY_UPLOAD_FOLDER");
}

function resolveUploadFolder(folder?: string): string {
  const baseFolder = getCloudinaryBaseFolder();
  const scopedFolder = String(folder ?? "").trim().replace(/^\/+|\/+$/g, "");

  if (baseFolder && scopedFolder) return `${baseFolder}/${scopedFolder}`;
  if (baseFolder) return baseFolder;
  return scopedFolder;
}

function ensureCloudinaryConfigured() {
  if (isConfigured) return;

  const cloudName = getEnv("CLOUDINARY_CLOUD_NAME");
  const apiKey = getEnv("CLOUDINARY_API_KEY");
  const apiSecret = getEnv("CLOUDINARY_API_SECRET");

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary configuration missing. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  isConfigured = true;
}

function uploadBuffer(buffer: Buffer, options?: UploadImageOptions): Promise<string> {
  ensureCloudinaryConfigured();

  return new Promise((resolve, reject) => {
    const folder = resolveUploadFolder(options?.folder);
    const uploadOptions = folder ? { folder, resource_type: "image" as const } : { resource_type: "image" as const };

    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error || !result?.secure_url) {
        reject(error ?? new Error("Cloudinary upload failed."));
        return;
      }
      resolve(result.secure_url);
    });

    stream.end(buffer);
  });
}

export function isCloudinaryImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith("res.cloudinary.com");
  } catch {
    return false;
  }
}

function extractPublicIdFromCloudinaryUrl(url: string): string | null {
  if (!isCloudinaryImageUrl(url)) return null;

  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const uploadIndex = pathParts.findIndex((part) => part === "upload");
    if (uploadIndex === -1) return null;

    const partsAfterUpload = pathParts.slice(uploadIndex + 1);
    const versionIndex = partsAfterUpload.findIndex((part) => /^v\d+$/.test(part));
    const publicIdParts =
      versionIndex >= 0 ? partsAfterUpload.slice(versionIndex + 1) : partsAfterUpload;

    if (publicIdParts.length === 0) return null;

    const joined = publicIdParts.join("/");
    return joined.replace(/\.[^/.]+$/, "");
  } catch {
    return null;
  }
}

export function isDataImageUrl(value: string): boolean {
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(String(value).trim());
}

export async function uploadImageFile(file: File, options?: UploadImageOptions): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return uploadBuffer(buffer, options);
}

export async function uploadImageDataUrl(dataUrl: string, options?: UploadImageOptions): Promise<string> {
  ensureCloudinaryConfigured();
  const normalizedDataUrl = String(dataUrl).trim();
  if (!isDataImageUrl(normalizedDataUrl)) {
    throw new Error("Invalid image data URL.");
  }

  const folder = resolveUploadFolder(options?.folder);
  const uploadOptions = folder ? { folder, resource_type: "image" as const } : { resource_type: "image" as const };
  const result = await cloudinary.uploader.upload(normalizedDataUrl, uploadOptions);
  if (!result?.secure_url) {
    throw new Error("Cloudinary upload failed.");
  }
  return result.secure_url;
}

export async function deleteCloudinaryImageByUrl(url: string): Promise<boolean> {
  const normalizedUrl = String(url ?? "").trim();
  if (!normalizedUrl || !isCloudinaryImageUrl(normalizedUrl)) {
    return false;
  }

  try {
    ensureCloudinaryConfigured();
  } catch {
    return false;
  }

  const publicId = extractPublicIdFromCloudinaryUrl(normalizedUrl);
  if (!publicId) return false;

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      invalidate: true,
    });
    return result?.result === "ok" || result?.result === "not found";
  } catch {
    return false;
  }
}

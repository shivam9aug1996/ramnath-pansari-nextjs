import { v2 as cloudinary } from "cloudinary";
import tmp from "tmp";
import {
  cloudinary_api_key,
  cloudinary_cloud_name,
  cloudinary_secret_key,
} from "./keys";
cloudinary.config({
  cloud_name: cloudinary_cloud_name,
  api_key: cloudinary_api_key,
  api_secret: cloudinary_secret_key,
});
export const uploadImage = async (imageFile: {
  type: string;
  imageUrl?: string;
}) => {
  try {
    let imageUrl = null;
    var mime = imageFile.type;
    var encoding = "base64";
    let file = await new Promise<string>((res) => {
      res("data:" + mime + ";" + encoding + "," + imageFile?.imageUrl);
    });
    try {
      const uploadResult = await cloudinary.uploader.upload(file, {});
      imageUrl = uploadResult?.secure_url;
      try {
        tmp.setGracefulCleanup();
        return imageUrl;
      } catch (error) {
        console.log("Error deleting file:", error);
      }
    } catch (error) {
      console.log(
        "error while uploading image",
        error,
        file?.substring(0, 100),
      );
    }
  } catch (error) {
    console.log("error in buffer", error);
  }
};
export const uploadImage1 = async (imageUrl: string) => {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok)
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const mimeType = response.headers.get("content-type");
    const base64Data = fileBuffer.toString("base64");
    const fileUri = `data:${mimeType};base64,${base64Data}`;
    const uploadResult = await cloudinary.uploader.upload(fileUri, {});
    console.log("Image uploaded successfully:", uploadResult.secure_url);
    return uploadResult.secure_url;
  } catch (error) {
    console.error("Error uploading image:", error);
    return null;
  }
};
export const deleteImage = async (imageUrl: string) => {
  console.log("deleteImage---------->", imageUrl);
  const url = new URL(imageUrl);
  const pathnameParts = url.pathname.split("/");
  const imageName = pathnameParts[pathnameParts.length - 1];
  const publicName = imageName?.substring(0, imageName?.lastIndexOf("."));
  cloudinary.uploader.destroy(publicName, (err, callResult) =>
    console.log("Response", err, callResult),
  );
};

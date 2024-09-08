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

export const uploadImage = async (imageFile) => {
  try {
    let imageUrl = null;
    // console.log(",kjhgfghjkl;", imageFile);
    // const fileBuffer = await imageFile.arrayBuffer();
    // console.log("765rdfgbnm", fileBuffer);
    var mime = imageFile.type;
    var encoding = "base64";
    // var base64Data = Buffer.from(fileBuffer).toString("base64");
    //var fileUri = "data:" + mime + ";" + encoding + "," + imageFile?.imageUrl;
    //console.log(fileUri?.substring(0, 50));
    // const bytes = await imageFile.arrayBuffer();
    // const buffer = Buffer.from(bytes);
    // const { name: tmpFileName, fd: tmpFileDescriptor } = tmp.fileSync();

    // try {
    //   // await writeFile(uploadDir, buffer);
    //   console.log("jhgfdcvhjk", tmpFileName, buffer);
    //   let result = await writeFile(tmpFileName, buffer);
    //   console.log("i8765redfghjki87", result);
    // } catch (error) {
    //   console.log(error);
    // }

    let file = await new Promise((res) => {
      res("data:" + mime + ";" + encoding + "," + imageFile?.imageUrl);
    });
    //console.log(",jhgfdwe67890", file?.substring(0, 50));

    try {
      const uploadResult = await cloudinary.uploader.upload(file, {
        //public_id: `uploaded-images/image_tmpFileName`, // Adjust the public_id as needed
      });
      // console.log("kjhgfdfghjk", uploadResult);
      imageUrl = uploadResult?.secure_url;
      try {
        //  await fs.unlink(uploadDir);
        tmp.setGracefulCleanup();
        return imageUrl;
      } catch (error) {
        console.log("Error deleting file:", error);
      }
    } catch (error) {
      console.log(
        "error while uploading image"
        // error,
        // imageFile,
        // tmpFileName,
        // `uploaded-images/image_${Date.now()}`
      );
    }
  } catch (error) {
    console.log("error in buffer", error);
  }
};

export const uploadImage1 = async (imageUrl) => {
  try {
    // Fetch the image from the URL
    const response = await fetch(imageUrl);
    if (!response.ok)
      throw new Error(`Failed to fetch image: ${response.statusText}`);

    // Get the response as an ArrayBuffer and convert it to a Buffer
    const arrayBuffer = await response.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Convert the buffer to a base64 string
    const mimeType = response.headers.get("content-type");
    const base64Data = fileBuffer.toString("base64");
    const fileUri = `data:${mimeType};base64,${base64Data}`;

    // Upload the image to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(fileUri, {});

    console.log("Image uploaded successfully:", uploadResult.secure_url);
    return uploadResult.secure_url;
  } catch (error) {
    console.error("Error uploading image:", error);
    return null;
  }
};

export const deleteImage = async (imageUrl) => {
  const url = new URL(imageUrl);
  const pathnameParts = url.pathname.split("/");
  const imageName = pathnameParts[pathnameParts.length - 1];
  const publicName = imageName?.substring(0, imageName?.lastIndexOf("."));

  cloudinary.uploader.destroy(
    publicName,
    //{ invalidate: true, resource_type: "image" },
    (err, callResult) => console.log("Response", err, callResult)
  );
};

import { deleteImage, uploadImage } from "./global";
export const uploadMultipleImages = async (
  imageFiles: {
    type: string;
    imageUrl?: string;
  }[] = [],
) => {
  const imageUrl = [];
  for (let i = 0; i < imageFiles?.length; i++) {
    try {
      let data = await uploadImage(imageFiles[i]);
      imageUrl.push(data);
    } catch (uploadError) {
      console.error(`Error uploading image`);
    }
  }
  return imageUrl;
};
export const deleteMultipleImages = async (imageUrls: string[] = []) => {
  for (let i = 0; i < imageUrls.length; i++) {
    try {
      await deleteImage(imageUrls[i]);
    } catch (error) {
      console.error(`Error deleting image:`);
    }
  }
};
export const calculateSecondsElapsed = (initialTime: number) => {
  let currentTime = new Date().getTime();
  let timeElapsedInMilliseconds = currentTime - initialTime;
  let timeElapsedInSeconds = timeElapsedInMilliseconds / 1000;
  return timeElapsedInSeconds;
};

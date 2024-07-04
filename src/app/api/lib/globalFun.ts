import { deleteImage, uploadImage } from "./global";

export const uploadMultipleImages = async (imageFiles = []) => {
  const imageUrl = [];

  for (let i = 0; i < imageFiles?.length; i++) {
    try {
      let data = await uploadImage(imageFiles[i]);
      imageUrl.push(data);
    } catch (uploadError) {
      // Log the error and continue processing other images or handle it as needed
      console.error(`Error uploading image`);
      // Optionally, you can decide to break the loop or perform any other action
    }
  }

  return imageUrl;
};

export const deleteMultipleImages = async (imageUrls = []) => {
  for (let i = 0; i < imageUrls.length; i++) {
    try {
      await deleteImage(imageUrls[i]);
    } catch (error) {
      console.error(`Error deleting image:`);
      // Continue with deletion of other images even if one deletion fails
    }
  }
};

export const calculateSecondsElapsed = (initialTime) => {
  // Get the current time in milliseconds
  let currentTime = new Date().getTime();

  // Calculate the difference in milliseconds
  let timeElapsedInMilliseconds = currentTime - initialTime;

  // Convert milliseconds to seconds
  let timeElapsedInSeconds = timeElapsedInMilliseconds / 1000;

  return timeElapsedInSeconds;
};

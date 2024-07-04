"use server";

import { cookies } from "next/headers";

export const getCookies = () => {
  // let token = cookies().get("bahi_khata_user_token")?.value;
  let token = null;
  let userData = cookies().get("bahi_khata_user_data")?.value;
  let businessIdSelected = cookies().get("businessIdSelected")?.value;
  return { token, userData, businessIdSelected };
};

export const deleteCookies = () => {
  cookies()
    .getAll()
    .map((item) => {
      cookies().delete(item?.name);
    });
};

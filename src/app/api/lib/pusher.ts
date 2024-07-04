import Pusher from "pusher";
import {
  pusher_api_key,
  pusher_app_id,
  pusher_cluster,
  pusher_secret_key,
} from "./keys";

export const pusher = new Pusher({
  appId: pusher_app_id,
  key: pusher_api_key,
  secret: pusher_secret_key,
  cluster: pusher_cluster,
  useTLS: true,
});

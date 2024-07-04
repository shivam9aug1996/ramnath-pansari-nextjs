const dbPassword = process.env.DB_PASSWORD;
export const secretKey = process.env.SECRET_KEY;
export const dbUrl = `mongodb+srv://shivam9aug1996:${dbPassword}@ramnath-pansari-cluster.0ouh72q.mongodb.net/?retryWrites=true&w=majority&appName=ramnath-pansari-cluster-0`;

export const cloudinary_api_key = process.env.CLOUDINARY_API_KEY;
export const cloudinary_secret_key = process.env.CLOUDINARY_SECRET_KEY;
export const cloudinary_cloud_name = process.env.CLOUDINARY_CLOUD_NAME;

export const pusher_api_key = process.env.PUSHER_API_KEY;
export const pusher_secret_key = process.env.PUSHER_SECRET_KEY;
export const pusher_cluster = process.env.PUSHER_CLUSTER;
export const pusher_app_id = process.env.PUSHER_APP_ID;

export const pusher_public_api_key = process.env.NEXT_PUBLIC_PUSHER_API_KEY;
export const pusher_public_cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

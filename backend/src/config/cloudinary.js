import { v2 as cloudinary } from 'cloudinary';
import { config } from 'dotenv';

config(); // Carrega as variáveis de ambiente do .env

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  console.warn('⚠️ CLOUDINARY: Variáveis de ambiente não configuradas. Upload de imagens desabilitado.');
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

export default cloudinary;
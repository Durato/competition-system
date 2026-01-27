const hostname = window.location.hostname;
const isLocal = hostname === "localhost" || 
                hostname === "127.0.0.1" ||
                hostname.startsWith("192.168.") || 
                hostname.startsWith("10.");

const Config = {
  // Usa o hostname atual (ex: 10.0.1.51) para montar a URL da API na porta 3000
  API_URL: isLocal ? `http://${hostname}:3000` : "https://competition-system-anar.onrender.com"
};
import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const API = axios.create({
  baseURL: API_URL
});

export default API;

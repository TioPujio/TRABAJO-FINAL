import { API_URL } from "../services/api";

export default function ProductCard({ product }) {
  return (
    <div className="bg-white rounded-2xl shadow-md hover:shadow-lg transition p-4">
      <img
        src={`${API_URL}${product.imageUrl}`}
        className="w-full h-40 object-cover rounded-lg"
      />

      <h2 className="text-lg font-semibold mt-3 capitalize">{product.name}</h2>

      <p className="text-green-700 font-bold">${product.pricePerKg} / kg</p>

      <p className="text-sm text-gray-500">{product.category}</p>
    </div>
  );
}

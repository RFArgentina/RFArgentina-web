import { useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import axios from "axios";

// Componentes principales
import RFALanding from "./components/RFALanding";
import { Toaster } from "./components/ui/sonner";
import Header from "./components/Header"; // Header

// URL del backend desde variables de entorno
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Página principal (Home)
const Home = () => {
  const helloWorldApi = async () => {
    try {
      const response = await axios.get(`${API}/`);
      console.log("Backend dice:", response.data.message);
    } catch (e) {
      console.error("Error al conectar con backend:", e);
    }
  };

  useEffect(() => {
    helloWorldApi();
  }, []);

  return <RFALanding />;
};

// App principal
function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Header />  {/* 🔹 Header fijo en todas las páginas */}
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;

import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Componentes principales
import RFALanding from "./components/RFALanding";
import { Toaster } from "./components/ui/sonner";
import Header from "./components/Header";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Plans from "./pages/Plans";
import Enterprise from "./pages/Enterprise";
import CaseLookup from "./pages/CaseLookup";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Cookies from "./pages/Cookies";
import ErrorBoundary from "./components/ErrorBoundary";

const Home = () => {
  return <RFALanding />;
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Header />
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Navigate to="/consultar-caso" replace />} />
            <Route path="/verificar" element={<Navigate to="/login" replace />} />
            <Route path="/crear-caso" element={<Dashboard />} />
            <Route path="/consultar-caso" element={<CaseLookup />} />
            <Route path="/planes" element={<Plans />} />
            <Route path="/empresas" element={<Enterprise />} />
            <Route path="/panel" element={<Dashboard />} />
            <Route path="/terminos" element={<Terms />} />
            <Route path="/privacidad" element={<Privacy />} />
            <Route path="/cookies" element={<Cookies />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;

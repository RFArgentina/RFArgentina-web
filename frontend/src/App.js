import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Componentes principales
import RFALanding from "./components/RFALanding";
import { Toaster } from "./components/ui/sonner";
import Header from "./components/Header";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import Dashboard from "./pages/Dashboard";
import Plans from "./pages/Plans";
import Enterprise from "./pages/Enterprise";
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
            <Route path="/registro" element={<Register />} />
            <Route path="/verificar" element={<VerifyEmail />} />
            <Route path="/planes" element={<Plans />} />
            <Route path="/empresas" element={<Enterprise />} />
            <Route path="/panel" element={<Dashboard />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;

import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/AuthContext";
import ProtectedRoute from "./lib/ProtectedRoute";

import Login from "./pages/Login";
import Home from "./pages/Home";
import Counting from "./pages/Counting";
import GerenteDashboard from "./pages/GerenteDashboard";
import GerenteProdutos from "./pages/GerenteProdutos";
import GerenteFuncionarios from "./pages/GerenteFuncionarios";
import GerenteHistorico from "./pages/GerenteHistorico";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* área do Contador */}
          <Route path="/" element={<ProtectedRoute role="contador"><Home /></ProtectedRoute>} />
          <Route path="/contagem/:categoria" element={<ProtectedRoute role="contador"><Counting /></ProtectedRoute>} />

          {/* área do Gerente */}
          <Route path="/gerente" element={<ProtectedRoute role="gerente"><GerenteDashboard /></ProtectedRoute>} />
          <Route path="/gerente/produtos" element={<ProtectedRoute role="gerente"><GerenteProdutos /></ProtectedRoute>} />
          <Route path="/gerente/funcionarios" element={<ProtectedRoute role="gerente"><GerenteFuncionarios /></ProtectedRoute>} />
          <Route path="/gerente/historico" element={<ProtectedRoute role="gerente"><GerenteHistorico /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
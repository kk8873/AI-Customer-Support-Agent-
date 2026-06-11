import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AdminPage } from "@/pages/AdminPage";
import { ChatPage } from "@/pages/ChatPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}

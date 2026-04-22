import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import ChatPage from "./pages/ChatPage";
import OverviewPage from "./pages/OverviewPage";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

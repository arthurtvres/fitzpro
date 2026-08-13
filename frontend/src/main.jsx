import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

// Inter self-hosted: nada de CDN externa, funciona offline.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

import App from "./App.jsx";
import "./styles/index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/* A rota passou a ser a URL, e não estado do React. O App continua lendo
        "secao/pagina" como antes — só que agora de `location.pathname`, o que
        faz o botão voltar do navegador, o F5 e um link colado funcionarem. */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

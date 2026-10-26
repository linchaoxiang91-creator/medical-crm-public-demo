import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Pilot from "./Pilot";
import "./style.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {(window.location.hostname === "crm.91linker.com" || window.location.hash.startsWith("#pilot")) ? <Pilot /> : <App />}
  </React.StrictMode>,
);

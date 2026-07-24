import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import StarCoordinates from "./components/StarCoordinates";
import "./index.css";

// #star で Star Coordinates 実験ビュー、それ以外は通常アプリ。
function Root() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return hash === "#star" ? <StarCoordinates /> : <App />;
}

createRoot(document.querySelector("#content")).render(<Root />);

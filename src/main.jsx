import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import StarCoordinates from "./components/StarCoordinates";
import "./index.css";

// Star Coordinates を既定表示にし、#map で通常の地図アプリを開く。
function Root() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return hash === "#map" ? <App /> : <StarCoordinates />;
}

createRoot(document.querySelector("#content")).render(<Root />);

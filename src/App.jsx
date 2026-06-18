import { useState } from "react";

import Sidebar from "./components/Sidebar";
import CoffeeMap from "./components/CoffeeMap";
import DetailPanel from "./components/DetailPanel";

function App() {
  const [selectedCoffee, setSelectedCoffee] = useState(null);

  return (
    <div className="min-h-screen bg-base-100 text-base-content overflow-x-hidden overflow-y-scroll">
      <div className="grid min-h-screen grid-cols-[240px_1fr_380px]">
        <Sidebar />

        <main className="border-x border-base-300 p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">味覚マップ</h1>
            <p className="mt-2 text-sm text-base-content/70">
              コーヒーの味わいの特徴をもとにしたマップです
            </p>
          </div>

          <CoffeeMap
            selectedCoffee={selectedCoffee}
            onSelectCoffee={setSelectedCoffee}
          />
        </main>

        <DetailPanel selectedCoffee={selectedCoffee} />
      </div>
    </div>
  );
}

export default App;

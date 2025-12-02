import { useState } from "react";
import Monaco from "./Components/Monaco";
import Navbar from "./Components/Navbar";
import SideMenu from "./Components/SideMenu";

function App() {
  const [count, _setCount] = useState("");

  return (
    <div className="min-h-screen drawer lg:drawer-open">
      <input id="my-drawer" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content fresh-gradient flex flex-col items-center justify-start">
        <Navbar />
        <Monaco source={count} />
      </div>
      <div className="drawer-side">
        <label htmlFor="my-drawer" aria-label="close sidebar" className="drawer-overlay"></label>
        <SideMenu />
      </div>
    </div>
  );
}

export default App;

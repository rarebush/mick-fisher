import { useState } from "react";
import MainMenu from "./components/ui/MainMenu";
import GameLayout from "./components/layout/GameLayout";
import FPSCounter from "./components/ui/FPSCounter";

function App() {
  const [gameState, setGameState] = useState("menu"); // 'menu' | 'playing'

  return (
    <div className="app">
      {import.meta.env.DEV && <FPSCounter />}

      {gameState === "menu" && (
        <MainMenu onStart={() => setGameState("playing")} />
      )}

      {gameState === "playing" && (
        <GameLayout onQuit={() => setGameState("menu")} />
      )}
    </div>
  );
}

export default App;

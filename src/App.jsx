import { useState } from "react";
import MainMenu from "./components/ui/MainMenu";
import GameLayout from "./components/layout/GameLayout";

function App() {
  const [gameState, setGameState] = useState("menu"); // 'menu' | 'playing'

  return (
    <div className="app">
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

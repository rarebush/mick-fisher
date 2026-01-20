import "./main-menu.css";

function MainMenu({ onStart }) {
  return (
    <div className="main-menu">
      <h1>Mick Fisher</h1>
      <p className="tagline">Surface the unknown</p>
      <button className="start-btn" onClick={onStart}>
        Start Fishing
      </button>
    </div>
  );
}

export default MainMenu;

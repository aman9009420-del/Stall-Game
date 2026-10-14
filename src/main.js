import '@fontsource/russo-one/latin-400.css';
import '@fontsource/rajdhani/latin-500.css';
import '@fontsource/rajdhani/latin-600.css';
import '@fontsource/rajdhani/latin-700.css';
import './style.css';
import { Game } from './game/Game.js';

const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
if (coarse || navigator.maxTouchPoints > 1) document.body.classList.add('touch-device');
window.addEventListener('touchstart', () => document.body.classList.add('touch-device'), { once: true, passive: true });

const game = new Game(document.getElementById('game'));
game.init().catch((err) => {
  console.error(err);
  const text = document.getElementById('loading-text');
  if (text && !/WebGL/.test(text.textContent)) text.textContent = `Something went wrong: ${err.message}`;
});

// Debug handle (handy for tinkering in the console / automated tests).
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) window.stallRacer = game;

import * as THREE from 'three';
import { OrbitControls } from '../lib/OrbitControls.js';
import { createGame } from './game.js';

window.addEventListener('error', (e) => {
  const l = document.getElementById('loader');
  if (l) {
    const t = l.querySelector('.loader-text');
    if (t) t.textContent = 'Error: ' + (e.message || 'failed to start');
  }
});

const game = createGame({ THREE, OrbitControls });
window.__stall = game;

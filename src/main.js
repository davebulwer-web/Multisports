import { Game } from './engine/game.js';
import { loadAssets } from './game/assets.js';
import { TitleScene } from './game/scenes/menus.js';

const canvas = document.getElementById('screen');
const game = new Game(canvas);
await loadAssets();
game.setScene(new TitleScene(game, { splash: true }));
game.start();
window.game = game; // handy for debugging in the console

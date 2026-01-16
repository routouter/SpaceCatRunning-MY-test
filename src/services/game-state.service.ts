
import { Injectable, signal, computed } from '@angular/core';

export type GameStatus = 'MENU' | 'PLAYING' | 'GAME_OVER';

@Injectable({
  providedIn: 'root'
})
export class GameStateService {
  status = signal<GameStatus>('MENU');
  score = signal<number>(0);
  speed = signal<number>(1.0); // Game speed multiplier

  isPlaying = computed(() => this.status() === 'PLAYING');
  isGameOver = computed(() => this.status() === 'GAME_OVER');
  isMenu = computed(() => this.status() === 'MENU');

  startGame() {
    this.score.set(0);
    this.speed.set(1.0);
    this.status.set('PLAYING');
  }

  endGame() {
    this.status.set('GAME_OVER');
  }

  resetGame() {
    this.status.set('MENU');
    this.score.set(0);
  }

  incrementScore(amount: number) {
    if (this.isPlaying()) {
      this.score.update(s => s + amount);
      // Slowly increase speed as score goes up
      this.speed.update(s => Math.min(s + 0.001, 2.5));
    }
  }
}

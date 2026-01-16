
import { Component, inject } from '@angular/core';
import { GameStateService } from '../services/game-state.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-game-ui',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full h-full flex flex-col justify-between p-6 pointer-events-auto">
      
      <!-- HUD (Heads Up Display) -->
      <div class="flex justify-between items-start w-full">
        <div class="bg-black/50 backdrop-blur-md text-white px-6 py-2 rounded-full border border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.3)]">
          <span class="text-orange-400 font-bold mr-2">SCORE</span>
          <span class="font-mono text-2xl">{{ gameState.score() | number:'1.0-0' }}</span>
        </div>
        
        <div class="text-white/50 text-xs font-mono text-right hidden md:block">
          <div>LEFT / RIGHT to Move</div>
          <div>SPACE to Jump</div>
        </div>
      </div>

      <!-- Main Menu Screen -->
      @if (gameState.isMenu()) {
        <div class="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50">
          <div class="text-center transform transition-all hover:scale-105 duration-300">
            <h1 class="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-white mb-2 drop-shadow-[0_2px_10px_rgba(255,165,0,0.5)]">
              SPACE CAT
            </h1>
            <p class="text-xl text-blue-200 mb-8 font-light tracking-widest">GALACTIC RUNNER</p>
            
            <button 
              (click)="gameState.startGame()"
              class="group relative px-8 py-4 bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-full text-xl shadow-[0_0_20px_rgba(249,115,22,0.6)] transition-all overflow-hidden">
              <span class="relative z-10">START MISSION</span>
              <div class="absolute inset-0 h-full w-full scale-0 rounded-full transition-all duration-300 group-hover:scale-100 group-hover:bg-orange-400/20"></div>
            </button>
            
            <div class="mt-8 grid grid-cols-2 gap-4 text-white/60 text-sm max-w-xs mx-auto">
               <div class="flex flex-col items-center">
                 <div class="w-8 h-8 border border-white/20 rounded flex items-center justify-center mb-1">←</div>
                 <span>Left</span>
               </div>
               <div class="flex flex-col items-center">
                 <div class="w-8 h-8 border border-white/20 rounded flex items-center justify-center mb-1">→</div>
                 <span>Right</span>
               </div>
            </div>
          </div>
        </div>
      }

      <!-- Game Over Screen -->
      @if (gameState.isGameOver()) {
        <div class="absolute inset-0 flex items-center justify-center bg-red-900/40 backdrop-blur-md z-50 animate-in fade-in duration-500">
          <div class="text-center bg-black/80 p-10 rounded-2xl border border-red-500/30 shadow-2xl max-w-md w-full mx-4">
            <h2 class="text-5xl font-bold text-white mb-2">CRASH!</h2>
            <p class="text-red-400 mb-6">System Malfunction</p>
            
            <div class="mb-8 py-4 border-y border-white/10">
              <div class="text-sm text-gray-400 uppercase tracking-widest mb-1">Final Score</div>
              <div class="text-6xl font-mono text-white">{{ gameState.score() | number:'1.0-0' }}</div>
            </div>
            
            <button 
              (click)="gameState.startGame()"
              class="w-full px-6 py-3 bg-white text-black hover:bg-gray-200 font-bold rounded-lg transition-colors">
              TRY AGAIN
            </button>
            
            <button 
              (click)="gameState.resetGame()"
              class="w-full mt-3 px-6 py-3 border border-white/20 text-white/60 hover:text-white hover:border-white/50 hover:bg-white/5 font-medium rounded-lg transition-all">
              MAIN MENU
            </button>
          </div>
        </div>
      }
    </div>
  `
})
export class GameUiComponent {
  gameState = inject(GameStateService);
}

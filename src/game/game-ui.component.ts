
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
        <div class="bg-black/50 backdrop-blur-md text-white px-6 py-2 rounded-full border border-sky-500/30 shadow-[0_0_15px_rgba(14,165,233,0.3)]">
          <span class="text-sky-400 font-bold mr-2">ALTITUDE</span>
          <span class="font-mono text-2xl">{{ gameState.score() | number:'1.0-0' }}ft</span>
        </div>
        
        <div class="text-white/50 text-xs font-mono text-right hidden md:block">
          <div>LEFT / RIGHT to Bank</div>
          <div>SPACE to Pull Up</div>
        </div>
      </div>

      <!-- Main Menu Screen -->
      @if (gameState.isMenu()) {
        <div class="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50">
          <div class="text-center transform transition-all hover:scale-105 duration-300 flex flex-col items-center">
            
            <!-- Logo Area -->
            <div class="flex flex-col items-center mb-8">
              <!-- Transparent Box with Dashed Border and Centered Text -->
              <div class="w-80 md:w-96 h-24 bg-transparent border-4 border-dashed border-sky-500 rounded-lg shadow-[0_0_20px_rgba(56,189,248,0.3)] mb-2 flex items-center justify-center">
                <span class="text-sky-400 font-black text-4xl md:text-5xl italic tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  Plane Game
                </span>
              </div>
            </div>
            
            <button 
              (click)="gameState.startGame()"
              class="group relative px-8 py-4 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-full text-xl shadow-[0_0_20px_rgba(14,165,233,0.6)] transition-all overflow-hidden">
              <span class="relative z-10">TAKEOFF</span>
              <div class="absolute inset-0 h-full w-full scale-0 rounded-full transition-all duration-300 group-hover:scale-100 group-hover:bg-sky-400/20"></div>
            </button>
            
            <div class="mt-8 grid grid-cols-2 gap-4 text-white/60 text-sm max-w-xs mx-auto">
               <div class="flex flex-col items-center">
                 <div class="w-8 h-8 border border-white/20 rounded flex items-center justify-center mb-1">←</div>
                 <span>Bank Left</span>
               </div>
               <div class="flex flex-col items-center">
                 <div class="w-8 h-8 border border-white/20 rounded flex items-center justify-center mb-1">→</div>
                 <span>Bank Right</span>
               </div>
            </div>
          </div>
        </div>
      }

      <!-- Game Over Screen -->
      @if (gameState.isGameOver()) {
        <div class="absolute inset-0 flex items-center justify-center bg-red-900/40 backdrop-blur-md z-50 animate-in fade-in duration-500">
          <div class="text-center bg-black/80 p-10 rounded-2xl border border-red-500/30 shadow-2xl max-w-md w-full mx-4">
            <h2 class="text-5xl font-bold text-white mb-2">MAYDAY!</h2>
            <p class="text-red-400 mb-6">Critical Failure</p>
            
            <div class="mb-8 py-4 border-y border-white/10">
              <div class="text-sm text-gray-400 uppercase tracking-widest mb-1">Max Altitude</div>
              <div class="text-6xl font-mono text-white">{{ gameState.score() | number:'1.0-0' }}</div>
            </div>
            
            <button 
              (click)="gameState.startGame()"
              class="w-full px-6 py-3 bg-white text-black hover:bg-gray-200 font-bold rounded-lg transition-colors">
              RETRY FLIGHT
            </button>
            
            <button 
              (click)="gameState.resetGame()"
              class="w-full mt-3 px-6 py-3 border border-white/20 text-white/60 hover:text-white hover:border-white/50 hover:bg-white/5 font-medium rounded-lg transition-all">
              HANGAR
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

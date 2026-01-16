
import { Component } from '@angular/core';
import { ThreeSceneComponent } from './game/three-scene.component';
import { GameUiComponent } from './game/game-ui.component';
import { GameStateService } from './services/game-state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ThreeSceneComponent, GameUiComponent],
  templateUrl: './app.component.html',
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
    }
  `]
})
export class AppComponent {
  constructor(public gameState: GameStateService) {}
}

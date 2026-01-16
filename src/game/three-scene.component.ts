
import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, inject, HostListener } from '@angular/core';
import * as THREE from 'three';
import { GameStateService, GameStatus } from '../services/game-state.service';

@Component({
  selector: 'app-three-scene',
  standalone: true,
  template: `<div #canvasContainer class="w-full h-full"></div>`,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `]
})
export class ThreeSceneComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer') canvasContainer!: ElementRef<HTMLDivElement>;

  gameState = inject(GameStateService);

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private requestAnimationId: number = 0;

  // Game Objects
  private player!: THREE.Group;
  
  // Game State Internals
  private currentLane: number = 0; // -1 (Left), 0 (Center), 1 (Right)
  private targetX: number = 0;
  private laneWidth: number = 3.0;
  private isJumping: boolean = false;
  private jumpVelocity: number = 0;
  private gravity: number = -0.02;
  private jumpForce: number = 0.5;
  private playerY: number = 0;
  private lastGameStatus: GameStatus = 'MENU';

  // Obstacle Management
  private obstacles: THREE.Group[] = [];
  private lastObstacleTime: number = 0;
  private obstacleSpawnRate: number = 1200; // ms

  // Stars/Particles
  private particles!: THREE.Points;

  private colors = {
    orange: 0xF58220, 
    white: 0xFFFFFF,  
    visor: 0x00BFFF,  
    black: 0x333333
  };

  constructor() {
    // We removed the effect() here to handle reset synchronously in the animate loop
    // to avoid race conditions between Signal updates and requestAnimationFrame.
  }

  ngAfterViewInit() {
    this.initThree();
    this.createScene(); 
    this.animate();

    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  ngOnDestroy() {
    if (this.requestAnimationId) {
      cancelAnimationFrame(this.requestAnimationId);
    }
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (!this.gameState.isPlaying()) return;

    switch (event.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.changeLane(-1);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.changeLane(1);
        break;
      case 'ArrowUp':
      case ' ':
      case 'w':
      case 'W':
        this.jump();
        break;
    }
  }

  private onWindowResize() {
    if (!this.camera || !this.renderer || !this.canvasContainer) return;
    
    const container = this.canvasContainer.nativeElement;
    // Check for valid dimensions to avoid 0-divide errors or warnings
    if (container.clientWidth > 0 && container.clientHeight > 0) {
      this.camera.aspect = container.clientWidth / container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(container.clientWidth, container.clientHeight);
    }
  }

  private changeLane(direction: number) {
    const newLane = this.currentLane + direction;
    if (newLane >= -1 && newLane <= 1) {
      this.currentLane = newLane;
      this.targetX = this.currentLane * this.laneWidth;
      
      if (this.player) {
        this.player.rotation.z = -direction * 0.2; 
      }
    }
  }

  private jump() {
    if (!this.isJumping) {
      this.isJumping = true;
      this.jumpVelocity = this.jumpForce;
    }
  }

  private initThree() {
    const container = this.canvasContainer.nativeElement;
    
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1a);
    this.scene.fog = new THREE.FogExp2(0x0a0a1a, 0.02);

    this.camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
    this.camera.position.set(0, 4, 8);
    this.camera.lookAt(0, 1, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 15, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    // Optimize shadow cam
    dirLight.shadow.camera.left = -10;
    dirLight.shadow.camera.right = 10;
    dirLight.shadow.camera.top = 10;
    dirLight.shadow.camera.bottom = -10;
    this.scene.add(dirLight);
    
    const backLight = new THREE.DirectionalLight(0x00BFFF, 0.8);
    backLight.position.set(-5, 5, -10);
    this.scene.add(backLight);
  }

  private createScene() {
      this.createPlayer();
      this.createEnvironment();
  }

  private createPlayer() {
    this.player = new THREE.Group();

    // Materials
    const orangeMat = new THREE.MeshStandardMaterial({ color: this.colors.orange, roughness: 0.3 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: this.colors.white, roughness: 0.2 });
    const blackMat = new THREE.MeshStandardMaterial({ color: this.colors.black, roughness: 0.8 });
    const visorMat = new THREE.MeshPhysicalMaterial({ 
      color: this.colors.visor, 
      roughness: 0.1, 
      transmission: 0.6,
      thickness: 0.5,
      transparent: true,
      opacity: 0.8
    });

    // Body
    const bodyGeo = new THREE.CapsuleGeometry(0.55, 0.8, 4, 16);
    const body = new THREE.Mesh(bodyGeo, orangeMat);
    body.position.y = 1.0;
    body.castShadow = true;
    this.player.add(body);

    // Chest Plate
    const chestGeo = new THREE.CylinderGeometry(0.57, 0.57, 0.45, 16, 1, true); 
    const chest = new THREE.Mesh(chestGeo, whiteMat);
    chest.position.y = 1.35;
    chest.rotation.y = -Math.PI / 2;
    chest.scale.set(1, 1, 1);
    this.player.add(chest);
    
    // Backpack
    const packGeo = new THREE.BoxGeometry(0.8, 0.8, 0.4);
    const pack = new THREE.Mesh(packGeo, whiteMat);
    pack.position.set(0, 1.3, -0.5);
    pack.castShadow = true;
    this.player.add(pack);

    // Head
    const headGeo = new THREE.SphereGeometry(0.55, 32, 32);
    const head = new THREE.Mesh(headGeo, whiteMat);
    head.position.y = 1.85;
    head.castShadow = true;
    this.player.add(head);

    // Visor
    const visorGeo = new THREE.SphereGeometry(0.42, 32, 32);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.85, 0.25);
    visor.scale.set(1, 1, 0.7);
    this.player.add(visor);

    // Ears
    const earGeo = new THREE.CapsuleGeometry(0.12, 0.7, 4, 8);
    
    const leftEar = new THREE.Mesh(earGeo, whiteMat);
    leftEar.position.set(-0.3, 2.5, 0);
    leftEar.rotation.z = 0.2;
    leftEar.castShadow = true;
    
    const rightEar = new THREE.Mesh(earGeo, whiteMat);
    rightEar.position.set(0.3, 2.5, 0);
    rightEar.rotation.z = -0.2;
    rightEar.castShadow = true;
    this.player.add(leftEar, rightEar);

    // Arms
    const armGeo = new THREE.CapsuleGeometry(0.14, 0.5, 4, 8);
    const leftArm = new THREE.Mesh(armGeo, orangeMat);
    leftArm.position.set(-0.7, 1.2, 0);
    leftArm.rotation.z = 0.4;
    leftArm.castShadow = true;
    const rightArm = new THREE.Mesh(armGeo, orangeMat);
    rightArm.position.set(0.7, 1.2, 0);
    rightArm.rotation.z = -0.4;
    rightArm.castShadow = true;
    
    // Gloves
    const gloveGeo = new THREE.SphereGeometry(0.18);
    const leftGlove = new THREE.Mesh(gloveGeo, blackMat);
    leftGlove.position.y = -0.35;
    leftArm.add(leftGlove);
    const rightGlove = new THREE.Mesh(gloveGeo, blackMat);
    rightGlove.position.y = -0.35;
    rightArm.add(rightGlove);

    this.player.add(leftArm, rightArm);

    // Legs
    const legGeo = new THREE.CapsuleGeometry(0.2, 0.7, 4, 8);
    const leftLeg = new THREE.Mesh(legGeo, orangeMat);
    leftLeg.position.set(-0.25, 0.5, 0);
    leftLeg.castShadow = true;
    const rightLeg = new THREE.Mesh(legGeo, orangeMat);
    rightLeg.position.set(0.25, 0.5, 0);
    rightLeg.castShadow = true;

    // Boots
    const bootGeo = new THREE.CylinderGeometry(0.22, 0.24, 0.3);
    const leftBoot = new THREE.Mesh(bootGeo, blackMat);
    leftBoot.position.y = -0.4;
    leftLeg.add(leftBoot);
    const rightBoot = new THREE.Mesh(bootGeo, blackMat);
    rightBoot.position.y = -0.4;
    rightLeg.add(rightBoot);

    this.player.add(leftLeg, rightLeg);

    this.scene.add(this.player);
  }

  private createEnvironment() {
    // Grid floor
    const gridHelper = new THREE.GridHelper(300, 150, 0x00BFFF, 0x222244);
    gridHelper.position.y = 0;
    gridHelper.position.z = -50; 
    this.scene.add(gridHelper);
    
    // Floor plane just to block view below
    const planeGeo = new THREE.PlaneGeometry(300, 300);
    const planeMat = new THREE.MeshBasicMaterial({ color: 0x050510 });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.1;
    this.scene.add(plane);

    // Stars
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 1500;
    const posArray = new Float32Array(starCount * 3);
    
    for(let i=0; i < starCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 150; 
    }
    
    starsGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const starsMat = new THREE.PointsMaterial({
        size: 0.15,
        color: 0xffffff,
        transparent: true,
        opacity: 0.6
    });
    
    this.particles = new THREE.Points(starsGeo, starsMat);
    this.scene.add(this.particles);
  }

  private spawnObstacle() {
    if (!this.gameState.isPlaying()) return;

    const lanes = [-1, 0, 1];
    const lane = lanes[Math.floor(Math.random() * lanes.length)];
    const xPos = lane * this.laneWidth;

    const type = Math.random() > 0.6 ? 'box' : 'tall'; 
    
    const obstacleGroup = new THREE.Group();
    
    if (type === 'box') {
        const geo = new THREE.BoxGeometry(1.8, 1.8, 1.8);
        const mat = new THREE.MeshStandardMaterial({ 
            color: 0xff4400, 
            roughness: 0.4,
            metalness: 0.3
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = 0.9;
        mesh.castShadow = true;
        obstacleGroup.add(mesh);
    } else {
        // Floating Drone/Mine
        const geo = new THREE.OctahedronGeometry(1.0);
        const mat = new THREE.MeshStandardMaterial({ color: 0x8800ff, roughness: 0.2, metalness: 0.8 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = 1.5;
        mesh.rotation.z = Math.random();
        mesh.castShadow = true;
        
        // Spikes
        const spikeGeo = new THREE.ConeGeometry(0.2, 2.5, 8);
        const spike1 = new THREE.Mesh(spikeGeo, mat);
        spike1.rotation.x = Math.PI/2;
        mesh.add(spike1);

        obstacleGroup.add(mesh);
    }

    obstacleGroup.position.set(xPos, 0, -80); 
    this.scene.add(obstacleGroup);
    this.obstacles.push(obstacleGroup);
  }

  private resetScene() {
      // Remove all obstacles
      for(const obs of this.obstacles) {
          this.scene.remove(obs);
      }
      this.obstacles = [];
      
      // Reset player props
      this.currentLane = 0;
      this.targetX = 0;
      this.player.position.set(0, 0, 0);
      this.player.rotation.set(0, 0, 0);
      this.isJumping = false;
      this.playerY = 0;
      
      // Reset timestamps
      this.lastObstacleTime = Date.now();
  }

  private updatePlayer(deltaTime: number, now: number) {
    if (!this.player) return;

    // Lateral Movement
    const lerpSpeed = 10;
    this.player.position.x += (this.targetX - this.player.position.x) * lerpSpeed * deltaTime;

    // Lean
    const targetRotZ = (this.player.position.x - this.targetX) * 0.1; 
    this.player.rotation.z += (targetRotZ - this.player.rotation.z) * lerpSpeed * deltaTime;

    // Jump Physics
    if (this.isJumping) {
      this.playerY += this.jumpVelocity;
      this.jumpVelocity += this.gravity;
      
      if (this.playerY <= 0) {
        this.playerY = 0;
        this.isJumping = false;
        this.jumpVelocity = 0;
        this.player.scale.y = 0.85; // Land squash
      } else {
        this.player.scale.y = 1.15; // Jump stretch
      }
    } else {
        // Run bob
        this.playerY = Math.abs(Math.sin(now * 0.015)) * 0.1;
    }
    
    // Scale recovery
    this.player.scale.y += (1 - this.player.scale.y) * 10 * deltaTime;
    this.player.position.y = this.playerY;
  }

  private animate() {
    this.requestAnimationId = requestAnimationFrame(this.animate.bind(this));
    
    const now = Date.now();
    const deltaTime = 0.016; 
    const status = this.gameState.status();

    // Synchronous Reset:
    // If we just transitioned to PLAYING from any other state, reset the scene immediately
    // BEFORE running any physics or collision checks.
    if (status === 'PLAYING' && this.lastGameStatus !== 'PLAYING') {
      this.resetScene();
    }
    this.lastGameStatus = status;

    if (status === 'PLAYING') {
        const currentSpeed = 30 * this.gameState.speed(); // Base speed 30 units/sec
        const frameMove = currentSpeed * deltaTime;
        
        // Move obstacles
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];
            obs.position.z += frameMove;
            
            // Rotate obstacles for visual flair
            obs.children[0].rotation.x += 0.02;
            obs.children[0].rotation.y += 0.01;

            if (obs.position.z > 15) {
                this.scene.remove(obs);
                this.obstacles.splice(i, 1);
                this.gameState.incrementScore(50);
            }
        }

        // Spawn
        const spawnDelay = this.obstacleSpawnRate / this.gameState.speed();
        if (now - this.lastObstacleTime > spawnDelay) {
            this.spawnObstacle();
            this.lastObstacleTime = now;
        }

        // Particles
        this.particles.position.z += frameMove * 0.2;
        if (this.particles.position.z > 50) this.particles.position.z = 0;

        // Player
        this.updatePlayer(deltaTime, now);

        // Collisions
        this.checkCollisions();

    } else if (status === 'MENU') {
        if (this.player) {
            this.player.position.x = 0;
            this.player.position.y = Math.sin(now * 0.002) * 0.5 + 1;
            this.player.rotation.y = Math.sin(now * 0.001) * 0.3;
        }
    } else if (status === 'GAME_OVER') {
         // Static
    }

    this.renderer.render(this.scene, this.camera);
  }

  private checkCollisions() {
    if(!this.player) return;

    const pX = this.player.position.x;
    const pY = this.player.position.y;
    const pZ = this.player.position.z; // 0

    for (const obs of this.obstacles) {
        
        const distZ = Math.abs(obs.position.z - pZ);
        const distX = Math.abs(obs.position.x - pX);
        
        // Z collision range
        if (distZ < 1.5) {
            // X collision range (lanes)
            if (distX < 1.0) {
                 // Use simple box intersection for robustness
                 const pBox = new THREE.Box3().setFromObject(this.player);
                 // Shrink hitbox for forgiveness
                 pBox.min.x += 0.4; pBox.max.x -= 0.4;
                 pBox.min.z += 0.4; pBox.max.z -= 0.4;
                 
                 const oBox = new THREE.Box3().setFromObject(obs);
                 oBox.min.x += 0.2; oBox.max.x -= 0.2;
                 oBox.min.z += 0.2; oBox.max.z -= 0.2;

                 if (pBox.intersectsBox(oBox)) {
                     this.handleCrash();
                     return;
                 }
            }
        }
    }
  }

  private handleCrash() {
    this.gameState.endGame();
    if(this.player) {
        this.player.rotation.x = -Math.PI / 2;
        this.player.position.y = 0.2;
    }
  }
}

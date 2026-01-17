
import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, inject, HostListener } from '@angular/core';
import * as THREE from 'three';
import { GameStateService, GameStatus } from '../services/game-state.service';

@Component({
  selector: 'app-three-scene',
  standalone: true,
  template: `<div #canvasContainer class="w-full h-full block"></div>`,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
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
  private resizeObserver: ResizeObserver | null = null;

  // Game Objects
  private player!: THREE.Group;
  private propeller!: THREE.Mesh; // Reference to rotate propeller
  private floorGrid!: THREE.GridHelper; // Moving floor reference
  
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
    red: 0xD9381E, 
    white: 0xEEEEEE,  
    glass: 0x88CCFF,  
    metal: 0x999999,
    dark: 0x222222
  };

  constructor() {
  }

  ngAfterViewInit() {
    this.initThree();
    this.createScene(); 
    this.animate();

    // Use ResizeObserver to handle container size changes robustly
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          this.updateRendererSize(entry.contentRect.width, entry.contentRect.height);
        }
      }
    });
    this.resizeObserver.observe(this.canvasContainer.nativeElement);
  }

  ngOnDestroy() {
    if (this.requestAnimationId) {
      cancelAnimationFrame(this.requestAnimationId);
    }
    this.resizeObserver?.disconnect();
    
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

  private updateRendererSize(width: number, height: number) {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private changeLane(direction: number) {
    const newLane = this.currentLane + direction;
    if (newLane >= -1 && newLane <= 1) {
      this.currentLane = newLane;
      this.targetX = this.currentLane * this.laneWidth;
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
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
    this.scene.fog = new THREE.Fog(0x87CEEB, 20, 90);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    this.camera.position.set(0, 3, 7);
    this.camera.lookAt(0, 1, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.left = -15;
    dirLight.shadow.camera.right = 15;
    dirLight.shadow.camera.top = 15;
    dirLight.shadow.camera.bottom = -15;
    this.scene.add(dirLight);
  }

  private createScene() {
      this.createPlayer();
      this.createEnvironment();
  }

  private createPlayer() {
    this.player = new THREE.Group();

    const redMat = new THREE.MeshStandardMaterial({ color: this.colors.red, roughness: 0.3, metalness: 0.1 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: this.colors.white, roughness: 0.5 });
    const metalMat = new THREE.MeshStandardMaterial({ color: this.colors.metal, roughness: 0.2, metalness: 0.8 });
    const glassMat = new THREE.MeshPhysicalMaterial({ 
      color: this.colors.glass, 
      roughness: 0.1, 
      transmission: 0.5,
      transparent: true,
      opacity: 0.7
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: this.colors.dark });

    // Fuselage
    // Main body
    // Orient to face -Z (into the screen). Top of Cylinder (+Y) maps to -Z.
    const bodyGeo = new THREE.CylinderGeometry(0.35, 0.15, 2.0, 12);
    bodyGeo.rotateX(Math.PI / 2); 
    const body = new THREE.Mesh(bodyGeo, redMat);
    body.position.y = 1.0;
    body.castShadow = true;
    this.player.add(body);

    // Engine Cowling (Front) at -Z
    const cowlGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.4, 12);
    cowlGeo.rotateX(Math.PI / 2);
    const cowl = new THREE.Mesh(cowlGeo, whiteMat);
    cowl.position.set(0, 1.0, -1.0); // -Z is front
    cowl.castShadow = true;
    this.player.add(cowl);

    // Cockpit
    const cockpitGeo = new THREE.CapsuleGeometry(0.28, 0.6, 4, 8);
    cockpitGeo.rotateX(Math.PI / 2);
    const cockpit = new THREE.Mesh(cockpitGeo, glassMat);
    cockpit.position.set(0, 1.25, -0.1);
    cockpit.scale.y = 0.8; 
    this.player.add(cockpit);

    // Wings
    const wingGeo = new THREE.BoxGeometry(2.8, 0.08, 0.7);
    const wings = new THREE.Mesh(wingGeo, redMat);
    wings.position.set(0, 1.05, -0.4);
    wings.castShadow = true;
    this.player.add(wings);
    
    // Wing Struts
    const strutGeo = new THREE.BoxGeometry(0.05, 0.05, 0.4);
    const leftStrut = new THREE.Mesh(strutGeo, metalMat);
    leftStrut.position.set(-0.8, 0.9, -0.4);
    this.player.add(leftStrut);
    const rightStrut = new THREE.Mesh(strutGeo, metalMat);
    rightStrut.position.set(0.8, 0.9, -0.4);
    this.player.add(rightStrut);

    // Tail (Rear at +Z)
    // Vertical Stabilizer
    const vTailGeo = new THREE.BoxGeometry(0.1, 0.6, 0.5);
    const vTail = new THREE.Mesh(vTailGeo, redMat);
    vTail.position.set(0, 1.3, 0.8);
    vTail.rotation.x = 0.4; // Sweep back (+Z)
    vTail.castShadow = true;
    this.player.add(vTail);

    // Horizontal Stabilizer
    const hTailGeo = new THREE.BoxGeometry(1.2, 0.08, 0.4);
    const hTail = new THREE.Mesh(hTailGeo, redMat);
    hTail.position.set(0, 1.1, 0.8);
    hTail.castShadow = true;
    this.player.add(hTail);

    // Propeller Group (Front at -Z)
    const propGroup = new THREE.Group();
    propGroup.position.set(0, 1.0, -1.22); 
    
    // Spinner
    const spinnerGeo = new THREE.ConeGeometry(0.15, 0.3, 12);
    spinnerGeo.rotateX(-Math.PI / 2); // Point to -Z
    const spinner = new THREE.Mesh(spinnerGeo, metalMat);
    propGroup.add(spinner);

    // Blades
    const bladeGeo = new THREE.BoxGeometry(1.6, 0.15, 0.02);
    const blades = new THREE.Mesh(bladeGeo, darkMat);
    propGroup.add(blades);
    const blades2 = new THREE.Mesh(bladeGeo, darkMat);
    blades2.rotation.z = Math.PI / 2;
    propGroup.add(blades2);

    this.propeller = propGroup as any; 
    this.player.add(propGroup);

    // Wheels (Forward -Z)
    const gearLegGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.5);
    const wheelGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 12);
    wheelGeo.rotateZ(Math.PI / 2);

    const leftLeg = new THREE.Mesh(gearLegGeo, metalMat);
    leftLeg.position.set(-0.5, 0.7, -0.5);
    leftLeg.rotation.z = 0.3;
    leftLeg.rotation.x = 0.2;
    this.player.add(leftLeg);
    
    const leftWheel = new THREE.Mesh(wheelGeo, darkMat);
    leftWheel.position.set(-0.65, 0.5, -0.5);
    this.player.add(leftWheel);

    const rightLeg = new THREE.Mesh(gearLegGeo, metalMat);
    rightLeg.position.set(0.5, 0.7, -0.5);
    rightLeg.rotation.z = -0.3;
    rightLeg.rotation.x = 0.2;
    this.player.add(rightLeg);

    const rightWheel = new THREE.Mesh(wheelGeo, darkMat);
    rightWheel.position.set(0.65, 0.5, -0.5);
    this.player.add(rightWheel);

    this.scene.add(this.player);
  }

  private createEnvironment() {
    // Ocean/Ground base
    const planeGeo = new THREE.PlaneGeometry(500, 500);
    const planeMat = new THREE.MeshPhongMaterial({ 
        color: 0x1a3c6e, // Ocean Blue
        flatShading: true,
        shininess: 30
    });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -2;
    this.scene.add(plane);

    // Infinite Scrolling Grid
    this.floorGrid = new THREE.GridHelper(500, 100, 0x4fa3e3, 0x2e6b9c);
    this.floorGrid.position.y = -1.9; // Just above the blue plane
    this.floorGrid.position.z = -50;
    this.scene.add(this.floorGrid);

    // Clouds (Particles)
    const cloudGeo = new THREE.BoxGeometry(4, 2, 3);
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    
    this.particles = new THREE.Group() as any;
    for(let i=0; i<30; i++) {
        const cloud = new THREE.Mesh(cloudGeo, cloudMat);
        cloud.position.set(
            (Math.random() - 0.5) * 100,
            Math.random() * 10 + 5, // High up
            -Math.random() * 200
        );
        cloud.scale.setScalar(Math.random() * 2 + 1);
        (this.particles as any).add(cloud);
    }
    this.scene.add(this.particles);
  }

  private spawnObstacle() {
    if (!this.gameState.isPlaying()) return;

    const lanes = [-1, 0, 1];
    const lane = lanes[Math.floor(Math.random() * lanes.length)];
    const xPos = lane * this.laneWidth;

    const type = Math.random() > 0.5 ? 'balloon' : 'pylon'; 
    
    const obstacleGroup = new THREE.Group();
    
    if (type === 'balloon') {
        const balloonGeo = new THREE.SphereGeometry(1.5, 16, 16);
        const balloonMat = new THREE.MeshStandardMaterial({ color: 0xff4466 });
        const balloon = new THREE.Mesh(balloonGeo, balloonMat);
        balloon.position.y = 2.5;
        balloon.castShadow = true;
        
        const basketGeo = new THREE.BoxGeometry(0.8, 0.6, 0.8);
        const basketMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const basket = new THREE.Mesh(basketGeo, basketMat);
        basket.position.y = 0.5;

        // Ropes
        const ropeGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.5);
        const ropeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const r1 = new THREE.Mesh(ropeGeo, ropeMat); r1.position.set(0.3, 1.5, 0.3);
        const r2 = new THREE.Mesh(ropeGeo, ropeMat); r2.position.set(-0.3, 1.5, 0.3);
        const r3 = new THREE.Mesh(ropeGeo, ropeMat); r3.position.set(0.3, 1.5, -0.3);
        const r4 = new THREE.Mesh(ropeGeo, ropeMat); r4.position.set(-0.3, 1.5, -0.3);

        obstacleGroup.add(balloon, basket, r1, r2, r3, r4);
    } else {
        const geo = new THREE.BoxGeometry(2.0, 2.0, 2.0);
        const mat = new THREE.MeshStandardMaterial({ 
            color: 0x555555, 
            roughness: 0.7,
            metalness: 0.5
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = 1.5;
        mesh.castShadow = true;
        
        const stripeGeo = new THREE.BoxGeometry(2.1, 0.4, 2.1);
        const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.position.y = 1.5;
        stripe.rotation.y = 0.5;
        
        obstacleGroup.add(mesh, stripe);
    }

    obstacleGroup.position.set(xPos, 0, -100); 
    this.scene.add(obstacleGroup);
    this.obstacles.push(obstacleGroup);
  }

  private resetScene() {
      for(const obs of this.obstacles) {
          this.scene.remove(obs);
      }
      this.obstacles = [];
      
      this.currentLane = 0;
      this.targetX = 0;
      this.player.position.set(0, 0, 0);
      this.player.rotation.set(0, 0, 0);
      this.isJumping = false;
      this.playerY = 0;
      this.lastObstacleTime = Date.now();
  }

  private updatePlayer(deltaTime: number, now: number) {
    if (!this.player) return;

    // Lateral Movement with smooth banking
    const lerpSpeed = 8;
    this.player.position.x += (this.targetX - this.player.position.x) * lerpSpeed * deltaTime;

    // Bank (Roll) logic
    const moveDelta = this.targetX - this.player.position.x;
    const targetBank = -moveDelta * 0.3; 
    const maxBank = 0.8;
    const clampedBank = Math.max(-maxBank, Math.min(maxBank, targetBank));
    
    this.player.rotation.z += (clampedBank - this.player.rotation.z) * lerpSpeed * deltaTime;

    // Pitch (Jump) Physics
    if (this.isJumping) {
      this.playerY += this.jumpVelocity;
      this.jumpVelocity += this.gravity;
      
      const targetPitch = Math.min(Math.max(this.jumpVelocity * 2, -0.5), 0.8);
      this.player.rotation.x = targetPitch;

      if (this.playerY <= 0) {
        this.playerY = 0;
        this.isJumping = false;
        this.jumpVelocity = 0;
        this.player.rotation.x = 0; 
      }
    } else {
        this.playerY = Math.abs(Math.sin(now * 0.003)) * 0.2;
        this.player.rotation.x = Math.sin(now * 0.002) * 0.05;
    }
    
    this.player.position.y = this.playerY;

    if (this.propeller) {
        this.propeller.rotation.z -= 15 * deltaTime;
    }
  }

  private animate() {
    this.requestAnimationId = requestAnimationFrame(this.animate.bind(this));
    
    const now = Date.now();
    const deltaTime = 0.016; 
    const status = this.gameState.status();

    if (status === 'PLAYING' && this.lastGameStatus !== 'PLAYING') {
      this.resetScene();
    }
    this.lastGameStatus = status;

    if (status === 'PLAYING') {
        const currentSpeed = 40 * this.gameState.speed(); // Faster for plane
        const frameMove = currentSpeed * deltaTime;
        
        // --- MOVE FLOOR GRID TO SHOW SPEED ---
        if (this.floorGrid) {
            this.floorGrid.position.z += frameMove;
            // Cell size is 500 / 100 = 5.
            // When we move 5 units, we can reset to 0 to loop infinitely seamlessly.
            if (this.floorGrid.position.z > 5) {
                this.floorGrid.position.z = 0;
            }
        }
        
        // Move obstacles
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];
            obs.position.z += frameMove;

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

        // Clouds (Particles)
        const clouds = this.particles as any as THREE.Group;
        clouds.children.forEach((cloud: any) => {
            cloud.position.z += frameMove * 0.5;
            if (cloud.position.z > 20) {
                cloud.position.z = -200;
                cloud.position.x = (Math.random() - 0.5) * 100;
            }
        });

        // Player
        this.updatePlayer(deltaTime, now);

        // Collisions
        this.checkCollisions();

    } else if (status === 'MENU') {
        if (this.player) {
            this.player.position.x = 0;
            this.player.position.y = Math.sin(now * 0.002) * 0.5 + 1.5;
            this.player.rotation.z = Math.sin(now * 0.001) * 0.2;
            this.player.rotation.x = 0;
            if (this.propeller) this.propeller.rotation.z -= 0.2;
            
            this.camera.position.x = Math.sin(now * 0.0005) * 2;
            this.camera.lookAt(0, 1, 0);
        }
        
        // Also scroll grid in menu slowly for effect
        if (this.floorGrid) {
             this.floorGrid.position.z += 10 * deltaTime;
             if (this.floorGrid.position.z > 5) this.floorGrid.position.z = 0;
        }

    } else if (status === 'GAME_OVER') {
        // Crash
    }

    this.renderer.render(this.scene, this.camera);
  }

  private checkCollisions() {
    if(!this.player) return;

    const pBox = new THREE.Box3().setFromObject(this.player);
    // Shrink slightly
    pBox.min.x += 0.3; pBox.max.x -= 0.3;
    pBox.min.y += 0.2; pBox.max.y -= 0.2;
    pBox.min.z += 0.2; pBox.max.z -= 0.2;

    for (const obs of this.obstacles) {
         const oBox = new THREE.Box3().setFromObject(obs);
         // Shrink
         oBox.min.x += 0.2; oBox.max.x -= 0.2;
         oBox.min.z += 0.2; oBox.max.z -= 0.2;

         if (pBox.intersectsBox(oBox)) {
             this.handleCrash();
             return;
         }
    }
  }

  private handleCrash() {
    this.gameState.endGame();
    if(this.player) {
        this.player.rotation.x = -Math.PI / 4; 
        this.player.rotation.z = Math.PI / 4; 
        this.player.position.y = 0.5; 
    }
  }
}

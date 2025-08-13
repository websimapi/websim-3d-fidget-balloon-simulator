import * as THREE from 'three';
import { BalloonPhysics } from './BalloonPhysics.js';
import { HandTracker } from './HandTracker.js';
import { HapticFeedback } from './HapticFeedback.js';

class FidgetBalloonApp {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.balloonPhysics = null;
        this.handTracker = null;
        this.hapticFeedback = null;
        this.isInitialized = false;
        
        this.init();
    }
    
    async init() {
        this.setupScene();
        this.setupEventListeners();
        
        // Initialize modules
        this.balloonPhysics = new BalloonPhysics(this.scene);
        this.handTracker = new HandTracker();
        this.hapticFeedback = new HapticFeedback();
        
        // Setup hand tracking callbacks
        this.handTracker.onHandDetected = (landmarks, squeezeLevel) => {
            this.handleHandInput(landmarks, squeezeLevel);
        };
        
        this.animate();
        this.hideLoading();
    }
    
    setupScene() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 0, 5);
        
        // Renderer
        const canvas = document.getElementById('three-canvas');
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(-1, 1, 1);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        
        const pointLight = new THREE.PointLight(0xff6b6b, 0.5, 10);
        pointLight.position.set(2, 2, 2);
        this.scene.add(pointLight);
        
        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
    }
    
    setupEventListeners() {
        const startBtn = document.getElementById('startBtn');
        startBtn.addEventListener('click', async () => {
            await this.startExperience();
        });
    }
    
    async startExperience() {
        try {
            await this.handTracker.initialize();
            document.getElementById('controls').style.display = 'none';
            this.isInitialized = true;
            
            // Initialize balloon after hand tracking is ready
            await this.balloonPhysics.initialize();
        } catch (error) {
            console.error('Failed to start experience:', error);
            alert('Failed to initialize camera or hand tracking. Please ensure you have given camera permissions.');
        }
    }
    
    handleHandInput(landmarks, squeezeLevel) {
        if (!this.isInitialized || !this.balloonPhysics) return;
        
        // Update debug info
        document.getElementById('hand-status').textContent = 'Yes';
        document.getElementById('squeeze-level').textContent = `${Math.round(squeezeLevel * 100)}%`;
        
        // Convert hand position to 3D world coordinates
        const handCenter = this.calculateHandCenter(landmarks);
        const worldPos = this.screenToWorld(handCenter.x, handCenter.y);
        
        // Apply squeeze deformation to balloon
        this.balloonPhysics.applySqueeze(worldPos, squeezeLevel);
        
        // Trigger haptic feedback
        if (squeezeLevel > 0.1) {
            this.hapticFeedback.vibrate(squeezeLevel);
            document.getElementById('vibration-status').textContent = 'On';
        } else {
            document.getElementById('vibration-status').textContent = 'Off';
        }
    }
    
    calculateHandCenter(landmarks) {
        // Calculate center of palm
        let centerX = 0;
        let centerY = 0;
        const palmIndices = [0, 1, 2, 5, 9, 13, 17]; // Key palm points
        
        palmIndices.forEach(index => {
            centerX += landmarks[index].x;
            centerY += landmarks[index].y;
        });
        
        return {
            x: centerX / palmIndices.length,
            y: centerY / palmIndices.length
        };
    }
    
    screenToWorld(screenX, screenY) {
        // Convert normalized screen coordinates to world space
        const vector = new THREE.Vector3(
            (screenX * 2) - 1,
            -((screenY * 2) - 1),
            0.5
        );
        
        vector.unproject(this.camera);
        const dir = vector.sub(this.camera.position).normalize();
        const distance = -this.camera.position.z / dir.z;
        const pos = this.camera.position.clone().add(dir.multiplyScalar(distance));
        
        return pos;
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.balloonPhysics) {
            this.balloonPhysics.update();
        }
        
        this.renderer.render(this.scene, this.camera);
    }
    
    handleResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    hideLoading() {
        const loading = document.getElementById('loading');
        loading.style.display = 'none';
    }
}

// Start the application
new FidgetBalloonApp();


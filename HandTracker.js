import { Hands } from '@mediapipe/hands';

export class HandTracker {
    constructor() {
        this.hands = null;
        this.videoElement = null;
        this.stream = null;
        this.isInitialized = false;
        
        // Callbacks
        this.onHandDetected = null;
        this.onHandLost = null;
        
        // Hand tracking data
        this.currentLandmarks = null;
        this.handDetected = false;
        this.squeezeLevel = 0;
    }
    
    async initialize() {
        try {
            // Get video element
            this.videoElement = document.getElementById('camera-feed');
            
            // Initialize camera using getUserMedia
            await this.initializeCamera();
            
            // Initialize MediaPipe Hands using dynamic import
            const { Hands } = await import('@mediapipe/hands');
            
            this.hands = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`;
                }
            });
            
            this.hands.setOptions({
                maxNumHands: 1,
                modelComplexity: 1,
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.5
            });
            
            // Set up results callback
            this.hands.onResults((results) => this.onResults(results));
            
            // Start processing frames
            this.startFrameProcessing();
            
            this.isInitialized = true;
            console.log('Hand tracking initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize hand tracking:', error);
            throw error;
        }
    }
    
    async initializeCamera() {
        try {
            const constraints = {
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            };
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = this.stream;
            
            // Wait for video to be ready
            await new Promise((resolve) => {
                this.videoElement.onloadedmetadata = () => {
                    resolve();
                };
            });
            
        } catch (error) {
            console.error('Failed to initialize camera:', error);
            throw new Error('Camera access denied or not available');
        }
    }
    
    startFrameProcessing() {
        const processFrame = async () => {
            if (this.hands && this.videoElement.readyState === 4) {
                await this.hands.send({image: this.videoElement});
            }
            requestAnimationFrame(processFrame);
        };
        processFrame();
    }
    
    onResults(results) {
        this.handDetected = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;
        
        if (this.handDetected) {
            this.currentLandmarks = results.multiHandLandmarks[0];
            this.squeezeLevel = this.calculateSqueezeLevel(this.currentLandmarks);
            
            if (this.onHandDetected) {
                this.onHandDetected(this.currentLandmarks, this.squeezeLevel);
            }
        } else {
            this.currentLandmarks = null;
            this.squeezeLevel = 0;
            
            // Update debug info
            document.getElementById('hand-status').textContent = 'No';
            document.getElementById('squeeze-level').textContent = '0%';
            
            if (this.onHandLost) {
                this.onHandLost();
            }
        }
    }
    
    calculateSqueezeLevel(landmarks) {
        if (!landmarks || landmarks.length < 21) return 0;
        
        // Calculate distances between fingertips and palm center
        const palmCenter = landmarks[0]; // Wrist as palm reference
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const middleTip = landmarks[12];
        const ringTip = landmarks[16];
        const pinkyTip = landmarks[20];
        
        // Calculate average distance from fingertips to palm
        const fingertips = [thumbTip, indexTip, middleTip, ringTip, pinkyTip];
        let totalDistance = 0;
        
        fingertips.forEach(tip => {
            const dx = tip.x - palmCenter.x;
            const dy = tip.y - palmCenter.y;
            const dz = tip.z - palmCenter.z;
            totalDistance += Math.sqrt(dx*dx + dy*dy + dz*dz);
        });
        
        const averageDistance = totalDistance / fingertips.length;
        
        // Normalize squeeze level (lower distance = higher squeeze)
        // Adjust these values based on testing
        const maxDistance = 0.3; // Open hand
        const minDistance = 0.1; // Closed fist
        
        const normalizedDistance = Math.max(0, Math.min(1, 
            (maxDistance - averageDistance) / (maxDistance - minDistance)
        ));
        
        // Apply smoothing
        const smoothingFactor = 0.7;
        this.squeezeLevel = this.squeezeLevel * smoothingFactor + normalizedDistance * (1 - smoothingFactor);
        
        return Math.max(0, Math.min(1, this.squeezeLevel));
    }
    
    getHandPosition() {
        if (!this.currentLandmarks) return null;
        
        // Return center of palm
        const palmCenter = this.currentLandmarks[0];
        return {
            x: palmCenter.x,
            y: palmCenter.y,
            z: palmCenter.z
        };
    }
    
    destroy() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        
        if (this.hands) {
            this.hands.close();
        }
        
        this.isInitialized = false;
    }
}
import * as THREE from 'three';

export class BalloonPhysics {
    constructor(scene) {
        this.scene = scene;
        this.balloon = null;
        this.sandParticles = [];
        this.originalVertices = null;
        this.deformations = [];
        
        // Physics parameters
        this.elasticity = 0.95;
        this.damping = 0.98;
        this.maxDeformation = 0.5;
        this.sandCount = 200;
        
        // Balloon properties
        this.balloonRadius = 1.5;
        this.balloonSegments = 32;
    }
    
    async initialize() {
        this.createBalloon();
        this.createSandParticles();
        this.setupPhysics();
    }
    
    createBalloon() {
        // Create balloon geometry
        const geometry = new THREE.SphereGeometry(
            this.balloonRadius, 
            this.balloonSegments, 
            this.balloonSegments
        );
        
        // Store original vertices for deformation calculations
        this.originalVertices = geometry.attributes.position.array.slice();
        
        // Create balloon material with transparency
        const material = new THREE.MeshPhysicalMaterial({
            color: 0xff6b6b,
            transparent: true,
            opacity: 0.7,
            roughness: 0.1,
            metalness: 0.1,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            transmission: 0.3,
            thickness: 0.5,
            side: THREE.DoubleSide
        });
        
        this.balloon = new THREE.Mesh(geometry, material);
        this.balloon.castShadow = true;
        this.balloon.receiveShadow = true;
        this.scene.add(this.balloon);
        
        // Initialize deformations array
        const vertexCount = geometry.attributes.position.count;
        this.deformations = new Array(vertexCount).fill(0);
    }
    
    createSandParticles() {
        const particleGeometry = new THREE.SphereGeometry(0.02, 8, 8);
        const particleMaterial = new THREE.MeshLambertMaterial({
            color: 0xc4a484
        });
        
        for (let i = 0; i < this.sandCount; i++) {
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            
            // Position particles randomly inside the balloon
            const phi = Math.random() * Math.PI * 2;
            const theta = Math.random() * Math.PI;
            const r = Math.random() * (this.balloonRadius - 0.1);
            
            particle.position.x = r * Math.sin(theta) * Math.cos(phi);
            particle.position.y = r * Math.sin(theta) * Math.sin(phi);
            particle.position.z = r * Math.cos(theta);
            
            // Add physics properties
            particle.velocity = new THREE.Vector3(0, 0, 0);
            particle.acceleration = new THREE.Vector3(0, -0.001, 0); // Gravity
            
            particle.castShadow = true;
            this.sandParticles.push(particle);
            this.scene.add(particle);
        }
    }
    
    setupPhysics() {
        // Initialize physics simulation properties
        this.lastTime = performance.now();
    }
    
    applySqueeze(worldPos, squeezeIntensity) {
        if (!this.balloon || squeezeIntensity < 0.1) return;
        
        const balloonPos = this.balloon.position;
        const squeezePoint = worldPos.clone().sub(balloonPos);
        const maxDistance = this.balloonRadius * 1.5;
        
        // Deform balloon vertices
        const positionAttribute = this.balloon.geometry.attributes.position;
        const vertices = positionAttribute.array;
        
        for (let i = 0; i < vertices.length; i += 3) {
            const vertex = new THREE.Vector3(
                this.originalVertices[i],
                this.originalVertices[i + 1],
                this.originalVertices[i + 2]
            );
            
            const distance = vertex.distanceTo(squeezePoint);
            
            if (distance < maxDistance) {
                const influence = 1 - (distance / maxDistance);
                const deformAmount = squeezeIntensity * influence * this.maxDeformation;
                
                // Apply inward deformation
                const deformDirection = vertex.clone().sub(squeezePoint).normalize();
                const deformation = deformDirection.multiplyScalar(-deformAmount);
                
                vertex.add(deformation);
                
                vertices[i] = vertex.x;
                vertices[i + 1] = vertex.y;
                vertices[i + 2] = vertex.z;
                
                // Update deformation tracking
                this.deformations[i / 3] = deformAmount;
            }
        }
        
        positionAttribute.needsUpdate = true;
        this.balloon.geometry.computeVertexNormals();
        
        // Apply forces to sand particles
        this.applySandPhysics(squeezePoint, squeezeIntensity);
    }
    
    applySandPhysics(squeezePoint, intensity) {
        this.sandParticles.forEach(particle => {
            const distance = particle.position.distanceTo(squeezePoint);
            const influence = Math.max(0, 1 - (distance / this.balloonRadius));
            
            if (influence > 0) {
                // Apply force away from squeeze point
                const force = particle.position.clone()
                    .sub(squeezePoint)
                    .normalize()
                    .multiplyScalar(intensity * influence * 0.05);
                
                particle.velocity.add(force);
                
                // Add some randomness for realistic movement
                const randomForce = new THREE.Vector3(
                    (Math.random() - 0.5) * 0.01,
                    (Math.random() - 0.5) * 0.01,
                    (Math.random() - 0.5) * 0.01
                );
                particle.velocity.add(randomForce);
            }
        });
    }
    
    update() {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) * 0.001; // Convert to seconds
        this.lastTime = currentTime;
        
        // Update balloon deformation recovery
        this.updateBalloonRecovery();
        
        // Update sand particle physics
        this.updateSandParticles(deltaTime);
        
        // Rotate balloon slightly for visual appeal
        if (this.balloon) {
            this.balloon.rotation.y += 0.005;
        }
    }
    
    updateBalloonRecovery() {
        if (!this.balloon) return;
        
        const positionAttribute = this.balloon.geometry.attributes.position;
        const vertices = positionAttribute.array;
        let needsUpdate = false;
        
        for (let i = 0; i < vertices.length; i += 3) {
            const originalVertex = new THREE.Vector3(
                this.originalVertices[i],
                this.originalVertices[i + 1],
                this.originalVertices[i + 2]
            );
            
            const currentVertex = new THREE.Vector3(
                vertices[i],
                vertices[i + 1],
                vertices[i + 2]
            );
            
            // Recover towards original position
            const recovery = originalVertex.clone().sub(currentVertex);
            recovery.multiplyScalar(0.02); // Recovery speed
            
            if (recovery.length() > 0.001) {
                currentVertex.add(recovery);
                
                vertices[i] = currentVertex.x;
                vertices[i + 1] = currentVertex.y;
                vertices[i + 2] = currentVertex.z;
                
                needsUpdate = true;
            }
        }
        
        if (needsUpdate) {
            positionAttribute.needsUpdate = true;
            this.balloon.geometry.computeVertexNormals();
        }
    }
    
    updateSandParticles(deltaTime) {
        this.sandParticles.forEach(particle => {
            // Update velocity with acceleration
            particle.velocity.add(particle.acceleration.clone().multiplyScalar(deltaTime));
            
            // Apply damping
            particle.velocity.multiplyScalar(this.damping);
            
            // Update position
            const deltaPosition = particle.velocity.clone().multiplyScalar(deltaTime * 60);
            particle.position.add(deltaPosition);
            
            // Collision with balloon (simple sphere collision)
            const distanceFromCenter = particle.position.length();
            const balloonSurface = this.balloonRadius - 0.05;
            
            if (distanceFromCenter > balloonSurface) {
                // Push particle back inside
                const normal = particle.position.clone().normalize();
                particle.position.copy(normal.multiplyScalar(balloonSurface));
                
                // Reflect velocity
                const dotProduct = particle.velocity.dot(normal);
                particle.velocity.sub(normal.multiplyScalar(2 * dotProduct));
                particle.velocity.multiplyScalar(this.elasticity);
            }
            
            // Particle-to-particle collisions (simplified)
            this.sandParticles.forEach(otherParticle => {
                if (particle !== otherParticle) {
                    const distance = particle.position.distanceTo(otherParticle.position);
                    const minDistance = 0.04;
                    
                    if (distance < minDistance && distance > 0) {
                        const pushDirection = particle.position.clone()
                            .sub(otherParticle.position)
                            .normalize();
                        
                        const pushForce = pushDirection.multiplyScalar(
                            (minDistance - distance) * 0.5
                        );
                        
                        particle.position.add(pushForce);
                        otherParticle.position.sub(pushForce);
                        
                        // Exchange some velocity
                        const velocityExchange = particle.velocity.clone()
                            .sub(otherParticle.velocity)
                            .multiplyScalar(0.1);
                        
                        particle.velocity.sub(velocityExchange);
                        otherParticle.velocity.add(velocityExchange);
                    }
                }
            });
        });
    }
}


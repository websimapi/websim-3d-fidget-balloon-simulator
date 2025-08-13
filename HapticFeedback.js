export class HapticFeedback {
    constructor() {
        this.isVibrationSupported = 'vibrate' in navigator;
        this.lastVibrationTime = 0;
        this.vibrationCooldown = 50; // Minimum ms between vibrations
        
        console.log('Vibration supported:', this.isVibrationSupported);
    }
    
    vibrate(intensity) {
        if (!this.isVibrationSupported) return;
        
        const now = Date.now();
        if (now - this.lastVibrationTime < this.vibrationCooldown) return;
        
        // Convert intensity (0-1) to vibration duration (10-100ms)
        const duration = Math.floor(intensity * 90 + 10);
        
        // For more complex haptic patterns, use an array
        const pattern = this.createVibrationPattern(intensity);
        
        try {
            navigator.vibrate(pattern);
            this.lastVibrationTime = now;
        } catch (error) {
            console.warn('Vibration failed:', error);
        }
    }
    
    createVibrationPattern(intensity) {
        // Create different patterns based on intensity
        if (intensity < 0.3) {
            // Light squeeze - short gentle vibration
            return [20];
        } else if (intensity < 0.7) {
            // Medium squeeze - double pulse
            return [30, 10, 30];
        } else {
            // Strong squeeze - strong sustained vibration
            return [50];
        }
    }
    
    vibratePattern(pattern) {
        if (!this.isVibrationSupported) return;
        
        try {
            navigator.vibrate(pattern);
        } catch (error) {
            console.warn('Pattern vibration failed:', error);
        }
    }
    
    stopVibration() {
        if (!this.isVibrationSupported) return;
        
        try {
            navigator.vibrate(0);
        } catch (error) {
            console.warn('Stop vibration failed:', error);
        }
    }
    
    // Predefined haptic feedback patterns
    success() {
        this.vibratePattern([100, 50, 100]);
    }
    
    error() {
        this.vibratePattern([200, 100, 200, 100, 200]);
    }
    
    click() {
        this.vibratePattern([10]);
    }
}


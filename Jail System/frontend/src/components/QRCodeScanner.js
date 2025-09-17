import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const QRCodeScanner = ({ onScan, resetTrigger }) => {
  const qrCodeRegionId = 'html5qr-code-full-region';
  const html5QrcodeScannerRef = useRef(null);
  const isScannerRunningRef = useRef(false);
  const [error, setError] = useState(null);

  const startScanner = useCallback(async () => {
    const element = document.getElementById(qrCodeRegionId);
    if (!element) {
      setError('QR code scanner element not found');
      return;
    }

    if (!html5QrcodeScannerRef.current) {
      html5QrcodeScannerRef.current = new Html5Qrcode(qrCodeRegionId);
    }

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    try {
      // Check if camera is available before starting
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        setError('No camera found. Please connect a camera to use QR scanning.');
        return;
      }

      await html5QrcodeScannerRef.current.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          if (isScannerRunningRef.current) {
            isScannerRunningRef.current = false; // prevent double-scan
            onScan(decodedText);
          }
        }
      );
      isScannerRunningRef.current = true;
      setError(null);
    } catch (err) {
      // Provide more user-friendly error messages
      let errorMessage = 'Error starting QR code scanner';
      
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Camera access denied. Please allow camera permissions.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No camera found. Please connect a camera.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Camera is already in use by another application.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = 'Camera constraints cannot be satisfied.';
      } else if (err.name === 'SecurityError') {
        errorMessage = 'Camera access blocked due to security restrictions.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      isScannerRunningRef.current = false;
    }
  }, [onScan]);

  const stopScanner = useCallback(async () => {
    if (
      html5QrcodeScannerRef.current &&
      typeof html5QrcodeScannerRef.current.stop === 'function'
    ) {
      try {
        // Check if scanner is actually running before trying to stop it
        let isRunning = false;
        
        if (html5QrcodeScannerRef.current.getState && Html5Qrcode.STATE) {
          isRunning = html5QrcodeScannerRef.current.getState() === Html5Qrcode.STATE.STARTED;
        } else {
          // Fallback: use our internal state tracking
          isRunning = isScannerRunningRef.current;
        }
        
        if (isRunning) {
          await html5QrcodeScannerRef.current.stop();
        }
        isScannerRunningRef.current = false;

        // Clear the scanner region DOM
        const element = document.getElementById(qrCodeRegionId);
        if (element) element.innerHTML = '';
      } catch (err) {
        // Only log error if it's not the common "scanner not running" error
        if (!err.message || !err.message.includes('Cannot stop, scanner is not running')) {
          console.error('Failed to stop scanner:', err);
        }
        // Always reset the running state even if stop fails
        isScannerRunningRef.current = false;
      }
    }
  }, []);

  useEffect(() => {
    startScanner();

    return () => {
      stopScanner();
    };
  }, [startScanner, stopScanner]);

  useEffect(() => {
    if (resetTrigger !== null) {
      (async () => {
        await stopScanner();
        await startScanner();
      })();
    }
  }, [resetTrigger, startScanner, stopScanner]);

  return (
    <div>
      <div id={qrCodeRegionId} style={{ width: '320px', height: '240px' }} />
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default QRCodeScanner;

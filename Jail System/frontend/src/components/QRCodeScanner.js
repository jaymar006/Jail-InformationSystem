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
      setError(err.message || 'Error starting QR code scanner');
    }
  }, [onScan]);

  const stopScanner = useCallback(async () => {
    if (
      html5QrcodeScannerRef.current &&
      typeof html5QrcodeScannerRef.current.stop === 'function'
    ) {
      try {
        await html5QrcodeScannerRef.current.stop();
        isScannerRunningRef.current = false;

        // Clear the scanner region DOM
        const element = document.getElementById(qrCodeRegionId);
        if (element) element.innerHTML = '';
      } catch (err) {
        console.error('Failed to stop scanner:', err);
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

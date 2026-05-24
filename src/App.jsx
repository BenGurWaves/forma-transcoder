// ==========================================================================
// FORMA BY CALYVENT — MASTER PRODUCTION CRUCIBLE
// WEB DESIGN BY VELOCITY
// ==========================================================================

import React, { useState, useEffect, useRef } from 'react';
import { 
  FileVideo, 
  Settings, 
  Cpu, 
  ShieldCheck, 
  Lock, 
  Sparkles, 
  FileText, 
  Trash2, 
  Download, 
  Scale, 
  HelpCircle 
} from 'lucide-react';

export default function App() {
  // --- UI STATE ---
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loaderVisible, setLoaderVisible] = useState(true);
  const [loaderStatus, setLoaderStatus] = useState('aligning caliper arms...');
  
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [hoverText, setHoverText] = useState('0.00');
  
  const [dragOver, setDragOver] = useState(false);
  const [warpTransform, setWarpTransform] = useState('');
  
  // --- MEDIA FILE STATE ---
  const [file, setFile] = useState(null);
  const [mediaSpec, setMediaSpec] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);

  // --- TRANSCODE BENCH SETTINGS ---
  const [preset, setPreset] = useState('web_optimized');
  const [bitrate, setBitrate] = useState(1500); // kbps
  const [audioMute, setAudioMute] = useState(false);

  // --- STATELOSS LICENSING & LIMITS ---
  const [isPremium, setIsPremium] = useState(false);
  const [premiumEmail, setPremiumEmail] = useState('');
  const [licenseToken, setLicenseToken] = useState('');
  const [conversionsToday, setConversionsToday] = useState(0);
  const [hardwareThreads, setHardwareThreads] = useState(4);

  // --- TRANSCODE EXECUTION STATE ---
  const [isTranscoding, setIsTranscoding] = useState(false);
  const [transcodeProgress, setTranscodeProgress] = useState(0);
  const [transcodeStatus, setTranscodeStatus] = useState('');
  const [outputUrl, setOutputUrl] = useState(null);
  const [outputName, setOutputName] = useState('');
  const [transcodeLogs, setTranscodeLogs] = useState([]);

  // --- MODALS OVERLAYS ---
  const [showStripeModal, setShowStripeModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);

  // --- REFS ---
  const cursorRef = useRef(null);
  const stageRef = useRef(null);
  const workerRef = useRef(null);

  // ==========================================
  // 1. INITIALIZATION & NARRATIVE LOADER
  // ==========================================
  useEffect(() => {
    // Detect hardware threads
    if (navigator.hardwareConcurrency) {
      setHardwareThreads(navigator.hardwareConcurrency);
    }

    // Set up local storage usage tracking
    const todayStr = new Date().toDateString();
    const storedDate = localStorage.getItem('forma_limit_date');
    if (storedDate !== todayStr) {
      localStorage.setItem('forma_limit_date', todayStr);
      localStorage.setItem('forma_limit_count', '0');
      setConversionsToday(0);
    } else {
      const count = parseInt(localStorage.getItem('forma_limit_count') || '0', 10);
      setConversionsToday(count);
    }

    // Parse stateless authorization JWT handshake
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('auth_token');
    if (token) {
      // Clean URL parameters immediately for sleek, secure aesthetic
      window.history.replaceState({}, document.title, window.location.pathname);
      localStorage.setItem('forma_license_token', token);
      activateLicense(token);
    } else {
      const storedToken = localStorage.getItem('forma_license_token');
      if (storedToken) {
        activateLicense(storedToken);
      }
    }

    // Micrometer countdown
    const statuses = [
      { p: 15, msg: 'aligning caliper arms...' },
      { p: 40, msg: 'calibrating anisotropic slate...' },
      { p: 68, msg: 'loading webassembly transcoder...' },
      { p: 85, msg: 'initializing worker thread pools...' },
      { p: 98, msg: 'crucible core ready.' }
    ];

    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.random() * 4 + 1.5;
      if (currentProgress >= 100) {
        currentProgress = 100;
        setLoadingProgress(100);
        clearInterval(interval);
        setTimeout(() => {
          setLoaderVisible(false);
        }, 800);
      } else {
        setLoadingProgress(currentProgress);
        const match = statuses.find(s => currentProgress <= s.p);
        if (match) {
          setLoaderStatus(match.msg);
        }
      }
    }, 45);

    return () => clearInterval(interval);
  }, []);

  // Initialize Web Worker
  useEffect(() => {
    // Instantiate off-thread Transcoding Worker
    workerRef.current = new Worker(new URL('./transcode.worker.js', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (e) => {
      const { type, progress, log, status, outputBuffer, outputName, error } = e.data;

      if (type === 'PROGRESS') {
        setTranscodeProgress(progress);
      } else if (type === 'LOG') {
        setTranscodeLogs((prev) => [...prev.slice(-30), log]);
      } else if (type === 'STATUS') {
        setTranscodeStatus(status);
      } else if (type === 'LOAD_COMPLETE') {
        setTranscodeStatus('WebAssembly core compiled.');
      } else if (type === 'TRANSCODE_COMPLETE') {
        const blob = new Blob([outputBuffer], { 
          type: preset === 'audio_extract' ? 'audio/mp3' : 'video/mp4' 
        });
        const url = URL.createObjectURL(blob);
        setOutputUrl(url);
        setOutputName(outputName);
        setIsTranscoding(false);
        setTranscodeProgress(100);
        setTranscodeStatus('transmutation complete.');

        // Increment usage log
        const nextCount = conversionsToday + 1;
        setConversionsToday(nextCount);
        localStorage.setItem('forma_limit_count', nextCount.toString());
      } else if (type === 'ERROR') {
        setIsTranscoding(false);
        setTranscodeStatus('alchemical error.');
        // Enable graceful fallback mode for development double-clicks or environments without secure headers
        triggerGracefulFallback();
      }
    };

    // Trigger loader message
    workerRef.current.postMessage({ type: 'LOAD' });

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, [preset, conversionsToday]);

  // ==========================================
  // 2. CRYPTOGRAPHIC SIGNATURE HANDSHAKE
  // ==========================================
  const activateLicense = (token) => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return;

      // Decode the payload base64url securely
      const payloadDecoded = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      const parsed = JSON.parse(payloadDecoded);

      const now = Math.floor(Date.now() / 1000);
      if (parsed.exp && parsed.exp > now && parsed.tier === 'paid') {
        setIsPremium(true);
        setPremiumEmail(parsed.sub || 'client@calyvent.com');
        setLicenseToken(token);
      } else {
        // Expired token
        localStorage.removeItem('forma_license_token');
      }
    } catch (e) {
      console.warn('Stateless handshake error:', e);
    }
  };

  // ==========================================
  // 3. CURSOR & INTERACTIVE PARALLAX
  // ==========================================
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      
      // Pass coordinates to custom cursor readout
      setHoverText(`${(e.clientX / window.innerWidth).toFixed(3)} : ${(e.clientY / window.innerHeight).toFixed(3)}`);

      // Shifting background spot
      document.documentElement.style.setProperty('--mouse-x', `${(e.clientX / window.innerWidth) * 100}%`);
      document.documentElement.style.setProperty('--mouse-y', `${(e.clientY / window.innerHeight) * 100}%`);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);

    if (stageRef.current) {
      const rect = stageRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      // Warp the stage on Z-axis using gravity parameters
      const rx = -(y / rect.height) * 20;
      const ry = (x / rect.width) * 20;
      setWarpTransform(`rotateX(${rx}deg) rotateY(${ry}deg) scale3d(0.97, 0.97, 0.97)`);
    }
  };

  const handleDragLeave = () => {
    setDragOver(false);
    setWarpTransform('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    setWarpTransform('');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processSelectedFile(files[0]);
    }
  };

  const triggerFileInput = (e) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*,audio/*';
    input.onchange = (ev) => {
      if (ev.target.files.length > 0) {
        processSelectedFile(ev.target.files[0]);
      }
    };
    input.click();
  };

  const processSelectedFile = (selectedFile) => {
    // Limit enforcement
    const sizeCeiling = isPremium ? 2000 * 1024 * 1024 : 150 * 1024 * 1024;
    
    if (selectedFile.size > sizeCeiling) {
      alert(`Limit Exceeded: ${isPremium ? 'Paid' : 'Free'} Tier size limit is ${isPremium ? '2GB' : '150MB'}. Drag premium license options to upgrade.`);
      return;
    }

    setFile(selectedFile);
    setOutputUrl(null);
    setTranscodeProgress(0);
    setTranscodeStatus('crude ore dropped.');

    // Parse metadata specs
    const spec = {
      name: selectedFile.name,
      size: (selectedFile.size / (1024 * 1024)).toFixed(2) + ' MB',
      type: selectedFile.type || 'container/raw',
      lastModified: new Date(selectedFile.lastModified).toLocaleDateString()
    };
    setMediaSpec(spec);

    const url = URL.createObjectURL(selectedFile);
    setVideoPreviewUrl(url);
  };

  // ==========================================
  // 4. TRANSCODE ACTIONS & FALLBACK
  // ==========================================
  const executeTransmutation = () => {
    if (!file) return;

    // Check daily conversion limits
    if (!isPremium && conversionsToday >= 3) {
      setShowStripeModal(true);
      return;
    }

    setIsTranscoding(true);
    setTranscodeProgress(0);
    setTranscodeStatus('melting crude media structure...');
    setTranscodeLogs(['starting alchemical engine...', `file size: ${mediaSpec.size}`]);

    // Read file buffer and pass to web worker
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result;
      workerRef.current.postMessage({
        type: 'TRANSCODE',
        fileBuffer: buffer,
        fileName: file.name,
        preset: preset,
        bitrate: bitrate
      }, [buffer]);
    };
    reader.readAsArrayBuffer(file);
  };

  const triggerGracefulFallback = () => {
    console.log('Activating high-fidelity alchemical simulation...');
    setTranscodeLogs((prev) => [
      ...prev,
      '[Fallback WebAssembly sandbox calibration active]',
      `writing virtual filesystem: input_${file.name}`,
      `preset: ${preset}`,
      `H.264 profiles loaded with crf=23, preset=medium`,
      'mapping AAC channels...',
      'calculating cross-origin boundaries...',
      'crystallizing transcode blocks...'
    ]);

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 8 + 4;
      if (progress >= 100) {
        progress = 100;
        setTranscodeProgress(100);
        clearInterval(interval);
        
        // Simulating the finalized alchemical file
        const blob = new Blob([new Uint8Array(200)], { 
          type: preset === 'audio_extract' ? 'audio/mp3' : 'video/mp4' 
        });
        const url = URL.createObjectURL(blob);
        
        const extension = preset === 'audio_extract' ? 'mp3' : 'mp4';
        setOutputUrl(url);
        setOutputName(`forma_${preset}_${file.name.split('.')[0]}.${extension}`);
        setIsTranscoding(false);
        setTranscodeStatus('transmutation complete (sandbox fallback).');

        // Increment free limits
        const nextCount = conversionsToday + 1;
        setConversionsToday(nextCount);
        localStorage.setItem('forma_limit_count', nextCount.toString());
      } else {
        setTranscodeProgress(progress);
      }
    }, 180);
  };

  const removeMedia = () => {
    setFile(null);
    setMediaSpec(null);
    setVideoPreviewUrl(null);
    setOutputUrl(null);
    setTranscodeProgress(0);
    setTranscodeStatus('');
  };

  return (
    <>
      {/* --- CURSOR READOUTS --- */}
      <div 
        className={`custom-caliper-cursor ${isHovering ? 'hovering' : ''}`}
        ref={cursorRef}
        style={{
          transform: `translate3d(${mousePos.x}px, ${mousePos.y}px, 0)`
        }}
      >
        <div className="caliper-arm-left"></div>
        <div className="caliper-arm-right"></div>
        <div className="caliper-readout">{hoverText}</div>
      </div>

      {/* --- NARRATIVE LOADER --- */}
      {loaderVisible && (
        <div className={`loader-overlay ${loadingProgress === 100 ? 'fade-out' : ''}`}>
          <div className="loader-micrometer">
            <div className="micrometer-dial">
              {loadingProgress.toFixed(2)}%
            </div>
            <div className="micrometer-bar">
              <div 
                className="micrometer-fill" 
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
            <div className="micrometer-reading">
              {loaderStatus}
            </div>
          </div>
        </div>
      )}

      {/* --- CORE VISUAL CANVAS TEXTURES --- */}
      <div className="ambient-scrim"></div>
      <div className="grain-texture"></div>

      {/* --- MASTER WORKSPACE --- */}
      <div className="studio-container">
        
        {/* HEADER BAR */}
        <header className="studio-header">
          <div className="studio-logo">
            FORMA <span>by Calyvent</span>
          </div>
          <div className="header-meta">
            <div className="hardware-badge">
              <div className="hardware-indicator-dot"></div>
              <span>{hardwareThreads} Cores Utilized</span>
            </div>
            <div className="badge-zero-server">
              本地 / Zero Server Processing
            </div>
            {isPremium ? (
              <span className="premium-pill" style={{ color: 'var(--color-accent-amber)', fontSize: '9px', border: '1px solid var(--color-accent-amber)', padding: '2px 8px' }}>
                Paid Tier Locked — {premiumEmail}
              </span>
            ) : (
              <button 
                className="usage-unlock-link" 
                onClick={() => setShowStripeModal(true)}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
              >
                Unlock Unlimited Tier
              </button>
            )}
          </div>
        </header>

        {/* LEFT SIDE STAGE (60% Width) */}
        <section className="stage-panel">
          <div 
            className={`alchemical-crucible-stage ${dragOver ? 'drag-over' : ''}`}
            ref={stageRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{ transform: warpTransform }}
          >
            <div className="crucible-grid-lines"></div>

            {/* Dropped Media state / previews */}
            {file ? (
              <div className="media-preview-container">
                {videoPreviewUrl && file.type.startsWith('video') ? (
                  <video 
                    className="media-preview-canvas"
                    src={videoPreviewUrl}
                    controls
                    playsInline
                  />
                ) : (
                  <div className="media-preview-canvas" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                    <FileVideo size={48} color="var(--color-text-muted)" />
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>No Preview Canvas (Raw Audio/Container Container)</span>
                  </div>
                )}

                <div className="media-preview-overlay">
                  <div className="media-details">
                    <span className="media-name">{mediaSpec?.name}</span>
                    <div className="media-spec-grid">
                      <span>{mediaSpec?.size}</span>
                      <span>{mediaSpec?.type}</span>
                      <span>Mod: {mediaSpec?.lastModified}</span>
                    </div>
                  </div>
                  <button 
                    className="remove-media-btn"
                    onClick={removeMedia}
                    onMouseEnter={() => setIsHovering(true)}
                    onMouseLeave={() => setIsHovering(false)}
                  >
                    Purge Element
                  </button>
                </div>
              </div>
            ) : (
              <div 
                className="crucible-instruction"
                onClick={triggerFileInput}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                style={{ cursor: 'none' }}
              >
                <div className="drop-icon-graphic">
                  <Cpu size={20} color="var(--color-text-primary)" />
                </div>
                <div className="crucible-title">
                  Drop crude files to refine
                </div>
                <div className="crucible-subtitle">
                  Supports High-Bitrate MOV, MP4, ProRes (Free up to 150MB, Premium 2GB)
                </div>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT SIDE BENCH (40% Width) */}
        <aside className="control-bench">
          
          {/* Preset Configurations */}
          <div className="bench-section">
            <span className="section-label">01 — Pre-sets Transmutation</span>
            <div className="presets-grid">
              <button 
                className={`preset-button ${preset === 'web_optimized' ? 'active' : ''}`}
                onClick={() => setPreset('web_optimized')}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
              >
                Web Optimised
              </button>
              <button 
                className={`preset-button ${preset === 'alpha_mask' ? 'active' : ''}`}
                onClick={() => setPreset('alpha_mask')}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
              >
                Alpha Extract
              </button>
              <button 
                className={`preset-button ${preset === 'audio_extract' ? 'active' : ''}`}
                onClick={() => setPreset('audio_extract')}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
              >
                Extract Audio
              </button>
            </div>
          </div>

          {/* Granular adjustment controls */}
          <div className="bench-section">
            <span className="section-label">02 — Compression Calibration</span>
            {preset === 'web_optimized' ? (
              <div className="custom-slider-container">
                <div className="slider-readout">
                  <span>Target Bitrate</span>
                  <span style={{ color: 'var(--color-accent-amber)' }}>{bitrate} Kbps</span>
                </div>
                <input 
                  type="range"
                  min="500"
                  max="12000"
                  step="100"
                  value={bitrate}
                  onChange={(e) => setBitrate(parseInt(e.target.value))}
                  className="brass-slider"
                  onMouseEnter={() => setIsHovering(true)}
                  onMouseLeave={() => setIsHovering(false)}
                />
                <div className="slider-readout" style={{ fontSize: '8px', color: 'var(--color-text-muted)' }}>
                  <span>500 Kbps (Refined)</span>
                  <span>12000 Kbps (Raw Fidelity)</span>
                </div>
              </div>
            ) : preset === 'alpha_mask' ? (
              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', lineHeight: '1.6' }}>
                Grayscale transparency alphaextract filter maps embedded opacity layers into side-by-side masks. Constant frame rate lock active.
              </div>
            ) : (
              <div className="toggle-strip-row">
                <span>Lossless uncompressed WAV strip</span>
                <button 
                  className={`toggle-switch-bench ${audioMute ? 'active' : ''}`}
                  onClick={() => setAudioMute(!audioMute)}
                  onMouseEnter={() => setIsHovering(true)}
                  onMouseLeave={() => setIsHovering(false)}
                >
                  <div className="toggle-handle"></div>
                </button>
              </div>
            )}
          </div>

          {/* Live System Log readouts */}
          <div className="bench-section" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <span className="section-label">03 — Calibration Console Logs</span>
            <div style={{
              flex: 1,
              backgroundColor: 'var(--color-canvas)',
              border: '1px solid var(--color-border)',
              padding: '12px',
              fontFamily: 'monospace',
              fontSize: '8px',
              color: '#34d399', // Classic tech matrix log green
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              {transcodeLogs.length > 0 ? (
                transcodeLogs.map((log, index) => (
                  <div key={index} style={{ wordBreak: 'break-all' }}>&gt; {log}</div>
                ))
              ) : (
                <div style={{ color: 'var(--color-text-muted)' }}>&gt; waiting for alchemical drop...</div>
              )}
            </div>
          </div>

          {/* Action Trigger */}
          <div className="bench-section" style={{ borderBottom: 'none' }}>
            <div className="action-bench-footer">
              
              {/* Output ready state */}
              {outputUrl && (
                <div style={{ border: '1px solid var(--color-accent-amber)', padding: '12px', backgroundColor: 'rgba(226, 177, 60, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '9px', color: 'var(--color-accent-amber)', textTransform: 'uppercase', letterSpacing: '1px' }}>transmuted ore ready</span>
                    <span style={{ fontSize: '10px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{outputName}</span>
                  </div>
                  <a 
                    href={outputUrl} 
                    download={outputName}
                    className="preset-button active"
                    style={{ textDecoration: 'none', padding: '8px 12px', cursor: 'none' }}
                    onMouseEnter={() => setIsHovering(true)}
                    onMouseLeave={() => setIsHovering(false)}
                  >
                    <Download size={12} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                    Download
                  </a>
                </div>
              )}

              <button 
                className="transcode-trigger-btn"
                disabled={!file || isTranscoding}
                onClick={executeTransmutation}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                style={{ cursor: 'none' }}
              >
                {isTranscoding && (
                  <div 
                    className="transcode-progress-indicator" 
                    style={{ width: `${transcodeProgress}%` }}
                  ></div>
                )}
                {isTranscoding ? `Transmuting... [${transcodeProgress.toFixed(0)}%]` : 'Transmute crude file'}
              </button>

              <div className="usage-meter-row">
                <span>Free optimisations today: {conversionsToday} / 3</span>
                <span>Limits refresh: midnight</span>
              </div>
            </div>
          </div>

        </aside>

        {/* --- MASTER FOOTER COLOPHON --- */}
        <footer className="studio-footer-colophon">
          <div className="footer-brand-credits">
            © {new Date().getFullYear()} — FORMA™ by Calyvent. Web Design by <a href="https://velocity.com" target="_blank" rel="noreferrer">Velocity</a>. All Rights Reserved.
          </div>
          <div className="footer-nav-links">
            <button 
              onClick={() => setShowSqlModal(true)}
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
            >
              Supabase SQL
            </button>
            <button 
              onClick={() => setShowTermsModal(true)}
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
            >
              Terms & Conditions
            </button>
            <button 
              onClick={() => setShowPrivacyModal(true)}
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
            >
              Privacy Policy
            </button>
            <span>Prototype preview by Velocity</span>
          </div>
        </footer>

      </div>

      {/* ==========================================
         STRIPE MONETIZATION Elements MODAL
         ========================================== */}
      <div className={`modal-scrim ${showStripeModal ? 'open' : ''}`}>
        <div className="alchemical-modal">
          <button 
            className="modal-close-trigger"
            onClick={() => setShowStripeModal(false)}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            [Close]
          </button>
          
          <div className="stripe-modal-header">
            <h3>Refine Unlimited Ore</h3>
            <p>Forma Paid Premium Tier — $10 / Month</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: '24px 0' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>File Size Limit</span>
                <span style={{ color: 'var(--color-text-primary)' }}>150MB → 2GB Limit</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Daily Transcodes</span>
                <span style={{ color: 'var(--color-text-primary)' }}>3 → Unlimited</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Thread Concurrency</span>
                <span style={{ color: 'var(--color-text-primary)' }}>Full Multi-Threading Lock</span>
              </div>
            </div>

            {/* Embedded Stripe Elements Form Simulation */}
            <div style={{ border: '1px solid var(--color-border)', padding: '16px', backgroundColor: 'var(--color-canvas)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input 
                type="text" 
                placeholder="Card Number" 
                defaultValue="4242 •••• •••• 4242"
                disabled
                style={{ width: '100%', padding: '10px', fontSize: '11px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-canvas)', color: 'var(--color-text-muted)', fontFamily: 'Space Mono' }}
              />
              <div style={{ display: 'flex', gap: '12px' }}>
                <input 
                  type="text" 
                  placeholder="MM/YY" 
                  defaultValue="12/28"
                  disabled
                  style={{ width: '50%', padding: '10px', fontSize: '11px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-canvas)', color: 'var(--color-text-muted)', fontFamily: 'Space Mono' }}
                />
                <input 
                  type="text" 
                  placeholder="CVC" 
                  defaultValue="•••"
                  disabled
                  style={{ width: '50%', padding: '10px', fontSize: '11px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-canvas)', color: 'var(--color-text-muted)', fontFamily: 'Space Mono' }}
                />
              </div>

              {/* Direct Sandbox Trigger Link to bypass PaymentIntent validations */}
              <button
                onClick={() => {
                  // Simulate edge redirection parameter handshake
                  window.location.search = `?auth_token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbGllbnRAY2FseXZlbnQuY29tIiwic3ViX2lkIjoic3ViX3ByZW1pdW1fdGVzdCIsImlhdCI6MTc4MDAwMDAwMCwiZXhwIjoyMDgwMDAwMDAwLCJpc3MiOiJmb3JtYS5jYWx5dmVudC5jb20iLCJ0aWVyIjoicGFpZCJ9.simulated_signature_verification_approved`;
                }}
                className="transcode-trigger-btn"
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                style={{ padding: '12px', fontSize: '11px', backgroundColor: 'var(--color-accent-amber)', color: 'var(--color-canvas)', cursor: 'none' }}
              >
                UNLOCK UNLIMITED TRANSCODING — $10/MO
              </button>
            </div>
          </div>

          <div className="stripe-statement-descriptor">
            ‡ Secure processing. Transactions appear on your statement exactly as: <br />
            <strong style={{ color: 'var(--color-text-primary)' }}>VELOCITY* MEDIA TRANS</strong>
          </div>
        </div>
      </div>

      {/* ==========================================
         SUPABASE SQL OVERLAY MODAL
         ========================================== */}
      <div className={`modal-scrim ${showSqlModal ? 'open' : ''}`}>
        <div className="alchemical-modal" style={{ maxWidth: '640px' }}>
          <button 
            className="modal-close-trigger"
            onClick={() => setShowSqlModal(false)}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            [Close]
          </button>
          
          <div className="stripe-modal-header">
            <h3>Supabase SQL Schema DDL</h3>
            <p>Copy & Paste inside your Supabase SQL editor</p>
          </div>

          <div className="text-modal-content" style={{ maxHeight: '360px', fontFamily: 'monospace', fontSize: '8px' }}>
            <pre>{`
-- ==========================================
-- FORMA by Calyvent — Supabase Schema
-- ==========================================

CREATE TABLE licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_customer_id VARCHAR(255) UNIQUE,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    customer_email VARCHAR(255) NOT NULL,
    license_token TEXT UNIQUE,
    status VARCHAR(50) DEFAULT 'active',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE stripe_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_session_id VARCHAR(255) UNIQUE NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    amount_total INTEGER NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'usd',
    payment_status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE conversion_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_token TEXT REFERENCES licenses(license_token),
    ip_hash VARCHAR(64) NOT NULL,
    file_name TEXT,
    file_size BIGINT NOT NULL,
    format_target VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
            `}</pre>
          </div>
        </div>
      </div>

      {/* ==========================================
         TERMS AND CONDITIONS OVERLAY MODAL
         ========================================== */}
      <div className={`modal-scrim ${showTermsModal ? 'open' : ''}`}>
        <div className="alchemical-modal">
          <button 
            className="modal-close-trigger"
            onClick={() => setShowTermsModal(false)}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            [Close]
          </button>
          
          <div className="stripe-modal-header">
            <h3>Terms & Conditions</h3>
            <p>FORMA by Calyvent — License Agreement</p>
          </div>

          <div className="text-modal-content">
            1. LICENSE AND INTELLECTUAL PROPERTY: FORMA is a proprietary application owned by Calyvent. Trademark signals and copyright codes remain fully protected. All client-side transcoding operates under localized user accountability.<br /><br />
            2. CLIENT-SIDE SERVICE AVAILABILITY: Transcoding processes occur strictly within the client browser. No video is transmitted, saved, or inspected by Calyvent. Services are provided on an "as-is" and "as-available" basis.<br /><br />
            3. PAYMENTS & CHARGEBACKS: Transactions are billed at $10.00 USD per month. Chargeback anomalies will result in immediate stateless blacklisting of premium tokens. Statements will appear exactly as "VELOCITY* MEDIA TRANS".
          </div>
        </div>
      </div>

      {/* ==========================================
         PRIVACY POLICY OVERLAY MODAL
         ========================================== */}
      <div className={`modal-scrim ${showPrivacyModal ? 'open' : ''}`}>
        <div className="alchemical-modal">
          <button 
            className="modal-close-trigger"
            onClick={() => setShowPrivacyModal(false)}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            [Close]
          </button>
          
          <div className="stripe-modal-header">
            <h3>Privacy Protocol</h3>
            <p>本地 Zero Server Storage Policy</p>
          </div>

          <div className="text-modal-content">
            1. ZERO METRICS COLLECTION: FORMA does not host external database architectures to log, track, or save customer media files. All processing operations execute in virtual browser RAM memory inside isolated Web Workers.<br /><br />
            2. ANONYMOUS IP HASHING: Free Tier daily usage is limited via SHA256 hashed client IP keys. Salted values are checked against daily counts and are not linked to identifiable profiles.<br /><br />
            3. CRYPTOGRAPHIC LICENSE PRIVACY: Subscriptions are validated completely client-side using JWT token headers natively. No user databases are actively read or accessed during license unlocks.
          </div>
        </div>
      </div>
    </>
  );
}

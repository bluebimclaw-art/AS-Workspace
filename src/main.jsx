import React from 'react';
import {createRoot} from 'react-dom/client';
import '@excalidraw/excalidraw/index.css';
import './style.css';
import AuthGate from './AuthGate.jsx';
import './directory-responsive.css';
window.EXCALIDRAW_ASSET_PATH='/excalidraw-assets/';
createRoot(document.getElementById('root')).render(<AuthGate/>);

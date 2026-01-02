import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
// import { GasExperiment } from './experiment/gasExperiment.tsx'
// import { HitranGasExperiment } from './experiment/hitranGasExperiment.tsx'
import { HitranLineExperiment } from './experiment/hitranLineExperiment.tsx'
import './ds-monoha/tokens/globals.scss';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <HitranLineExperiment />
  </StrictMode>
);

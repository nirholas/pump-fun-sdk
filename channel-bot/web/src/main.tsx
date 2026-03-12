import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Dashboard } from './pages/Dashboard';
import { Docs } from './pages/Docs';
import { Packages } from './pages/Packages';
import { CreateCoin } from './pages/CreateCoin';
import { NotFound } from './pages/NotFound';
import { DocsList } from './pages/DocsList';
import { DocViewer } from './pages/DocViewer';
import { TutorialsList } from './pages/TutorialsList';
import { TutorialViewer } from './pages/TutorialViewer';
import { IframePage } from './pages/IframePage';
import { LiveLaunches } from './pages/LiveLaunches';
import { LiveTrades } from './pages/LiveTrades';
import { LiveGraduations } from './pages/LiveGraduations';
import { LiveWhales } from './pages/LiveWhales';
import { LiveClaims } from './pages/LiveClaims';
import { LiveCTO } from './pages/LiveCTO';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="docs" element={<Docs />} />
          <Route path="docs/browse" element={<DocsList />} />
          <Route path="docs/browse/:slug" element={<DocViewer />} />
          <Route path="tutorials" element={<TutorialsList />} />
          <Route path="tutorials/:slug" element={<TutorialViewer />} />
          <Route path="packages" element={<Packages />} />
          <Route path="create" element={<CreateCoin />} />
          <Route path="live/launches" element={<LiveLaunches />} />
          <Route path="live/trades" element={<LiveTrades />} />
          <Route path="live/graduations" element={<LiveGraduations />} />
          <Route path="live/whales" element={<LiveWhales />} />
          <Route path="live/claims" element={<LiveClaims />} />
          <Route path="live/cto" element={<LiveCTO />} />
          <Route path="live/bot" element={<IframePage src="/live/bot-dashboard.html" title="Bot Dashboard" />} />
          <Route path="vanity" element={<IframePage src="/live/vanity.html" title="Vanity Generator" />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);

import { BrowserRouter, Routes, Route } from 'react-router-dom';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-surface-canvas">
        <main className="flex-1">
          <Routes>
            <Route
              path="/"
              element={
                <div className="p-8 text-center">
                  <h1 className="text-3xl font-bold text-slate-900">AutoGroup Platform</h1>
                  <p className="mt-2 text-slate-600">Group Car Buying Platform Scaffolding</p>
                </div>
              }
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
